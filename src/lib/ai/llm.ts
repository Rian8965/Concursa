type LlmProvider = "gemini" | "openai";

type LlmResult = {
  provider: LlmProvider;
  model: string;
  jsonText: string;
};

type GeminiModelInfo = { name?: string; supportedGenerationMethods?: string[] };

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

async function listGeminiModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: "GET" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: GeminiModelInfo[] };
  const models = data.models ?? [];
  const eligible = models
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => String(m.name ?? ""))
    .filter(Boolean)
    // a API costuma devolver "models/<id>", a gente quer só o id
    .map((name) => (name.startsWith("models/") ? name.slice("models/".length) : name));
  return Array.from(new Set(eligible));
}

export async function runLlmJson(system: string, user: string): Promise<LlmResult> {
  const provider = pickProvider();

  if (provider === "gemini") {
    const apiKey = requiredEnv("GEMINI_API_KEY");
    const requestedModel = (process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest").trim();
    const candidates = [
      requestedModel,
      "gemini-1.5-pro-latest",
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

    let lastErr = "";
    for (const model of candidates) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        lastErr = `Gemini error (${res.status}): ${t.slice(0, 800)}`;
        // 404/NOT_FOUND normalmente é modelo inválido; tenta o próximo
        if (res.status === 404 || t.includes("NOT_FOUND")) continue;
        throw new Error(lastErr);
      }

      const data = (await res.json()) as any;
      const jsonText =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ??
        "";
      if (!jsonText.trim()) throw new Error("Gemini returned empty response");

      return { provider, model, jsonText };
    }

    // Fallback robusto: descobre modelos disponíveis e tenta os primeiros.
    const discovered = await listGeminiModels(apiKey);
    for (const model of discovered.slice(0, 6)) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        lastErr = `Gemini error (${res.status}): ${t.slice(0, 800)}`;
        continue;
      }
      const data = (await res.json()) as any;
      const jsonText =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ??
        "";
      if (!jsonText.trim()) continue;
      return { provider, model, jsonText };
    }

    throw new Error(
      lastErr ||
        `Gemini error: model '${requestedModel}' not found and no listModels fallback succeeded`,
    );
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

