/**
 * Análise de dependências do enunciado (heurística, sem API) + utilitários de validação.
 * Uso no cliente e no servidor. A camada de IA em lote está em `enunciado-llm.ts`.
 */

export type EnunciadoDependency = {
  needsTextSupport: boolean;
  needsFigure: boolean;
  figureHints: string[];
  textHints: string[];
};

const VISUAL_PHRASES: RegExp[] = [
  /\bobserve\s+(?:a|o|as|os)\s+(?:imagem|figura|ilustra[cç][aã]o|foto|fotografia|tabela|gr[áa]fico|mapa|esquema|desenho|tirinha|charge|diagrama|quadrinho)\b/gi,
  /\bveja\s+(?:a|o|as|os)\s+(?:imagem|figura|foto|tabela|gr[áa]fico|mapa|tirinha|charge|desenho)\b/gi,
  /\b(analise|analis[ea]|analisar)\s+(?:a|o|as|os)\s+(?:imagem|figura|foto|ilustra[cç][aã]o|tabela|gr[áa]fico|esquema|tirinha|charge)\b/gi,
  /\bcom\s+base\s+no(?:s)?\s+(?:gr[áa]fico|mapa|quadro|desenho|esquema|tabela|diagrama)\b/gi,
  /\bcom\s+base\s+na(?:s)?\s+(?:figura|imagem|foto|tabela|ilustra[cç][aã]o|tirinha)\b/gi,
  /\bde\s+acordo\s+com\s+(?:a|o|as|os)\s+(?:figura|imagem|gr[áa]fico|tabela|mapa|ilustra[cç][aã]o|esquema|charge)\b/gi,
  /\bconforme\s+(?:a|o|as|os)\s+(?:figura|imagem|gr[áa]fico|tabela|mapa|ilustra[cç][aã]o|esquema|charge|diagrama)\b/gi,
  /\b(?:a|A)\s+(?:imagem|figura|tabela|gr[áa]fico|mapa)\s+(?:abaixo|acima|ao\s+lado|a\s+seguir|anexa|seguinte|ao\s+lado)\b/gi,
  /\b(?:na|no)\s+(?:figura|imagem|tabela|gr[áa]fico|mapa|esquema)\s+\d{1,2}\b/gi,
  /\bcom\s+base\s+no(?:s)?\s+dado(?:s)?\s+(?:da|do|apresentad[oa](?:s)?|do\s+gr[áa]fico|da\s+tabela)\b/gi,
  /\b(?:utilize|use|leia|interpret[ea])\s+(?:o|a|os|as)?\s*gr[áa]fico\b/gi,
  /\b(?:a\s+foto|a\s+carta|a\s+charge|a\s+tirinha|o\s+mapa|a\s+vis[aã]o|o\s+desenho)\b/gi,
  /\bface\s+ao\s+mapa\b/gi,
  /\b(?:mapa|gr[áa]fico|tabela|figura|esquema|ilustra[cç][aã]o|foto|fotografia|tirinha|charge|diagrama|quadrinho|croqui)\s+(?:abaixo|acima|ao\s+lado|a\s+seguir|anexa|seguinte)\b/gi,
  /\b(?:a\s+seguir|logo\s+ab[ao]ixo|abaixo|acima|ao\s+lado)\b[\s,:–—-]*\b(?:[ée]\s+)?apresenta(?:mos)?\s+(?:[oa]s?\s+)?(?:imagem|figura|foto|gr[áa]fico|tabela|mapa|esquema|charge|tirinha|ilustra[cç][aã]o)\b/gi,
  /\b(?:[ée]\s+)?\bapresenta(?:da)?\s+a\s+seguinte\s+(?:imagem|figura|tabela|gr[áa]fico|mapa|foto)\b/gi,
];

const VISUAL_WORDS =
  /\b(imagem|figura|gr[áa]fico|tabela|mapa|tirinha|charge|ilustra[cç][aã]o|fotografias?|fotos?|esquema|diagrama|quadrinho|croquis?|mapinha)\b/gi;

const NEGATE_VISUAL_CONTEXT =
  /\b(sem|n[aã]o|inexistente|n[aã]o\s+h[áa]|aus[eê]ncia|desconsider)\b.*\b(imagem|figura|gr[áa]fico|tabela)\b/gi;

const TEXT_PHRASES: RegExp[] = [
  /\bcom\s+base\s+no(?:s)?\s+(?:texto|textos|trecho|trechos|fragmento|par[áa]grafo|passagem)\b/gi,
  /\bcom\s+base\s+em\s+(?:o|a|os|as|um|uma|uns|umas)\s*(?:texto|trecho|fragmento|passagem)\b/gi,
  /\b(de|em)\s+acordo\s+com\s+(?:o|a|os|as|um|uma)?\s*(?:texto|trecho|fragmento|passagem)\b/gi,
  /\b(?:leia|l[êe])\s+(?:o|a|os|as)?\s*(?:texto|textos|trecho|trechos|fragmento|par[áa]grafo|passagem)\b/gi,
  /\bconsiderando\s+(?:o|a|os|as)?\s*(?:texto|trecho|fragmento|passagem)\b/gi,
  /\bsegundo\s+(?:o|a|os|as)?\s*(?:texto|trecho|passagem|fragmento)\b/gi,
  /\b(?:ap[óo]s|depois de)\s+(?:a|o)?\s*leitura\s+do(?:s)?\s+texto/gi,
  /\bap[óo]s?\s+ler\s+o(?:s)?\s+texto/gi,
  /\bconforme\s+o(?:s)?\s+texto/gi,
  /\bo\s+texto\s+(?:abaixo|a\s+seguir|acima|anexo|seguinte|apresenta(?:do|dos)?\s+a\s+seguir)\b/gi,
  /\b(?:[ée]\s*)\s*com\s+base\s+em\s+informa[çc][oõ]es?\s+do(?:s)?\s+texto/gi,
  /\b(?:[ée]\s*)\s*com?\s*base\s+em\s*informa[çc][oõ]es*\s*do\s+trecho/gi,
];

const TEXT_STANDALONE_WORDS = /\b(text[oa]-base|textobase|fragmento|trecho|passagem)\b/gi;

const NEGATE_TEXT =
  /\b(sem|n[aã]o|inexistente|n[aã]o\s+h[áa]\s+texto|texto\s+d[ae]\s*quest[ãa]o|apenas)\b.*\b(trecho|texto|fragmento)\b/gi;

function pushUnique(arr: string[], s: string) {
  const t = s.trim();
  if (t && !arr.includes(t)) arr.push(t.slice(0, 200));
}

function firstMatchText(text: string, re: RegExp): string | null {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m ? (m[0] ?? "").trim() : null;
}

export function analyzeEnunciadoHeuristic(raw: string | null | undefined): EnunciadoDependency {
  const text = (raw ?? "").trim();
  if (!text) {
    return { needsTextSupport: false, needsFigure: false, figureHints: [], textHints: [] };
  }
  const tLower = text.toLowerCase();

  const figureHints: string[] = [];
  const textHints: string[] = [];
  let needsFigure = false;

  for (const re of VISUAL_PHRASES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(text)) !== null) {
      if (m[0]) {
        needsFigure = true;
        pushUnique(figureHints, m[0].replace(/\s+/g, " "));
        if (figureHints.length >= 3) break;
      }
    }
  }

  if (!needsFigure) {
    VISUAL_WORDS.lastIndex = 0;
    NEGATE_VISUAL_CONTEXT.lastIndex = 0;
    if (VISUAL_WORDS.test(text) && !NEGATE_VISUAL_CONTEXT.test(text)) {
      needsFigure = true;
      const w = firstMatchText(String(text), VISUAL_WORDS);
      if (w) pushUnique(figureHints, w);
    }
  }

  let needsText = false;
  for (const re of TEXT_PHRASES) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      needsText = true;
      pushUnique(textHints, m[0].replace(/\s+/g, " "));
      if (textHints.length >= 3) break;
    }
  }
  if (!needsText) {
    TEXT_STANDALONE_WORDS.lastIndex = 0;
    const m = TEXT_STANDALONE_WORDS.exec(text);
    if (m?.[0] && /trecho|fragmento|texto|passagem/i.test(m[0])) {
      if (!NEGATE_TEXT.test(text) || /com base|leia|segundo|acordo|considerando/.test(tLower)) {
        needsText = true;
        pushUnique(textHints, m[0]);
      }
    }
  }

  if (NEGATE_TEXT.test(text) && !/\bcom\s+base|leia|acordo|considerando|segundo\s+o\s+texto/.test(tLower)) {
    needsText = false;
  }

  return { needsTextSupport: needsText, needsFigure, figureHints, textHints };
}

export type MergedEnunciadoDependency = EnunciadoDependency & { source: "heuristic" | "merged" };

export function mergeDependencyOr(
  a: EnunciadoDependency,
  b: Partial<EnunciadoDependency> | null | undefined,
): MergedEnunciadoDependency {
  if (!b) return { ...a, source: "heuristic" };
  const t = a.needsTextSupport || Boolean(b.needsTextSupport);
  const f = a.needsFigure || Boolean(b.needsFigure);
  const fromLlm =
    (!a.needsTextSupport && Boolean(b.needsTextSupport)) || (!a.needsFigure && Boolean(b.needsFigure));
  return {
    needsTextSupport: t,
    needsFigure: f,
    figureHints: a.figureHints,
    textHints: a.textHints,
    source: fromLlm ? "merged" : "heuristic",
  };
}

export function isEnunciadoDependencySatisfied(
  d: EnunciadoDependency,
  hasTextBlockLink: boolean,
  hasFigureImageLink: boolean,
): { ok: true } | { ok: false; missing: Array<"text" | "image"> } {
  const missing: Array<"text" | "image"> = [];
  if (d.needsTextSupport && !hasTextBlockLink) missing.push("text");
  if (d.needsFigure && !hasFigureImageLink) missing.push("image");
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

export function mergeHeuristicWithLlmMap(
  heur: Record<string, EnunciadoDependency>,
  llm: Record<string, { needsTextSupport: boolean; needsFigure: boolean }> | null,
): Record<string, MergedEnunciadoDependency> {
  const out: Record<string, MergedEnunciadoDependency> = {};
  for (const [id, h] of Object.entries(heur)) {
    const b = llm?.[id];
    out[id] = mergeDependencyOr(h, b ?? undefined);
  }
  return out;
}

export function getDependencyBlockUserMessage(missing: Array<"text" | "image">): string {
  const parts: string[] = [];
  if (missing.includes("image")) {
    parts.push("Precisa vincular imagem (figura, gráfico, tabela, mapa, etc.) no PDF antes de aprovar.");
  }
  if (missing.includes("text")) {
    parts.push("Precisa vincular texto de apoio no PDF antes de aprovar.");
  }
  return parts.join(" ");
}

export function isQuestionVinculoComplete(
  d: MergedEnunciadoDependency,
  hasTextBlockLink: boolean,
  hasFigureImageLink: boolean,
): { ok: boolean; missing: Array<"text" | "image"> } {
  const g = isEnunciadoDependencySatisfied(d, hasTextBlockLink, hasFigureImageLink);
  if (g.ok) return { ok: true, missing: [] };
  return { ok: false, missing: g.missing };
}
