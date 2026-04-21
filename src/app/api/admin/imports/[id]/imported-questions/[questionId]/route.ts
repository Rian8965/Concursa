import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

type AltDTO = { letter: string; content: string };

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: importId, questionId } = await params;
  const body = (await req.json()) as Partial<{
    content: string;
    alternatives: AltDTO[];
    correctAnswer: string | null;
    suggestedSubjectId: string | null;
    suggestedTopicId: string | null;
    sourcePage: number | null;
    sourcePosition: number | null;
    confidence: number | null;
    rawText: string | null;
    hasImage: boolean;
    imageUrl: string | null;
    status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";
  }>;

  const iq = await prisma.importedQuestion.findFirst({
    where: { id: questionId, importId },
    select: { id: true },
  });
  if (!iq) return NextResponse.json({ error: "Questão importada não encontrada" }, { status: 404 });

  if (body.alternatives) {
    const ok = Array.isArray(body.alternatives) && body.alternatives.length > 0 && body.alternatives.every((a) =>
      a &&
      typeof a.letter === "string" &&
      typeof a.content === "string" &&
      a.letter.trim().length >= 1 &&
      a.letter.trim().length <= 3
    );
    if (!ok) return NextResponse.json({ error: "alternatives inválido" }, { status: 400 });
  }

  const updated = await prisma.importedQuestion.update({
    where: { id: questionId },
    data: {
      content: typeof body.content === "string" ? body.content : undefined,
      alternatives: body.alternatives ? (body.alternatives as any) : undefined,
      correctAnswer: body.correctAnswer === undefined ? undefined : body.correctAnswer,
      suggestedSubjectId: body.suggestedSubjectId === undefined ? undefined : body.suggestedSubjectId,
      suggestedTopicId: body.suggestedTopicId === undefined ? undefined : body.suggestedTopicId,
      sourcePage: body.sourcePage === undefined ? undefined : body.sourcePage,
      sourcePosition: body.sourcePosition === undefined ? undefined : body.sourcePosition,
      confidence: body.confidence === undefined ? undefined : body.confidence,
      rawText: body.rawText === undefined ? undefined : body.rawText,
      hasImage: body.hasImage === undefined ? undefined : body.hasImage,
      imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl,
      status: body.status === undefined ? undefined : body.status,
    },
  });

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-question-edit",
      location: "src/app/api/admin/imports/[id]/imported-questions/[questionId]/route.ts:PATCH",
      message: "imported question patched",
      data: {
        importId,
        questionId,
        changed: {
          content: typeof body.content === "string",
          alternatives: Array.isArray(body.alternatives) ? body.alternatives.length : null,
          correctAnswer: body.correctAnswer === undefined ? null : body.correctAnswer,
          suggestedSubjectId: body.suggestedSubjectId === undefined ? null : body.suggestedSubjectId,
          status: body.status ?? null,
          rawText: body.rawText !== undefined,
        },
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ question: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: importId, questionId } = await params;
  const iq = await prisma.importedQuestion.findFirst({
    where: { id: questionId, importId },
    select: { id: true },
  });
  if (!iq) return NextResponse.json({ error: "Questão importada não encontrada" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.importedQuestionAsset.deleteMany({ where: { importedQuestionId: questionId } });
    await tx.importedQuestion.delete({ where: { id: questionId } });
  });

  return NextResponse.json({ ok: true });
}

