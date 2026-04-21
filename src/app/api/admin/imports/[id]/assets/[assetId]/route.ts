import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id, assetId } = await params;
  const body = (await req.json()) as {
    scope?: "EXCLUSIVE" | "SHARED";
    extractedText?: string | null;
    imageDataUrl?: string | null;
    label?: string | null;
    page?: number;
    bboxX?: number;
    bboxY?: number;
    bboxW?: number;
    bboxH?: number;
  };

  const existing = await prisma.importAsset.findFirst({
    where: { id: assetId, importId: id },
  });
  if (!existing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const wantsBbox =
    body.page !== undefined ||
    body.bboxX !== undefined ||
    body.bboxY !== undefined ||
    body.bboxW !== undefined ||
    body.bboxH !== undefined;
  if (wantsBbox) {
    const page = body.page ?? existing.page;
    const bboxX = body.bboxX ?? existing.bboxX;
    const bboxY = body.bboxY ?? existing.bboxY;
    const bboxW = body.bboxW ?? existing.bboxW;
    const bboxH = body.bboxH ?? existing.bboxH;
    const ok =
      typeof page === "number" &&
      page >= 1 &&
      [bboxX, bboxY, bboxW, bboxH].every((n) => typeof n === "number" && n >= 0 && n <= 1) &&
      bboxW > 0 &&
      bboxH > 0;
    if (!ok) {
      return NextResponse.json(
        { error: "page/bbox inválidos (use página >= 1 e bbox normalizado 0–1)." },
        { status: 400 },
      );
    }
  }

  const asset = await prisma.importAsset.update({
    where: { id: assetId },
    data: {
      ...(body.scope ? { scope: body.scope } : {}),
      ...(body.extractedText !== undefined ? { extractedText: body.extractedText?.trim() || null } : {}),
      ...(body.imageDataUrl !== undefined ? { imageDataUrl: body.imageDataUrl?.trim() || null } : {}),
      ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
      ...(body.page !== undefined ? { page: body.page } : {}),
      ...(body.bboxX !== undefined ? { bboxX: body.bboxX } : {}),
      ...(body.bboxY !== undefined ? { bboxY: body.bboxY } : {}),
      ...(body.bboxW !== undefined ? { bboxW: body.bboxW } : {}),
      ...(body.bboxH !== undefined ? { bboxH: body.bboxH } : {}),
    },
  });

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-asset-patch",
      location: "src/app/api/admin/imports/[id]/assets/[assetId]/route.ts:PATCH",
      message: "asset patched",
      data: {
        importId: id,
        assetId,
        changed: {
          scope: body.scope ?? null,
          hasText: body.extractedText !== undefined,
          hasImageDataUrl: body.imageDataUrl !== undefined,
          bbox: wantsBbox ? { page: body.page ?? existing.page, bboxX: body.bboxX ?? existing.bboxX, bboxY: body.bboxY ?? existing.bboxY, bboxW: body.bboxW ?? existing.bboxW, bboxH: body.bboxH ?? existing.bboxH } : null,
        },
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({ asset });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id, assetId } = await params;

  const existing = await prisma.importAsset.findFirst({
    where: { id: assetId, importId: id },
  });
  if (!existing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  await prisma.importAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ ok: true });
}
