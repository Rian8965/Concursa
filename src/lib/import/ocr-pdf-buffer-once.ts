import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS } from "@/lib/docai/process-options";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/** OCR rápido (Document AI online) de um PDF pequeno em memória — ex.: gabarito. */
export async function ocrPdfBufferToText(pdfBytes: Buffer): Promise<string> {
  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION").trim().toLowerCase();
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID").trim();

  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${location}-documentai.googleapis.com`,
  });
  const name = client.processorPath(projectId, location, processorId);

  const [res] = await client.processDocument({
    name,
    rawDocument: { content: pdfBytes.toString("base64"), mimeType: "application/pdf" },
    ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
  });

  return (res.document?.text ?? "").trim();
}
