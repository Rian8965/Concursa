import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function baseDir() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "private", "brand-assets");
}

export async function ensureBrandAssetsDir(): Promise<void> {
  await fs.mkdir(baseDir(), { recursive: true });
}

export function getBrandAssetPath(key: string): string {
  return path.join(baseDir(), key);
}

export function makeBrandAssetKey(ext: string) {
  const safeExt = ext.replace(/[^a-z0-9.]/gi, "").toLowerCase() || "bin";
  const id = crypto.randomBytes(16).toString("hex");
  return `${id}.${safeExt}`;
}

export async function saveBrandAssetBuffer(key: string, buffer: Buffer): Promise<string> {
  await ensureBrandAssetsDir();
  const full = getBrandAssetPath(key);
  await fs.writeFile(full, buffer);
  return `private/brand-assets/${key}`;
}

export async function readBrandAssetBuffer(storedPath: string | null | undefined): Promise<Buffer | null> {
  if (!storedPath) return null;
  const full = path.join(/*turbopackIgnore: true*/ process.cwd(), storedPath);
  try {
    return await fs.readFile(full);
  } catch {
    return null;
  }
}

