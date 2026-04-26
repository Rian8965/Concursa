import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { makeBrandAssetKey, saveBrandAssetBuffer } from "@/lib/brand-storage";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function extFromMime(m: string) {
  if (m === "image/png") return "png";
  if (m === "image/jpeg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  if (m === "image/svg+xml") return "svg";
  return "bin";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "").trim(); // "logo" | "loginBg" | etc. (só metadado)

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo 'file' (multipart/form-data)." }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Tipo de arquivo não suportado. Use PNG/JPG/WEBP/GIF/SVG." }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // limites simples para não estourar memória (logo e bg sobem já otimizados no client)
  const maxBytes = kind === "loginBg" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
  if (bytes.length > maxBytes) {
    return NextResponse.json({ error: `Arquivo muito grande. Máximo: ${(maxBytes / 1024 / 1024).toFixed(0)}MB.` }, { status: 413 });
  }

  const key = makeBrandAssetKey(extFromMime(mime));
  // Persistência global: salva no banco (funciona em múltiplas instâncias/devices).
  // Mantemos também o storage em arquivo como fallback/compatibilidade local.
  await prisma.brandAsset.create({
    data: {
      key,
      mimeType: mime,
      bytes,
      kind: kind || null,
    },
  });
  await saveBrandAssetBuffer(key, bytes).catch(() => {});
  const url = `/api/public/brand-assets/${key}`;

  return NextResponse.json({ key, url });
}

