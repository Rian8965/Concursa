import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getEligibleSubjectsForStudentCompetition } from "@/lib/questions/eligible-subjects";
import { selectQuestionsForStudent } from "@/lib/questions/select-questions";
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

  if (!competitionId) {
    return NextResponse.json({ error: "concurso obrigatório" }, { status: 400 });
  }

  const { subjectIds: allowedSubjectIds, jobRoleId } = await getEligibleSubjectsForStudentCompetition({
    studentProfileId: profile.id,
    competitionId,
  });

  const effectiveSubjectIds: string[] | undefined = subjectIds?.length
    ? allowedSubjectIds?.length
      ? subjectIds.filter((id) => allowedSubjectIds!.includes(id))
      : subjectIds
    : allowedSubjectIds?.length ? allowedSubjectIds : undefined;

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

  const { questions: picked } = await selectQuestionsForStudent({
    studentProfileId: profile.id,
    competitionId,
    jobRoleId,
    subjectIds: effectiveSubjectIds ?? allowedSubjectIds,
    examBoardId,
    difficulty: null,
    quantity: Math.max(1, Math.min(120, Math.floor(quantity ?? 20))),
    deliveryType: "EXAM",
  });

  const shuffled = picked.map((p) => p.question);

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
