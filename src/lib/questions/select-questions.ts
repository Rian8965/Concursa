import { prisma } from "@/lib/db/prisma";
import { buildQuestionContextKey } from "./context-key";

type DeliveryType = "TRAINING" | "EXAM" | "APOSTILA";

export type SelectQuestionsInput = {
  studentProfileId: string;
  competitionId: string;
  jobRoleId: string | null;
  subjectIds: string[];
  examBoardId: string | null;
  difficulty?: string | null;
  quantity: number;
  deliveryType: DeliveryType;
};

export async function selectQuestionsForStudent(input: SelectQuestionsInput) {
  const contextKey = buildQuestionContextKey({
    competitionId: input.competitionId,
    jobRoleId: input.jobRoleId,
    examBoardId: input.examBoardId,
    subjectIds: input.subjectIds,
    difficulty: input.difficulty ?? null,
  });

  const baseWhere: Record<string, unknown> = {
    status: "ACTIVE",
    alternatives: { some: {} },
    ...(input.subjectIds.length ? { subjectId: { in: input.subjectIds } } : {}),
    ...(input.examBoardId ? { examBoardId: input.examBoardId } : {}),
    ...(input.difficulty ? { difficulty: input.difficulty } : {}),
  };

  // 1) Prioriza não repetidas dentro do mesmo contexto
  const usedRows = await prisma.usedQuestion.findMany({
    where: {
      studentProfileId: input.studentProfileId,
      usedInType: input.deliveryType,
      contextKey,
    },
    select: { questionId: true },
  });
  const usedIds = usedRows.map((r) => r.questionId);

  const unusedWhere = usedIds.length ? { ...baseWhere, id: { notIn: usedIds } } : baseWhere;

  const unused = await prisma.question.findMany({
    where: unusedWhere,
    select: { id: true },
    take: Math.min(800, input.quantity * 40),
  });

  const unusedIds = unused.map((q) => q.id);
  shuffleInPlace(unusedIds);

  const pickedIds: { id: string; reason: "NEW" | "REPEAT_EXHAUSTED" }[] = [];
  for (const id of unusedIds) {
    if (pickedIds.length >= input.quantity) break;
    pickedIds.push({ id, reason: "NEW" });
  }

  // 2) Fallback: se não tiver suficiente, completa repetindo aleatoriamente (esgotamento)
  if (pickedIds.length < input.quantity) {
    const any = await prisma.question.findMany({
      where: baseWhere,
      select: { id: true },
      take: Math.min(1200, input.quantity * 60),
    });
    const anyIds = any.map((q) => q.id);
    shuffleInPlace(anyIds);

    for (const id of anyIds) {
      if (pickedIds.length >= input.quantity) break;
      if (pickedIds.some((p) => p.id === id)) continue;
      pickedIds.push({ id, reason: "REPEAT_EXHAUSTED" });
    }
  }

  // Carrega o payload completo (mantém a ordem escolhida)
  const questions = await prisma.question.findMany({
    where: { id: { in: pickedIds.map((p) => p.id) } },
    include: {
      alternatives: { orderBy: { order: "asc" } },
      subject: { select: { name: true } },
    },
  });
  const qMap = new Map(questions.map((q) => [q.id, q]));

  const ordered = pickedIds
    .map((p) => ({ pick: p, q: qMap.get(p.id) }))
    .filter((x): x is { pick: (typeof pickedIds)[number]; q: NonNullable<(typeof qMap extends Map<string, infer V> ? V : never)> } => Boolean(x.q))
    .map((x) => ({ question: x.q, reason: x.pick.reason, contextKey }));

  // Registra entregas (anti-repetição por filtro)
  await prisma.usedQuestion.createMany({
    data: ordered.map((o) => ({
      studentProfileId: input.studentProfileId,
      questionId: o.question.id,
      usedInType: input.deliveryType,
      contextKey,
      reason: o.reason,
    })),
  });

  return { contextKey, questions: ordered };
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

