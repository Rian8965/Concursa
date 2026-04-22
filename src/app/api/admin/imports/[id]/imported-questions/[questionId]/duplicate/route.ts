import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: importId, questionId } = await params;
  const iq = await prisma.importedQuestion.findFirst({
    where: { id: questionId, importId },
  });
  if (!iq) return NextResponse.json({ error: "Questão importada não encontrada" }, { status: 404 });

  const maxPos = await prisma.importedQuestion.aggregate({
    where: { importId },
    _max: { sourcePosition: true },
  });
  const nextPos = (maxPos._max.sourcePosition ?? 0) + 1;

  const created = await prisma.importedQuestion.create({
    data: {
      importId,
      content: iq.content,
      alternatives: iq.alternatives as any,
      correctAnswer: iq.correctAnswer,
      suggestedSubjectId: iq.suggestedSubjectId,
      suggestedTopicId: iq.suggestedTopicId,
      year: iq.year,
      examBoardId: iq.examBoardId,
      competitionId: iq.competitionId,
      cityId: iq.cityId,
      jobRoleId: iq.jobRoleId,
      difficulty: iq.difficulty,
      tags: iq.tags ?? [],
      sourcePage: iq.sourcePage,
      sourcePosition: nextPos,
      hasImage: iq.hasImage,
      imageUrl: iq.imageUrl,
      rawText: iq.rawText,
      confidence: iq.confidence,
      status: "PENDING_REVIEW",
    },
  });

  return NextResponse.json({ question: created }, { status: 201 });
}

