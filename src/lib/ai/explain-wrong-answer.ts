import { runLlmJson } from "@/lib/ai/llm";
import { z } from "zod";

const outSchema = z.object({
  explanation: z.string().min(1).max(4000),
});

function trimContext(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Gera 2–4 frases explicando o erro, em português, a partir do enunciado e das alternativas.
 */
export async function generateWrongAnswerExplanation(input: {
  content: string;
  supportText?: string | null;
  alternatives: { letter: string; content: string }[];
  selectedAnswer: string;
  correctAnswer: string;
}): Promise<string | null> {
  if (process.env.GEMINI_API_KEY == null && process.env.OPENAI_API_KEY == null) {
    return null;
  }

  const alts = input.alternatives
    .map((a) => `${a.letter}) ${a.content}`)
    .join("\n");
  const support = input.supportText?.trim()
    ? `\nTexto de apoio / contexto:\n${trimContext(input.supportText, 3500)}`
    : "";

  const system = [
    "Você explica comentários de questões de concursos públicos em português do Brasil.",
    "Responda APENAS com um JSON no formato: {\"explanation\":\"...\"}.",
    "A explicação deve ter 2 a 4 frases curtas, clara, sem repetir o enunciado de forma vaga.",
    "Diga por que a alternativa correta é a certa e por que a escolhida pelo aluno não é, em cima do conteúdo da questão.",
    "Não invente fatos externos: baseie-se no texto dado.",
  ].join(" ");

  const user = [
    `Enunciado:\n${trimContext(input.content, 6000)}`,
    support,
    `\nAlternativas:\n${alts}`,
    `\nO aluno marcou: ${input.selectedAnswer.toUpperCase()}.`,
    `A resposta correta é: ${input.correctAnswer.toUpperCase()}.`,
    "Gere a explicação pedida.",
  ].join("\n");

  try {
    const { jsonText } = await runLlmJson(system, user);
    const raw = JSON.parse(jsonText) as unknown;
    const parsed = outSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data.explanation.trim() || null;
  } catch (e) {
    console.error("[explain-wrong-answer]", e);
    return null;
  }
}
