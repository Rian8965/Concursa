import { auth } from "@/lib/auth";
import { generateWrongAnswerExplanation } from "@/lib/ai/explain-wrong-answer";
import { canUseAI, recordAiUsage, recordAiError } from "@/lib/ai/ai-gate";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: questionId } = await params;
  const userId = session.user.id;

  // 1. Verificar gate de IA
  const gate = await canUseAI(userId);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.message,
        reason: gate.reason,
        canBuyCredits: gate.canBuyCredits,
      },
      { status: 429 },
    );
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const last = await prisma.studentAnswer.findFirst({
    where: { studentProfileId: profile.id, questionId },
    orderBy: { answeredAt: "desc" },
    select: { id: true, isCorrect: true, aiExplanation: true, selectedAnswer: true },
  });
  if (!last) return NextResponse.json({ error: "Nenhuma resposta encontrada para esta questão" }, { status: 404 });
  if (last.isCorrect) return NextResponse.json({ error: "A questão foi respondida corretamente (sem explicação necessária)" }, { status: 400 });

  // Se já tem explicação cached, retornar sem gastar cota
  if (last.aiExplanation?.trim()) return NextResponse.json({ aiExplanation: last.aiExplanation });

  const q = await prisma.question.findUnique({
    where: { id: questionId },
    include: { alternatives: { orderBy: { order: "asc" } } },
  });
  if (!q) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  // 2. Chamar IA com limite de caracteres do plano
  const result = await generateWrongAnswerExplanation({
    content: q.content,
    supportText: q.supportText,
    alternatives: q.alternatives.map((a) => ({ letter: a.letter, content: a.content })),
    selectedAnswer: last.selectedAnswer ?? "-",
    correctAnswer: q.correctAnswer,
    charLimit: gate.charLimit,
  });

  if (!result?.explanation?.trim()) {
    // Registrar erro sem descontar do limite
    await recordAiError({
      userId,
      questionId,
      source: gate.source,
      model: "unknown",
      errorMessage: "Resposta vazia da IA",
    });
    return NextResponse.json({ error: "Não foi possível gerar explicação agora. Tente novamente." }, { status: 502 });
  }

  // 3. Registrar uso APÓS sucesso
  await recordAiUsage({
    userId,
    questionId,
    source: gate.source,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  // 4. Salvar explicação no registro da resposta
  await prisma.studentAnswer.update({
    where: { id: last.id },
    data: { aiExplanation: result.explanation },
  });

  return NextResponse.json({ aiExplanation: result.explanation });
}
