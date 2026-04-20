import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id, linkId } = await params;

  const link = await prisma.importedQuestionAsset.findFirst({
    where: { id: linkId },
    include: { importedQuestion: true },
  });
  if (!link || link.importedQuestion.importId !== id) {
    return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  }

  await prisma.importedQuestionAsset.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
