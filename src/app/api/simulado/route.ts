import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { competitionId, subjectIds, quantity = 20, timeLimitMinutes = 60 } = await req.json();

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    alternatives: { some: {} },
    ...(competitionId && { competitionId }),
    ...(subjectIds?.length && { subjectId: { in: subjectIds } }),
  };

  const total = await prisma.question.count({ where });
  if (total === 0) {
    return NextResponse.json({ error: "Nenhuma questão disponível." }, { status: 400 });
  }

  const skip = Math.max(0, Math.floor(Math.random() * Math.max(1, total - quantity)));
  const questions = await prisma.question.findMany({
    where,
    include: { alternatives: { orderBy: { order: "asc" } }, subject: { select: { name: true } } },
    take: Math.min(quantity * 2, 100),
    skip,
  });

  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, quantity);

  const exam = await prisma.simulatedExam.create({
    data: {
      studentProfileId: profile.id,
      competitionId: competitionId || null,
      totalQuestions: shuffled.length,
      timeAllowedSeconds: timeLimitMinutes * 60,
      status: "IN_PROGRESS",
      questions: {
        create: shuffled.map((q, i) => ({ questionId: q.id, order: i + 1 })),
      },
    },
  });

  return NextResponse.json({
    examId: exam.id,
    timeLimitSeconds: timeLimitMinutes * 60,
    questions: shuffled.map((q, i) => ({
      id: q.id,
      order: i + 1,
      content: q.content,
      supportText: q.supportText,
      subject: q.subject?.name,
      difficulty: q.difficulty,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      alternatives: q.alternatives.map((a) => ({ id: a.id, letter: a.letter, content: a.content })),
    })),
  });
}
