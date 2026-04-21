import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { readImportPdfBuffer } from "@/lib/import-pdf-storage";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { runLlmJson } from "@/lib/ai/llm";

export const runtime = "nodejs";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type DocaiLayout = {
  textAnchor?: { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> };
  boundingPoly?: { normalizedVertices?: Array<{ x?: number; y?: number }>; vertices?: Array<{ x?: number; y?: number }> };
};

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

function bboxMinMax(layout?: DocaiLayout) {
  const verts =
    layout?.boundingPoly?.normalizedVertices ??
    layout?.boundingPoly?.vertices ??
    [];
  const xs = verts.map((v) => (typeof v.x === "number" ? v.x : NaN)).filter((n) => Number.isFinite(n));
  const ys = verts.map((v) => (typeof v.y === "number" ? v.y : NaN)).filter((n) => Number.isFinite(n));
  if (!xs.length || !ys.length) return null;
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function intersects(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: importId } = await params;
  const body = (await req.json()) as {
    importedQuestionId: string;
    page: number;
    bbox: { x: number; y: number; w: number; h: number };
  };

  if (!body.importedQuestionId) return NextResponse.json({ error: "importedQuestionId é obrigatório" }, { status: 400 });
  if (!body.page || body.page < 1) return NextResponse.json({ error: "page inválida" }, { status: 400 });
  const b = body.bbox;
  const okBbox = b && [b.x, b.y, b.w, b.h].every((n) => typeof n === "number" && n >= 0 && n <= 1) && b.w > 0 && b.h > 0;
  if (!okBbox) return NextResponse.json({ error: "bbox inválido (0–1)" }, { status: 400 });

  const imp = await prisma.pDFImport.findUnique({ where: { id: importId }, select: { storedPdfPath: true } });
  if (!imp?.storedPdfPath) return NextResponse.json({ error: "PDF não disponível" }, { status: 404 });

  const iq = await prisma.importedQuestion.findFirst({ where: { id: body.importedQuestionId, importId }, select: { id: true } });
  if (!iq) return NextResponse.json({ error: "Questão não pertence a esta importação" }, { status: 400 });

  const pdf = await readImportPdfBuffer(imp.storedPdfPath);
  if (!pdf) return NextResponse.json({ error: "PDF não encontrado no disco" }, { status: 404 });

  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION").trim().toLowerCase();
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID").trim();

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-alt-identify",
      location: "src/app/api/admin/imports/[id]/identify-alternatives/route.ts:POST",
      message: "identify alternatives request",
      data: { importId, importedQuestionId: body.importedQuestionId, page: body.page, bbox: body.bbox },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const client = new DocumentProcessorServiceClient({ apiEndpoint: `${location}-documentai.googleapis.com` });
  const name = client.processorPath(projectId, location, processorId);
  const [result] = await client.processDocument({
    name,
    rawDocument: { content: pdf.toString("base64"), mimeType: "application/pdf" },
  });

  const fullText = result.document?.text ?? "";
  const doc = result.document as unknown as {
    pages?: Array<{ pageNumber?: number; paragraphs?: Array<{ layout?: DocaiLayout }> }>;
  } | undefined;

  const pageIdx = body.page - 1;
  const pageObj = doc?.pages?.[pageIdx];
  if (!pageObj) return NextResponse.json({ error: "Página não encontrada no Document AI" }, { status: 404 });

  const selBox = { minX: b.x, minY: b.y, maxX: b.x + b.w, maxY: b.y + b.h };
  const paras = (pageObj.paragraphs ?? [])
    .map((p) => {
      const mm = bboxMinMax(p.layout);
      return { text: segText(fullText, p.layout).trim(), mm };
    })
    .filter((x) => x.text.length > 0 && x.mm);

  const picked = paras
    .filter((x) => intersects(x.mm!, selBox))
    .map((x) => x.text)
    .join("\n");

  const system = [
    "Você extrai alternativas de uma questão de prova a partir de um trecho OCR.",
    "Retorne APENAS JSON válido (sem markdown) no formato:",
    "{ alternatives: [{ letter: 'A', content: '...' }, ...] }",
    "REGRAS:",
    "- Reconhecer formatos: A) (A) A. a) etc.",
    "- Alternativas podem estar quebradas em várias linhas; junte as linhas da mesma alternativa.",
    "- Se houver enunciado misturado, ignore o que não for alternativa.",
    "- Normalizar letras para A,B,C,D,E (maiúsculo).",
  ].join("\n");
  const user = ["TRECHO OCR:", picked].join("\n\n");

  const llm = await runLlmJson(system, user);
  let parsed: any;
  try {
    parsed = JSON.parse(llm.jsonText);
  } catch {
    return NextResponse.json({ error: "IA não retornou JSON válido.", raw: llm.jsonText.slice(0, 1200) }, { status: 502 });
  }

  const alternatives = Array.isArray(parsed?.alternatives) ? parsed.alternatives : [];
  const cleaned = alternatives
    .map((a: any) => ({
      letter: String(a?.letter ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1),
      content: String(a?.content ?? a?.text ?? "").trim(),
    }))
    .filter((a: any) => a.letter && a.content);

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-alt-identify",
      location: "src/app/api/admin/imports/[id]/identify-alternatives/route.ts:POST:done",
      message: "identify alternatives completed",
      data: { importId, page: body.page, pickedChars: picked.length, alternatives: cleaned.length, provider: llm.provider, model: llm.model },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ ok: true, extractedText: picked, alternatives: cleaned, meta: { provider: llm.provider, model: llm.model } });
}

