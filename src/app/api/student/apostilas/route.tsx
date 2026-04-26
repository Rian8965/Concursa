import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  ApostilaPdfDocument,
  type ApostilaQuestionRow,
} from "@/components/pdf/apostila-document";
import { getEligibleSubjectsForStudentCompetition } from "@/lib/questions/eligible-subjects";
import { selectQuestionsForStudent } from "@/lib/questions/select-questions";
import type { Difficulty } from "@prisma/client";

const MIN_Q = 5;
const MAX_Q = 60;
const DEFAULT_Q = 40;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const competitionId = body.competitionId as string | undefined;
  const requestedSubjectIds = Array.isArray(body.subjectIds) ? body.subjectIds.filter(Boolean) as string[] : [];
  const difficultyRaw = typeof body.difficulty === "string" && body.difficulty !== "ALL" ? body.difficulty : null;
  const difficulty: Difficulty | null =
    difficultyRaw === "EASY" || difficultyRaw === "MEDIUM" || difficultyRaw === "HARD" ? difficultyRaw : null;
  const includeAnswerKey = body.includeAnswerKey !== false;

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

  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { examBoardDefined: true, examBoardId: true, name: true },
  });

  const examBoardId = (comp?.examBoardDefined && comp.examBoardId) ? comp.examBoardId : null;

  const { subjectIds: allowedSubjectIds, jobRoleId } = await getEligibleSubjectsForStudentCompetition({
    studentProfileId: profile.id,
    competitionId,
  });

  const eligibleSubjectIds = requestedSubjectIds.length
    ? requestedSubjectIds.filter((s) => allowedSubjectIds.includes(s))
    : allowedSubjectIds;

  if (eligibleSubjectIds.length === 0) {
    return NextResponse.json(
      { error: "Não há matérias disponíveis para o seu cargo neste concurso." },
      { status: 400 }
    );
  }

  // Conta o total disponível no pool (para respeitar quantidade e avisar quando faltar)
  const subjectOr = [
    { subjectId: { in: eligibleSubjectIds } },
    { aiMeta: { suggestedSubjectId: { in: eligibleSubjectIds } } },
  ];
  const andClauses: any[] = [{ OR: subjectOr }];
  if (examBoardId) {
    andClauses.push({
      OR: [{ examBoardId }, { aiMeta: { suggestedExamBoardId: examBoardId } }],
    });
  }

  const poolWhere: any = {
    status: "ACTIVE",
    alternatives: { some: {} },
    AND: andClauses,
    ...(difficulty ? { difficulty } : {}),
  };

  const available = await prisma.question.count({ where: poolWhere });
  const effectiveCount = Math.min(count, available);

  // Distribuição equilibrada por matéria
  const per = Math.floor(effectiveCount / eligibleSubjectIds.length);
  let remainder = effectiveCount - (per * eligibleSubjectIds.length);

  const picked: { id: string; order: number }[] = [];
  const pickedQuestions: Awaited<ReturnType<typeof selectQuestionsForStudent>>["questions"] = [];

  for (const subjectId of eligibleSubjectIds) {
    const take = per + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (take <= 0) continue;

    const { questions } = await selectQuestionsForStudent({
      studentProfileId: profile.id,
      competitionId,
      jobRoleId,
      subjectIds: [subjectId],
      examBoardId,
      difficulty,
      quantity: take,
      deliveryType: "APOSTILA",
    });
    pickedQuestions.push(...questions);
  }

  // Completa o que faltou (se houver pool no conjunto) para respeitar exatamente a quantidade escolhida
  if (pickedQuestions.length < effectiveCount) {
    const remaining = effectiveCount - pickedQuestions.length;
    const { questions: extra } = await selectQuestionsForStudent({
      studentProfileId: profile.id,
      competitionId,
      jobRoleId,
      subjectIds: eligibleSubjectIds,
      examBoardId,
      difficulty,
      quantity: remaining,
      deliveryType: "APOSTILA",
    });

    const already = new Set(pickedQuestions.map((q) => q.question.id));
    for (const q of extra) {
      if (already.has(q.question.id)) continue;
      pickedQuestions.push(q);
      already.add(q.question.id);
      if (pickedQuestions.length >= effectiveCount) break;
    }
  }

  // Ordenação final embaralhada (mantém balanceamento, mas ainda aleatório)
  const shuffled = [...pickedQuestions]
    .sort(() => Math.random() - 0.5)
    .slice(0, effectiveCount)
    .map((x) => x.question);

  const rows: ApostilaQuestionRow[] = shuffled.map((q, i) => ({
    order: i + 1,
    content: q.content,
    supportText: q.supportText ?? null,
    subjectName: q.subject?.name ?? null,
    questionImageUrl: q.imageUrl ?? null,
    alternatives: q.alternatives.map((a) => ({
      letter: a.letter,
      content: a.content,
    })),
    correctAnswer: q.correctAnswer,
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
      questions={includeAnswerKey ? rows : rows.map((r) => ({ ...r, correctAnswer: "-" }))}
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
  });

  const filename = `apostila-${enrollment.competition.name.replace(/[^\w\-]+/g, "-").slice(0, 40)}-${Date.now()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Apostila-Requested": String(count),
      "X-Apostila-Available": String(available),
    },
  });
}
