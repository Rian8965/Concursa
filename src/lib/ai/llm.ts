type LlmProvider = "gemini" | "openai";

type LlmResult = {
  provider: LlmProvider;
  model: string;
  jsonText: string;
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function pickProvider(): LlmProvider {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error("Missing env var: GEMINI_API_KEY or OPENAI_API_KEY");
}

export async function runLlmJson(system: string, user: string): Promise<LlmResult> {
  const provider = pickProvider();

  if (provider === "gemini") {
    const apiKey = requiredEnv("GEMINI_API_KEY");
    const model = process.env.GEMINI_MODEL ?? "gemini-1.5-pro";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Gemini error (${res.status}): ${t.slice(0, 800)}`);
    }

    const data = (await res.json()) as any;
    const jsonText =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ??
      "";
    if (!jsonText.trim()) throw new Error("Gemini returned empty response");

    return { provider, model, jsonText };
  }

  // OpenAI
  const apiKey = requiredEnv("OPENAI_API_KEY");
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
    throw new Error(`OpenAI error (${res.status}): ${t.slice(0, 800)}`);
  }

  const data = (await res.json()) as any;
  const jsonText = data?.choices?.[0]?.message?.content ?? "";
  if (!jsonText.trim()) throw new Error("OpenAI returned empty response");

  return { provider, model, jsonText };
}

