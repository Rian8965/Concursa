import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      alternatives: { orderBy: { order: "asc" } },
      subject: { select: { id: true, name: true, color: true } },
      topic: { select: { id: true, name: true } },
      examBoard: { select: { id: true, acronym: true, name: true } },
    },
  });
  if (!question) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  const history = await prisma.studentAnswer.findMany({
    where: { studentProfileId: profile.id, questionId: id },
    orderBy: { answeredAt: "desc" },
    take: 30,
    select: {
      id: true,
      selectedAnswer: true,
      isCorrect: true,
      aiExplanation: true,
      answeredAt: true,
      sessionType: true,
      sessionId: true,
      timeSpentSeconds: true,
    },
  });

  const last = history[0] ?? null;

  return NextResponse.json({
    question: {
      id: question.id,
      content: question.content,
      supportText: question.supportText,
      imageUrl: question.imageUrl,
      hasImage: question.hasImage,
      correctAnswer: question.correctAnswer,
      year: question.year,
      difficulty: question.difficulty,
      subject: question.subject,
      topic: question.topic,
      examBoard: question.examBoard,
      alternatives: question.alternatives.map((a) => ({ letter: a.letter, content: a.content, imageUrl: a.imageUrl ?? null })),
    },
    lastAnswer: last ? {
      selectedAnswer: last.selectedAnswer,
      isCorrect: last.isCorrect,
      aiExplanation: last.aiExplanation,
      answeredAt: last.answeredAt,
      sessionType: last.sessionType,
      sessionId: last.sessionId,
    } : null,
    history,
  });
}

