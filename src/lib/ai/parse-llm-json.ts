/**
 * Interpreta JSON devolvido por modelos (Gemini/OpenAI).
 * Melhora a taxa de sucesso sem alterar o fluxo quando a resposta já vem correta:
 * - remove cercas \`\`\`json ... \`\`\` que alguns modelos ainda injetam;
 * - tenta o primeiro `{` até o último `}` se houver lixo antes/depois.
 *
 * Não desativa validações: se nada for parseável, devolve `ok: false` com a mensagem do motor.
 */
export function parseLlmJsonRobustly(
  raw: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const tryOne = (s: string) => {
    try {
      return { ok: true as const, value: JSON.parse(s) as unknown };
    } catch (e) {
      return { ok: false as const, err: e instanceof Error ? e.message : String(e) };
    }
  };

  const t = (raw ?? "").trim();
  if (!t) {
    return { ok: false, message: "Resposta vazia do modelo" };
  }

  const candidates: string[] = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) candidates.push(fence[1].trim());

  const i0 = t.indexOf("{");
  const i1 = t.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) {
    const slice = t.slice(i0, i1 + 1);
    if (slice.length >= 2) candidates.push(slice);
  }

  const seen = new Set<string>();
  const errors: string[] = [];
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const r = tryOne(c);
    if (r.ok) return { ok: true, value: r.value };
    errors.push(r.err);
  }

  return { ok: false, message: errors[0] ?? "JSON inválido" };
}
