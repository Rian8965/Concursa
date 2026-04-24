import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";

export const runtime = "nodejs";
// Editais podem ser grandes — 2 min de timeout
export const maxDuration = 120;

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export type EditalDraft = {
  name: string;
  organization?: string | null;
  examBoard?: { acronym: string; name?: string | null } | null;
  cities?: Array<{ name: string; state: string }> | null;
  jobRoles?: Array<{
    name: string;
    subjects?: Array<{ name: string }> | null;
  }> | null;
  stages?: Array<{ name: string }> | null;
  examDate?: string | null;
  year?: number | null;
  description?: string | null;
  notes?: string | null;
  confidence?: number | null;
};

const SYSTEM_PROMPT = [
  "Você é um assistente especializado em extrair dados estruturados de EDITAIS de concurso público no Brasil.",
  "Retorne APENAS JSON válido, sem markdown, sem explicações.",
  "Regras:",
  "- Se um campo não existir no edital, use null ou omita.",
  "- Se houver múltiplas cidades, liste todas em 'cities'.",
  "- Para cada cargo (jobRole), identifique as matérias/disciplinas específicas daquele cargo.",
  "- Matérias comuns a todos os cargos devem aparecer em TODOS os cargos onde se aplicam.",
  "- Se o edital tiver um quadro de matérias genérico (sem separar por cargo), replique para todos os cargos.",
  "- Identifique etapas/fases do concurso (prova objetiva, discursiva, TAF, psicológico, investigação social, curso de formação, títulos, etc.).",
  "- Banca com sigla (ex: FGV, CEBRASPE, VUNESP): preencha acronym.",
  "- Datas: use formato YYYY-MM-DD.",
  "- confidence: 0 a 1 (quão confiável é o preenchimento global).",
].join("\n");

const USER_PROMPT = [
  "Leia o edital em PDF anexo e extraia o objeto EditalDraft com EXATAMENTE esta estrutura JSON:",
  "{",
  '  "name": "Nome completo do concurso",',
  '  "organization": "Órgão/entidade contratante ou null",',
  '  "examBoard": { "acronym": "SIGLA", "name": "Nome completo" } ou null,',
  '  "cities": [{ "name": "Cidade", "state": "UF" }],',
  '  "jobRoles": [',
  '    {',
  '      "name": "Nome do Cargo",',
  '      "subjects": [{ "name": "Nome da Matéria" }]',
  '    }',
  '  ],',
  '  "stages": [{ "name": "Nome da Etapa/Fase" }],',
  '  "examDate": "YYYY-MM-DD ou null",',
  '  "year": 2025 ou null,',
  '  "description": "Resumo curto do concurso ou null",',
  '  "notes": "Observações relevantes ou null",',
  '  "confidence": 0.85',
  "}",
  "",
  "IMPORTANTE: identifique matérias POR CARGO. Se não houver separação clara por cargo, aplique a lista de matérias a todos os cargos.",
].join("\n");

// ─── Gemini direto com PDF ────────────────────────────────────────────────────

/** Tamanho máximo para inline (18 MB — margem abaixo do limite de 20 MB do Gemini). */
const MAX_INLINE_BYTES = 18 * 1024 * 1024;

/** Faz upload via Gemini Files API e retorna o URI do arquivo. */
async function uploadToGeminiFiles(
  pdfBytes: Buffer,
  apiKey: string,
): Promise<string> {
  // Passo 1 — inicia o upload resumável
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(pdfBytes.length),
        "X-Goog-Upload-Header-Content-Type": "application/pdf",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "edital.pdf" } }),
    },
  );
  if (!initRes.ok) {
    const t = await initRes.text().catch(() => "");
    throw new Error(`Gemini Files API init failed (${initRes.status}): ${t.slice(0, 300)}`);
  }

  const uploadUrl = initRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini Files API: upload URL não retornada");

  // Passo 2 — envia o arquivo
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(pdfBytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(pdfBytes),
  });
  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(`Gemini Files API upload failed (${uploadRes.status}): ${t.slice(0, 300)}`);
  }

  const fileData = (await uploadRes.json()) as { file?: { uri?: string; state?: string } };
  const uri = fileData.file?.uri;
  if (!uri) throw new Error("Gemini Files API: URI de arquivo não retornada");

  // Aguarda até o arquivo estar ACTIVE (normalmente alguns segundos)
  for (let i = 0; i < 12; i++) {
    if (fileData.file?.state !== "PROCESSING") break;
    await new Promise((r) => setTimeout(r, 3000));
    const checkRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${uri.split("/").pop()}?key=${encodeURIComponent(apiKey)}`,
    );
    const checkData = (await checkRes.json()) as { state?: string };
    if (checkData.state !== "PROCESSING") break;
  }

  return uri;
}

/** Lista modelos Gemini disponíveis para a chave fornecida. */
async function listGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    return (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => {
        const n = m.name ?? "";
        return n.startsWith("models/") ? n.slice("models/".length) : n;
      })
      .filter(Boolean)
      .filter((m) => !m.includes("lite") && !m.includes("computer") && !m.includes("embedding"));
  } catch {
    return [];
  }
}

/** Analisa o edital PDF diretamente com Gemini (sem Document AI). */
async function analyzeEditalWithGemini(
  pdfBytes: Buffer,
  apiKey: string,
): Promise<{ jsonText: string; model: string; pagesHandledBy: string }> {
  const isLarge = pdfBytes.length > MAX_INLINE_BYTES;

  let pdfPart: Record<string, unknown>;
  let pagesHandledBy: string;

  if (isLarge) {
    const fileUri = await uploadToGeminiFiles(pdfBytes, apiKey);
    pdfPart = { file_data: { mime_type: "application/pdf", file_uri: fileUri } };
    pagesHandledBy = "files-api";
  } else {
    pdfPart = {
      inline_data: { mime_type: "application/pdf", data: pdfBytes.toString("base64") },
    };
    pagesHandledBy = "inline";
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [pdfPart, { text: USER_PROMPT }] }],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });

  // Lista estática com preferência de modelos mais capazes para PDF
  const staticCandidates = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
  ];

  async function tryModel(model: string): Promise<string | null> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      // 404 / NOT_FOUND = modelo não disponível nesta chave → tenta próximo
      if (res.status === 404 || t.includes("NOT_FOUND")) return null;
      // Computer Use ou outros → também pula
      if (t.includes("Computer Use") || t.includes("computer-use")) return null;
      throw new Error(`Gemini ${model} (${res.status}): ${t.slice(0, 500)}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const jsonText =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return jsonText.trim() || null;
  }

  // 1ª passagem — modelos estáticos preferidos
  for (const model of staticCandidates) {
    const jsonText = await tryModel(model);
    if (jsonText) return { jsonText, model, pagesHandledBy };
  }

  // 2ª passagem — descobre dinamicamente todos os modelos disponíveis
  const discovered = await listGeminiModels(apiKey);
  // Ordena: prefere modelos mais novos / pro
  const preferredOrder = ["2.0", "1.5-pro", "1.5-flash", "pro", "flash"];
  discovered.sort((a, b) => {
    const ia = preferredOrder.findIndex((p) => a.includes(p));
    const ib = preferredOrder.findIndex((p) => b.includes(p));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const model of discovered.slice(0, 15)) {
    if (staticCandidates.includes(model)) continue; // já tentado
    const jsonText = await tryModel(model);
    if (jsonText) return { jsonText, model, pagesHandledBy };
  }

  throw new Error(
    "Nenhum modelo Gemini disponível para análise de PDF. Verifique a GEMINI_API_KEY e os modelos habilitados no seu projeto.",
  );
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Envie um PDF no campo 'file' (multipart/form-data)." },
      { status: 400 },
    );
  }
  if ((file.type || "application/pdf") !== "application/pdf") {
    return NextResponse.json({ error: "Apenas PDF é suportado." }, { status: 415 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada. Configure a variável de ambiente para usar esta função." },
      { status: 500 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let result: { jsonText: string; model: string; pagesHandledBy: string };
  try {
    result = await analyzeEditalWithGemini(bytes, geminiKey);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[edital/parse] Gemini failed:", message);
    return NextResponse.json(
      { error: `Falha ao analisar o PDF: ${message}`.slice(0, 900) },
      { status: 502 },
    );
  }

  const robust = parseLlmJsonRobustly(result.jsonText);
  if (!robust.ok) {
    console.error("[edital/parse] JSON inválido:", robust.message);
    return NextResponse.json(
      { error: `IA retornou JSON inválido: ${robust.message}` },
      { status: 500 },
    );
  }

  const draft = robust.value as EditalDraft;
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    draft,
    meta: {
      llm: { provider: "gemini", model: result.model },
      pagesHandledBy: result.pagesHandledBy,
      fileSizeBytes: bytes.length,
      elapsedMs,
    },
  });
}
