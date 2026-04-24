import type { protos } from "@google-cloud/documentai";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { PDFDocument } from "pdf-lib";
import { DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS, DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS } from "./process-options";

/**
 * Limite de páginas por chamada ao Document AI (online processing).
 * Mesmo com imagelessMode: true, muitos processadores mantêm o limite em 15.
 * Usamos 14 para ter margem de segurança.
 */
const CHUNK_PAGES = 14;

export function isDocumentAiOnlinePageLimitError(message: string): boolean {
  return (
    /pages in non-imageless mode exceed|Document pages in non-imageless|exceed the limit:\s*\d+\s+got\s+\d+|imageless mode to increase the limit/i.test(
      message,
    ) ||
    /at most\s+\d+\s+pages?\s+in\s+one\s+call/i.test(message) ||
    /more than\s+\d+\s+pages?\s+in\s+one\s+call/i.test(message)
  );
}

function mergeText(chunks: string[]) {
  return chunks
    .map((t) => t.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Divide um PDF em sub-PDFs de até `chunkSize` páginas cada.
 * Retorna buffers prontos para enviar ao Document AI.
 */
async function splitPdfIntoChunks(pdfBytes: Buffer, chunkSize: number): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const chunks: Buffer[] = [];

  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages); // exclusive
    const chunkDoc = await PDFDocument.create();
    const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
    const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((p) => chunkDoc.addPage(p));
    const chunkBytes = await chunkDoc.save();
    chunks.push(Buffer.from(chunkBytes));
  }

  return chunks;
}

async function processSingleBuffer(
  client: DocumentProcessorServiceClient,
  processorName: string,
  pdfBytes: Buffer,
): Promise<string> {
  const [res] = await client.processDocument({
    name: processorName,
    rawDocument: { content: pdfBytes.toString("base64"), mimeType: "application/pdf" },
    ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
  });
  return (res.document?.text ?? "").trim();
}

/**
 * Extrai texto completo de um PDF via Document AI.
 * PDFs com mais de CHUNK_PAGES páginas são divididos em pedaços menores
 * (cada pedaço é um PDF independente) para contornar o limite de páginas por chamada.
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
  // Carrega o PDF para obter a contagem real de páginas
  let pageCount = 1;
  try {
    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pageCount = srcDoc.getPageCount();
  } catch {
    // Se pdf-lib não conseguir ler, tenta direto e deixa o Document AI reclamar
  }

  // PDF pequeno — tenta como chamada única; se falhar por limite, cai no chunking
  if (pageCount <= CHUNK_PAGES) {
    try {
      const text = await processSingleBuffer(client, processorName, pdfBytes);
      return {
        document: { text },
        pageCount,
        usedChunking: false,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Se o erro não for de limite de páginas, repropaga
      if (!isDocumentAiOnlinePageLimitError(msg)) throw e;
      // Caso contrário, cai no chunking abaixo
    }
  }

  // PDF grande (ou fallback): dividir em pedaços e processar separadamente
  const chunks = await splitPdfIntoChunks(pdfBytes, CHUNK_PAGES);
  const texts: string[] = [];

  for (const chunk of chunks) {
    try {
      const text = await processSingleBuffer(client, processorName, chunk);
      texts.push(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Erro de limite (improvável, mas defensivo): pula o chunk com aviso
      if (isDocumentAiOnlinePageLimitError(msg)) {
        console.warn("[docai] chunk still exceeds page limit — skipping:", msg);
        continue;
      }
      throw e;
    }
  }

  return {
    document: { text: mergeText(texts) },
    pageCount,
    usedChunking: true,
  };
}
