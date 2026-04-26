import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { saveEditalBuffer } from "@/lib/edital-storage";
import { findOrCreateJobRole, findOrCreateSubject } from "@/lib/import/auto-create-meta";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

type StageInDraft = {
  name: string;
  dateStart?: string | null;
  dateEnd?: string | null;
};

type JobRoleInDraft = {
  name: string;
  subjects?: Array<{ name: string }> | null;
};

type Draft = {
  name: string;
  organization?: string | null;
  examBoard?: { acronym: string; name?: string | null } | null;
  cities?: Array<{ name: string; state: string }> | null;
  jobRoles?: Array<JobRoleInDraft> | null;
  stages?: Array<StageInDraft> | null;
  examDate?: string | null;
  description?: string | null;
  notes?: string | null;
};

function norm(s: unknown) {
  return typeof s === "string" ? s.trim() : "";
}

async function upsertExamBoard(examBoard: Draft["examBoard"]) {
  if (!examBoard?.acronym) return null;
  const acronym = norm(examBoard.acronym).toUpperCase();
  if (!acronym) return null;
  const name = norm(examBoard.name) || acronym;
  return prisma.examBoard.upsert({
    where: { acronym },
    update: { name },
    create: { acronym, name },
    select: { id: true },
  });
}

async function ensureCity(c: { name: string; state: string } | undefined) {
  if (!c) return null;
  const name = norm(c.name);
  const state = norm(c.state).toUpperCase();
  if (!name || !state) return null;
  const existing = await prisma.city.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, state },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.city.create({ data: { name, state }, select: { id: true } });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: competitionId } = await params;

  let body: { draft: Draft; pdfBase64: string } | null = null;
  try {
    body = (await req.json()) as { draft: Draft; pdfBase64: string };
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const draft = body?.draft;
  const pdfBase64 = body?.pdfBase64;
  if (!draft || !draft.name || typeof pdfBase64 !== "string" || pdfBase64.length < 50) {
    return NextResponse.json({ error: "draft e pdfBase64 são obrigatórios" }, { status: 400 });
  }

  const bytes = Buffer.from(pdfBase64, "base64");

  try {
    const existing = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });

    const examBoard = await upsertExamBoard(draft.examBoard);
    const primaryCity = await ensureCity(draft.cities?.[0]);
    if (!primaryCity?.id) {
      return NextResponse.json(
        { error: "Não foi possível identificar cidade/estado no edital. Ajuste no rascunho e tente novamente." },
        { status: 400 },
      );
    }

    type ResolvedJobRole = { jobRoleId: string; subjectIds: string[] };
    const resolvedJobRoles: ResolvedJobRole[] = [];

    for (const jr of draft.jobRoles ?? []) {
      const jrName = norm(jr.name);
      if (!jrName) continue;
      const jobRoleId = await findOrCreateJobRole(jrName, prisma);
      if (!jobRoleId) continue;
      const subjectIds: string[] = [];
      for (const s of jr.subjects ?? []) {
        const sName = norm(s.name);
        if (!sName) continue;
        const subjectId = await findOrCreateSubject(sName, prisma);
        if (subjectId) subjectIds.push(subjectId);
      }
      resolvedJobRoles.push({ jobRoleId, subjectIds });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1) Atualiza cabeçalho do concurso (mantém o mesmo ID; não cria duplicado)
      await tx.competition.update({
        where: { id: competitionId },
        data: {
          name: draft.name.trim(),
          cityId: primaryCity.id,
          organization: norm(draft.organization) || null,
          examBoardId: examBoard?.id ?? null,
          examBoardDefined: Boolean(examBoard?.id),
          examDate: draft.examDate ? new Date(draft.examDate) : null,
          description: [norm(draft.description), norm(draft.notes)].filter(Boolean).join("\n\n") || null,
          // editalUrl será preenchido após salvar o PDF
        },
        select: { id: true },
      });

      // 2) Substitui cargos + matérias do concurso
      await tx.competitionJobRoleSubject.deleteMany({ where: { competitionId } });
      await tx.competitionJobRole.deleteMany({ where: { competitionId } });
      await tx.competitionSubject.deleteMany({ where: { competitionId } });

      for (const { jobRoleId, subjectIds } of resolvedJobRoles) {
        await tx.competitionJobRole.upsert({
          where: { competitionId_jobRoleId: { competitionId, jobRoleId } },
          create: { competitionId, jobRoleId },
          update: {},
        });
        for (const subjectId of subjectIds) {
          await tx.competitionJobRoleSubject.create({
            data: { competitionId, jobRoleId, subjectId },
          }).catch(() => {});
        }
      }

      const allSubjectIds = [...new Set(resolvedJobRoles.flatMap((r) => r.subjectIds))];
      if (allSubjectIds.length > 0) {
        await tx.competitionSubject.createMany({
          data: allSubjectIds.map((subjectId) => ({ competitionId, subjectId })),
          skipDuplicates: true,
        });
      }

      // 3) Substitui etapas (cronograma)
      await tx.competitionStage.deleteMany({ where: { competitionId } });
      const cleanStages = (draft.stages ?? [])
        .map((stage) => {
          const stageName = norm(stage.name);
          if (!stageName) return null;
          const dateNote = stage.dateStart
            ? stage.dateEnd
              ? `${stage.dateStart} a ${stage.dateEnd}`
              : stage.dateStart
            : null;
          return { name: stageName, description: dateNote };
        })
        .filter(Boolean) as Array<{ name: string; description: string | null }>;

      if (cleanStages.length > 0) {
        await tx.competitionStage.createMany({
          data: cleanStages.map((s, order) => ({
            competitionId,
            name: s.name,
            order,
            description: s.description,
          })),
        });
      }

      // 4) Salva o PDF do edital e vincula ao concurso
      await saveEditalBuffer(competitionId, bytes);
      const editalUrl = `/api/competitions/${competitionId}/edital`;
      await tx.competition.update({
        where: { id: competitionId },
        data: { editalUrl },
        select: { id: true, editalUrl: true },
      });

      return { id: competitionId, editalUrl };
    }, { timeout: 20000 });

    return NextResponse.json({ competitionId: updated.id, editalUrl: updated.editalUrl }, { status: 200 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: `Erro Prisma: ${e.code}` }, { status: 500 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao atualizar concurso com edital";
    console.error("[competitions/:id/edital/confirm]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

