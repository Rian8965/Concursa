import fs from "fs/promises";
import path from "path";

function baseDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "private", "editais");
}

export function getEditalPath(competitionId: string): string {
  return path.join(baseDir(), `${competitionId}.pdf`);
}

export async function ensureEditalDir(): Promise<void> {
  await fs.mkdir(baseDir(), { recursive: true });
}

export async function saveEditalBuffer(competitionId: string, buffer: Buffer): Promise<string> {
  await ensureEditalDir();
  const p = getEditalPath(competitionId);
  await fs.writeFile(p, buffer);
  return `private/editais/${competitionId}.pdf`;
}

export async function readEditalBuffer(storedPath: string | null | undefined): Promise<Buffer | null> {
  if (!storedPath) return null;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}

