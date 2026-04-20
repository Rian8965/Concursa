import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  ApostilaPdfDocument,
  type ApostilaQuestionRow,
} from "@/components/pdf/apostila-document";

const MIN_Q = 5;
const MAX_Q = 60;
const DEFAULT_Q = 28;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const competitionId = body.competitionId as string | undefined;
  let count = typeof body.questionCount === "number" ? body.questionCount : DEFAULT_Q;
  count = Math.min(MAX_Q, Math.max(MIN_Q, Math.floor(count)));

  if (!competitionId) {
    return NextResponse.json({ error: "concurso obrigatório" }, { status: 400 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  }

  const enrollment = await prisma.studentCompetition.findUnique({
    where: {
      studentProfileId_competitionId: {
        studentProfileId: profile.id,
        competitionId,
      },
    },
    include: { competition: { select: { name: true } } },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Concurso não disponível no seu plano" }, { status: 403 });
  }

  const usedRows = await prisma.usedQuestion.findMany({
    where: { studentProfileId: profile.id, usedInType: "APOSTILA" },
    select: { questionId: true },
  });
  const usedIds = usedRows.map((r) => r.questionId);

  const baseWhere = {
    status: "ACTIVE" as const,
    competitionId,
    alternatives: { some: {} },
  };

  const unusedWhere =
    usedIds.length > 0 ? { ...baseWhere, id: { notIn: usedIds } } : baseWhere;

  let questions = await prisma.question.findMany({
    where: unusedWhere,
    include: {
      alternatives: { orderBy: { order: "asc" } },
      subject: { select: { name: true } },
    },
    take: Math.min(count * 4, 200),
  });

  if (questions.length < count) {
    questions = await prisma.question.findMany({
      where: baseWhere,
      include: {
        alternatives: { orderBy: { order: "asc" } },
        subject: { select: { name: true } },
      },
      take: Math.min(count * 4, 200),
    });
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Não há questões publicadas para este concurso ainda." },
      { status: 400 }
    );
  }

  const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, count);

  const rows: ApostilaQuestionRow[] = shuffled.map((q, i) => ({
    order: i + 1,
    content: q.content,
    supportText: q.supportText ?? null,
    subjectName: q.subject?.name ?? null,
    alternatives: q.alternatives.map((a) => ({
      letter: a.letter,
      content: a.content,
    })),
  }));

  const title = `Apostila — ${enrollment.competition.name}`;
  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const pdfEl = (
    <ApostilaPdfDocument
      title={title}
      generatedAt={generatedAt}
      questions={rows}
    />
  );

  const buffer = await renderToBuffer(pdfEl);

  await prisma.$transaction(async (tx) => {
    await tx.apostila.create({
      data: {
        studentProfileId: profile.id,
        competitionId,
        title,
        fileUrl: null,
        questions: {
          create: shuffled.map((q, order) => ({
            questionId: q.id,
            order: order + 1,
          })),
        },
      },
    });
    await tx.usedQuestion.createMany({
      data: shuffled.map((q) => ({
        studentProfileId: profile.id,
        questionId: q.id,
        usedInType: "APOSTILA" as const,
      })),
    });
  });

  const filename = `apostila-${enrollment.competition.name.replace(/[^\w\-]+/g, "-").slice(0, 40)}-${Date.now()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
