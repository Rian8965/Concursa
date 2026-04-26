import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function classifyDifficulty(acc: number | null) {
  if (acc == null) return "—";
  if (acc > 0.7) return "Fácil";
  if (acc >= 0.5) return "Média";
  return "Difícil";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const board = await prisma.examBoard.findUnique({ where: { id } });
  if (!board) return NextResponse.json({ error: "Banca não encontrada" }, { status: 404 });

  // Total de questões (ativas, com alternativas)
  const questionWhere = {
    status: "ACTIVE" as const,
    examBoardId: id,
    alternatives: { some: {} as const },
  };

  const [totalQuestions, distinctSubjects] = await Promise.all([
    prisma.question.count({ where: questionWhere }),
    prisma.question.findMany({
      where: { ...questionWhere, subjectId: { not: null } },
      distinct: ["subjectId"],
      select: { subjectId: true },
    }),
  ]);

  // Estatísticas de respostas dos alunos (student_answers) para questões dessa banca
  const [row] = await prisma.$queryRaw<Array<{ totalAnswers: bigint; correctAnswers: bigint }>>`
SELECT
  COUNT(*)::bigint AS "totalAnswers",
  SUM(CASE WHEN sa."isCorrect" = true THEN 1 ELSE 0 END)::bigint AS "correctAnswers"
FROM "student_answers" sa
JOIN "questions" q ON q."id" = sa."questionId"
WHERE q."examBoardId" = ${id}
`;

  const totalAnswers = Number(row?.totalAnswers ?? 0);
  const correctAnswers = Number(row?.correctAnswers ?? 0);
  const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : null;

  // Breakdown por matéria (somente matérias com questões da banca)
  const subjectRows = await prisma.$queryRaw<Array<{
    subjectId: string;
    subjectName: string;
    totalQuestions: bigint;
    totalAnswers: bigint;
    correctAnswers: bigint;
  }>>`
SELECT
  s."id" AS "subjectId",
  s."name" AS "subjectName",
  COUNT(DISTINCT q."id")::bigint AS "totalQuestions",
  COUNT(sa."id")::bigint AS "totalAnswers",
  SUM(CASE WHEN sa."isCorrect" = true THEN 1 ELSE 0 END)::bigint AS "correctAnswers"
FROM "subjects" s
JOIN "questions" q ON q."subjectId" = s."id"
LEFT JOIN "student_answers" sa ON sa."questionId" = q."id"
WHERE q."examBoardId" = ${id}
  AND q."status" = 'ACTIVE'
GROUP BY s."id", s."name"
ORDER BY COUNT(DISTINCT q."id") DESC, s."name" ASC
`;

  const subjects = subjectRows.map((r) => {
    const tq = Number(r.totalQuestions ?? 0);
    const ta = Number(r.totalAnswers ?? 0);
    const ca = Number(r.correctAnswers ?? 0);
    const acc = ta > 0 ? ca / ta : null;
    return {
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      totalQuestions: tq,
      totalAnswers: ta,
      accuracy: acc,
      difficulty: classifyDifficulty(acc),
    };
  });

  // evolução ao longo do tempo (últimos 90 dias, por dia) se houver dados
  const days = await prisma.$queryRaw<Array<{ day: string; answers: bigint; correct: bigint }>>`
SELECT
  to_char(date_trunc('day', sa."answeredAt"), 'YYYY-MM-DD') AS "day",
  COUNT(*)::bigint AS "answers",
  SUM(CASE WHEN sa."isCorrect" = true THEN 1 ELSE 0 END)::bigint AS "correct"
FROM "student_answers" sa
JOIN "questions" q ON q."id" = sa."questionId"
WHERE q."examBoardId" = ${id}
  AND sa."answeredAt" >= (now() - interval '90 days')
GROUP BY 1
ORDER BY 1 ASC
`;

  return NextResponse.json({
    board: { id: board.id, acronym: board.acronym, name: board.name, website: board.website, isActive: board.isActive },
    kpis: {
      totalQuestions,
      totalSubjects: distinctSubjects.length,
      totalAnswers,
      accuracy,
      difficulty: classifyDifficulty(accuracy),
    },
    subjects,
    timeline: days.map((d) => {
      const a = Number(d.answers ?? 0);
      const c = Number(d.correct ?? 0);
      return { day: d.day, answers: a, accuracy: a > 0 ? c / a : null };
    }),
  });
}

