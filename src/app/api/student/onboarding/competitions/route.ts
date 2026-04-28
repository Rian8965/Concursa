import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const competitions = await prisma.competition.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      status: true,
      examBoard: { select: { acronym: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 300,
  });

  return NextResponse.json({
    competitions: competitions.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      examBoardAcronym: c.examBoard?.acronym ?? null,
    })),
  });
}

