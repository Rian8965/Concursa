import { NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { auth } from "@/lib/auth";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";
import { extractPdfFullTextWithDocumentAi } from "@/lib/docai/extract-pdf-fulltext";

export const runtime = "nodejs";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export type EditalDraft = {
  name: string;
  organization?: string | null;
  examBoard?: { acronym: string; name?: string | null } | null;
  cities?: Array<{ name: string; state: string }> | null;
  /** Cargos identificados, cada um com suas próprias matérias */
  jobRoles?: Array<{
    name: string;
    subjects?: Array<{ name: string }> | null;
  }> | null;
  /** Etapas/fases do concurso (prova objetiva, TAF, psicológico, etc.) */
  stages?: Array<{ name: string }> | null;
  examDate?: string | null; // YYYY-MM-DD
  year?: number | null;
  description?: string | null;
  notes?: string | null;
  confidence?: number | null; // 0..1
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um PDF no campo 'file' (multipart/form-data)." }, { status: 400 });
  }
  if ((file.type || "application/pdf") !== "application/pdf") {
    return NextResponse.json({ error: "Apenas PDF é suportado (application/pdf)." }, { status: 415 });
  }

  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION").trim().toLowerCase();
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID").trim();

  const bytes = Buffer.from(await file.arrayBuffer());

  const client = new DocumentProcessorServiceClient({ apiEndpoint: `${location}-documentai.googleapis.com` });
  const name = client.processorPath(projectId, location, processorId);

  let result: Awaited<ReturnType<typeof extractPdfFullTextWithDocumentAi>>;
  try {
    result = await extractPdfFullTextWithDocumentAi(client, name, bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[edital/parse] Document AI failed:", message);
    return NextResponse.json(
      { error: `Falha ao ler o PDF (Document AI): ${message}`.slice(0, 900) },
      { status: 502 },
    );
  }

  const fullText = (result.document?.text ?? "").trim();
  const pageCount = result.pageCount;

  if (!fullText) {
    return NextResponse.json(
      { error: "O PDF não contém texto legível. Verifique se o arquivo é um edital textual (não apenas imagens)." },
      { status: 422 },
    );
  }

  // Envia até 80.000 chars para o LLM (editais longos têm até ~60k chars de texto).
  const MAX_CHARS = 80_000;
  const excerpt =
    fullText.length > MAX_CHARS
      ? fullText.slice(0, MAX_CHARS) + "\n\n[... texto truncado ...]"
      : fullText;

  const system = [
    "Você é um assistente especializado em extrair dados estruturados de EDITAIS de concurso público no Brasil.",
    "Retorne APENAS JSON válido, sem markdown, sem explicações.",
    "Regras:",
    "- Se um campo não existir no edital, use null ou omita.",
    "- Se houver múltiplas cidades, liste todas em 'cities'.",
    "- Para cada cargo (jobRole), identifique as matérias/disciplinas específicas daquele cargo.",
    "- Matérias comuns a todos os cargos devem aparecer em TODOS os cargos onde se aplicam.",
    "- Se o edital tiver um quadro de matérias genérico (sem separar por cargo), replique para todos os cargos.",
    "- Identifique as etapas/fases do concurso (prova objetiva, discursiva, TAF, psicológico, investigação social, curso de formação, títulos, etc.).",
    "- Banca com sigla (ex: FGV, CEBRASPE, VUNESP): preencha acronym.",
    "- Datas: use formato YYYY-MM-DD.",
    "- confidence: 0 a 1 (quão confiável é o preenchimento global).",
  ].join("\n");

  const user = [
    "Texto do edital (pode estar incompleto se muito longo):",
    "---",
    excerpt,
    "---",
    "",
    "Extraia o objeto EditalDraft com EXATAMENTE esta estrutura JSON:",
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

  const llm = await runLlmJson(system, user);
  const robust = parseLlmJsonRobustly(llm.jsonText);
  if (!robust.ok) {
    console.error("[edital/parse] LLM returned invalid JSON:", robust.message);
    return NextResponse.json({ error: `IA retornou JSON inválido: ${robust.message}` }, { status: 500 });
  }
  const draft = robust.value as EditalDraft;
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    draft,
    meta: {
      llm: { provider: llm.provider, model: llm.model },
      docaiChars: fullText.length,
      elapsedMs,
      pageCount,
      usedChunking: result.usedChunking,
    },
  });
}
