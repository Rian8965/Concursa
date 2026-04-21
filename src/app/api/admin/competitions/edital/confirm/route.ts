import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { saveEditalBuffer } from "@/lib/edital-storage";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

type Draft = {
  name: string;
  organization?: string | null;
  examBoard?: { acronym: string; name?: string | null } | null;
  cities?: Array<{ name: string; state: string }> | null;
  jobRoles?: Array<{ name: string }> | null;
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
  // City não tem unique por (name,state); então busca first.
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

async function ensureJobRoles(jobRoles: Array<{ name: string }> | null | undefined) {
  const out: Array<{ id: string }> = [];
  const seen = new Set<string>();
  for (const jr of jobRoles ?? []) {
    const name = norm(jr.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const slug = slugifyBase(name);
    // slug é unique; garante unique final
    const safeSlug = slug ? `${slug}-${Date.now().toString(36).slice(-4)}` : `cargo-${Date.now().toString(36)}`;
    const existing = await prisma.jobRole.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) {
      out.push({ id: existing.id });
    } else {
      const created = await prisma.jobRole.create({ data: { name, slug: safeSlug }, select: { id: true } });
      out.push({ id: created.id });
    }
  }
  return out;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const startedAt = Date.now();
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

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-edital-confirm",
      location: "src/app/api/admin/competitions/edital/confirm/route.ts:POST",
      message: "edital confirm started",
      data: { bytes: bytes.length, name: draft.name, cities: (draft.cities ?? []).length, jobRoles: (draft.jobRoles ?? []).length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    const examBoard = await upsertExamBoard(draft.examBoard);
    const cities = await ensureCities(draft.cities);
    const primaryCity = cities[0] ?? null;
    if (!primaryCity?.id) {
      return NextResponse.json({ error: "Não foi possível identificar cidade/estado no edital. Ajuste no rascunho e tente novamente." }, { status: 400 });
    }

    const jobRoles = await ensureJobRoles(draft.jobRoles);

    const base = slugifyBase(draft.name);
    const slug = `${base || "concurso"}-${Date.now()}`;

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
          editalUrl: null, // setado após salvar arquivo
        },
        select: { id: true },
      });

      if (jobRoles.length) {
        await tx.competitionJobRole.createMany({
          data: jobRoles.map((jr) => ({ competitionId: competition.id, jobRoleId: jr.id })),
        });
      }

      // Vínculo "macio": cria StudentCompetition dummy? Não. Mantemos apenas primary city no model atual.
      // As demais cidades ficam registradas via notes/description (por enquanto), até termos model de múltiplas cidades.

      const storedPath = await saveEditalBuffer(competition.id, bytes);
      const editalUrl = `/api/competitions/${competition.id}/edital`;

      await tx.competition.update({
        where: { id: competition.id },
        data: { editalUrl },
        select: { id: true },
      });

      return { id: competition.id, editalUrl, storedPath };
    });

    const elapsedMs = Date.now() - startedAt;

    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        runId: "pre-fix",
        hypothesisId: "H-edital-confirm",
        location: "src/app/api/admin/competitions/edital/confirm/route.ts:POST",
        message: "edital confirm finished",
        data: { elapsedMs, competitionId: created.id },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return NextResponse.json({ competitionId: created.id, editalUrl: created.editalUrl }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: `Erro Prisma: ${e.code}` }, { status: 500 });
    }
    const msg = e instanceof Error ? e.message : "Erro ao criar concurso";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

