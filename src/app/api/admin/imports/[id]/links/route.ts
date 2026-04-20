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
    importedQuestionId: string;
    importAssetId: string;
    role: "SUPPORT_TEXT" | "FIGURE";
  };

  if (!body.importedQuestionId || !body.importAssetId || !body.role) {
    return NextResponse.json({ error: "importedQuestionId, importAssetId e role são obrigatórios" }, { status: 400 });
  }
  if (!["SUPPORT_TEXT", "FIGURE"].includes(body.role)) {
    return NextResponse.json({ error: "role inválido" }, { status: 400 });
  }

  const iq = await prisma.importedQuestion.findFirst({
    where: { id: body.importedQuestionId, importId: id },
  });
  if (!iq) return NextResponse.json({ error: "Questão importada não pertence a esta importação" }, { status: 400 });

  const asset = await prisma.importAsset.findFirst({
    where: { id: body.importAssetId, importId: id },
  });
  if (!asset) return NextResponse.json({ error: "Ativo não encontrado nesta importação" }, { status: 400 });

  try {
    const link = await prisma.importedQuestionAsset.create({
      data: {
        importedQuestionId: body.importedQuestionId,
        importAssetId: body.importAssetId,
        role: body.role,
      },
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Este vínculo já existe ou é inválido." }, { status: 409 });
  }
}
