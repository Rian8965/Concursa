import { auth } from "@/lib/auth";
import { generateWrongAnswerExplanation } from "@/lib/ai/explain-wrong-answer";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function limitConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const q = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    while (q.length) {
      const it = q.shift();
      if (it === undefined) return;
      await fn(it);
    }
  });
  return Promise.allSettled(workers);
}

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
  const subjectAgg = new Map<string, { subject: string; total: number; correct: number }>();
  const results: Array<{
    questionId: string;
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    subject?: string | null;
  }> = [];

  const wrongToExplain: Array<{
    questionId: string;
    selectedAnswer: string;
    correctAnswer: string;
    content: string;
    supportText: string | null;
    alternatives: { letter: string; content: string }[];
  }> = [];

  for (const row of sess.questions) {
    const q = row.question;
    const selected = row.selectedAnswer ?? null;
    const isCorrect = Boolean(selected) && selected === q.correctAnswer;
    if (isCorrect) correctCount += 1;

    const subj = q.subject?.name ?? "Sem matéria";
    const cur = subjectAgg.get(subj) ?? { subject: subj, total: 0, correct: 0 };
    cur.total += 1;
    if (isCorrect) cur.correct += 1;
    subjectAgg.set(subj, cur);

    if (!isCorrect) {
      wrongToExplain.push({
        questionId: q.id,
        selectedAnswer: selected ?? "-",
        correctAnswer: q.correctAnswer,
        content: q.content,
        supportText: q.supportText ?? null,
        alternatives: q.alternatives.map((al) => ({ letter: al.letter, content: al.content })),
      });
    }

    results.push({
      questionId: q.id,
      selectedAnswer: selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
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
        aiExplanation: null,
      },
    });
  }

  await prisma.trainingSession.update({
    where: { id },
    data: { correctAnswers: correctCount, timeSpentSeconds, completedAt: new Date() },
  });

  // Gera explicações de forma assíncrona (não bloquear o resultado).
  if (wrongToExplain.length) {
    setImmediate(async () => {
      await limitConcurrency(wrongToExplain, 3, async (w) => {
        try {
          const expl = await generateWrongAnswerExplanation({
            content: w.content,
            supportText: w.supportText,
            alternatives: w.alternatives,
            selectedAnswer: w.selectedAnswer,
            correctAnswer: w.correctAnswer,
          });
          if (!expl) return;
          await prisma.studentAnswer.updateMany({
            where: {
              studentProfileId: profile.id,
              questionId: w.questionId,
              sessionType: "TRAINING",
              sessionId: id,
              aiExplanation: null,
            },
            data: { aiExplanation: expl },
          });
        } catch (e) {
          console.error("[training/submit] async explain", e);
        }
      });
    });
  }

  return NextResponse.json({
    ok: true,
    correctAnswers: correctCount,
    totalQuestions: sess.totalQuestions,
    score: sess.totalQuestions > 0 ? Math.round((correctCount / sess.totalQuestions) * 100) : 0,
    results,
    subjectPerformance: Array.from(subjectAgg.values())
      .map((s) => ({ ...s, accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total),
  });
}
