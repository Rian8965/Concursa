import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { readEditalBuffer } from "@/lib/edital-storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  // Admin pode sempre baixar; aluno só se estiver vinculado ao concurso.
  if (session.user.role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
    if (!profile) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const sc = await prisma.studentCompetition.findUnique({
      where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
      select: { id: true },
    });
    if (!sc) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const competition = await prisma.competition.findUnique({ where: { id }, select: { editalUrl: true } });
  if (!competition?.editalUrl) return NextResponse.json({ error: "Edital não encontrado" }, { status: 404 });

  const storedPath = `private/editais/${id}.pdf`;
  const buf = await readEditalBuffer(storedPath);
  if (!buf) return NextResponse.json({ error: "Arquivo do edital não encontrado" }, { status: 404 });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="edital-${id}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

