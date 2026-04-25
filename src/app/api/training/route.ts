import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { competitionId, subjectIds, difficulty, quantity = 10 } = await req.json() as {
    competitionId?: string;
    subjectIds?: string[];
    difficulty?: string;
    quantity?: number;
  };

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // Determina quais subject IDs são permitidos para este aluno+concurso
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
    } else if (competitionId) {
      // Sem cargo específico: usa todas as matérias do concurso
      const links = await prisma.competitionSubject.findMany({
        where: { competitionId },
        select: { subjectId: true },
      });
      if (links.length > 0) allowedSubjectIds = links.map((l) => l.subjectId);
    }
  }

  // Intersecta matérias solicitadas pelo aluno com as permitidas
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
    ...(difficulty && difficulty !== "ALL" && { difficulty }),
  };

  const total = await prisma.question.count({ where });
  if (total === 0) {
    return NextResponse.json({
      error: "Nenhuma questão disponível com os filtros selecionados. Verifique se há questões cadastradas para as matérias deste concurso/cargo.",
    }, { status: 400 });
  }

  const skip = Math.max(0, Math.floor(Math.random() * Math.max(1, total - quantity)));
  const questions = await prisma.question.findMany({
    where,
    include: { alternatives: { orderBy: { order: "asc" } }, subject: { select: { name: true } } },
    take: Math.min(quantity * 2, 60),
    skip,
  });

  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, quantity);

  const trainingSession = await prisma.trainingSession.create({
    data: {
      studentProfileId: profile.id,
      competitionId: competitionId || null,
      subjectId: (effectiveSubjectIds?.length === 1 ? effectiveSubjectIds[0] : null) ?? null,
      totalQuestions: shuffled.length,
      filters: { subjectIds: effectiveSubjectIds, difficulty, quantity },
    },
  });

  await prisma.usedQuestion.createMany({
    data: shuffled.map((q) => ({ studentProfileId: profile.id, questionId: q.id, usedInType: "TRAINING" })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    sessionId: trainingSession.id,
    questions: shuffled.map((q) => ({
      id: q.id,
      content: q.content,
      supportText: q.supportText,
      correctAnswer: q.correctAnswer,
      subject: q.subject?.name,
      difficulty: q.difficulty,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      alternatives: q.alternatives.map((a) => ({ id: a.id, letter: a.letter, content: a.content })),
    })),
  });
}
