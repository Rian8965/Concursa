import type { PrismaClient } from "@prisma/client";
import { parseGabaritoMap, resolveCorrectAnswerForImportedQuestion } from "@/lib/import/gabarito";

type Alt = { letter: string; content: string };

function normalizeAlternatives(alts: unknown): Alt[] {
  if (!Array.isArray(alts)) return [];
  const out: Alt[] = [];
  const seen = new Set<string>();
  for (const item of alts) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const letter = String(o.letter ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 1);
    const content = String(o.content ?? "").trim();
    if (!letter || !content) continue;
    if (seen.has(letter)) continue;
    seen.add(letter);
    out.push({ letter, content });
  }
  out.sort((a, b) => a.letter.localeCompare(b.letter));
  return out;
}

function parseQuestionNumberFromRaw(rawText?: string | null): number | null {
  if (!rawText?.trim()) return null;
  try {
    const p = JSON.parse(rawText) as { number?: unknown };
    return typeof p.number === "number" && Number.isFinite(p.number) ? Math.max(1, Math.floor(p.number)) : null;
  } catch {
    return null;
  }
}

function mergeRawTextPatch(rawText: string | null | undefined, patch: Record<string, unknown>): string {
  try {
    const o = rawText?.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    return JSON.stringify({ ...o, ...patch });
  } catch {
    return JSON.stringify(patch);
  }
}

/**
 * Aplica o mapa de gabarito (texto já OCR/limpo) a todas as questões importadas da prova.
 * Usa o campo `number` no JSON de rawText — alinhado ao número no PDF, não à posição na lista.
 */
export async function applyGabaritoTextToImportQuestions(
  prisma: PrismaClient,
  importId: string,
  gabaritoOcrText: string,
): Promise<{ updated: number; mapSize: number }> {
  const map = parseGabaritoMap(gabaritoOcrText);
  const rows = await prisma.importedQuestion.findMany({
    where: { importId },
    select: { id: true, alternatives: true, rawText: true },
  });

  let updated = 0;
  for (const row of rows) {
    const alts = normalizeAlternatives(row.alternatives);
    const qNum = parseQuestionNumberFromRaw(row.rawText);
    const resolved = resolveCorrectAnswerForImportedQuestion({
      questionNumber: qNum,
      alternatives: alts,
      gabaritoMap: map,
    });
    const nextRaw = mergeRawTextPatch(row.rawText, {
      answerSource: resolved.answerSource,
      gabaritoMatchNumber: resolved.gabaritoMatchNumber ?? null,
    });
    await prisma.importedQuestion.update({
      where: { id: row.id },
      data: {
        correctAnswer: resolved.correctAnswer,
        rawText: nextRaw,
      },
    });
    updated++;
  }

  return { updated, mapSize: map.size };
}
