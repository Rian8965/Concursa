/**
 * Metadados de revisão guardados em `importedQuestion.rawText` (JSON), chave `review`.
 */

export type VinculoExcecaoManual = {
  /** ISO 8601 */
  at: string;
  /** Revisor confirmou que não falta vínculo de texto de apoio no PDF */
  semTexto: boolean;
  /** Revisor confirmou que não falta figura/imagem do enunciado no PDF */
  semImagem: boolean;
};

export type AlternativasVisuaisFlags = {
  /** Heurística / futura IA */
  aiSugeriu?: boolean;
  /** Revisor marcou “alternativas visuais” */
  revisorMarcou?: boolean;
};

export type ImportReviewMeta = {
  vinculoExcecao?: VinculoExcecaoManual;
  alternativasVisuais?: AlternativasVisuaisFlags;
};

export function parseImportRawText(raw: string | null | undefined): {
  review: ImportReviewMeta;
  rest: Record<string, unknown>;
} {
  if (!raw?.trim()) return { review: {}, rest: {} };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const r = o.review;
    const review: ImportReviewMeta =
      r && typeof r === "object" && r !== null && !Array.isArray(r)
        ? (r as ImportReviewMeta)
        : {};
    const { review: _drop, ...rest } = o;
    return { review, rest };
  } catch {
    return { review: {}, rest: {} };
  }
}

export function mergeReviewIntoRawText(
  raw: string | null | undefined,
  patch: Partial<ImportReviewMeta> & { vinculoExcecao?: ImportReviewMeta["vinculoExcecao"] | null },
): string {
  const { review: cur, rest } = parseImportRawText(raw);
  const next: ImportReviewMeta = {
    vinculoExcecao: patch.vinculoExcecao === null ? undefined : (patch.vinculoExcecao !== undefined ? patch.vinculoExcecao : cur.vinculoExcecao),
    alternativasVisuais: {
      ...cur.alternativasVisuais,
      ...patch.alternativasVisuais,
    },
  };
  if (next.vinculoExcecao == null) delete next.vinculoExcecao;
  if (next.alternativasVisuais && Object.keys(next.alternativasVisuais).length === 0) {
    delete next.alternativasVisuais;
  }
  return JSON.stringify({ ...rest, review: next });
}

/** Vinculo gate: requer text/image link a menos que isenção cubra a exigência. */
export function isVinculoSatisfiedForReview(
  needText: boolean,
  needImage: boolean,
  hasTextLink: boolean,
  hasImageLink: boolean,
  review: ImportReviewMeta,
): { ok: boolean; missing: Array<"text" | "image"> } {
  const e = review.vinculoExcecao;
  const needTextEff = needText && !(e?.semTexto);
  const needImageEff = needImage && !(e?.semImagem);
  const missing: Array<"text" | "image"> = [];
  if (needTextEff && !hasTextLink) missing.push("text");
  if (needImageEff && !hasImageLink) missing.push("image");
  return missing.length ? { ok: false, missing } : { ok: true, missing: [] };
}

export function alternativasVisuaisAtivas(review: ImportReviewMeta, heuristicVisual: boolean): boolean {
  const a = review.alternativasVisuais;
  return Boolean(a?.revisorMarcou || a?.aiSugeriu || heuristicVisual);
}

/**
 * Heurística: alternativas com texto muito curto ou marcador de imagem — combinar com marcação do revisor.
 */
export function detectLikelyVisualAlternatives(
  alternatives: { content: string; letter: string }[],
): boolean {
  if (alternatives.length < 2) return false;
  const allVeryShort = alternatives.every((a) => {
    const t = (a.content ?? "").replace(/\s+/g, " ").trim();
    return t.length <= 2 || /^[.\-–·\s]+$/i.test(t);
  });
  if (allVeryShort) return true;
  return alternatives.some((a) => {
    const t = (a.content ?? "").trim();
    if (!t) return true;
    return /^\[imagem\]|\(ilustra|\(fig|\(imagem\)/i.test(t);
  });
}

/** Verifica se cada alternativa (por letra) tem recorte de imagem vinculado. */
export function missingAlternativeImageLinks(
  letters: string[],
  hasImageByLetter: Record<string, boolean>,
): string[] {
  return letters
    .map((l) => l.trim().toUpperCase().slice(0, 1))
    .filter((l) => l && !hasImageByLetter[l]);
}

type PrismaLinkRow = {
  role: string;
  alternativeLetter: string | null;
  importAsset: { kind: string; imageDataUrl: string | null; extractedText: string | null };
};

/** A partir dos vínculos Prisma (enunciado, apoio, figura, alternativas com letra). */
export function reviewLinkStatsFromPrismaJoins(rows: PrismaLinkRow[]) {
  let hasTextBlockLink = false;
  let hasMainImageLink = false;
  const altImageDataByLetter: Record<string, string | null> = {};
  for (const l of rows) {
    if (l.role === "SUPPORT_TEXT" && l.importAsset.kind === "TEXT_BLOCK") {
      hasTextBlockLink = true;
    }
    if (l.role === "FIGURE" && l.importAsset.kind === "IMAGE") {
      if (l.alternativeLetter) {
        const c = l.alternativeLetter.toUpperCase().slice(0, 1);
        if (/^[A-E]$/.test(c)) {
          altImageDataByLetter[c] = l.importAsset.imageDataUrl?.trim() || null;
        }
      } else {
        hasMainImageLink = true;
      }
    }
  }
  return { hasTextBlockLink, hasMainImageLink, altImageDataByLetter };
}

export type LinkFlagAsset = {
  kind: string;
  imageDataUrl?: string | null;
  questionLinks: Array<{
    importedQuestionId: string;
    role: string;
    alternativeLetter?: string | null;
  }>;
};

/** Uso na UI de revisão (DTO de assets) — mesma semântica que `reviewLinkStatsFromPrismaJoins`. */
export function getExtendedLinkFlags(assets: LinkFlagAsset[] | undefined, questionId: string) {
  let hasTextBlockLink = false;
  let hasMainImageLink = false;
  const altImageByLetter: Record<string, boolean> = {};
  for (const a of assets ?? []) {
    const ln = a.questionLinks?.find((l) => l.importedQuestionId === questionId);
    if (!ln) continue;
    if (a.kind === "TEXT_BLOCK" && ln.role === "SUPPORT_TEXT") {
      hasTextBlockLink = true;
    }
    if (a.kind === "IMAGE" && ln.role === "FIGURE") {
      if (ln.alternativeLetter) {
        altImageByLetter[String(ln.alternativeLetter).toUpperCase().slice(0, 1)] = true;
      } else {
        hasMainImageLink = true;
      }
    }
  }
  return { hasTextBlockLink, hasMainImageLink, altImageByLetter };
}
