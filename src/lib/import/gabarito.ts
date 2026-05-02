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
 * Interpreta formatos comuns de gabarito:
 * - "1-A", "01 B", "Questão 5: C", linhas "01A 02B"
 * - Tabela em duas linhas: "01 02 03…" seguida de "A B C…"
 * - Formato sequencial sem números: coluna de letras cujo índice = número da questão
 * - "1A 2B 3C" (compacto com dígito único)
 */
export function parseGabaritoMap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!text?.trim()) return map;
  const normalized = text.replace(/\u2013|\u2014/g, "-").replace(/\r/g, "\n");
  const lines = normalized.split(/\n+/);

  const push = (n: number, L: string) => {
    if (n >= 1 && n <= 999 && /^[A-E]$/.test(L)) map.set(n, L);
  };

  // ─── Passo 1: formatos linha-a-linha com número explícito ───────────────────
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 300) continue;

    // "questão 01 - A" | "01-A" | "01: A" | "01) A" | "01 A"
    const reLine =
      /^(?:quest[aã]o|questão|q\.?)?\s*(\d{1,4})\s*[-–.:)\]]\s*([A-E])\b/i.exec(line) ??
      /^(\d{1,4})\s+([A-E])\b/.exec(line);
    if (reLine) {
      push(parseInt(reLine[1], 10), reLine[2].toUpperCase());
      continue;
    }

    // tokens "01A" | "1-A" | "01 A" dentro de uma linha mista
    const tokenRe = /\b(\d{1,4})\s*[-–.]?\s*([A-E])\b/gi;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(line)) !== null) {
      push(parseInt(m[1], 10), m[2].toUpperCase());
    }
  }

  // ─── Passo 2: blocos densos sem espaço ("01A02B03C") ────────────────────────
  const compact = normalized.replace(/\s+/g, " ");
  // Inclui dígito único: "1A2B" ou "01A02B"
  const denseRe = /(\d{1,4})([A-E])(?=\d|$|\s)/g;
  let dm: RegExpExecArray | null;
  while ((dm = denseRe.exec(compact)) !== null) {
    push(parseInt(dm[1], 10), dm[2].toUpperCase());
  }

  // ─── Passo 3: tabela em DUAS LINHAS ─────────────────────────────────────────
  // Formato: linha com números "01 02 03 04 05" seguida de linha com letras "A B C D E"
  // Tanto a linha de números quanto a de letras podem ser separadas por espaço/tab/|
  if (map.size === 0) {
    const numLineRe = /^[\s|]*(\d{1,4}(?:\s*[|,\t]\s*\d{1,4}){2,})[\s|]*$/;
    const letLineRe = /^[\s|]*([A-E](?:\s*[|,\t]\s*[A-E]){2,})[\s|]*$/i;

    for (let i = 0; i < lines.length - 1; i++) {
      const lineA = lines[i].trim();
      const lineB = lines[i + 1].trim();

      const numMatch = numLineRe.exec(lineA);
      const letMatch = letLineRe.exec(lineB);

      if (numMatch && letMatch) {
        const nums = lineA.split(/[\s|,\t]+/).map((t) => parseInt(t, 10)).filter((n) => Number.isFinite(n) && n >= 1);
        const letters = lineB.split(/[\s|,\t]+/).map((t) => t.trim().toUpperCase()).filter((t) => /^[A-E]$/.test(t));
        for (let j = 0; j < Math.min(nums.length, letters.length); j++) {
          push(nums[j], letters[j]);
        }
        i++; // Pula a linha de letras para não reprocessar
      }
    }
  }

  // ─── Passo 4: tabela em DUAS LINHAS (cabeçalho de coluna separado por | ou tab) ─
  // Formato: "| 01 | 02 | 03 |" / "| A  | B  | C  |"
  if (map.size === 0) {
    for (let i = 0; i < lines.length - 1; i++) {
      const cells0 = lines[i].split(/\|/).map((c) => c.trim()).filter(Boolean);
      const cells1 = lines[i + 1].split(/\|/).map((c) => c.trim()).filter(Boolean);
      if (cells0.length < 3 || cells0.length !== cells1.length) continue;
      const allNums = cells0.every((c) => /^\d{1,4}$/.test(c));
      const allLets = cells1.every((c) => /^[A-E]$/i.test(c));
      if (allNums && allLets) {
        for (let j = 0; j < cells0.length; j++) {
          push(parseInt(cells0[j], 10), cells1[j].toUpperCase());
        }
        i++;
      }
    }
  }

  // ─── Passo 5: formato sequencial puro (apenas letras em ordem) ───────────────
  // Detecta se há um bloco onde cada linha é apenas uma letra A-E (sem número),
  // inferindo que a primeira letra corresponde à menor questão ainda não mapeada.
  // Só tenta se o mapa ainda estiver vazio para evitar conflitos.
  if (map.size === 0) {
    const pureLetters: string[] = [];
    for (const raw of lines) {
      const t = raw.trim().toUpperCase();
      if (/^[A-E]$/.test(t)) pureLetters.push(t);
      else if (t) pureLetters.length = 0; // quebra de sequência
    }
    if (pureLetters.length >= 5) {
      pureLetters.forEach((L, i) => push(i + 1, L));
    }
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
  gabaritoMap: Map<number, string>;
  /** @deprecated Não usado — a resposta correta só vem do gabarito oficial. */
  letterFromLlm?: string | null;
}): {
  correctAnswer: string | null;
  answerSource: GabaritoResolveSource;
  gabaritoMatchNumber: number | null;
} {
  const letters = args.alternatives.map((a) => String(a.letter ?? "").trim().toUpperCase().slice(0, 1)).filter(Boolean);
  const valid = new Set(letters);

  // Fonte única de verdade: gabarito oficial (arquivo separado ou seção no PDF).
  // Se não encontrado, retorna null — a questão fica para revisão manual.
  const fromMap = pickLetterFromGabaritoMap(args.questionNumber, letters, args.gabaritoMap);
  if (fromMap.letter && valid.has(fromMap.letter)) {
    return {
      correctAnswer: fromMap.letter,
      answerSource: "gabarito",
      gabaritoMatchNumber: fromMap.matchedKey,
    };
  }

  return { correctAnswer: null, answerSource: null, gabaritoMatchNumber: null };
}
