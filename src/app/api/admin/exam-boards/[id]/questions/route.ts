import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const subjectId = (url.searchParams.get("subjectId") ?? "").trim() || null;
  const search = (url.searchParams.get("search") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim().toUpperCase();
  const page = clamp(parseInt(url.searchParams.get("page") ?? "1", 10) || 1, 1, 9999);
  const limit = clamp(parseInt(url.searchParams.get("limit") ?? "25", 10) || 25, 5, 50);
  const offset = (page - 1) * limit;

  const statusFilter =
    status === "ACTIVE" || status === "INACTIVE" || status === "PENDING_REVIEW" || status === "REJECTED"
      ? status
      : null;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    code: string | null;
    content: string;
    year: number | null;
    difficulty: string;
    status: string;
    subjectName: string | null;
    topicName: string | null;
    jobRoleName: string | null;
    jobRoleLevel: string | null;
    totalAnswers: bigint;
    correctAnswers: bigint;
  }>>`
SELECT
  q."id",
  q."code",
  q."content",
  q."year",
  q."difficulty"::text AS "difficulty",
  q."status"::text AS "status",
  s."name" AS "subjectName",
  t."name" AS "topicName",
  jr."name" AS "jobRoleName",
  jr."level" AS "jobRoleLevel",
  COUNT(sa."id")::bigint AS "totalAnswers",
  SUM(CASE WHEN sa."isCorrect" = true THEN 1 ELSE 0 END)::bigint AS "correctAnswers"
FROM "questions" q
LEFT JOIN "subjects" s ON s."id" = q."subjectId"
LEFT JOIN "topics" t ON t."id" = q."topicId"
LEFT JOIN "job_roles" jr ON jr."id" = q."jobRoleId"
LEFT JOIN "student_answers" sa ON sa."questionId" = q."id"
WHERE q."examBoardId" = ${id}
  AND (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
  AND (${statusFilter}::text IS NULL OR q."status"::text = ${statusFilter}::text)
  AND (
    ${search}::text = '' OR
    COALESCE(q."code",'') ILIKE ('%' || ${search}::text || '%') OR
    q."content" ILIKE ('%' || ${search}::text || '%') OR
    COALESCE(q."supportText",'') ILIKE ('%' || ${search}::text || '%')
  )
GROUP BY q."id", s."name", t."name", jr."name", jr."level"
ORDER BY q."createdAt" DESC
LIMIT ${limit} OFFSET ${offset};
`;

  const totalRow = await prisma.$queryRaw<Array<{ total: bigint }>>`
SELECT COUNT(*)::bigint AS total
FROM "questions" q
WHERE q."examBoardId" = ${id}
  AND (${subjectId}::text IS NULL OR q."subjectId" = ${subjectId}::text)
  AND (${statusFilter}::text IS NULL OR q."status"::text = ${statusFilter}::text)
  AND (
    ${search}::text = '' OR
    COALESCE(q."code",'') ILIKE ('%' || ${search}::text || '%') OR
    q."content" ILIKE ('%' || ${search}::text || '%') OR
    COALESCE(q."supportText",'') ILIKE ('%' || ${search}::text || '%')
  );
`;

  const totalRaw = totalRow?.[0]?.total;
  const total = typeof totalRaw === "bigint" ? Number(totalRaw) : Number(totalRaw ?? 0);

  return NextResponse.json({
    page,
    limit,
    total,
    questions: rows.map((r) => {
      const totalAnswers = Number(r.totalAnswers ?? 0);
      const correctAnswers = Number(r.correctAnswers ?? 0);
      const accuracy = totalAnswers > 0 ? correctAnswers / totalAnswers : null;
      return {
        id: r.id,
        code: r.code,
        snippet: r.content.length > 220 ? `${r.content.slice(0, 220)}…` : r.content,
        year: r.year,
        difficulty: r.difficulty,
        status: r.status,
        subjectName: r.subjectName,
        topicName: r.topicName,
        jobRoleName: r.jobRoleName,
        jobRoleLevel: r.jobRoleLevel,
        totalAnswers,
        accuracy,
      };
    }),
  });
}

