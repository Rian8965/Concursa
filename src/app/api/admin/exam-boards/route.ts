import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET() {
  const examBoards = await prisma.examBoard.findMany({ where: { isActive: true }, orderBy: { acronym: "asc" } });
  return NextResponse.json({ examBoards });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { name, acronym, website } = await req.json();
  const examBoard = await prisma.examBoard.create({ data: { name, acronym, website: website || null } });
  return NextResponse.json({ examBoard }, { status: 201 });
}
