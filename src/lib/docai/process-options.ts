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

/**
 * O SDK Node define `imagelessMode` em ProcessRequest com default **false**.
 * Só passar `processOptions.ocrConfig.advancedOcrOptions` não ativa o limite online de ~30 págs;
 * sem `imagelessMode: true` a API continua em modo não-imageless (~15 págs).
 */
export const DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS: Pick<
  protos.google.cloud.documentai.v1.IProcessRequest,
  "imagelessMode" | "processOptions"
> = {
  imagelessMode: true,
  processOptions: DOCUMENT_AI_IMAGELESS_PROCESS_OPTIONS,
};
