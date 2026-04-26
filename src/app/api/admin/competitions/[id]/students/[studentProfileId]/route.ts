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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; studentProfileId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: competitionId, studentProfileId } = await params;

  const [comp, enrollment] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, status: true, examDate: true, examBoard: { select: { acronym: true } }, city: { select: { name: true, state: true } } },
    }),
    prisma.studentCompetition.findUnique({
      where: { studentProfileId_competitionId: { studentProfileId, competitionId } },
      include: { jobRole: { select: { id: true, name: true } }, studentProfile: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } } },
    }),
  ]);
  if (!comp) return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });
  if (!enrollment) return NextResponse.json({ error: "Aluno não está inscrito neste concurso" }, { status: 404 });

  const [trainingSessions, simulatedExams] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { competitionId, studentProfileId, completedAt: { not: null } },
      select: { id: true, createdAt: true, completedAt: true, correctAnswers: true, totalQuestions: true, timeSpentSeconds: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.simulatedExam.findMany({
      where: { competitionId, studentProfileId, status: "COMPLETED" },
      select: { id: true, createdAt: true, completedAt: true, correctAnswers: true, totalQuestions: true, timeSpentSeconds: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const trainingIds = trainingSessions.map((s) => s.id);
  const examIds = simulatedExams.map((e) => e.id);

  const answers = await prisma.studentAnswer.findMany({
    where: {
      studentProfileId,
      OR: [
        ...(trainingIds.length ? [{ sessionType: "TRAINING" as const, sessionId: { in: trainingIds } }] : []),
        ...(examIds.length ? [{ sessionType: "EXAM" as const, sessionId: { in: examIds } }] : []),
      ],
    },
    select: { isCorrect: true, answeredAt: true, question: { select: { subject: { select: { name: true } } } } },
    orderBy: { answeredAt: "asc" },
  });

  const totalAnswered = answers.length;
  const totalCorrect = answers.filter((a) => a.isCorrect).length;
  const accuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const bySubject = new Map<string, { subject: string; total: number; correct: number }>();
  for (const a of answers) {
    const subj = a.question.subject?.name ?? "Sem matéria";
    const cur = bySubject.get(subj) ?? { subject: subj, total: 0, correct: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    bySubject.set(subj, cur);
  }
  const subjectPerformance = Array.from(bySubject.values())
    .map((s) => ({ ...s, accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  // Evolução (últimos 30 dias)
  const last30 = daysAgo(30);
  const daily = new Map<string, { day: string; answered: number; correct: number }>();
  for (const a of answers) {
    if (a.answeredAt < last30) continue;
    const key = a.answeredAt.toISOString().slice(0, 10);
    const cur = daily.get(key) ?? { day: key, answered: 0, correct: 0 };
    cur.answered += 1;
    if (a.isCorrect) cur.correct += 1;
    daily.set(key, cur);
  }
  const evolution: Array<{ day: string; answered: number; accuracy: number }> = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    const cur = daily.get(key) ?? { day: key, answered: 0, correct: 0 };
    evolution.push({ day: key, answered: cur.answered, accuracy: cur.answered ? Math.round((cur.correct / cur.answered) * 100) : 0 });
  }

  const avgTimePerQuestionSeconds = totalAnswered
    ? Math.round(
        (
          trainingSessions.reduce((acc, s) => acc + (s.timeSpentSeconds ?? 0), 0) +
          simulatedExams.reduce((acc, e) => acc + (e.timeSpentSeconds ?? 0), 0)
        ) / Math.max(1, totalAnswered),
      )
    : 0;

  const lastActivityAt = answers.length ? answers[answers.length - 1]!.answeredAt : null;

  return NextResponse.json({
    competition: comp,
    student: {
      studentProfileId,
      userId: enrollment.studentProfile.user.id,
      name: enrollment.studentProfile.user.name,
      email: enrollment.studentProfile.user.email,
      isActive: enrollment.studentProfile.user.isActive,
      jobRole: enrollment.jobRole?.name ?? null,
      enrolledAt: enrollment.enrolledAt,
      lastActivityAt,
      totalAnswered,
      totalCorrect,
      accuracy,
      trainingsCompleted: trainingSessions.length,
      examsCompleted: simulatedExams.length,
      avgTimePerQuestionSeconds,
    },
    subjectPerformance,
    evolution,
    sessions: {
      trainings: trainingSessions,
      exams: simulatedExams,
    },
  });
}

