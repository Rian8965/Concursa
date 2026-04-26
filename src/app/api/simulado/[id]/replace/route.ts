import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getEligibleSubjectsForStudentCompetition } from "@/lib/questions/eligible-subjects";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { questionId?: string };
  const removeQuestionId = String(body.questionId ?? "").trim();
  if (!removeQuestionId) return NextResponse.json({ error: "questionId obrigatório" }, { status: 400 });

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const exam = await prisma.simulatedExam.findUnique({
    where: { id },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!exam || exam.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
  }

  const row = exam.questions.find((q) => q.questionId === removeQuestionId);
  if (!row) return NextResponse.json({ error: "Questão não pertence a este simulado" }, { status: 400 });

  const competitionId = exam.competitionId;
  if (!competitionId) return NextResponse.json({ error: "Simulado sem concurso" }, { status: 400 });

  const { enrolled, subjectIds } = await getEligibleSubjectsForStudentCompetition({
    studentProfileId: profile.id,
    competitionId,
  });
  if (!enrolled) return NextResponse.json({ error: "Você não está inscrito neste concurso" }, { status: 403 });

  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { examBoardDefined: true, examBoardId: true },
  });
  const examBoardId = (comp?.examBoardDefined && comp.examBoardId) ? comp.examBoardId : null;

  const currentIds = exam.questions.map((q) => q.questionId);

  const baseWhere = {
    status: "ACTIVE" as const,
    isMarkedSuspect: false as const,
    alternatives: { some: {} as const },
    AND: [
      {
        OR: [
          { subjectId: { in: subjectIds } },
          { aiMeta: { suggestedSubjectId: { in: subjectIds } } },
        ],
      },
      ...(examBoardId
        ? [{
            OR: [{ examBoardId }, { aiMeta: { suggestedExamBoardId: examBoardId } }],
          }]
        : []),
    ],
  };

  const pool = await prisma.question.findMany({
    where: { ...baseWhere, id: { notIn: currentIds } },
    select: { id: true },
    take: 300,
  });
  const ids = pool.map((p) => p.id);
  if (!ids.length) {
    return NextResponse.json(
      { error: "Não há questões compatíveis disponíveis para substituir agora." },
      { status: 404 },
    );
  }
  const pickId = ids[Math.floor(Math.random() * ids.length)]!;

  await prisma.simulatedExamQuestion.update({
    where: { id: row.id },
    data: { questionId: pickId, selectedAnswer: null, isCorrect: null, timeSpentSeconds: null },
  });

  const q = await prisma.question.findUnique({
    where: { id: pickId },
    include: {
      alternatives: { orderBy: { order: "asc" } },
      subject: { select: { name: true } },
    },
  });
  if (!q) return NextResponse.json({ error: "Falha ao carregar questão de reposição" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    replaced: { removedQuestionId: removeQuestionId, newQuestionId: pickId, order: row.order },
    question: {
      id: q.id,
      order: row.order,
      content: q.content,
      supportText: q.supportText,
      subject: q.subject?.name,
      difficulty: q.difficulty,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      alternatives: q.alternatives.map((a) => ({ id: a.id, letter: a.letter, content: a.content, imageUrl: a.imageUrl ?? null })),
    },
  });
}

