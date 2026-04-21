import type { protos } from "@google-cloud/documentai";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS, DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS } from "./process-options";

/** Margem abaixo do limite típico (~30 págs.) do processamento online com imageless. */
const ONLINE_CHUNK_PAGES = 24;

export function isDocumentAiOnlinePageLimitError(message: string): boolean {
  return /pages in non-imageless mode exceed|Document pages in non-imageless|exceed the limit:\s*\d+\s+got\s+\d+|imageless mode to increase the limit/i.test(
    message,
  );
}

function parseGotPageCount(message: string): number | null {
  const m = message.match(/got\s+(\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function processRange(
  client: DocumentProcessorServiceClient,
  processorName: string,
  pdfBytes: Buffer,
  fromStart: number,
  fromEnd: number,
): Promise<protos.google.cloud.documentai.v1.IProcessResponse> {
  const [res] = await client.processDocument({
    name: processorName,
    rawDocument: { content: pdfBytes.toString("base64"), mimeType: "application/pdf" },
    imagelessMode: true,
    processOptions: {
      ...DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS,
      fromStart,
      fromEnd,
    },
  });
  return res;
}

function mergeText(chunks: string[]) {
  return chunks.map((t) => t.trim()).filter(Boolean).join("\n\n");
}

function estimatePdfPageCount(pdfBytes: Buffer): number | null {
  // Heurística leve para evitar dependências que exigem APIs de browser (ex: DOMMatrix).
  // Conta ocorrências de "/Type /Page" (mas não "/Type /Pages").
  try {
    const s = pdfBytes.toString("latin1");
    const m = s.match(/\/Type\s*\/Page(?!s)\b/g);
    const n = m?.length ?? 0;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function runChunked(
  client: DocumentProcessorServiceClient,
  processorName: string,
  pdfBytes: Buffer,
  totalPages: number,
): Promise<{
  document: protos.google.cloud.documentai.v1.IDocument;
  pageCount: number;
  usedChunking: boolean;
}> {
  const texts: string[] = [];
  const total = Math.max(1, totalPages);
  for (let start = 1; start <= total; start += ONLINE_CHUNK_PAGES) {
    const end = Math.min(start + ONLINE_CHUNK_PAGES - 1, total);
    const res = await processRange(client, processorName, pdfBytes, start, end);
    texts.push(res.document?.text ?? "");
  }
  return {
    document: { text: mergeText(texts), pages: [] },
    pageCount: total,
    usedChunking: true,
  };
}

/**
 * Extrai texto do PDF via Document AI. Usa faixas de página quando o PDF passa
 * do limite de uma única requisição online ou quando a API ainda acusa limite.
 */
export async function extractPdfFullTextWithDocumentAi(
  client: DocumentProcessorServiceClient,
  processorName: string,
  pdfBytes: Buffer,
): Promise<{
  document: protos.google.cloud.documentai.v1.IDocument;
  pageCount: number;
  usedChunking: boolean;
}> {
  const pageCount = Math.max(1, estimatePdfPageCount(pdfBytes) ?? 1);

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "imageless-fix",
      hypothesisId: "H-imageless-flag",
      location: "extract-pdf-fulltext.ts:extractPdfFullTextWithDocumentAi",
      message: "docai extract path",
      data: { pageCount, willChunkFirst: pageCount > ONLINE_CHUNK_PAGES, imagelessMode: true },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (pageCount > ONLINE_CHUNK_PAGES) {
    return runChunked(client, processorName, pdfBytes, pageCount);
  }

  try {
    const [res] = await client.processDocument({
      name: processorName,
      rawDocument: { content: pdfBytes.toString("base64"), mimeType: "application/pdf" },
      ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
    });
    return { document: res.document ?? {}, pageCount, usedChunking: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!isDocumentAiOnlinePageLimitError(message)) {
      throw e;
    }
    const fromErr = parseGotPageCount(message);
    const totalForChunk = fromErr ?? Math.min(500, Math.max(pageCount + 1, 30));
    return runChunked(client, processorName, pdfBytes, Math.max(pageCount, totalForChunk));
  }
}
