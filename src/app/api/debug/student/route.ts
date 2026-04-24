/**
 * Endpoint de diagnóstico — apenas para debug.
 * Acesse: /api/debug/student (autenticado como aluno ou admin)
 * Retorna o resultado das queries do dashboard/concursos ou o erro detalhado.
 */
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const results: Record<string, unknown> = {
    userId: session.user.id,
    userName: session.user.name,
    role: session.user.role,
  };

  // Test 1: studentProfile
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      include: { plan: true },
    });
    results.test1_profile = { ok: true, hasProfile: !!profile, planId: profile?.planId ?? null };
  } catch (e) {
    results.test1_profile = { ok: false, error: String(e) };
  }

  // Test 2: studentProfile with competition include (dashboard query)
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        plan: true,
        studentCompetitions: {
          where: { isActive: true },
          include: {
            competition: { include: { city: true, examBoard: true } },
            jobRole: true,
          },
          take: 4,
        },
      },
    });
    results.test2_dashboard_query = {
      ok: true,
      competitions: profile?.studentCompetitions?.map((sc) => ({
        id: sc.competitionId,
        name: sc.competition?.name,
        cityId: sc.competition?.cityId,
        hasCity: !!sc.competition?.city,
        cityName: sc.competition?.city?.name ?? null,
      })) ?? [],
    };
  } catch (e) {
    results.test2_dashboard_query = { ok: false, error: String(e) };
  }

  // Test 3: counts (dashboard)
  const profileId = (results.test1_profile as { hasProfile?: boolean } & { ok: boolean })?.ok
    ? (await prisma.studentProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }))?.id ?? ""
    : "";

  if (profileId) {
    try {
      const [a, b, c, d] = await Promise.all([
        prisma.studentAnswer.count({ where: { studentProfileId: profileId } }),
        prisma.studentAnswer.count({ where: { studentProfileId: profileId, isCorrect: true } }),
        prisma.trainingSession.count({ where: { studentProfileId: profileId } }),
        prisma.simulatedExam.count({ where: { studentProfileId: profileId, status: "COMPLETED" } }),
      ]);
      results.test3_counts = { ok: true, answers: a, correct: b, trainings: c, simulados: d };
    } catch (e) {
      results.test3_counts = { ok: false, error: String(e) };
    }
  }

  // Test 4: studentCompetition with subjects (concursos page query)
  if (profileId) {
    try {
      const sc = await prisma.studentCompetition.findMany({
        where: { studentProfileId: profileId, isActive: true },
        include: {
          competition: {
            include: { city: true, examBoard: true, subjects: { include: { subject: true } } },
          },
          jobRole: true,
        },
        take: 5,
      });
      results.test4_concursos_query = {
        ok: true,
        count: sc.length,
        items: sc.map((s) => ({
          competitionId: s.competitionId,
          name: s.competition?.name,
          hasCity: !!s.competition?.city,
          subjectsCount: s.competition?.subjects?.length ?? 0,
        })),
      };
    } catch (e) {
      results.test4_concursos_query = { ok: false, error: String(e) };
    }
  }

  // Test 5: check if new migration tables exist
  try {
    await prisma.$queryRaw`SELECT 1 FROM "competition_stages" LIMIT 1`;
    results.test5_migration_stages = { ok: true };
  } catch (e) {
    results.test5_migration_stages = { ok: false, error: "competition_stages table missing — run migrations!" };
  }

  try {
    await prisma.$queryRaw`SELECT 1 FROM "question_reports" LIMIT 1`;
    results.test6_migration_reports = { ok: true };
  } catch (e) {
    results.test6_migration_reports = { ok: false, error: "question_reports table missing — run migrations!" };
  }

  try {
    await prisma.$queryRaw`SELECT "isMarkedSuspect" FROM "questions" LIMIT 1`;
    results.test7_question_column = { ok: true };
  } catch (e) {
    results.test7_question_column = { ok: false, error: "isMarkedSuspect column missing in questions — run migrations!" };
  }

  return NextResponse.json(results, { status: 200 });
}
