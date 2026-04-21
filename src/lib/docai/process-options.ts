import type { protos } from "@google-cloud/documentai";

/**
 * Opções do Document AI para PDFs maiores.
 * Sem imageless: limite típico de ~15 páginas; com USE_IMAGELESS_OCR: até ~30.
 * @see https://cloud.google.com/document-ai/docs/process-documents-client-libraries
 */
export const DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS: protos.google.cloud.documentai.v1.IProcessOptions = {
  ocrConfig: {
    advancedOcrOptions: ["USE_IMAGELESS_OCR"],
  },
};
