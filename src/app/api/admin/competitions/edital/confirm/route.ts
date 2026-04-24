import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { saveEditalBuffer } from "@/lib/edital-storage";
import { findOrCreateSubject, findOrCreateJobRole } from "@/lib/import/auto-create-meta";
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

function slugifyBase(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
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
  const existing = await prisma.city.findFirst({ where: { name: { equals: name, mode: "insensitive" }, state } });
  if (existing) return { id: existing.id };
  return prisma.city.create({ data: { name, state }, select: { id: true } });
}

async function ensureCities(cities: Array<{ name: string; state: string }> | null | undefined) {
  const out: Array<{ id: string }> = [];
  const seen = new Set<string>();
  for (const c of cities ?? []) {
    const name = norm(c.name);
    const state = norm(c.state).toUpperCase();
    if (!name || !state) continue;
    const key = `${name.toLowerCase()}|${state}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = await ensureCity({ name, state });
    if (row?.id) out.push({ id: row.id });
  }
  return out;
}

/** Constrói um texto resumido do edital para usar como contexto no Quiz da IA */
function buildEditalText(draft: Draft): string {
  const lines: string[] = [];
  lines.push(`CONCURSO: ${draft.name}`);
  if (draft.organization) lines.push(`ÓRGÃO: ${draft.organization}`);
  if (draft.examBoard?.acronym) lines.push(`BANCA: ${draft.examBoard.acronym}${draft.examBoard.name ? ` — ${draft.examBoard.name}` : ""}`);

  const cityLine = (draft.cities ?? [])
    .map((c) => `${norm(c.name)}/${norm(c.state).toUpperCase()}`)
    .filter(Boolean)
    .join(", ");
  if (cityLine) lines.push(`CIDADE: ${cityLine}`);
  if (draft.examDate) lines.push(`DATA DA PROVA: ${draft.examDate}`);
  if (draft.description) lines.push(`\nDESCRIÇÃO:\n${draft.description}`);
  if (draft.notes) lines.push(`\nOBSERVAÇÕES:\n${draft.notes}`);

  if ((draft.stages ?? []).length > 0) {
    lines.push("\nCRONOGRAMA / ETAPAS:");
    for (const s of draft.stages ?? []) {
      const n = norm(s.name);
      if (!n) continue;
      const dateStr = s.dateStart
        ? s.dateEnd
          ? `${s.dateStart} a ${s.dateEnd}`
          : s.dateStart
        : "";
      lines.push(`  • ${n}${dateStr ? ` — ${dateStr}` : ""}`);
    }
  }

  if ((draft.jobRoles ?? []).length > 0) {
    lines.push("\nCARGOS E MATÉRIAS:");
    for (const jr of draft.jobRoles ?? []) {
      const jn = norm(jr.name);
      if (!jn) continue;
      lines.push(`  Cargo: ${jn}`);
      const subjects = (jr.subjects ?? []).map((s) => norm(s.name)).filter(Boolean);
      if (subjects.length > 0) {
        lines.push(`    Matérias: ${subjects.join(", ")}`);
      }
    }
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

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
    const examBoard = await upsertExamBoard(draft.examBoard);
    const cities = await ensureCities(draft.cities);
    const primaryCity = cities[0] ?? null;
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

    const base = slugifyBase(draft.name);
    const slug = `${base || "concurso"}-${Date.now()}`;
    const editalText = buildEditalText(draft);

    const created = await prisma.$transaction(async (tx) => {
      const competition = await tx.competition.create({
        data: {
          name: draft.name.trim(),
          slug,
          cityId: primaryCity.id,
          organization: norm(draft.organization) || null,
          examBoardId: examBoard?.id ?? null,
          examBoardDefined: Boolean(examBoard?.id),
          examDate: draft.examDate ? new Date(draft.examDate) : null,
          status: "UPCOMING",
          description: [norm(draft.description), norm(draft.notes)].filter(Boolean).join("\n\n") || null,
          editalUrl: null,
          editalText,
        },
        select: { id: true },
      });

      // CompetitionJobRole + CompetitionJobRoleSubject
      for (const { jobRoleId, subjectIds } of resolvedJobRoles) {
        await tx.competitionJobRole.upsert({
          where: { competitionId_jobRoleId: { competitionId: competition.id, jobRoleId } },
          create: { competitionId: competition.id, jobRoleId },
          update: {},
        });
        for (const subjectId of subjectIds) {
          await tx.competitionJobRoleSubject.create({
            data: { competitionId: competition.id, jobRoleId, subjectId },
          });
        }
      }

      // CompetitionSubject: union de todas as matérias
      const allSubjectIds = [...new Set(resolvedJobRoles.flatMap((r) => r.subjectIds))];
      if (allSubjectIds.length > 0) {
        await tx.competitionSubject.createMany({
          data: allSubjectIds.map((subjectId) => ({ competitionId: competition.id, subjectId })),
          skipDuplicates: true,
        });
      }

      // CompetitionStage (com datas)
      let stageOrder = 0;
      for (const stage of draft.stages ?? []) {
        const stageName = norm(stage.name);
        if (!stageName) continue;
        await tx.competitionStage.create({
          data: {
            competitionId: competition.id,
            name: stageName,
            order: stageOrder++,
            dateStart: safeDate(stage.dateStart),
            dateEnd: safeDate(stage.dateEnd),
          },
        });
      }

      const storedPath = await saveEditalBuffer(competition.id, bytes);
      const editalUrl = `/api/competitions/${competition.id}/edital`;

      await tx.competition.update({
        where: { id: competition.id },
        data: { editalUrl },
        select: { id: true },
      });

      return { id: competition.id, editalUrl, storedPath };
    });

    return NextResponse.json({ competitionId: created.id, editalUrl: created.editalUrl }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: `Erro Prisma: ${e.code}` }, { status: 500 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao criar concurso";
    console.error("[edital/confirm]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
