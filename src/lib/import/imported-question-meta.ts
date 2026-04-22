import type { Difficulty } from "@prisma/client";

/** Campos de PDFImport usados para preencher metadados quando a questão não os define. */
export type ImportContextMeta = {
  year: number | null;
  examBoardId: string | null;
  competitionId: string | null;
  cityId: string | null;
  jobRoleId: string | null;
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
    subjectId: iq.suggestedSubjectId?.trim() || null,
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
  concurso: "concurso",
};

export function metaMissingLabels(missing: string[]) {
  return missing.map((k) => META_LABEL[k] ?? k);
}

/**
 * Obrigatórios: disciplina, assunto, ano, banca, concurso e nível (sempre há difficulty).
 * Cidade e cargo são herdados e opcionais. Tags são opcionais.
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
  if (!m.competitionId) missing.push("concurso");
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

/** Garante tags como array; aceita `undefined` vindo do JSON. */
export function normalizeTagsInput(v: string[] | undefined | null) {
  if (!v || !Array.isArray(v)) return [] as string[];
  return v.map((t) => String(t).trim()).filter(Boolean);
}
