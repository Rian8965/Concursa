import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const q = await prisma.question.findUnique({
    where: { id },
    include: { aiMeta: true },
  });
  if (!q) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });
  if (!q.aiMeta) return NextResponse.json({ error: "Sem sugestões de IA para aplicar" }, { status: 400 });

  const meta = q.aiMeta;
  const updated = await prisma.question.update({
    where: { id },
    data: {
      ...(q.year == null && meta.suggestedYear != null && { year: meta.suggestedYear }),
      ...(q.examBoardId == null && meta.suggestedExamBoardId != null && { examBoardId: meta.suggestedExamBoardId }),
      ...(q.cityId == null && meta.suggestedCityId != null && { cityId: meta.suggestedCityId }),
      ...(q.jobRoleId == null && meta.suggestedJobRoleId != null && { jobRoleId: meta.suggestedJobRoleId }),
      ...(q.subjectId == null && meta.suggestedSubjectId != null && { subjectId: meta.suggestedSubjectId }),
      ...(q.topicId == null && meta.suggestedTopicId != null && { topicId: meta.suggestedTopicId }),
    },
  });

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-q-apply-ai",
      location: "src/app/api/admin/questions/[id]/apply-ai/route.ts:POST",
      message: "applied AI suggestions to question",
      data: { questionId: id },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ question: updated });
}

