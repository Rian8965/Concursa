import { prisma } from "@/lib/db/prisma";
import { LEGACY_CHAR_LIMIT } from "@/lib/ai/ai-gate";
import { z } from "zod";

const outSchema = z.object({
  explanation: z.string().min(1).max(4000),
});

function trimContext(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function buildPrompt(charLimit: number): string {
  if (charLimit >= 1200) {
    return `Explique em linguagem simples, em até ${charLimit} caracteres, por que o aluno errou a questão. Mostre o raciocínio correto, explique a alternativa correta e finalize com uma dica prática para o aluno não errar novamente. Seja objetivo e não escreva respostas longas.`;
  }
  return `Explique em linguagem simples, em até ${charLimit} caracteres, por que o aluno errou a questão. Mostre o raciocínio correto de forma objetiva e finalize com uma dica curta para ele não errar novamente. Não escreva respostas longas.`;
}

export type ExplainResult = {
  explanation: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
};

/**
 * Gera explicação de erro em questão respeitando o limite de caracteres do plano do aluno.
 * Retorna null em caso de falha.
 */
export async function generateWrongAnswerExplanation(input: {
  content: string;
  supportText?: string | null;
  alternatives: { letter: string; content: string }[];
  selectedAnswer: string;
  correctAnswer: string;
  charLimit?: number;
}): Promise<ExplainResult | null> {
  if (process.env.GEMINI_API_KEY == null && process.env.OPENAI_API_KEY == null) {
    return null;
  }

  const charLimit = input.charLimit ?? LEGACY_CHAR_LIMIT;

  const alts = input.alternatives.map((a) => `${a.letter}) ${a.content}`).join("\n");
  const support = input.supportText?.trim()
    ? `\nTexto de apoio / contexto:\n${trimContext(input.supportText, 3500)}`
    : "";

  const planPrompt = buildPrompt(charLimit);

  const system = [
    "Você explica comentários de questões de concursos públicos em português do Brasil.",
    "Responda APENAS com um JSON no formato: {\"explanation\":\"...\"}.",
    planPrompt,
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
    const result = await runGeminiOrOpenAI(system, user);
    if (!result) return null;

    const raw = JSON.parse(result.jsonText) as unknown;
    const parsed = outSchema.safeParse(raw);
    if (!parsed.success) return null;

    const explanation = parsed.data.explanation.trim();
    if (!explanation) return null;

    // Truncar resposta caso a IA ultrapasse o limite de caracteres
    const truncated = explanation.length > charLimit
      ? `${explanation.slice(0, charLimit - 1)}…`
      : explanation;

    return {
      explanation: truncated,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch (e) {
    console.error("[explain-wrong-answer]", e);
    return null;
  }
}

// ---- Runner interno com suporte a tokens ----

type RunResult = {
  model: string;
  jsonText: string;
  inputTokens?: number;
  outputTokens?: number;
};

type GeminiModelInfo = { name?: string; supportedGenerationMethods?: string[] };

async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: "GET" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: GeminiModelInfo[] };
  const models = data.models ?? [];
  return models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => String(m.name ?? ""))
    .filter(Boolean)
    .map((name) => (name.startsWith("models/") ? name.slice("models/".length) : name))
    .filter((m) => !m.includes("computer") && !m.includes("cu-"));
}

async function runGeminiOrOpenAI(system: string, user: string): Promise<RunResult | null> {
  if (process.env.GEMINI_API_KEY) {
    const apiKey = process.env.GEMINI_API_KEY;
    // Preferimos o modelo mais econômico: gemini-2.0-flash-lite ou gemini-2.0-flash
    const requestedModel = (process.env.GEMINI_MODEL ?? "gemini-2.0-flash").trim();
    const candidates = [
      "gemini-2.0-flash-lite",
      requestedModel,
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    for (const model of candidates) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (res.status === 404 || t.includes("NOT_FOUND")) continue;
        if (res.status === 400 && t.includes("Computer Use")) continue;
        throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
      }
      const data = (await res.json()) as any;
      const jsonText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
      if (!jsonText.trim()) continue;

      return {
        model,
        jsonText,
        inputTokens: data?.usageMetadata?.promptTokenCount ?? undefined,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? undefined,
      };
    }

    // Fallback: descobrir modelos disponíveis
    const discovered = await listGeminiModels(apiKey);
    for (const model of discovered.slice(0, 8)) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as any;
      const jsonText = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
      if (!jsonText.trim()) continue;
      return {
        model,
        jsonText,
        inputTokens: data?.usageMetadata?.promptTokenCount ?? undefined,
        outputTokens: data?.usageMetadata?.candidatesTokenCount ?? undefined,
      };
    }
    return null;
  }

  if (process.env.OPENAI_API_KEY) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
    }
    const data = (await res.json()) as any;
    const jsonText = data?.choices?.[0]?.message?.content ?? "";
    if (!jsonText.trim()) return null;
    return {
      model,
      jsonText,
      inputTokens: data?.usage?.prompt_tokens ?? undefined,
      outputTokens: data?.usage?.completion_tokens ?? undefined,
    };
  }

  return null;
}
