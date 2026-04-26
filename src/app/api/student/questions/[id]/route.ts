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

  // Fallback: se (por algum motivo) não existir StudentAnswer,
  // usa sessões finalizadas (treino/simulado) para montar um "histórico mínimo".
  // Isso garante que as telas "Questões" / "Revisar erros" não fiquem vazias em bases antigas.
  if (history.length === 0) {
    const [tsq, seq] = await Promise.all([
      prisma.trainingSessionQuestion.findFirst({
        where: {
          questionId: id,
          trainingSession: { studentProfileId: profile.id, completedAt: { not: null } },
          isCorrect: { not: null },
        },
        orderBy: { trainingSession: { completedAt: "desc" } },
        include: { trainingSession: { select: { id: true, completedAt: true } } },
      }),
      prisma.simulatedExamQuestion.findFirst({
        where: {
          questionId: id,
          exam: { studentProfileId: profile.id, status: "COMPLETED", completedAt: { not: null } },
          isCorrect: { not: null },
        },
        orderBy: { exam: { completedAt: "desc" } },
        include: { exam: { select: { id: true, completedAt: true } } },
      }),
    ]);

    const fallbackHistory = [
      tsq ? {
        id: `tsq_${tsq.trainingSessionId}_${tsq.questionId}`,
        selectedAnswer: (tsq.selectedAnswer ?? "-"),
        isCorrect: Boolean(tsq.isCorrect),
        aiExplanation: null,
        answeredAt: tsq.trainingSession.completedAt!,
        sessionType: "TRAINING",
        sessionId: tsq.trainingSessionId,
        timeSpentSeconds: null,
      } : null,
      seq ? {
        id: `seq_${seq.examId}_${seq.questionId}`,
        selectedAnswer: (seq.selectedAnswer ?? "-"),
        isCorrect: Boolean(seq.isCorrect),
        aiExplanation: null,
        answeredAt: seq.exam.completedAt!,
        sessionType: "EXAM",
        sessionId: seq.examId,
        timeSpentSeconds: null,
      } : null,
    ].filter(Boolean) as typeof history;

    // Mantém a assinatura de retorno do endpoint
    const best = fallbackHistory.sort((a, b) => new Date(b.answeredAt).getTime() - new Date(a.answeredAt).getTime());
    const bestLast = best[0] ?? null;

    return NextResponse.json({
      question: {
        id: question.id,
        content: question.content,
        supportText: question.supportText,
        imageUrl: question.imageUrl,
        hasImage: question.hasImage,
        correctAnswer: question.correctAnswer,
        isMarkedSuspect: question.isMarkedSuspect,
        year: question.year,
        difficulty: question.difficulty,
        subject: question.subject,
        topic: question.topic,
        examBoard: question.examBoard,
        alternatives: question.alternatives.map((a) => ({ letter: a.letter, content: a.content, imageUrl: a.imageUrl ?? null })),
      },
      lastAnswer: bestLast ? {
        selectedAnswer: bestLast.selectedAnswer,
        isCorrect: bestLast.isCorrect,
        aiExplanation: bestLast.aiExplanation,
        answeredAt: bestLast.answeredAt,
        sessionType: bestLast.sessionType,
        sessionId: bestLast.sessionId,
      } : null,
      history: best,
    });
  }

  return NextResponse.json({
    question: {
      id: question.id,
      content: question.content,
      supportText: question.supportText,
      imageUrl: question.imageUrl,
      hasImage: question.hasImage,
      correctAnswer: question.correctAnswer,
      isMarkedSuspect: question.isMarkedSuspect,
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

