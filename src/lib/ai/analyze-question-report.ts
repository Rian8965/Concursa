import { runLlmJson } from "@/lib/ai/llm";
import { z } from "zod";

const outSchema = z.object({
  verdict: z.enum(["ANSWER_IS_CORRECT", "ANSWER_MAY_BE_WRONG", "ANSWER_IS_WRONG", "AMBIGUOUS"]),
  analysis: z.string().min(1).max(6000),
  confidence: z.number().min(0).max(1),
});

export type QuestionReportVerdict =
  | "ANSWER_IS_CORRECT"
  | "ANSWER_MAY_BE_WRONG"
  | "ANSWER_IS_WRONG"
  | "AMBIGUOUS";

export interface QuestionReportAiResult {
  verdict: QuestionReportVerdict;
  analysis: string;
  confidence: number;
}

function trim(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * A IA analisa se a resposta da questão está correta ou não,
 * a partir da denúncia do aluno. Retorna um veredito honesto.
 */
export async function analyzeQuestionReport(input: {
  content: string;
  supportText?: string | null;
  alternatives: { letter: string; content: string }[];
  correctAnswer: string;
  studentReason: string;
}): Promise<QuestionReportAiResult | null> {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return null;
  }

  const alts = input.alternatives.map((a) => `${a.letter}) ${a.content}`).join("\n");
  const support = input.supportText?.trim()
    ? `\nTexto de apoio:\n${trim(input.supportText, 3000)}`
    : "";

  const system = [
    "Você é um especialista em concursos públicos que analisa denúncias de gabarito.",
    "Analise a questão, as alternativas, o gabarito oficial e o argumento do aluno.",
    "Seja completamente honesto: se o gabarito estiver errado, diga claramente.",
    "Se o gabarito estiver certo, diga claramente. Se houver ambiguidade real, diga isso.",
    "Não tente defender o gabarito se ele realmente estiver errado.",
    "Responda APENAS com JSON no formato:",
    '{"verdict":"ANSWER_IS_CORRECT|ANSWER_MAY_BE_WRONG|ANSWER_IS_WRONG|AMBIGUOUS","analysis":"análise detalhada em 3-6 frases","confidence":0.0}',
    "confidence: número entre 0.0 e 1.0 indicando sua certeza sobre o veredito.",
  ].join(" ");

  const user = [
    `Enunciado:\n${trim(input.content, 6000)}`,
    support,
    `\nAlternativas:\n${alts}`,
    `\nGabarito oficial: ${input.correctAnswer.toUpperCase()}`,
    `\nArgumento do aluno sobre o possível erro:\n${trim(input.studentReason, 2000)}`,
    "\nAnalise e emita seu veredito.",
  ].join("\n");

  try {
    const { jsonText } = await runLlmJson(system, user);
    const raw = JSON.parse(jsonText) as unknown;
    const parsed = outSchema.safeParse(raw);
    if (!parsed.success) return null;
    return parsed.data;
  } catch (e) {
    console.error("[analyze-question-report]", e);
    return null;
  }
}
