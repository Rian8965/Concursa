import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [subjects, examBoards] = await Promise.all([
    prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 200,
    }),
    prisma.examBoard.findMany({
      where: { isActive: true },
      orderBy: { acronym: "asc" },
      select: { id: true, acronym: true, name: true },
      take: 200,
    }),
  ]);

  return NextResponse.json({ subjects, examBoards });
}

