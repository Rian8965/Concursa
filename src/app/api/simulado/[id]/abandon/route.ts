import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const exam = await prisma.simulatedExam.findUnique({ where: { id } });
  if (!exam || exam.studentProfileId !== profile.id) {
    return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
  }

  if (exam.status === "IN_PROGRESS") {
    await prisma.simulatedExam.update({
      where: { id },
      data: { status: "ABANDONED", completedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
