import { NextRequest, NextResponse } from "next/server";
import { readBrandAssetBuffer } from "@/lib/brand-storage";
import { prisma } from "@/lib/db/prisma";

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
  // Fonte primária: banco (persistente entre instâncias).
  const db = await prisma.brandAsset.findUnique({
    where: { key },
    select: { bytes: true, mimeType: true },
  });

  const buf = db?.bytes
    ? Buffer.from(db.bytes)
    : await readBrandAssetBuffer(`private/brand-assets/${key}`);

  // Não retorne JSON aqui: o front usa `next/image` e isso vira "imagem inválida".
  if (!buf) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Content-Type": contentTypeFromKey(key),
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": db?.mimeType ?? contentTypeFromKey(key),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

