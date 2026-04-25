import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const apostila = await prisma.apostila.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: {
            include: {
              alternatives: { orderBy: { order: "asc" } },
              subject: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!apostila || apostila.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Apostila não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    apostila: {
      id: apostila.id,
      title: apostila.title,
      competitionId: apostila.competitionId,
      generatedAt: apostila.generatedAt,
      questions: apostila.questions.map((aq) => ({
        order: aq.order,
        questionId: aq.questionId,
        content: aq.question.content,
        supportText: aq.question.supportText,
        imageUrl: aq.question.imageUrl,
        correctAnswer: aq.question.correctAnswer,
        subject: aq.question.subject ? { id: aq.question.subject.id, name: aq.question.subject.name } : null,
        alternatives: aq.question.alternatives.map((a) => ({ letter: a.letter, content: a.content })),
      })),
    },
  });
}

