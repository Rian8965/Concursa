import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET() {
  const cities = await prisma.city.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ cities });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { name, state, ibgeCode } = await req.json();
  const city = await prisma.city.create({ data: { name, state, ibgeCode: ibgeCode || null } });
  return NextResponse.json({ city }, { status: 201 });
}
