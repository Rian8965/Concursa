import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { questionId, selectedAnswer } = await req.json();

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { alternatives: { orderBy: { order: "asc" } } },
  });
  if (!question) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  const isCorrect = question.correctAnswer === selectedAnswer;

  await prisma.studentAnswer.create({
    data: {
      studentProfileId: profile.id,
      questionId,
      selectedAnswer,
      isCorrect,
      sessionType: "TRAINING",
      sessionId: id,
    },
  });

  return NextResponse.json({ isCorrect, correctAnswer: question.correctAnswer });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { correctAnswers, timeSpentSeconds } = await req.json();

  await prisma.trainingSession.update({
    where: { id },
    data: { correctAnswers, timeSpentSeconds, completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
