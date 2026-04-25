import fs from "fs/promises";
import path from "path";
import { Storage } from "@google-cloud/storage";

function baseDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "private", "import-pdfs");
}

export function getImportPdfPath(importId: string): string {
  return path.join(baseDir(), `${importId}.pdf`);
}

export async function ensureImportPdfDir(): Promise<void> {
  await fs.mkdir(baseDir(), { recursive: true });
}

type StoredPdfRef =
  | { kind: "local"; path: string }
  | { kind: "gcs"; bucket: string; object: string };

function parseStoredPdfPath(storedPath: string): StoredPdfRef {
  // Novo formato: gcs://bucket/path/to/object.pdf
  if (storedPath.startsWith("gcs://")) {
    const rest = storedPath.slice("gcs://".length);
    const idx = rest.indexOf("/");
    const bucket = idx === -1 ? rest : rest.slice(0, idx);
    const object = idx === -1 ? "" : rest.slice(idx + 1);
    return { kind: "gcs", bucket, object };
  }
  // Compat/legado: caminho local relativo ao cwd (ex.: private/import-pdfs/{id}.pdf)
  return { kind: "local", path: storedPath };
}

function storageClient() {
  return new Storage();
}

function configuredBucket(): string | null {
  // Em produção (Firebase App Hosting), configure IMPORT_PDF_BUCKET com o nome do bucket (sem gs://).
  // Em dev, pode ficar vazio e usaremos o disco local.
  const b = process.env.IMPORT_PDF_BUCKET;
  const t = typeof b === "string" ? b.trim().replace(/^gs:\/\//, "") : "";
  return t ? t : null;
}

export async function saveImportPdfBuffer(importId: string, buffer: Buffer): Promise<string> {
  const bucket = configuredBucket();
  if (bucket) {
    const object = `imports/${importId}.pdf`;
    const storage = storageClient();
    const file = storage.bucket(bucket).file(object);
    await file.save(buffer, { contentType: "application/pdf", resumable: false });
    return `gcs://${bucket}/${object}`;
  }

  await ensureImportPdfDir();
  const p = getImportPdfPath(importId);
  await fs.writeFile(p, buffer);
  return `private/import-pdfs/${importId}.pdf`;
}

export async function deleteImportPdfFile(storedPath: string | null | undefined): Promise<void> {
  if (!storedPath) return;
  const ref = parseStoredPdfPath(storedPath);
  if (ref.kind === "gcs") {
    try {
      await storageClient().bucket(ref.bucket).file(ref.object).delete({ ignoreNotFound: true });
    } catch {
      /* ignore */
    }
    return;
  }

  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), ref.path);
  try {
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
}

export async function readImportPdfBuffer(storedPath: string | null | undefined): Promise<Buffer | null> {
  if (!storedPath) return null;
  const ref = parseStoredPdfPath(storedPath);
  if (ref.kind === "gcs") {
    try {
      const [buf] = await storageClient().bucket(ref.bucket).file(ref.object).download();
      return buf;
    } catch {
      return null;
    }
  }

  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), ref.path);
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
