import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";
import { LLM_FORMATTING_INSTRUCTIONS } from "@/lib/docai/format-text";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function mergeRawTextPatch(rawText: string | null | undefined, patch: Record<string, unknown>): string {
  try {
    const o = rawText?.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    return JSON.stringify({ ...o, ...patch });
  } catch {
    return JSON.stringify(patch);
  }
}

function normalizeAlternatives(alts: Array<{ letter?: string; text?: string; content?: string }>) {
  const cleaned = alts
    .map((a) => ({
      letter: String(a.letter ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1),
      content: String(a.text ?? a.content ?? "").trim(),
    }))
    .filter((a) => a.content.length > 0);
  const out: { letter: string; content: string }[] = [];
  const seen = new Set<string>();
  for (const a of cleaned) {
    const letter = a.letter || String.fromCharCode(65 + out.length);
    if (seen.has(letter)) continue;
    seen.add(letter);
    out.push({ letter, content: a.content });
    if (out.length >= 6) break;
  }
  out.sort((x, y) => x.letter.localeCompare(y.letter));
  return out;
}

/** Pré-visualização: só retorna JSON sugerido sem gravar. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: importId, questionId } = await params;
  const body = (await req.json().catch(() => ({}))) as { extractedText?: string };

  const text = String(body.extractedText ?? "").trim();
  if (text.length < 20) {
    return NextResponse.json({ error: "Texto extraído muito curto para reinterpretar." }, { status: 400 });
  }

  const iq = await prisma.importedQuestion.findFirst({
    where: { id: questionId, importId },
    select: { rawText: true, correctAnswer: true },
  });
  if (!iq) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  let existingNumber: number | null = null;
  try {
    const j = JSON.parse(iq.rawText ?? "{}") as { number?: unknown };
    existingNumber = typeof j.number === "number" ? j.number : null;
  } catch {
    existingNumber = null;
  }

  const system = [
    "Você é um extrator de questões de concurso.",
    "Receberá um trecho de texto OCR (possivelmente de múltiplos recortes unidos).",
    LLM_FORMATTING_INSTRUCTIONS,
    "",
    "TAREFA: extrair UMA única questão objetiva desse trecho.",
    "Retorne APENAS JSON válido (sem markdown fora do JSON):",
    '{ "statement": string, "alternatives": [{"letter": string, "text": string}], "number"?: number|null }',
    "REGRAS:",
    "- statement: enunciado completo. Preserve marcadores ** * __ ~~ == se existirem no texto.",
    "- alternatives: todas as opções (A–E) visíveis no trecho.",
    "- number: número da questão se aparecer no trecho; senão null.",
    "- Não invente alternativas que não estão no texto.",
  ].join("\n");

  const user = ["TEXTO DO RECORTE:", text.slice(0, 120_000)].join("\n\n");

  let parsed: { statement?: string; alternatives?: unknown; number?: unknown } = {};
  try {
    const llm = await runLlmJson(system, user);
    const robust = parseLlmJsonRobustly(llm.jsonText);
    if (!robust.ok) {
      return NextResponse.json({ error: robust.message ?? "JSON inválido da IA." }, { status: 422 });
    }
    parsed = robust.value as typeof parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `IA: ${msg}`.slice(0, 900) }, { status: 422 });
  }

  const statement = String(parsed.statement ?? "").trim();
  const alternatives = normalizeAlternatives(
    Array.isArray(parsed.alternatives) ? (parsed.alternatives as any[]) : [],
  );
  const numberRaw = parsed.number;
  const number =
    typeof numberRaw === "number" && Number.isFinite(numberRaw) ? Math.max(1, Math.floor(numberRaw)) : existingNumber;

  if (!statement || alternatives.length < 2) {
    return NextResponse.json({ error: "A IA não conseguiu extrair enunciado e alternativas suficientes." }, { status: 422 });
  }

  let correctAnswer: string | null = null;
  let answerSource: "gabarito" | "manual" | null = null;
  let gabaritoMatchNumber: number | null = null;

  if (correctAnswer == null && iq.correctAnswer) {
    const letters = new Set(alternatives.map((a) => a.letter));
    if (letters.has(String(iq.correctAnswer).toUpperCase().slice(0, 1))) {
      correctAnswer = String(iq.correctAnswer).toUpperCase().slice(0, 1);
      answerSource = "manual";
    }
  }

  return NextResponse.json({
    preview: {
      content: statement,
      alternatives,
      correctAnswer,
      rawTextPatch: {
        number,
        statement,
        reinterpretedAt: new Date().toISOString(),
        answerSource,
        gabaritoMatchNumber,
      },
    },
  });
}

/** Aplica a reinterpretação (corpo já validado no cliente via PUT ou reenvio do mesmo payload). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: importId, questionId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    alternatives?: { letter: string; content: string }[];
    correctAnswer?: string | null;
    rawTextPatch?: Record<string, unknown>;
  };

  const content = String(body.content ?? "").trim();
  const alternatives = normalizeAlternatives(body.alternatives ?? []);
  if (!content || alternatives.length < 2) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const exists = await prisma.importedQuestion.findFirst({
    where: { id: questionId, importId },
    select: { id: true, rawText: true },
  });
  if (!exists) return NextResponse.json({ error: "Questão não encontrada" }, { status: 404 });

  const patch = body.rawTextPatch ?? {};
  const nextRaw = mergeRawTextPatch(exists.rawText, {
    ...patch,
    statement: content,
    answerSource: patch.answerSource ?? undefined,
    gabaritoMatchNumber: patch.gabaritoMatchNumber ?? undefined,
  });

  const ca = body.correctAnswer != null ? String(body.correctAnswer).toUpperCase().slice(0, 1) : null;
  const letters = new Set(alternatives.map((a) => a.letter));
  const correctAnswer = ca && letters.has(ca) ? ca : null;

  await prisma.importedQuestion.update({
    where: { id: questionId },
    data: {
      content,
      alternatives,
      correctAnswer,
      rawText: nextRaw,
    },
  });

  return NextResponse.json({ ok: true });
}
