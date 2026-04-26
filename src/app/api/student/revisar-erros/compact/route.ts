import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

type OriginFilter = "ALL" | "TRAINING" | "EXAM" | "MANUAL";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
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
  const origin = ((searchParams.get("origin") ?? "ALL").toUpperCase() as OriginFilter) ?? "ALL";
  const start = (searchParams.get("start") ?? "").trim() || null; // yyyy-mm-dd
  const end = (searchParams.get("end") ?? "").trim() || null;

  const yearNum = year ? parseInt(year, 10) : null;
  const startDt = start ? new Date(`${start}T00:00:00.000Z`) : null;
  const endDt = end ? new Date(`${end}T23:59:59.999Z`) : null;

  const rows = await prisma.$queryRaw<
    Array<{
      questionId: string;
      wrongCount: number;
      lastAttemptAt: Date;
      lastOrigin: string;
      code: string | null;
      content: string;
      year: number | null;
      subjectName: string | null;
      topicName: string | null;
      examBoardAcronym: string | null;
    }>
  >`
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
wrong AS (
  SELECT
    ae."questionId",
    COUNT(*)::int AS "wrongCount",
    MAX(ae."answeredAt") AS "lastAttemptAt"
  FROM answer_events ae
  WHERE ae."isCorrect" = false
    AND (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
    AND (${startDt}::timestamp IS NULL OR ae."answeredAt" >= ${startDt}::timestamp)
    AND (${endDt}::timestamp IS NULL OR ae."answeredAt" <= ${endDt}::timestamp)
  GROUP BY ae."questionId"
),
last_origin AS (
  SELECT DISTINCT ON (ae."questionId")
    ae."questionId",
    ae."sessionType" AS "lastOrigin"
  FROM answer_events ae
  WHERE ae."isCorrect" = false
    AND (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
  ORDER BY ae."questionId", ae."answeredAt" DESC, ae."sourcePrio" ASC
)
SELECT
  q."id" AS "questionId",
  w."wrongCount",
  w."lastAttemptAt",
  lo."lastOrigin",
  q."code" AS "code",
  q."content",
  q."year",
  s."name" AS "subjectName",
  t."name" AS "topicName",
  eb."acronym" AS "examBoardAcronym"
FROM wrong w
JOIN "questions" q ON q."id" = w."questionId"
LEFT JOIN last_origin lo ON lo."questionId" = w."questionId"
LEFT JOIN "subjects" s ON s."id" = q."subjectId"
LEFT JOIN "topics" t ON t."id" = q."topicId"
LEFT JOIN "exam_boards" eb ON eb."id" = q."examBoardId"
WHERE (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
  AND (${topicId}::text IS NULL OR q."topicId" = ${topicId}::text)
  AND (${examBoardId}::text IS NULL OR q."examBoardId" = ${examBoardId}::text)
  AND (${yearNum}::int IS NULL OR q."year" = ${yearNum}::int)
  AND (
    ${search}::text = '' OR
    COALESCE(q."code",'') ILIKE ('%' || ${search}::text || '%') OR
    q."content" ILIKE ('%' || ${search}::text || '%') OR
    COALESCE(q."supportText",'') ILIKE ('%' || ${search}::text || '%')
  )
ORDER BY w."lastAttemptAt" DESC
LIMIT ${limit} OFFSET ${(page - 1) * limit};
`;

  const totalRow = await prisma.$queryRaw<Array<{ total: bigint }>>`
WITH answer_events AS (
  SELECT
    sa."questionId",
    sa."answeredAt" AS "answeredAt",
    sa."isCorrect" AS "isCorrect",
    sa."sessionType"::text AS "sessionType"
  FROM "student_answers" sa
  WHERE sa."studentProfileId" = ${profile.id}

  UNION ALL

  SELECT
    tsq."questionId",
    ts."completedAt" AS "answeredAt",
    tsq."isCorrect" AS "isCorrect",
    'TRAINING'::text AS "sessionType"
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
    'EXAM'::text AS "sessionType"
  FROM "simulated_exam_questions" seq
  JOIN "simulated_exams" se ON se."id" = seq."examId"
  WHERE se."studentProfileId" = ${profile.id}
    AND se."status" = 'COMPLETED'
    AND se."completedAt" IS NOT NULL
    AND seq."isCorrect" IS NOT NULL
),
wrong AS (
  SELECT ae."questionId"
  FROM answer_events ae
  WHERE ae."isCorrect" = false
    AND (${origin}::text = 'ALL' OR ae."sessionType" = ${origin}::text)
    AND (${startDt}::timestamp IS NULL OR ae."answeredAt" >= ${startDt}::timestamp)
    AND (${endDt}::timestamp IS NULL OR ae."answeredAt" <= ${endDt}::timestamp)
  GROUP BY ae."questionId"
)
SELECT COUNT(*)::bigint AS total FROM wrong;
`;

  return NextResponse.json({
    page,
    limit,
    total: (() => {
      const raw = totalRow?.[0]?.total;
      return typeof raw === "bigint" ? Number(raw) : Number(raw ?? 0);
    })(),
    items: rows.map((r) => ({
      questionId: r.questionId,
      code: r.code,
      snippet: r.content.length > 180 ? `${r.content.slice(0, 180)}…` : r.content,
      subjectName: r.subjectName,
      topicName: r.topicName,
      examBoardAcronym: r.examBoardAcronym,
      year: r.year,
      wrongCount: r.wrongCount,
      lastAttemptAt: r.lastAttemptAt,
      origin: r.lastOrigin,
    })),
  });
}

