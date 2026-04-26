import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

type StatusFilter = "ALL" | "CORRECT" | "WRONG" | "UNANSWERED";
type OriginFilter = "ALL" | "TRAINING" | "EXAM" | "MANUAL";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
    if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page = clamp(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1, 9999);
    const limit = clamp(parseInt(searchParams.get("limit") ?? "25", 10) || 25, 5, 50);

    const search = (searchParams.get("search") ?? "").trim();
    const subjectId = (searchParams.get("subjectId") ?? "").trim() || null;
    const topicId = (searchParams.get("topicId") ?? "").trim() || null;
    const examBoardId = (searchParams.get("examBoardId") ?? "").trim() || null;
    const year = (searchParams.get("year") ?? "").trim() || null;
    const status = ((searchParams.get("status") ?? "ALL").toUpperCase() as StatusFilter) ?? "ALL";
    const origin = ((searchParams.get("origin") ?? "ALL").toUpperCase() as OriginFilter) ?? "ALL";

    const yearNum = year ? parseInt(year, 10) : null;

    // Busca por número da questão (id "Q123" ou "123") não existe no modelo, então tratamos como conteúdo.
    const qSearch = search;

    // Listagem compacta baseada em:
    // - últimas respostas por questão (StudentAnswer)
    // - + questões entregues e não respondidas (UsedQuestion sem StudentAnswer)
    //
    // Observação: usamos queryRaw para manter leve e paginável sem N+1.
    const rows = await prisma.$queryRaw<
    Array<{
      questionId: string;
      lastAnsweredAt: Date | null;
      lastIsCorrect: boolean | null;
      lastSelectedAnswer: string | null;
      lastSessionType: string | null;
      wrongCount: number;
      content: string;
      year: number | null;
      subjectName: string | null;
      topicName: string | null;
      examBoardAcronym: string | null;
    }>
  >`
WITH answer_events AS (
  -- Fonte primária: histórico consolidado (student_answers)
  SELECT
    sa."questionId",
    sa."answeredAt" AS "answeredAt",
    sa."isCorrect" AS "isCorrect",
    sa."selectedAnswer" AS "selectedAnswer",
    sa."sessionType"::text AS "sessionType",
    sa."sessionId" AS "sessionId",
    1::int AS "sourcePrio"
  FROM "student_answers" sa
  WHERE sa."studentProfileId" = ${profile.id}

  UNION ALL

  -- Fallback: treinos finalizados que (por algum motivo) não geraram StudentAnswer
  SELECT
    tsq."questionId",
    ts."completedAt" AS "answeredAt",
    tsq."isCorrect" AS "isCorrect",
    COALESCE(tsq."selectedAnswer", '-') AS "selectedAnswer",
    'TRAINING'::text AS "sessionType",
    ts."id" AS "sessionId",
    2::int AS "sourcePrio"
  FROM "training_session_questions" tsq
  JOIN "training_sessions" ts ON ts."id" = tsq."trainingSessionId"
  WHERE ts."studentProfileId" = ${profile.id}
    AND ts."completedAt" IS NOT NULL
    AND tsq."isCorrect" IS NOT NULL

  UNION ALL

  -- Fallback: simulados finalizados que (por algum motivo) não geraram StudentAnswer
  SELECT
    seq."questionId",
    se."completedAt" AS "answeredAt",
    seq."isCorrect" AS "isCorrect",
    COALESCE(seq."selectedAnswer", '-') AS "selectedAnswer",
    'EXAM'::text AS "sessionType",
    se."id" AS "sessionId",
    2::int AS "sourcePrio"
  FROM "simulated_exam_questions" seq
  JOIN "simulated_exams" se ON se."id" = seq."examId"
  WHERE se."studentProfileId" = ${profile.id}
    AND se."status" = 'COMPLETED'
    AND se."completedAt" IS NOT NULL
    AND seq."isCorrect" IS NOT NULL
),
last_answers AS (
  SELECT DISTINCT ON (ae."questionId")
    ae."questionId",
    ae."answeredAt" AS "lastAnsweredAt",
    ae."isCorrect" AS "lastIsCorrect",
    ae."selectedAnswer" AS "lastSelectedAnswer",
    ae."sessionType" AS "lastSessionType"
  FROM answer_events ae
  WHERE (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
  ORDER BY ae."questionId", ae."answeredAt" DESC, ae."sourcePrio" ASC
),
wrong_counts AS (
  SELECT ae."questionId", COUNT(*)::int AS "wrongCount"
  FROM answer_events ae
  WHERE ae."isCorrect" = false
    AND (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
  GROUP BY ae."questionId"
),
answered AS (
  SELECT
    q."id" AS "questionId",
    la."lastAnsweredAt",
    la."lastIsCorrect",
    la."lastSelectedAnswer",
    la."lastSessionType",
    COALESCE(wc."wrongCount", 0) AS "wrongCount",
    q."content",
    q."year",
    s."name" AS "subjectName",
    t."name" AS "topicName",
    eb."acronym" AS "examBoardAcronym"
  FROM last_answers la
  JOIN "questions" q ON q."id" = la."questionId"
  LEFT JOIN "subjects" s ON s."id" = q."subjectId"
  LEFT JOIN "topics" t ON t."id" = q."topicId"
  LEFT JOIN "exam_boards" eb ON eb."id" = q."examBoardId"
  LEFT JOIN wrong_counts wc ON wc."questionId" = q."id"
  WHERE (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
    AND (${topicId}::text IS NULL OR q."topicId" = ${topicId}::text)
    AND (${examBoardId}::text IS NULL OR q."examBoardId" = ${examBoardId}::text)
    AND (${yearNum}::int IS NULL OR q."year" = ${yearNum}::int)
    AND (
      ${qSearch}::text = '' OR
      q."content" ILIKE ('%' || ${qSearch}::text || '%') OR
      COALESCE(q."supportText",'') ILIKE ('%' || ${qSearch}::text || '%')
    )
    AND (
      ${status}::text = 'ALL' OR
      (${status}::text = 'CORRECT' AND la."lastIsCorrect" = true) OR
      (${status}::text = 'WRONG' AND la."lastIsCorrect" = false) OR
      (${status}::text = 'UNANSWERED' AND false)
    )
),
unanswered AS (
  SELECT
    q."id" AS "questionId",
    NULL::timestamp AS "lastAnsweredAt",
    NULL::boolean AS "lastIsCorrect",
    NULL::text AS "lastSelectedAnswer",
    NULL::text AS "lastSessionType",
    0::int AS "wrongCount",
    q."content",
    q."year",
    s."name" AS "subjectName",
    t."name" AS "topicName",
    eb."acronym" AS "examBoardAcronym"
  FROM "used_questions" uq
  JOIN "questions" q ON q."id" = uq."questionId"
  LEFT JOIN "subjects" s ON s."id" = q."subjectId"
  LEFT JOIN "topics" t ON t."id" = q."topicId"
  LEFT JOIN "exam_boards" eb ON eb."id" = q."examBoardId"
  WHERE uq."studentProfileId" = ${profile.id}
    AND NOT EXISTS (
      SELECT 1 FROM answer_events ae
      WHERE ae."questionId" = uq."questionId"
        AND (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
    )
    AND (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
    AND (${topicId}::text IS NULL OR q."topicId" = ${topicId}::text)
    AND (${examBoardId}::text IS NULL OR q."examBoardId" = ${examBoardId}::text)
    AND (${yearNum}::int IS NULL OR q."year" = ${yearNum}::int)
    AND (
      ${qSearch}::text = '' OR
      q."content" ILIKE ('%' || ${qSearch}::text || '%') OR
      COALESCE(q."supportText",'') ILIKE ('%' || ${qSearch}::text || '%')
    )
    AND (${status}::text = 'ALL' OR ${status}::text = 'UNANSWERED')
)
SELECT * FROM answered
UNION ALL
SELECT * FROM unanswered
ORDER BY "lastAnsweredAt" DESC NULLS LAST, "questionId" DESC
LIMIT ${limit} OFFSET ${(page - 1) * limit};
`;

    // total (para paginação) — calculado separado, mas barato com as mesmas CTEs.
    const totalRow = await prisma.$queryRaw<Array<{ total: bigint }>>`
WITH answer_events AS (
  SELECT
    sa."questionId",
    sa."answeredAt" AS "answeredAt",
    sa."isCorrect" AS "isCorrect",
    sa."sessionType"::text AS "sessionType",
    1::int AS "sourcePrio"
  FROM "student_answers" sa
  WHERE sa."studentProfileId" = ${profile.id}

  UNION ALL

  SELECT
    tsq."questionId",
    ts."completedAt" AS "answeredAt",
    tsq."isCorrect" AS "isCorrect",
    'TRAINING'::text AS "sessionType",
    2::int AS "sourcePrio"
  FROM "training_session_questions" tsq
  JOIN "training_sessions" ts ON ts."id" = tsq."trainingSessionId"
  WHERE ts."studentProfileId" = ${profile.id}
    AND ts."completedAt" IS NOT NULL
    AND tsq."isCorrect" IS NOT NULL

  UNION ALL

  SELECT
    seq."questionId",
    se."completedAt" AS "answeredAt",
    seq."isCorrect" AS "isCorrect",
    'EXAM'::text AS "sessionType",
    2::int AS "sourcePrio"
  FROM "simulated_exam_questions" seq
  JOIN "simulated_exams" se ON se."id" = seq."examId"
  WHERE se."studentProfileId" = ${profile.id}
    AND se."status" = 'COMPLETED'
    AND se."completedAt" IS NOT NULL
    AND seq."isCorrect" IS NOT NULL
),
last_answers AS (
  SELECT DISTINCT ON (ae."questionId")
    ae."questionId",
    ae."answeredAt" AS "lastAnsweredAt",
    ae."isCorrect" AS "lastIsCorrect",
    ae."sessionType" AS "lastSessionType"
  FROM answer_events ae
  WHERE (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
  ORDER BY ae."questionId", ae."answeredAt" DESC, ae."sourcePrio" ASC
),
answered AS (
  SELECT q."id"
  FROM last_answers la
  JOIN "questions" q ON q."id" = la."questionId"
  WHERE (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
    AND (${topicId}::text IS NULL OR q."topicId" = ${topicId}::text)
    AND (${examBoardId}::text IS NULL OR q."examBoardId" = ${examBoardId}::text)
    AND (${yearNum}::int IS NULL OR q."year" = ${yearNum}::int)
    AND (
      ${qSearch}::text = '' OR
      q."content" ILIKE ('%' || ${qSearch}::text || '%') OR
      COALESCE(q."supportText",'') ILIKE ('%' || ${qSearch}::text || '%')
    )
    AND (
      ${status}::text = 'ALL' OR
      (${status}::text = 'CORRECT' AND la."lastIsCorrect" = true) OR
      (${status}::text = 'WRONG' AND la."lastIsCorrect" = false) OR
      (${status}::text = 'UNANSWERED' AND false)
    )
),
unanswered AS (
  SELECT DISTINCT q."id"
  FROM "used_questions" uq
  JOIN "questions" q ON q."id" = uq."questionId"
  WHERE uq."studentProfileId" = ${profile.id}
    AND NOT EXISTS (
      SELECT 1 FROM answer_events ae
      WHERE ae."questionId" = uq."questionId"
        AND (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
    )
    AND (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
    AND (${topicId}::text IS NULL OR q."topicId" = ${topicId}::text)
    AND (${examBoardId}::text IS NULL OR q."examBoardId" = ${examBoardId}::text)
    AND (${yearNum}::int IS NULL OR q."year" = ${yearNum}::int)
    AND (
      ${qSearch}::text = '' OR
      q."content" ILIKE ('%' || ${qSearch}::text || '%') OR
      COALESCE(q."supportText",'') ILIKE ('%' || ${qSearch}::text || '%')
    )
    AND (${status}::text = 'ALL' OR ${status}::text = 'UNANSWERED')
)
SELECT COUNT(*)::bigint AS total FROM (
  SELECT "id" FROM answered
  UNION
  SELECT "id" FROM unanswered
) x;
`;

    const totalRaw = totalRow?.[0]?.total;
    const total = typeof totalRaw === "bigint" ? Number(totalRaw) : Number(totalRaw ?? 0);

    return NextResponse.json({
      page,
      limit,
      total,
      questions: rows.map((r) => ({
        questionId: r.questionId,
        snippet: r.content.length > 180 ? `${r.content.slice(0, 180)}…` : r.content,
        subjectName: r.subjectName,
        topicName: r.topicName,
        examBoardAcronym: r.examBoardAcronym,
        year: r.year,
        status: r.lastAnsweredAt == null ? "UNANSWERED" : (r.lastIsCorrect ? "CORRECT" : "WRONG"),
        lastAnsweredAt: r.lastAnsweredAt,
        wrongCount: r.wrongCount,
        origin: r.lastSessionType,
      })),
    });
  } catch (e) {
    console.error("[api/student/questions]", e);
    return NextResponse.json(
      { error: "Erro ao carregar questões. Tente novamente." },
      { status: 500 },
    );
  }
}

