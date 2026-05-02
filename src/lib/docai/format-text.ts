/**
 * Extrai texto com marcadores markdown a partir dos textStyles do Document AI.
 * Suporta: **negrito**, *itálico*, __sublinhado__, ~~tachado~~, ==grifado==
 */

export type DocaiTextStyle = {
  textAnchor?: { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> };
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  fontWeight?: string;
  textDecoration?: string;
  /** Cor de fundo do texto (pode indicar grifado/highlight) */
  backgroundColor?: { red?: number; green?: number; blue?: number };
};

/**
 * Reconstrói o texto completo com marcadores de formatação markdown
 * aproveitando os textStyles do Document AI.
 *
 * Quando não há estilos ou o texto é vazio, retorna o texto original.
 */
export function buildFormattedText(fullText: string, textStyles?: DocaiTextStyle[]): string {
  if (!textStyles?.length || !fullText) return fullText;

  type StyleRange = {
    start: number;
    end: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    highlight: boolean;
  };
  const ranges: StyleRange[] = [];

  for (const style of textStyles) {
    const segs = style.textAnchor?.textSegments ?? [];
    const isBold =
      style.bold === true ||
      (typeof style.fontWeight === "string" && style.fontWeight.toLowerCase() === "bold");
    const isItalic = style.italic === true;
    const isUnderline =
      style.underlined === true ||
      (typeof style.textDecoration === "string" &&
        style.textDecoration.toLowerCase().includes("underline"));
    const isStrike =
      style.strikethrough === true ||
      (typeof style.textDecoration === "string" &&
        style.textDecoration.toLowerCase().includes("line-through"));
    // Heurística de grifado: backgroundColor presente, não branco puro (< 2.7 de soma RGB)
    const bg = style.backgroundColor;
    const isHighlight = !!(
      bg &&
      (bg.red ?? 0) + (bg.green ?? 0) + (bg.blue ?? 0) < 2.7 &&
      ((bg.red ?? 0) > 0.1 || (bg.green ?? 0) > 0.1 || (bg.blue ?? 0) > 0.1)
    );

    if (!isBold && !isItalic && !isUnderline && !isStrike && !isHighlight) continue;

    for (const seg of segs) {
      const start = Number(seg.startIndex ?? 0);
      const end = Number(seg.endIndex ?? 0);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      ranges.push({
        start,
        end,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        strike: isStrike,
        highlight: isHighlight,
      });
    }
  }

  if (!ranges.length) return fullText;

  // Coleta todos os pontos de corte (boundaries)
  const boundaries = new Set<number>([0, fullText.length]);
  for (const r of ranges) {
    boundaries.add(r.start);
    boundaries.add(r.end);
  }
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  let result = "";
  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd = sorted[i + 1];
    const seg = fullText.slice(segStart, segEnd);
    if (!seg) continue;

    let bold = false,
      italic = false,
      underline = false,
      strike = false,
      highlight = false;

    for (const r of ranges) {
      if (r.start <= segStart && r.end >= segEnd) {
        bold = bold || r.bold;
        italic = italic || r.italic;
        underline = underline || r.underline;
        strike = strike || r.strike;
        highlight = highlight || r.highlight;
      }
    }

    let out = seg;
    // Aplica de dentro para fora para evitar conflitos de markdown
    if (highlight) out = `==${out}==`;
    if (strike) out = `~~${out}~~`;
    if (underline) out = `__${out}__`;
    if (italic) out = `*${out}*`;
    if (bold) out = `**${out}**`;
    result += out;
  }

  return result;
}

/** Instruções de formatação para o sistema do LLM */
export const LLM_FORMATTING_INSTRUCTIONS = [
  "═══ FORMATAÇÃO (CRÍTICO) ═══",
  "• O texto OCR pode conter marcadores markdown: **negrito**, *itálico*, __sublinhado__, ~~tachado~~, ==grifado==.",
  "• Preserve TODOS esses marcadores no campo 'statement', 'text' (alternativas) e 'text' (baseTexts) do JSON.",
  "• Não adicione formatação que não existe no texto original.",
  "• Não remova nem altere marcadores existentes.",
].join("\n");
