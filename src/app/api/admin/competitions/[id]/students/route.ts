import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: competitionId } = await params;

  const comp = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, name: true, status: true, examDate: true, examBoard: { select: { acronym: true } }, city: { select: { name: true, state: true } } },
  });
  if (!comp) return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });

  const enrollments = await prisma.studentCompetition.findMany({
    where: { competitionId, isActive: true },
    include: {
      jobRole: { select: { id: true, name: true } },
      studentProfile: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } },
    },
    orderBy: { enrolledAt: "asc" },
  });

  const studentProfileIds = enrollments.map((e) => e.studentProfileId);
  if (studentProfileIds.length === 0) {
    return NextResponse.json({
      competition: comp,
      students: [],
      summary: { students: 0, answered: 0, accuracyAvg: 0, examsCompleted: 0, trainingsCompleted: 0 },
      charts: { answersLast14d: [] as Array<{ day: string; answered: number }> },
    });
  }

  const [trainingSessions, simulatedExams] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { competitionId, studentProfileId: { in: studentProfileIds }, completedAt: { not: null } },
      select: { id: true, studentProfileId: true, completedAt: true },
    }),
    prisma.simulatedExam.findMany({
      where: { competitionId, studentProfileId: { in: studentProfileIds }, status: "COMPLETED" },
      select: { id: true, studentProfileId: true, completedAt: true },
    }),
  ]);

  const trainingIds = trainingSessions.map((s) => s.id);
  const examIds = simulatedExams.map((e) => e.id);

  // Respostas associadas ao concurso via sessionId (TRAINING/EXAM)
  const answers = await prisma.studentAnswer.findMany({
    where: {
      studentProfileId: { in: studentProfileIds },
      OR: [
        ...(trainingIds.length ? [{ sessionType: "TRAINING" as const, sessionId: { in: trainingIds } }] : []),
        ...(examIds.length ? [{ sessionType: "EXAM" as const, sessionId: { in: examIds } }] : []),
      ],
    },
    select: { studentProfileId: true, isCorrect: true, answeredAt: true },
  });

  const last14 = daysAgo(14);
  const dailyAnswered = new Map<string, number>();
  for (const a of answers) {
    if (a.answeredAt < last14) continue;
    const key = a.answeredAt.toISOString().slice(0, 10); // YYYY-MM-DD
    dailyAnswered.set(key, (dailyAnswered.get(key) ?? 0) + 1);
  }
  const answersLast14d: Array<{ day: string; answered: number }> = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    answersLast14d.push({ day: key, answered: dailyAnswered.get(key) ?? 0 });
  }

  // Agregações por aluno
  const answeredByStudent = new Map<string, { total: number; correct: number; lastAt: Date | null; last7d: number }>();
  const last7 = daysAgo(7);
  for (const a of answers) {
    const cur = answeredByStudent.get(a.studentProfileId) ?? { total: 0, correct: 0, lastAt: null, last7d: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    if (!cur.lastAt || a.answeredAt > cur.lastAt) cur.lastAt = a.answeredAt;
    if (a.answeredAt >= last7) cur.last7d += 1;
    answeredByStudent.set(a.studentProfileId, cur);
  }

  const trainingsByStudent = new Map<string, number>();
  for (const s of trainingSessions) trainingsByStudent.set(s.studentProfileId, (trainingsByStudent.get(s.studentProfileId) ?? 0) + 1);
  const examsByStudent = new Map<string, number>();
  for (const e of simulatedExams) examsByStudent.set(e.studentProfileId, (examsByStudent.get(e.studentProfileId) ?? 0) + 1);

  const rows = enrollments.map((e) => {
    const a = answeredByStudent.get(e.studentProfileId) ?? { total: 0, correct: 0, lastAt: null, last7d: 0 };
    const accuracy = a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0;
    const score =
      accuracy * 1000 +
      Math.min(2000, a.total) +
      (examsByStudent.get(e.studentProfileId) ?? 0) * 120 +
      (trainingsByStudent.get(e.studentProfileId) ?? 0) * 40 +
      Math.min(400, a.last7d) * 2;
    return {
      studentProfileId: e.studentProfileId,
      userId: e.studentProfile.user.id,
      name: e.studentProfile.user.name,
      email: e.studentProfile.user.email,
      isActive: e.studentProfile.user.isActive,
      jobRole: e.jobRole?.name ?? null,
      answeredTotal: a.total,
      accuracy,
      correct: a.correct,
      trainings: trainingsByStudent.get(e.studentProfileId) ?? 0,
      exams: examsByStudent.get(e.studentProfileId) ?? 0,
      lastActivityAt: a.lastAt,
      weeklyAnswered: a.last7d,
      score,
    };
  });

  rows.sort((a, b) => b.score - a.score);
  const ranked = rows.map((r, idx) => ({ ...r, rank: idx + 1 }));

  const answeredTotal = ranked.reduce((acc, r) => acc + r.answeredTotal, 0);
  const accuracyAvg = ranked.length
    ? Math.round(ranked.reduce((acc, r) => acc + r.accuracy, 0) / ranked.length)
    : 0;

  return NextResponse.json({
    competition: comp,
    students: ranked,
    summary: {
      students: ranked.length,
      answered: answeredTotal,
      accuracyAvg,
      examsCompleted: simulatedExams.length,
      trainingsCompleted: trainingSessions.length,
    },
    charts: { answersLast14d },
  });
}

