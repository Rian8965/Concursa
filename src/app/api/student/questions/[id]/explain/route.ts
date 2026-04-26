import { auth } from "@/lib/auth";
import { generateWrongAnswerExplanation } from "@/lib/ai/explain-wrong-answer";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: questionId } = await params;

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const last = await prisma.studentAnswer.findFirst({
    where: { studentProfileId: profile.id, questionId },
    orderBy: { answeredAt: "desc" },
    select: { id: true, isCorrect: true, aiExplanation: true, selectedAnswer: true },
  });
  if (!last) return NextResponse.json({ error: "Nenhuma resposta encontrada para esta questão" }, { status: 404 });
  if (last.isCorrect) return NextResponse.json({ error: "A questão foi respondida corretamente (sem explicação necessária)" }, { status: 400 });
  if (last.aiExplanation?.trim()) return NextResponse.json({ aiExplanation: last.aiExplanation });

  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { alternatives: { orderBy: { order: "asc" } } },
  });
  if (!q) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  const expl = await generateWrongAnswerExplanation({
    content: q.content,
    supportText: q.supportText,
    alternatives: q.alternatives.map((a) => ({ letter: a.letter, content: a.content })),
    selectedAnswer: last.selectedAnswer ?? "-",
    correctAnswer: q.correctAnswer,
  });

  if (!expl?.trim()) {
    return NextResponse.json({ error: "Não foi possível gerar explicação agora. Tente novamente." }, { status: 502 });
  }

  await prisma.studentAnswer.update({
    where: { id: last.id },
    data: { aiExplanation: expl },
  });

  return NextResponse.json({ aiExplanation: expl });
}

