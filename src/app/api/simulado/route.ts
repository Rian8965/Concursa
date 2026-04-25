import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { competitionId, subjectIds, quantity = 20, timeLimitMinutes = 60 } = await req.json() as {
    competitionId?: string;
    subjectIds?: string[];
    quantity?: number;
    timeLimitMinutes?: number;
  };

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // Filtra matérias pelo cargo do aluno neste concurso
  let allowedSubjectIds: string[] | null = null;
  if (competitionId) {
    const enrollment = await prisma.studentCompetition.findUnique({
      where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId } },
      select: { jobRoleId: true },
    });
    if (enrollment?.jobRoleId) {
      const links = await prisma.competitionJobRoleSubject.findMany({
        where: { competitionId, jobRoleId: enrollment.jobRoleId },
        select: { subjectId: true },
      });
      allowedSubjectIds = links.map((l) => l.subjectId);
    } else {
      // Sem cargo específico: todas as matérias do concurso
      const links = await prisma.competitionSubject.findMany({
        where: { competitionId },
        select: { subjectId: true },
      });
      if (links.length > 0) allowedSubjectIds = links.map((l) => l.subjectId);
    }
  }

  const effectiveSubjectIds: string[] | undefined = subjectIds?.length
    ? allowedSubjectIds
      ? subjectIds.filter((id) => allowedSubjectIds!.includes(id))
      : subjectIds
    : allowedSubjectIds ?? undefined;

  // CORREÇÃO CRÍTICA: filtrar por matéria quando disponível, sem exigir competitionId nas questões
  // + filtro por banca quando o concurso tem banca definida
  let examBoardId: string | null = null;
  if (competitionId) {
    const comp = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { examBoardId: true, examBoardDefined: true },
    });
    if (comp?.examBoardDefined && comp.examBoardId) examBoardId = comp.examBoardId;
  }

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    alternatives: { some: {} },
    ...(effectiveSubjectIds?.length
      ? { subjectId: { in: effectiveSubjectIds } }
      : competitionId
      ? { competitionId }
      : {}),
    ...(examBoardId && { examBoardId }),
  };

  const total = await prisma.question.count({ where });
  if (total === 0) {
    return NextResponse.json({
      error: "Nenhuma questão disponível para este concurso/cargo. Verifique se há questões cadastradas nas matérias.",
    }, { status: 400 });
  }

  const skip = Math.max(0, Math.floor(Math.random() * Math.max(1, total - quantity)));
  const questions = await prisma.question.findMany({
    where,
    include: { alternatives: { orderBy: { order: "asc" } }, subject: { select: { name: true } } },
    take: Math.min(quantity * 2, 100),
    skip,
  });

  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, quantity);

  const isFreeMode = !timeLimitMinutes || timeLimitMinutes <= 0;
  const timeAllowedSeconds = isFreeMode ? null : timeLimitMinutes * 60;

  const exam = await prisma.simulatedExam.create({
    data: {
      studentProfileId: profile.id,
      competitionId: competitionId || null,
      totalQuestions: shuffled.length,
      timeAllowedSeconds,
      status: "IN_PROGRESS",
      questions: {
        create: shuffled.map((q, i) => ({ questionId: q.id, order: i + 1 })),
      },
    },
  });

  return NextResponse.json({
    examId: exam.id,
    timeLimitSeconds: timeAllowedSeconds,
    questions: shuffled.map((q, i) => ({
      id: q.id,
      order: i + 1,
      content: q.content,
      supportText: q.supportText,
      subject: q.subject?.name,
      difficulty: q.difficulty,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      alternatives: q.alternatives.map((a) => ({ id: a.id, letter: a.letter, content: a.content })),
    })),
  });
}
