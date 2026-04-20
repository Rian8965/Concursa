import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET() {
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { name, description, durationDays } = await req.json();
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
  const plan = await prisma.plan.create({ data: { name, slug, description, durationDays: durationDays ? parseInt(durationDays) : null } });
  return NextResponse.json({ plan }, { status: 201 });
}
