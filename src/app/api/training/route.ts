import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { competitionId, subjectIds, difficulty, quantity = 10 } = await req.json();

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    alternatives: { some: {} },
    ...(competitionId && { competitionId }),
    ...(subjectIds?.length && { subjectId: { in: subjectIds } }),
    ...(difficulty && difficulty !== "ALL" && { difficulty }),
  };

  const total = await prisma.question.count({ where });
  if (total === 0) {
    return NextResponse.json({ error: "Nenhuma questão disponível com os filtros selecionados." }, { status: 400 });
  }

  const skip = Math.max(0, Math.floor(Math.random() * Math.max(1, total - quantity)));
  const questions = await prisma.question.findMany({
    where,
    include: { alternatives: { orderBy: { order: "asc" } }, subject: { select: { name: true } } },
    take: Math.min(quantity * 2, 60),
    skip,
  });

  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, quantity);

  const trainingSession = await prisma.trainingSession.create({
    data: {
      studentProfileId: profile.id,
      competitionId: competitionId || null,
      subjectId: subjectIds?.length === 1 ? subjectIds[0] : null,
      totalQuestions: shuffled.length,
      filters: { subjectIds, difficulty, quantity },
    },
  });

  await prisma.usedQuestion.createMany({
    data: shuffled.map((q) => ({ studentProfileId: profile.id, questionId: q.id, usedInType: "TRAINING" })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    sessionId: trainingSession.id,
    questions: shuffled.map((q) => ({
      id: q.id,
      content: q.content,
      supportText: q.supportText,
      correctAnswer: q.correctAnswer,
      subject: q.subject?.name,
      difficulty: q.difficulty,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      alternatives: q.alternatives.map((a) => ({ id: a.id, letter: a.letter, content: a.content })),
    })),
  });
}
