import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { answers, timeSpentSeconds } = await req.json() as {
    answers: { questionId: string; selectedAnswer: string | null }[];
    timeSpentSeconds: number;
  };

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const exam = await prisma.simulatedExam.findUnique({
    where: { id },
    include: { questions: { include: { question: { select: { id: true, correctAnswer: true } } } } },
  });
  if (!exam || exam.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
  }

  let correctCount = 0;
  const results: { questionId: string; selectedAnswer: string | null; correctAnswer: string; isCorrect: boolean }[] = [];

  for (const ans of answers) {
    const examQ = exam.questions.find((eq) => eq.questionId === ans.questionId);
    if (!examQ) continue;
    const isCorrect = !!ans.selectedAnswer && ans.selectedAnswer === examQ.question.correctAnswer;
    if (isCorrect) correctCount++;
    results.push({ questionId: ans.questionId, selectedAnswer: ans.selectedAnswer, correctAnswer: examQ.question.correctAnswer, isCorrect });

    await prisma.simulatedExamQuestion.updateMany({
      where: { examId: id, questionId: ans.questionId },
      data: { selectedAnswer: ans.selectedAnswer, isCorrect },
    });
  }

  await prisma.simulatedExam.update({
    where: { id },
    data: { correctAnswers: correctCount, timeSpentSeconds: timeSpentSeconds || 0, status: "COMPLETED", completedAt: new Date() },
  });

  const studentAnswers = answers
    .filter((a) => a.selectedAnswer)
    .map((a) => {
      const r = results.find((r) => r.questionId === a.questionId)!;
      return { studentProfileId: profile.id, questionId: a.questionId, selectedAnswer: a.selectedAnswer!, isCorrect: r.isCorrect, sessionType: "EXAM" as const, sessionId: id };
    });

  if (studentAnswers.length > 0) {
    await prisma.studentAnswer.createMany({ data: studentAnswers, skipDuplicates: true });
  }

  return NextResponse.json({
    score: Math.round((correctCount / exam.totalQuestions) * 100),
    correctAnswers: correctCount,
    totalQuestions: exam.totalQuestions,
    results,
  });
}
