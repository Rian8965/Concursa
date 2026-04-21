import fs from "fs/promises";
import path from "path";

function baseDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "private", "import-pdfs");
}

export function getImportPdfPath(importId: string): string {
  return path.join(baseDir(), `${importId}.pdf`);
}

export async function ensureImportPdfDir(): Promise<void> {
  await fs.mkdir(baseDir(), { recursive: true });
}

export async function saveImportPdfBuffer(importId: string, buffer: Buffer): Promise<string> {
  await ensureImportPdfDir();
  const p = getImportPdfPath(importId);
  await fs.writeFile(p, buffer);
  return `private/import-pdfs/${importId}.pdf`;
}

export async function deleteImportPdfFile(storedPath: string | null | undefined): Promise<void> {
  if (!storedPath) return;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
  try {
    await fs.unlink(full);
  } catch {
    /* ignore */
  }
}

export async function readImportPdfBuffer(storedPath: string | null | undefined): Promise<Buffer | null> {
  if (!storedPath) return null;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}
