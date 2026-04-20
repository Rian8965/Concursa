import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json()) as {
    kind: "TEXT_BLOCK" | "IMAGE";
    page: number;
    bboxX: number;
    bboxY: number;
    bboxW: number;
    bboxH: number;
    scope?: "EXCLUSIVE" | "SHARED";
    extractedText?: string | null;
    imageDataUrl?: string | null;
    label?: string | null;
  };

  const imp = await prisma.pDFImport.findUnique({ where: { id }, select: { id: true } });
  if (!imp) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  if (!["TEXT_BLOCK", "IMAGE"].includes(body.kind)) {
    return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  }
  if (body.page < 1 || ![body.bboxX, body.bboxY, body.bboxW, body.bboxH].every((n) => typeof n === "number" && n >= 0 && n <= 1)) {
    return NextResponse.json({ error: "Página ou bbox inválidos (use valores normalizados 0–1)." }, { status: 400 });
  }

  const asset = await prisma.importAsset.create({
    data: {
      importId: id,
      kind: body.kind,
      page: body.page,
      bboxX: body.bboxX,
      bboxY: body.bboxY,
      bboxW: body.bboxW,
      bboxH: body.bboxH,
      scope: body.scope ?? "EXCLUSIVE",
      extractedText: body.extractedText?.trim() || null,
      imageDataUrl: body.imageDataUrl?.trim() || null,
      label: body.label?.trim() || null,
    },
  });

  return NextResponse.json({ asset }, { status: 201 });
}
