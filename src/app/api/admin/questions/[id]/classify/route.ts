import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";

export const runtime = "nodejs";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function norm(s: unknown) {
  return typeof s === "string" ? s.trim() : "";
}

type LlmOut = {
  year?: number | null;
  examBoardAcronym?: string | null;
  cityName?: string | null;
  cityState?: string | null;
  jobRoleName?: string | null;
  subjectName?: string | null;
  topicName?: string | null;
  confidence?: number | null; // 0..1
  reasoning?: string | null;
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const q = await prisma.question.findUnique({
    where: { id },
    include: {
      subject: true,
      topic: true,
      competition: { include: { city: true, examBoard: true, jobRoles: { include: { jobRole: true } } } },
    },
  });
  if (!q) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  const system = [
    "Você classifica metadados de questões de concursos no Brasil.",
    "Retorne APENAS JSON válido.",
    "Se não tiver certeza, use null e diminua confidence.",
    "Campos: year, examBoardAcronym, cityName, cityState, jobRoleName, subjectName, topicName, confidence, reasoning.",
  ].join("\n");

  const user = [
    "Contexto do concurso (se houver):",
    q.competition
      ? JSON.stringify(
          {
            competitionName: q.competition.name,
            organization: q.competition.organization,
            city: q.competition.city ? { name: q.competition.city.name, state: q.competition.city.state } : null,
            examBoard: q.competition.examBoard ? { acronym: q.competition.examBoard.acronym, name: q.competition.examBoard.name } : null,
            jobRoles: (q.competition.jobRoles ?? []).map((x) => x.jobRole.name).slice(0, 12),
            examDate: q.competition.examDate ? q.competition.examDate.toISOString().slice(0, 10) : null,
          },
          null,
          2,
        )
      : "null",
    "",
    "Questão:",
    JSON.stringify(
      {
        content: q.content,
        supportText: q.supportText,
        rawText: q.rawText,
      },
      null,
      2,
    ),
  ].join("\n");

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-q-classify",
      location: "src/app/api/admin/questions/[id]/classify/route.ts:POST",
      message: "question classify started",
      data: { questionId: id, hasCompetition: Boolean(q.competitionId), hasSubject: Boolean(q.subjectId) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const llm = await runLlmJson(system, user);
  const robust = parseLlmJsonRobustly(llm.jsonText);
  if (!robust.ok) {
    return NextResponse.json({ error: "IA retornou JSON inválido", detail: robust.message }, { status: 500 });
  }
  const out = robust.value as LlmOut;

  const examBoardAcronym = norm(out.examBoardAcronym).toUpperCase();
  const cityName = norm(out.cityName);
  const cityState = norm(out.cityState).toUpperCase();
  const jobRoleName = norm(out.jobRoleName);
  const subjectName = norm(out.subjectName);
  const topicName = norm(out.topicName);

  const [examBoard, city, jobRole, subject] = await Promise.all([
    examBoardAcronym
      ? prisma.examBoard.findUnique({ where: { acronym: examBoardAcronym }, select: { id: true } })
      : Promise.resolve(null),
    cityName && cityState
      ? prisma.city.findFirst({ where: { name: { equals: cityName, mode: "insensitive" }, state: cityState }, select: { id: true } })
      : Promise.resolve(null),
    jobRoleName
      ? prisma.jobRole.findFirst({ where: { name: { equals: jobRoleName, mode: "insensitive" } }, select: { id: true } })
      : Promise.resolve(null),
    subjectName
      ? prisma.subject.findFirst({ where: { name: { equals: subjectName, mode: "insensitive" } }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  const topic =
    subject?.id && topicName
      ? await prisma.topic.findFirst({ where: { subjectId: subject.id, name: { equals: topicName, mode: "insensitive" } }, select: { id: true } })
      : null;

  const confidence = typeof out.confidence === "number" && Number.isFinite(out.confidence) ? Math.max(0, Math.min(1, out.confidence)) : null;
  const suggestedYear = typeof out.year === "number" && Number.isFinite(out.year) ? out.year : null;

  const meta = await prisma.questionAiMeta.upsert({
    where: { questionId: id },
    update: {
      suggestedYear,
      suggestedExamBoardId: examBoard?.id ?? null,
      suggestedCityId: city?.id ?? null,
      suggestedJobRoleId: jobRole?.id ?? null,
      suggestedSubjectId: subject?.id ?? null,
      suggestedTopicId: topic?.id ?? null,
      confidence,
      reasoning: norm(out.reasoning) || null,
      raw: out as any,
    },
    create: {
      questionId: id,
      suggestedYear,
      suggestedExamBoardId: examBoard?.id ?? null,
      suggestedCityId: city?.id ?? null,
      suggestedJobRoleId: jobRole?.id ?? null,
      suggestedSubjectId: subject?.id ?? null,
      suggestedTopicId: topic?.id ?? null,
      confidence,
      reasoning: norm(out.reasoning) || null,
      raw: out as any,
    },
    include: {
      subject: { select: { name: true } },
      examBoard: { select: { acronym: true } },
      city: { select: { name: true, state: true } },
      jobRole: { select: { name: true } },
      topic: { select: { name: true } },
    },
  });

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-q-classify",
      location: "src/app/api/admin/questions/[id]/classify/route.ts:POST",
      message: "question classify finished",
      data: {
        questionId: id,
        provider: llm.provider,
        model: llm.model,
        confidence,
        suggested: {
          year: suggestedYear,
          examBoardId: examBoard?.id ?? null,
          cityId: city?.id ?? null,
          jobRoleId: jobRole?.id ?? null,
          subjectId: subject?.id ?? null,
          topicId: topic?.id ?? null,
        },
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ meta, llm: { provider: llm.provider, model: llm.model } });
}

