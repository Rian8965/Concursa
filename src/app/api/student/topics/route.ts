import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subjectId");
  if (!subjectId) return NextResponse.json({ topics: [] });

  const topics = await prisma.topic.findMany({
    where: { subjectId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, subjectId: true },
    take: 300,
  });

  return NextResponse.json({ topics });
}

