import { auth } from "@/lib/auth";
import { readImportPdfBuffer } from "@/lib/import-pdf-storage";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const imp = await prisma.pDFImport.findUnique({
    where: { id },
    select: { storedPdfPath: true, originalFilename: true },
  });
  if (!imp?.storedPdfPath) {
    return NextResponse.json({ error: "PDF não disponível para esta importação." }, { status: 404 });
  }
  const buf = await readImportPdfBuffer(imp.storedPdfPath);
  if (!buf) {
    return NextResponse.json({ error: "Arquivo não encontrado no disco." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(imp.originalFilename || "prova.pdf")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
