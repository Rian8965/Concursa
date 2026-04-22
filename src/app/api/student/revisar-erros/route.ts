import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const items = await prisma.studentAnswer.findMany({
    where: { studentProfileId: profile.id, isCorrect: false },
    orderBy: { answeredAt: "desc" },
    take: 80,
    include: {
      question: {
        include: {
          subject: { select: { name: true, color: true } },
          alternatives: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  return NextResponse.json({ items });
}
