import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ competitions: [] });

  const rows = await prisma.studentCompetition.findMany({
    where: { studentProfileId: profile.id, isActive: true },
    orderBy: { enrolledAt: "desc" },
    select: {
      competitionId: true,
      competition: { select: { name: true } },
    },
    take: 20,
  });

  return NextResponse.json({
    competitions: rows.map((r) => ({
      id: r.competitionId,
      name: r.competition?.name ?? "Concurso",
    })),
  });
}

