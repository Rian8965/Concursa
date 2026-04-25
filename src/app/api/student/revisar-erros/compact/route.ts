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
      content: string;
      year: number | null;
      subjectName: string | null;
      topicName: string | null;
      examBoardAcronym: string | null;
    }>
  >`
WITH wrong AS (
  SELECT
    sa."questionId",
    COUNT(*)::int AS "wrongCount",
    MAX(sa."answeredAt") AS "lastAttemptAt"
  FROM "student_answers" sa
  WHERE sa."studentProfileId" = ${profile.id}
    AND sa."isCorrect" = false
    AND (${origin}::text = 'ALL' OR sa."sessionType" = ${origin}::text)
    AND (${startDt}::timestamp IS NULL OR sa."answeredAt" >= ${startDt}::timestamp)
    AND (${endDt}::timestamp IS NULL OR sa."answeredAt" <= ${endDt}::timestamp)
  GROUP BY sa."questionId"
),
last_origin AS (
  SELECT DISTINCT ON (sa."questionId")
    sa."questionId",
    sa."sessionType" AS "lastOrigin"
  FROM "student_answers" sa
  WHERE sa."studentProfileId" = ${profile.id}
    AND sa."isCorrect" = false
    AND (${origin}::text = 'ALL' OR sa."sessionType" = ${origin}::text)
  ORDER BY sa."questionId", sa."answeredAt" DESC
)
SELECT
  q."id" AS "questionId",
  w."wrongCount",
  w."lastAttemptAt",
  lo."lastOrigin",
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
    q."content" ILIKE ('%' || ${search}::text || '%') OR
    COALESCE(q."supportText",'') ILIKE ('%' || ${search}::text || '%')
  )
ORDER BY w."lastAttemptAt" DESC
LIMIT ${limit} OFFSET ${(page - 1) * limit};
`;

  const totalRow = await prisma.$queryRaw<Array<{ total: bigint }>>`
WITH wrong AS (
  SELECT sa."questionId"
  FROM "student_answers" sa
  WHERE sa."studentProfileId" = ${profile.id}
    AND sa."isCorrect" = false
    AND (${origin}::text = 'ALL' OR sa."sessionType" = ${origin}::text)
    AND (${startDt}::timestamp IS NULL OR sa."answeredAt" >= ${startDt}::timestamp)
    AND (${endDt}::timestamp IS NULL OR sa."answeredAt" <= ${endDt}::timestamp)
  GROUP BY sa."questionId"
)
SELECT COUNT(*)::bigint AS total FROM wrong;
`;

  return NextResponse.json({
    page,
    limit,
    total: Number(totalRow?.[0]?.total ?? 0n),
    items: rows.map((r) => ({
      questionId: r.questionId,
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

