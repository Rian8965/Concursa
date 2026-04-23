import type { Difficulty } from "@prisma/client";

/** Campos de PDFImport usados para preencher metadados quando a questão não os define. */
export type ImportContextMeta = {
  year: number | null;
  examBoardId: string | null;
  competitionId: string | null;
  cityId: string | null;
  jobRoleId: string | null;
  /** Disciplina padrão da importação (nova importação / cadastro) — herda para a publicação. */
  subjectId: string | null;
};

export type ImportedQuestionMetaFields = {
  suggestedSubjectId: string | null;
  suggestedTopicId: string | null;
  year: number | null;
  examBoardId: string | null;
  competitionId: string | null;
  cityId: string | null;
  jobRoleId: string | null;
  difficulty: Difficulty;
  tags: string[];
};

/** Efeito final ao publicar (por questão + herança da importação). */
export function resolveImportedQuestionPublishMeta(
  iq: ImportedQuestionMetaFields,
  imp: ImportContextMeta,
) {
  return {
    subjectId: iq.suggestedSubjectId?.trim() || imp.subjectId?.trim() || null,
    topicId: iq.suggestedTopicId?.trim() || null,
    year: iq.year ?? imp.year ?? null,
    examBoardId: iq.examBoardId ?? imp.examBoardId ?? null,
    competitionId: iq.competitionId ?? imp.competitionId ?? null,
    cityId: iq.cityId ?? imp.cityId ?? null,
    jobRoleId: iq.jobRoleId ?? imp.jobRoleId ?? null,
    difficulty: iq.difficulty,
    tags: (iq.tags ?? []).map((t) => t.trim()).filter(Boolean),
  };
}

const META_LABEL: Record<string, string> = {
  disciplina: "disciplina (matéria)",
  assunto: "assunto (tópico)",
  ano: "ano",
  banca: "banca",
};

export function metaMissingLabels(missing: string[]) {
  return missing.map((k) => META_LABEL[k] ?? k);
}

/**
 * Obrigatórios: disciplina, assunto, ano e banca.
 * Concurso, cidade e cargo são opcionais (preenchidos pela IA quando identificáveis).
 * Tags são opcionais.
 */
export function isImportedQuestionMetaComplete(
  iq: ImportedQuestionMetaFields,
  imp: ImportContextMeta,
): { ok: true } | { ok: false; missing: string[] } {
  const m = resolveImportedQuestionPublishMeta(iq, imp);
  const missing: string[] = [];
  if (!m.subjectId) missing.push("disciplina");
  if (!m.topicId) missing.push("assunto");
  if (m.year == null) missing.push("ano");
  if (!m.examBoardId) missing.push("banca");
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

/** Garante tags como array; aceita `undefined` vindo do JSON. */
export function normalizeTagsInput(v: string[] | undefined | null) {
  if (!v || !Array.isArray(v)) return [] as string[];
  return v.map((t) => String(t).trim()).filter(Boolean);
}

/** Opções do PATCH de integração (o cliente envia o que está no ecrã de revisão). */
export type ApproveDecisionMetaPatch = {
  suggestedSubjectId?: string | null;
  suggestedTopicId?: string | null;
  /** @deprecated use suggestedSubjectId */
  subjectId?: string | null;
  /** @deprecated use suggestedTopicId */
  topicId?: string | null;
  year?: number | null;
  examBoardId?: string | null;
  competitionId?: string | null;
  cityId?: string | null;
  jobRoleId?: string | null;
  difficulty?: Difficulty;
  tags?: string[];
};

/**
 * Unifica a linha em `imported_questions` com o payload da decisão de aprovação
 * (o que o revisor vê, incluindo alterações ainda não gravadas com "Salvar questão").
 */
export function mergeImportedMetaWithApprovePayload(
  iq: ImportedQuestionMetaFields,
  patch: ApproveDecisionMetaPatch | undefined,
): ImportedQuestionMetaFields {
  if (!patch) return iq;
  const subj =
    patch.suggestedSubjectId !== undefined
      ? patch.suggestedSubjectId
      : patch.subjectId !== undefined
        ? patch.subjectId
        : iq.suggestedSubjectId;
  const top =
    patch.suggestedTopicId !== undefined
      ? patch.suggestedTopicId
      : patch.topicId !== undefined
        ? patch.topicId
        : iq.suggestedTopicId;
  return {
    suggestedSubjectId: subj ?? null,
    suggestedTopicId: top ?? null,
    year: patch.year !== undefined ? patch.year : iq.year,
    examBoardId: patch.examBoardId !== undefined ? patch.examBoardId : iq.examBoardId,
    competitionId: patch.competitionId !== undefined ? patch.competitionId : iq.competitionId,
    cityId: patch.cityId !== undefined ? patch.cityId : iq.cityId,
    jobRoleId: patch.jobRoleId !== undefined ? patch.jobRoleId : iq.jobRoleId,
    difficulty: patch.difficulty !== undefined ? patch.difficulty : iq.difficulty,
    tags: patch.tags !== undefined ? patch.tags : iq.tags,
  };
}
