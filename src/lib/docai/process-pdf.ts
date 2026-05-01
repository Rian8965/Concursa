import type { protos } from "@google-cloud/documentai";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { Storage } from "@google-cloud/storage";
import { extractPdfFullTextWithDocumentAi, isDocumentAiOnlinePageLimitError } from "./extract-pdf-fulltext";
import { DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS } from "./process-options";

type DocAiProcessed = {
  document: protos.google.cloud.documentai.v1.IDocument;
  mode: "online" | "batch" | "online_chunked";
  pageCount: number | null;
};

function parseGcsUri(uri: string): { bucket: string; object: string } | null {
  const norm = uri.replace(/^gs:\/\//, "gcs://");
  if (!norm.startsWith("gcs://")) return null;
  const rest = norm.slice("gcs://".length);
  const idx = rest.indexOf("/");
  const bucket = idx === -1 ? rest : rest.slice(0, idx);
  const object = idx === -1 ? "" : rest.slice(idx + 1);
  if (!bucket || !object) return null;
  return { bucket, object };
}

function toGsUri(storedPath: string): string | null {
  const ref = parseGcsUri(storedPath);
  if (!ref) return null;
  return `gs://${ref.bucket}/${ref.object}`;
}

async function pickFirstJsonFromPrefix(bucketName: string, prefix: string): Promise<{ bucket: string; object: string } | null> {
  const storage = new Storage();
  const [files] = await storage.bucket(bucketName).getFiles({ prefix });
  const jsonFiles = files
    .map((f) => f.name)
    .filter((n) => n.toLowerCase().endsWith(".json"));
  if (!jsonFiles.length) return null;

  // Alguns prefixes incluem arquivos auxiliares (ex.: operation.json). Prioriza prováveis "document" outputs.
  const preferred =
    jsonFiles.find((n) => /document\.json$/i.test(n)) ??
    jsonFiles.find((n) => /output.*\.json$/i.test(n)) ??
    jsonFiles.find((n) => !/operation\.json$/i.test(n)) ??
    jsonFiles[0];

  return preferred ? { bucket: bucketName, object: preferred } : null;
}

async function downloadJson(bucketName: string, objectName: string): Promise<any> {
  const storage = new Storage();
  const [buf] = await storage.bucket(bucketName).file(objectName).download();
  const raw = buf.toString("utf8");
  return JSON.parse(raw);
}

function coerceDocumentFromBatchJson(payload: any): protos.google.cloud.documentai.v1.IDocument | null {
  if (!payload || typeof payload !== "object") return null;

  // Formato comum: { document: { ... } }
  if (payload.document && typeof payload.document === "object") {
    return payload.document as protos.google.cloud.documentai.v1.IDocument;
  }

  // Em alguns casos, o JSON salvo pode ser o próprio Document (sem wrapper).
  const looksLikeDoc =
    typeof payload.text === "string" ||
    Array.isArray(payload.pages) ||
    typeof payload.mimeType === "string";
  if (looksLikeDoc) return payload as protos.google.cloud.documentai.v1.IDocument;

  return null;
}

async function processPdfViaBatchDocumentAi(params: {
  client: DocumentProcessorServiceClient;
  processorName: string;
  inputGsUri: string;
  outputGsUri: string;
}): Promise<protos.google.cloud.documentai.v1.IDocument> {
  const { client, processorName, inputGsUri, outputGsUri } = params;

  let op: any;
  try {
    const [created] = await client.batchProcessDocuments({
      name: processorName,
      inputDocuments: {
        gcsDocuments: {
          documents: [{ gcsUri: inputGsUri, mimeType: "application/pdf" }],
        },
      },
      documentOutputConfig: {
        gcsOutputConfig: { gcsUri: outputGsUri },
      },
      ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
    });
    op = created;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Document AI batchProcessDocuments falhou: ${msg}`);
  }

  try {
    await op.promise();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Document AI batch op.promise falhou: ${msg}`);
  }

  const outRef = parseGcsUri(outputGsUri.replace(/^gs:\/\//, "gcs://"));
  if (!outRef) throw new Error("Saída do Document AI (GCS) inválida.");

  // O Document AI cria subpastas dentro do prefix; pegamos o primeiro .json encontrado.
  let picked: { bucket: string; object: string } | null = null;
  try {
    picked = await pickFirstJsonFromPrefix(outRef.bucket, outRef.object.replace(/\/?$/, "/"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Falha ao listar saída do Document AI no GCS: ${msg}`);
  }
  if (!picked) throw new Error("Document AI concluiu, mas não gerou nenhum JSON no GCS.");

  let payload: any;
  try {
    payload = await downloadJson(picked.bucket, picked.object);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Falha ao baixar/parsear JSON do Document AI no GCS: ${msg}`);
  }
  const doc = coerceDocumentFromBatchJson(payload);
  if (doc) return doc;

  // Fallback: às vezes o primeiro JSON escolhido não é o documento; tenta alguns candidatos.
  const fallbackOutRef = parseGcsUri(outputGsUri.replace(/^gs:\/\//, "gcs://"));
  if (!fallbackOutRef) throw new Error("Saída do Document AI (GCS) inválida.");
  const storage = new Storage();
  const [files] = await storage.bucket(fallbackOutRef.bucket).getFiles({ prefix: fallbackOutRef.object.replace(/\/?$/, "/") });
  const candidates = files
    .map((f) => f.name)
    .filter((n) => n.toLowerCase().endsWith(".json"))
    .filter((n) => !/operation\.json$/i.test(n))
    .slice(0, 15);

  for (const name of candidates) {
    try {
      const p = await downloadJson(fallbackOutRef.bucket, name);
      const d = coerceDocumentFromBatchJson(p);
      if (d) return d;
    } catch {
      // ignora e segue
    }
  }

  throw new Error(`JSON do Document AI não contém campo \`document\` (ex.: ${picked.object}).`);
}

const ONLINE_PAGE_LIMIT = 28; // margem de segurança abaixo do limite real (30)

async function processPdfViaOnline(
  client: DocumentProcessorServiceClient,
  processorName: string,
  pdfBytes: Buffer,
): Promise<DocAiProcessed> {
  try {
    const [res] = await client.processDocument({
      name: processorName,
      rawDocument: { content: pdfBytes.toString("base64"), mimeType: "application/pdf" },
      ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
    });
    const document = (res.document ?? {}) as protos.google.cloud.documentai.v1.IDocument;
    const pageCount = Array.isArray((document as any).pages) ? (document as any).pages.length : null;
    return { document, mode: "online", pageCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isDocumentAiOnlinePageLimitError(msg)) throw e;
    const extracted = await extractPdfFullTextWithDocumentAi(client, processorName, pdfBytes);
    return { document: extracted.document, mode: extracted.usedChunking ? "online_chunked" : "online", pageCount: extracted.pageCount };
  }
}

/**
 * Processa um PDF no Document AI retornando o `document` completo (com páginas/layout).
 *
 * Estratégia automática:
 * - PDFs ≤ ONLINE_PAGE_LIMIT páginas → online (rápido, ~10–30s).
 * - PDFs maiores via GCS (produção) → Batch (~2–5min, sem limite de páginas).
 * - Dev/local sem GCS grande → chunking via extract-pdf-fulltext.
 */
export async function processPdfWithDocumentAi(params: {
  client: DocumentProcessorServiceClient;
  processorName: string;
  storedPdfPath: string | null | undefined;
  pdfBytes: Buffer;
  importIdForOutputPrefix?: string;
}): Promise<DocAiProcessed> {
  const { client, processorName, storedPdfPath, pdfBytes, importIdForOutputPrefix } = params;

  // Conta páginas do PDF antes de decidir o modo.
  let pageCount: number | null = null;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    pageCount = src.getPageCount();
  } catch {
    // Se não conseguir contar, assume "grande" pra ser seguro.
  }

  const isSmall = pageCount !== null && pageCount <= ONLINE_PAGE_LIMIT;

  // PDFs pequenos: sempre online (rápido, sem GCS, sem quota de Batch).
  if (isSmall) {
    return processPdfViaOnline(client, processorName, pdfBytes);
  }

  // PDFs grandes via GCS (produção): Batch.
  const inputGs = storedPdfPath ? toGsUri(storedPdfPath) : null;
  if (storedPdfPath && inputGs) {
    const outRef = parseGcsUri(storedPdfPath.replace(/^gs:\/\//, "gcs://"));
    if (!outRef) throw new Error("storedPdfPath inválido para Batch.");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const prefix = `docai/outputs/${importIdForOutputPrefix ?? "import"}/${stamp}/`;
    const outputGs = `gs://${outRef.bucket}/${prefix}`;
    const document = await processPdfViaBatchDocumentAi({
      client,
      processorName,
      inputGsUri: inputGs,
      outputGsUri: outputGs,
    });
    const batchPageCount = Array.isArray((document as any).pages) ? (document as any).pages.length : null;
    return { document, mode: "batch", pageCount: batchPageCount };
  }

  // Fallback local/dev (PDF grande sem GCS): online com chunking automático.
  return processPdfViaOnline(client, processorName, pdfBytes);
}

