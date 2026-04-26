import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { analyzeQuestionReport } from "@/lib/ai/analyze-question-report";
import { NextRequest, NextResponse } from "next/server";

const STRUCTURAL_CATEGORIES = [
  "INCOMPLETE_STATEMENT",
  "MISSING_TEXT",
  "MISSING_IMAGE",
  "MISSING_ALTERNATIVE",
  "FORMAT_ERROR",
] as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    questionId: string;
    category: string;
    description?: string;
    phase: string;
    sessionId?: string;
    sessionType?: string;
  };

  const { questionId, category, description, phase, sessionId, sessionType } = body;

  if (!questionId || !category || !phase) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  // Durante treino/simulado, permitimos qualquer categoria.
  // Quando for estrutural, a UI pode tentar substituir automaticamente a questão.
  // Quando for gabarito (WRONG_ANSWER), a IA pode analisar (se houver descrição).

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { alternatives: { orderBy: { order: "asc" } } },
  });
  if (!question) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  const report = await prisma.questionReport.create({
    data: {
      studentProfileId: profile.id,
      questionId,
      category: category as never,
      description: description?.trim() || null,
      phase,
      sessionId: sessionId || null,
      sessionType: sessionType || null,
    },
  });

  // Se o aluno denunciou gabarito errado (ou ambiguidade) com detalhes: rodar análise da IA imediatamente
  if ((category === "WRONG_ANSWER" || category === "AMBIGUOUS_ANSWER") && description?.trim()) {
    setImmediate(async () => {
      try {
        const result = await analyzeQuestionReport({
          content: question.content,
          supportText: question.supportText,
          alternatives: question.alternatives.map((a) => ({ letter: a.letter, content: a.content })),
          correctAnswer: question.correctAnswer,
          studentReason: description.trim(),
        });

        if (!result) return;

        await prisma.questionReportAiReview.create({
          data: {
            reportId: report.id,
            verdict: result.verdict,
            analysis: result.analysis,
            confidence: result.confidence,
          },
        });

        // Atualiza status do report para AI_REVIEWED
        await prisma.questionReport.update({
          where: { id: report.id },
          data: { status: "AI_REVIEWED" },
        });

        // Se IA apontou problema real: marcar questão como suspeita
        if (result.verdict === "ANSWER_IS_WRONG" || result.verdict === "AMBIGUOUS" || result.verdict === "ANSWER_MAY_BE_WRONG") {
          await prisma.question.update({
            where: { id: questionId },
            data: { isMarkedSuspect: true },
          });
        }
      } catch (e) {
        console.error("[question-reports] AI review error", e);
      }
    });
  }

  return NextResponse.json({ ok: true, reportId: report.id });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const url = new URL(req.url);
  const questionId = url.searchParams.get("questionId");

  const reports = await prisma.questionReport.findMany({
    where: {
      studentProfileId: profile.id,
      ...(questionId ? { questionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { aiReview: true },
  });

  return NextResponse.json({ reports });
}
