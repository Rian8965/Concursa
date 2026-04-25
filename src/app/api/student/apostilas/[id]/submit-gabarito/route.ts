import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const answers = Array.isArray(body.answers) ? body.answers as { questionId: string; selectedAnswer: string | null }[] : [];
  const timeSpentSeconds = typeof body.timeSpentSeconds === "number" ? Math.max(0, Math.floor(body.timeSpentSeconds)) : null;

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const apostila = await prisma.apostila.findUnique({
    where: { id },
    include: {
      questions: {
        include: { question: { select: { id: true, correctAnswer: true } } },
      },
    },
  });
  if (!apostila || apostila.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Apostila não encontrada" }, { status: 404 });
  }

  const allowedIds = new Set(apostila.questions.map((q) => q.questionId));
  const qCorrect = new Map(apostila.questions.map((q) => [q.questionId, q.question.correctAnswer]));

  let correctCount = 0;
  let total = 0;

  // Cria StudentAnswer para cada questão respondida (ou marcada como em branco)
  for (const a of answers) {
    if (!allowedIds.has(a.questionId)) continue;
    const correctAnswer = qCorrect.get(a.questionId);
    if (!correctAnswer) continue;
    total += 1;
    const sel = a.selectedAnswer;
    const isCorrect = !!sel && sel === correctAnswer;
    if (isCorrect) correctCount += 1;

    await prisma.studentAnswer.create({
      data: {
        studentProfileId: profile.id,
        questionId: a.questionId,
        selectedAnswer: sel ?? "-",
        isCorrect,
        sessionType: "MANUAL",
        sessionId: apostila.id,
        timeSpentSeconds: timeSpentSeconds ?? undefined,
      },
    });
  }

  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return NextResponse.json({ ok: true, totalQuestions: total, correctAnswers: correctCount, score });
}

