import { generateWrongAnswerExplanation } from "@/lib/ai/explain-wrong-answer";
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

  // Registra no histórico do aluno:
  // - respostas marcadas normalmente
  // - questões não respondidas contam como erradas (selectedAnswer = "-")
  const wrongIds = [
    ...new Set(
      answers
        .filter((a) => {
          const r = results.find((x) => x.questionId === a.questionId);
          return r && !r.isCorrect;
        })
        .map((a) => a.questionId),
    ),
  ];

  const questionsById =
    wrongIds.length > 0
      ? await prisma.question.findMany({
          where: { id: { in: wrongIds } },
          include: { alternatives: { orderBy: { order: "asc" } } },
        })
      : [];
  const qMap = new Map(questionsById.map((q) => [q.id, q]));

  for (const a of answers) {
    const r = results.find((x) => x.questionId === a.questionId);
    if (!r) continue;

    let aiExplanation: string | null = null;
    if (!r.isCorrect) {
      const q = qMap.get(a.questionId);
      if (q) {
        try {
          aiExplanation = await generateWrongAnswerExplanation({
            content: q.content,
            supportText: q.supportText,
            alternatives: q.alternatives.map((al) => ({ letter: al.letter, content: al.content })),
            selectedAnswer: a.selectedAnswer ?? "-",
            correctAnswer: q.correctAnswer,
          });
        } catch (e) {
          console.error("[simulado/submit] explain", e);
        }
      }
    }

    await prisma.studentAnswer.create({
      data: {
        studentProfileId: profile.id,
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer ?? "-",
        isCorrect: r.isCorrect,
        sessionType: "EXAM",
        sessionId: id,
        aiExplanation: r.isCorrect ? null : aiExplanation,
      },
    });
  }

  return NextResponse.json({
    score: Math.round((correctCount / exam.totalQuestions) * 100),
    correctAnswers: correctCount,
    totalQuestions: exam.totalQuestions,
    results,
  });
}
