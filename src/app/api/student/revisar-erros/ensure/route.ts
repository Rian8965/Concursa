import { auth } from "@/lib/auth";
import { generateWrongAnswerExplanation } from "@/lib/ai/explain-wrong-answer";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

const PER_REQUEST = 12;

/** Preenche aiExplanation em respostas erradas ainda sem texto (p.ex. pós-simulado). */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (process.env.GEMINI_API_KEY == null && process.env.OPENAI_API_KEY == null) {
    return NextResponse.json({ ok: true, filled: 0, message: "IA não configurada" });
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const pending = await prisma.studentAnswer.findMany({
    where: { studentProfileId: profile.id, isCorrect: false, aiExplanation: null },
    take: PER_REQUEST,
    orderBy: { answeredAt: "desc" },
    include: {
      question: { include: { alternatives: { orderBy: { order: "asc" } } } },
    },
  });

  let filled = 0;
  for (const row of pending) {
    const q = row.question;
    const text = await generateWrongAnswerExplanation({
      content: q.content,
      supportText: q.supportText,
      alternatives: q.alternatives.map((a) => ({ letter: a.letter, content: a.content })),
      selectedAnswer: row.selectedAnswer,
      correctAnswer: q.correctAnswer,
    });
    if (text) {
      await prisma.studentAnswer.update({ where: { id: row.id }, data: { aiExplanation: text } });
      filled += 1;
    }
  }

  const remaining = await prisma.studentAnswer.count({
    where: { studentProfileId: profile.id, isCorrect: false, aiExplanation: null },
  });

  return NextResponse.json({ ok: true, filled, remaining });
}
