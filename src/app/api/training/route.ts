import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getEligibleSubjectsForStudentCompetition } from "@/lib/questions/eligible-subjects";
import { selectQuestionsForStudent } from "@/lib/questions/select-questions";
import { Difficulty, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function normalizeImageUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const t = u.trim();
  if (!t) return null;
  if (t.startsWith("data:")) return t;
  if (t.startsWith("https://")) return t;
  if (t.startsWith("http://")) return `https://${t.slice("http://".length)}`;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("gcs://")) {
    const rest = t.slice("gcs://".length);
    const idx = rest.indexOf("/");
    const bucket = idx === -1 ? rest : rest.slice(0, idx);
    const object = idx === -1 ? "" : rest.slice(idx + 1);
    if (!bucket || !object) return null;
    return `https://storage.googleapis.com/${bucket}/${object}`;
  }
  return t;
}

function parseDifficultyFilter(d: unknown): Difficulty | undefined {
  if (d !== "EASY" && d !== "MEDIUM" && d !== "HARD") return undefined;
  return d;
}

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

  if (!competitionId) {
    return NextResponse.json({ error: "concurso obrigatório" }, { status: 400 });
  }

  const { enrolled, subjectIds: allowedSubjectIds, jobRoleId } = await getEligibleSubjectsForStudentCompetition({
    studentProfileId: profile.id,
    competitionId,
  });

  if (!enrolled) {
    return NextResponse.json(
      { code: "NOT_ENROLLED", error: "Você não está inscrito neste concurso." },
      { status: 403 },
    );
  }

  if (!allowedSubjectIds.length) {
    return NextResponse.json(
      {
        code: jobRoleId ? "NO_SUBJECTS_FOR_JOB" : "NO_SUBJECTS_FOR_COMPETITION",
        error: jobRoleId
          ? "Não há matérias vinculadas ao seu cargo neste concurso. Peça ao administrador para configurar as matérias do cargo."
          : "Não há matérias vinculadas a este concurso. Peça ao administrador para configurar as matérias do edital.",
      },
      { status: 400 },
    );
  }

  // Intersecta matérias solicitadas pelo aluno com as permitidas
  let effectiveSubjectIds: string[] = allowedSubjectIds;
  if (subjectIds?.length) {
    const inter = subjectIds.filter((id) => allowedSubjectIds.includes(id));
    effectiveSubjectIds = inter.length ? inter : allowedSubjectIds;
  }

  // CORREÇÃO CRÍTICA: filtrar por matéria quando disponível, sem exigir competitionId nas questões
  // + filtro por banca quando o concurso tem banca definida
  let examBoardId: string | null = null;
  let boardRequired = false;
  if (competitionId) {
    const comp = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { examBoardId: true, examBoardDefined: true },
    });
    boardRequired = Boolean(comp?.examBoardDefined && comp.examBoardId);
    if (boardRequired) examBoardId = comp!.examBoardId!;
  }

  const diffFilter = difficulty && difficulty !== "ALL" ? parseDifficultyFilter(difficulty) : undefined;

  const poolBase: Prisma.QuestionWhereInput = {
    status: "ACTIVE",
    isMarkedSuspect: false,
    alternatives: { some: {} },
    AND: [
      {
        OR: [
          { subjectId: { in: effectiveSubjectIds } },
          { aiMeta: { suggestedSubjectId: { in: effectiveSubjectIds } } },
        ],
      },
      ...(examBoardId
        ? [
            {
              OR: [{ examBoardId: examBoardId }, { aiMeta: { suggestedExamBoardId: examBoardId } }],
            } as Prisma.QuestionWhereInput,
          ]
        : []),
    ],
    ...(diffFilter ? { difficulty: diffFilter } : {}),
  };

  const available = await prisma.question.count({ where: poolBase });
  if (available === 0) {
    return NextResponse.json(
      {
        code: boardRequired ? "NO_QUESTIONS_FOR_BOARD" : "NO_QUESTIONS_FOR_SUBJECTS",
        error: boardRequired
          ? "Não há questões ativas compatíveis com a banca deste concurso e com as matérias do seu cargo."
          : "Não há questões ativas compatíveis com as matérias do seu cargo (ou do concurso).",
      },
      { status: 404 },
    );
  }

  const { questions: picked } = await selectQuestionsForStudent({
    studentProfileId: profile.id,
    competitionId,
    jobRoleId,
    subjectIds: effectiveSubjectIds,
    examBoardId,
    difficulty: diffFilter ?? null,
    quantity: Math.max(1, Math.min(60, Math.floor(quantity ?? 10))),
    deliveryType: "TRAINING",
  });

  const shuffled = picked.map((p) => p.question);
  if (!shuffled.length) {
    return NextResponse.json(
      {
        code: "NO_QUESTIONS_MATCH_FILTERS",
        error: "Não foi possível montar a lista de questões com os filtros atuais (por exemplo, dificuldade). Tente outra combinação.",
      },
      { status: 404 },
    );
  }

  const trainingSession = await prisma.trainingSession.create({
    data: {
      studentProfileId: profile.id,
      competitionId: competitionId || null,
      subjectId: (effectiveSubjectIds?.length === 1 ? effectiveSubjectIds[0] : null) ?? null,
      totalQuestions: shuffled.length,
      filters: { subjectIds: effectiveSubjectIds, difficulty, quantity },
    },
  });

  await prisma.trainingSessionQuestion.createMany({
    data: shuffled.map((q, i) => ({
      trainingSessionId: trainingSession.id,
      questionId: q.id,
      order: i + 1,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    sessionId: trainingSession.id,
    questions: shuffled.map((q) => ({
      id: q.id,
      content: q.content,
      supportText: q.supportText,
      subject: q.subject?.name,
      difficulty: q.difficulty,
      hasImage: q.hasImage,
      imageUrl: normalizeImageUrl(q.imageUrl),
      alternatives: q.alternatives.map((a) => ({
        id: a.id,
        letter: a.letter,
        content: a.content,
        imageUrl: normalizeImageUrl(a.imageUrl),
      })),
    })),
  });
}
