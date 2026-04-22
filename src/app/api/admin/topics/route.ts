import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId")?.trim();
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId é obrigatório" }, { status: 400 });
  }
  const topics = await prisma.topic.findMany({
    where: { subjectId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, subjectId: true },
  });
  return NextResponse.json({ topics });
}
