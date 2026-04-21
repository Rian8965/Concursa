/**
 * Extrai trecho provável de gabarito do texto completo da prova (mesmo PDF).
 */
export function extractGabaritoSectionFromProvaFullText(fullText: string): string {
  if (!fullText?.trim()) return "";
  const lower = fullText.toLowerCase();
  const markers = [
    "gabarito oficial",
    "gabarito",
    "padrão de resposta",
    "padrão de respostas",
    "respostas objetivas",
    "resposta objetiva",
    "gabarito definitivo",
    "folha de respostas",
  ];
  let bestStart = -1;
  for (const m of markers) {
    const i = lower.indexOf(m);
    if (i >= 0 && (bestStart < 0 || i < bestStart)) bestStart = i;
  }
  if (bestStart >= 0) return fullText.slice(bestStart);
  const cut = Math.floor(fullText.length * 0.78);
  return fullText.slice(cut);
}

/**
 * Interpreta formatos comuns: "1-A", "01 B", "Questão 5: C", linhas "01A 02B".
 */
export function parseGabaritoMap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!text?.trim()) return map;
  const normalized = text.replace(/\u2013|\u2014/g, "-").replace(/\r/g, "\n");
  const lines = normalized.split(/\n+/);

  const push = (n: number, L: string) => {
    if (n >= 1 && n <= 999 && /^[A-E]$/.test(L)) map.set(n, L);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length > 200) continue;

    const reLine =
      /^(?:quest[aã]o|questão|q\.?)?\s*(\d{1,4})\s*[-–.:)\]]\s*([A-E])\b/i.exec(line) ??
      /^(\d{1,4})\s+([A-E])\b/.exec(line);
    if (reLine) {
      push(parseInt(reLine[1], 10), reLine[2].toUpperCase());
      continue;
    }

    const tokenRe = /\b(\d{1,4})\s*[-–.]?\s*([A-E])\b/gi;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(line)) !== null) {
      push(parseInt(m[1], 10), m[2].toUpperCase());
    }
  }

  // Blocos densos sem quebras (ex: "01A02B03C")
  const compact = normalized.replace(/\s+/g, " ");
  const dense = /\b(\d{2,4})([A-E])\b/g;
  let dm: RegExpExecArray | null;
  while ((dm = dense.exec(compact)) !== null) {
    push(parseInt(dm[1], 10), dm[2].toUpperCase());
  }

  return map;
}

export type GabaritoResolveSource = "gabarito" | "llm" | null;

export function pickLetterFromGabaritoMap(
  questionNumber: number | null,
  alternativesLetters: string[],
  map: Map<number, string>,
): { letter: string | null; matchedKey: number | null; source: GabaritoResolveSource } {
  const valid = new Set(alternativesLetters.map((x) => x.toUpperCase()).filter((x) => /^[A-Z]$/.test(x)));
  if (!valid.size) return { letter: null, matchedKey: null, source: null };

  const tryOrder = questionNumber != null && Number.isFinite(questionNumber)
    ? [questionNumber, questionNumber - 1, questionNumber + 1, questionNumber - 2, questionNumber + 2]
    : [];

  for (const k of tryOrder) {
    if (k < 1) continue;
    const L = map.get(k);
    if (L && valid.has(L)) return { letter: L, matchedKey: k, source: "gabarito" };
  }
  return { letter: null, matchedKey: null, source: null };
}

export function resolveCorrectAnswerForImportedQuestion(args: {
  questionNumber: number | null;
  alternatives: Array<{ letter: string; content: string }>;
  letterFromLlm: string | null;
  gabaritoMap: Map<number, string>;
}): {
  correctAnswer: string | null;
  answerSource: GabaritoResolveSource;
  gabaritoMatchNumber: number | null;
} {
  const letters = args.alternatives.map((a) => String(a.letter ?? "").trim().toUpperCase().slice(0, 1)).filter(Boolean);
  const valid = new Set(letters);

  const fromMap = pickLetterFromGabaritoMap(args.questionNumber, letters, args.gabaritoMap);
  if (fromMap.letter && valid.has(fromMap.letter)) {
    return {
      correctAnswer: fromMap.letter,
      answerSource: "gabarito",
      gabaritoMatchNumber: fromMap.matchedKey,
    };
  }

  const L = args.letterFromLlm ? args.letterFromLlm.toUpperCase().slice(0, 1) : null;
  if (L && valid.has(L)) {
    return { correctAnswer: L, answerSource: "llm", gabaritoMatchNumber: null };
  }

  return { correctAnswer: null, answerSource: null, gabaritoMatchNumber: null };
}
