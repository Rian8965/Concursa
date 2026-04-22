import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";

/**
 * Classificação em lote (uma chamada) via Gemini ou OpenAI.
 * Reforça a heurística; em falha, o chamador usa só heurística.
 */
export async function analyzeEnunciadoBatchLlm(
  items: { id: string; content: string }[],
): Promise<Record<string, { needsTextSupport: boolean; needsFigure: boolean }> | null> {
  if (items.length === 0) return {};
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) return null;

  const system = `Você classifica enunciados de provas (concursos) em português.
Retorne SOMENTE JSON válido no formato:
{ "items": [ { "id": string, "needsTextSupport": boolean, "needsFigure": boolean } ] }

Regras:
- needsTextSupport = true se o aluno PRECISA de um bloco de texto (trecho) do caderno além do enunciado curto, ex.: "com base no texto", "leia o trecho", "de acordo com o fragmento".
- needsFigure = true se a questão depende de figura/imagem, gráfico, tabela ilustrada, mapa, charge, tirinha, esquema, foto, desenho, "observe a figura", etc.
- Se o enunciado for só a redação curta e não pedir nada extra, false para ambos.
- Em caso de dúvida, prefira true (evitar questão cega para o aluno).`;

  const user = `Itens (id + enunciado):
${items
  .map((i, n) => `${n + 1}) id=${JSON.stringify(i.id)} enunciado:\n${i.content.slice(0, 8000)}`)
  .join("\n\n")}`;

  try {
    const { jsonText } = await runLlmJson(system, user);
    const robust = parseLlmJsonRobustly(jsonText);
    if (!robust.ok) {
      console.error("[enunciado-llm] parse failed", robust.message);
      return null;
    }
    const parsed = robust.value as { items?: Array<{ id: string; needsTextSupport?: boolean; needsFigure?: boolean }> };
    const out: Record<string, { needsTextSupport: boolean; needsFigure: boolean }> = {};
    for (const it of parsed.items ?? []) {
      if (!it?.id) continue;
      out[it.id] = {
        needsTextSupport: Boolean(it.needsTextSupport),
        needsFigure: Boolean(it.needsFigure),
      };
    }
    return out;
  } catch (e) {
    console.error("[enunciado-llm] batch failed", e);
    return null;
  }
}
