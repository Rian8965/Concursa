import { NextRequest, NextResponse } from "next/server";
import { readBrandAssetBuffer } from "@/lib/brand-storage";

export const runtime = "nodejs";

function contentTypeFromKey(key: string) {
  const k = key.toLowerCase();
  if (k.endsWith(".png")) return "image/png";
  if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
  if (k.endsWith(".webp")) return "image/webp";
  if (k.endsWith(".gif")) return "image/gif";
  if (k.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const storedPath = `private/brand-assets/${key}`;
  const buf = await readBrandAssetBuffer(storedPath);
  if (!buf) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFromKey(key),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

