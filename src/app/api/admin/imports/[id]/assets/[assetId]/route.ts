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
  };

  const existing = await prisma.importAsset.findFirst({
    where: { id: assetId, importId: id },
  });
  if (!existing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const asset = await prisma.importAsset.update({
    where: { id: assetId },
    data: {
      ...(body.scope ? { scope: body.scope } : {}),
      ...(body.extractedText !== undefined ? { extractedText: body.extractedText?.trim() || null } : {}),
      ...(body.imageDataUrl !== undefined ? { imageDataUrl: body.imageDataUrl?.trim() || null } : {}),
      ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
    },
  });

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
