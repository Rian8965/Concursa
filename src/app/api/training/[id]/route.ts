import { auth } from "@/lib/auth";
import { generateWrongAnswerExplanation } from "@/lib/ai/explain-wrong-answer";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { questionId, selectedAnswer } = await req.json();

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const sess = await prisma.trainingSession.findUnique({ where: { id } });
  if (!sess || sess.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Sessão de treino não encontrada" }, { status: 404 });
  }

  await prisma.trainingSessionQuestion.updateMany({
    where: { trainingSessionId: id, questionId },
    data: { selectedAnswer: String(selectedAnswer ?? "").trim().toUpperCase().slice(0, 4) || null },
  });

  // Regra: não corrigir em tempo real (nem IA nem acerto/erro).
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    answers?: { questionId: string; selectedAnswer: string | null }[];
    timeSpentSeconds?: number;
  };

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const sess = await prisma.trainingSession.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { question: { include: { alternatives: { orderBy: { order: "asc" } }, subject: { select: { name: true } } } } } },
    },
  });
  if (!sess || sess.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Sessão de treino não encontrada" }, { status: 404 });
  }

  // Atualiza marcações (caso o cliente tenha respostas locais)
  const provided = Array.isArray(body.answers) ? body.answers : [];
  if (provided.length) {
    for (const a of provided) {
      await prisma.trainingSessionQuestion.updateMany({
        where: { trainingSessionId: id, questionId: a.questionId },
        data: { selectedAnswer: a.selectedAnswer ? String(a.selectedAnswer).trim().toUpperCase().slice(0, 4) : null },
      });
    }
  }

  const timeSpentSeconds = Math.max(0, Math.floor(body.timeSpentSeconds ?? 0));

  let correctCount = 0;
  const results: Array<{
    questionId: string;
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    aiExplanation?: string | null;
    subject?: string | null;
  }> = [];

  for (const row of sess.questions) {
    const q = row.question;
    const selected = row.selectedAnswer ?? null;
    const isCorrect = Boolean(selected) && selected === q.correctAnswer;
    if (isCorrect) correctCount += 1;

    let aiExplanation: string | null = null;
    if (!isCorrect) {
      try {
        aiExplanation = await generateWrongAnswerExplanation({
          content: q.content,
          supportText: q.supportText,
          alternatives: q.alternatives.map((al) => ({ letter: al.letter, content: al.content })),
          selectedAnswer: selected ?? "-",
          correctAnswer: q.correctAnswer,
        });
      } catch (e) {
        console.error("[training/submit] explain", e);
      }
    }

    results.push({
      questionId: q.id,
      selectedAnswer: selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
      aiExplanation,
      subject: q.subject?.name ?? null,
    });

    await prisma.trainingSessionQuestion.updateMany({
      where: { trainingSessionId: id, questionId: q.id },
      data: { isCorrect },
    });

    await prisma.studentAnswer.create({
      data: {
        studentProfileId: profile.id,
        questionId: q.id,
        selectedAnswer: selected ?? "-",
        isCorrect,
        sessionType: "TRAINING",
        sessionId: id,
        aiExplanation: isCorrect ? null : aiExplanation,
      },
    });
  }

  await prisma.trainingSession.update({
    where: { id },
    data: { correctAnswers: correctCount, timeSpentSeconds, completedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    correctAnswers: correctCount,
    totalQuestions: sess.totalQuestions,
    score: sess.totalQuestions > 0 ? Math.round((correctCount / sess.totalQuestions) * 100) : 0,
    results,
  });
}
