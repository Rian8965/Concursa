import { NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { auth } from "@/lib/auth";
import { runLlmJson } from "@/lib/ai/llm";
import { DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS } from "@/lib/docai/process-options";

export const runtime = "nodejs";

type DocaiLayout = {
  textAnchor?: { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> };
  boundingPoly?: { normalizedVertices?: Array<{ x?: number; y?: number }>; vertices?: Array<{ x?: number; y?: number }> };
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function segText(fullText: string, layout?: DocaiLayout) {
  const segs = layout?.textAnchor?.textSegments ?? [];
  if (!fullText || !segs.length) return "";
  let out = "";
  for (const s of segs) {
    const a = Number(s.startIndex ?? 0);
    const b = Number(s.endIndex ?? 0);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) out += fullText.slice(a, b);
  }
  return out;
}

function bboxStats(layout?: DocaiLayout) {
  const verts =
    layout?.boundingPoly?.normalizedVertices ??
    layout?.boundingPoly?.vertices ??
    [];
  const xs = verts.map((v) => (typeof v.x === "number" ? v.x : NaN)).filter((n) => Number.isFinite(n));
  const ys = verts.map((v) => (typeof v.y === "number" ? v.y : NaN)).filter((n) => Number.isFinite(n));
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const midX = (minX + maxX) / 2;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midY = (minY + maxY) / 2;
  return { minX, maxX, midX, minY, maxY, midY };
}

function reconstructReadingOrder(pages: Array<any>) {
  const out: Array<{ page: number | null; text: string }> = [];

  for (const p of pages) {
    const paras = (p.paragraphs ?? []).filter((x: any) => (x.text ?? "").trim().length > 0);
    const withPos = paras
      .map((para: any) => {
        const s = bboxStats({ boundingPoly: para.bbox, textAnchor: undefined } as any) ?? para;
        return {
          text: String(para.text ?? ""),
          midX: typeof para.midX === "number" ? para.midX : typeof s.midX === "number" ? s.midX : null,
          midY: typeof para.midY === "number" ? para.midY : typeof s.midY === "number" ? s.midY : null,
        };
      })
      .filter((x: any) => x.midY != null);

    const left = withPos.filter((x: any) => x.midX != null && x.midX < 0.5).sort((a: any, b: any) => a.midY - b.midY);
    const right = withPos.filter((x: any) => x.midX != null && x.midX >= 0.5).sort((a: any, b: any) => a.midY - b.midY);

    const joined = [...left, ...right].map((x: any) => x.text.trim()).filter(Boolean).join("\n");
    out.push({ page: p.pageNumber ?? null, text: joined });
  }

  return out;
}

export async function POST(req: Request) {
  const devToken = process.env.ADMIN_API_DEV_TOKEN;
  const hasDevBypass = !!devToken && req.headers.get("x-dev-token") === devToken;

  if (!hasDevBypass) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role === "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startedAt = Date.now();

  // 1) Recebe PDF
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um PDF no campo 'file' (multipart/form-data)." }, { status: 400 });
  }

  const mimeType = file.type || "application/pdf";
  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Apenas PDF é suportado (application/pdf)." }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // 2) Document AI (layout)
  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION");
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID");

  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${location}-documentai.googleapis.com`,
  });

  const name = client.processorPath(projectId, location, processorId);
  const [result] = await client.processDocument({
    name,
    rawDocument: { content: bytes.toString("base64"), mimeType: "application/pdf" },
    processOptions: { ...DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS },
  });

  const fullText = result.document?.text ?? "";
  const doc = result.document as unknown as {
    pages?: Array<{
      pageNumber?: number;
      paragraphs?: Array<{ layout?: DocaiLayout }>;
    }>;
  } | undefined;

  const pages =
    doc?.pages?.map((p) => {
      const parasRaw = p.paragraphs ?? [];
      const paragraphs = parasRaw
        .map((para, i) => {
          const s = bboxStats(para.layout);
          return {
            i,
            text: segText(fullText, para.layout),
            bbox: para.layout?.boundingPoly ?? null,
            midX: s?.midX ?? null,
            midY: s?.midY ?? null,
          };
        })
        .filter((x) => x.text.trim().length > 0);
      return { pageNumber: p.pageNumber ?? null, paragraphs };
    }) ?? [];

  const ordered = reconstructReadingOrder(pages);
  const combined = ordered.map((p) => `--- Página ${p.page ?? "?"} ---\n${p.text}`).join("\n\n");

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-llm-parse",
      location: "src/app/api/admin/ai/import-proof/route.ts:POST",
      message: "ai import-proof starting",
      data: { bytes: bytes.length, pages: pages.length, fullTextLength: fullText.length, combinedLength: combined.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // 3) LLM para estruturar
  const system = [
    "Você é um extrator de provas de concurso.",
    "Você receberá texto OCR (já em ordem de leitura por páginas/colunas).",
    "TAREFA: retornar APENAS JSON válido (sem markdown) no formato:",
    "{ meta: { city?, concurso?, ano?, banca?, cargo?, materia? }, baseTexts: [{id, text}], questions: [{number, statement, baseTextId?, alternatives:[{letter, text}], correctAnswerLetter?}] }",
    "REGRAS:",
    "- Se houver 'texto-base' (enunciado comum) que vale para várias questões, crie um item em baseTexts e aponte baseTextId em todas as questões relacionadas.",
    "- Ignorar redação/discursivas: não criar questions para essa seção.",
    "- Manter a ordem correta das questões.",
    "- Alternativas: normalizar letras A,B,C,D,E (ou a,b,c...). Se faltarem, ainda assim tentar.",
    "- Se não souber algum metadado, omitir o campo.",
  ].join("\n");

  const user = [
    "Extraia a prova abaixo.",
    "Se houver colunas, já estão ordenadas por coluna esquerda depois direita em cada página.",
    "TEXTO:",
    combined,
  ].join("\n\n");

  const llm = await runLlmJson(system, user);

  let parsed: any = null;
  try {
    parsed = JSON.parse(llm.jsonText);
  } catch {
    return NextResponse.json(
      { error: "A IA não retornou JSON válido.", provider: llm.provider, model: llm.model, raw: llm.jsonText.slice(0, 2000) },
      { status: 502 },
    );
  }

  const elapsedMs = Date.now() - startedAt;

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-llm-parse",
      location: "src/app/api/admin/ai/import-proof/route.ts:POST:done",
      message: "ai import-proof completed",
      data: { elapsedMs, provider: llm.provider, model: llm.model, questions: Array.isArray(parsed?.questions) ? parsed.questions.length : null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({
    ok: true,
    meta: { elapsedMs, provider: llm.provider, model: llm.model },
    result: parsed,
  });
}

