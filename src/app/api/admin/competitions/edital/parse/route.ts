import { NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { auth } from "@/lib/auth";
import { runLlmJson } from "@/lib/ai/llm";
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

type EditalDraft = {
  name: string;
  organization?: string | null;
  examBoard?: { acronym: string; name?: string | null } | null;
  cities?: Array<{ name: string; state: string }> | null;
  jobRoles?: Array<{ name: string }> | null;
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
  const mimeType = file.type || "application/pdf";
  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Apenas PDF é suportado (application/pdf)." }, { status: 415 });
  }

  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION").trim().toLowerCase();
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID").trim();

  const bytes = Buffer.from(await file.arrayBuffer());

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-edital-parse",
      location: "src/app/api/admin/competitions/edital/parse/route.ts:POST",
      message: "edital parse started",
      data: { bytes: bytes.length, projectId, location, processorId },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const client = new DocumentProcessorServiceClient({ apiEndpoint: `${location}-documentai.googleapis.com` });
  const name = client.processorPath(projectId, location, processorId);

  let result: Awaited<ReturnType<typeof extractPdfFullTextWithDocumentAi>>;
  try {
    result = await extractPdfFullTextWithDocumentAi(client, name, bytes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        runId: "post-fix",
        hypothesisId: "H-docai-process",
        location: "src/app/api/admin/competitions/edital/parse/route.ts:extractPdf:catch",
        message: "Document AI extract failed",
        data: { messageHead: message.slice(0, 500) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: `Falha ao ler o PDF (Document AI): ${message}`.slice(0, 900) }, { status: 502 });
  }

  const pageCount = result.pageCount;
  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "post-fix",
      hypothesisId: "H-docai-process",
      location: "src/app/api/admin/competitions/edital/parse/route.ts:processDocument:ok",
      message: "Document AI ok",
      data: { pageCount, textChars: (result.document?.text ?? "").length, usedChunking: result.usedChunking },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const fullText = (result.document?.text ?? "").trim();
  const excerpt = fullText.slice(0, 20000);

  const system = [
    "Você é um assistente que extrai dados estruturados de um EDITAL de concurso público no Brasil.",
    "Retorne APENAS JSON válido.",
    "Se um campo não existir, use null ou omita.",
    "Se houver múltiplas cidades/estados/cargos, liste.",
    "Se a banca tiver sigla (ex: FGV, CEBRASPE), preencha acronym.",
    "Datas: use formato YYYY-MM-DD se possível.",
    "Inclua confidence entre 0 e 1 (quão confiável está o preenchimento global).",
  ].join("\n");

  const user = [
    "Texto (trecho inicial do edital; pode estar incompleto):",
    excerpt,
    "",
    "Extraia um rascunho EditalDraft com os campos:",
    "name, organization, examBoard{acronym,name}, cities[{name,state}], jobRoles[{name}], examDate, year, description, notes, confidence",
  ].join("\n");

  const llm = await runLlmJson(system, user);
  let draft: EditalDraft | null = null;
  try {
    draft = JSON.parse(llm.jsonText) as EditalDraft;
  } catch (e) {
    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        runId: "pre-fix",
        hypothesisId: "H-edital-parse",
        location: "src/app/api/admin/competitions/edital/parse/route.ts:JSON",
        message: "LLM returned invalid JSON",
        data: { provider: llm.provider, model: llm.model, jsonTextHead: llm.jsonText.slice(0, 800) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const msg = e instanceof Error ? e.message : "JSON inválido";
    return NextResponse.json({ error: `IA retornou JSON inválido: ${msg}` }, { status: 500 });
  }

  const elapsedMs = Date.now() - startedAt;

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-edital-parse",
      location: "src/app/api/admin/competitions/edital/parse/route.ts:POST",
      message: "edital parse finished",
      data: { elapsedMs, provider: llm.provider, model: llm.model, confidence: draft?.confidence ?? null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({
    draft,
    meta: {
      llm: { provider: llm.provider, model: llm.model },
      docaiChars: fullText.length,
      elapsedMs,
    },
  });
}

