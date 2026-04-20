import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function makeSlug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "cargo"}-${Date.now().toString(36)}`;
}

export async function GET() {
  const roles = await prisma.jobRole.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return NextResponse.json({ jobRoles: roles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { name, area, level, description } = body as {
    name?: string;
    area?: string;
    level?: string;
    description?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome do cargo é obrigatório" }, { status: 400 });
  }

  const slug = makeSlug(name.trim());

  const role = await prisma.jobRole.create({
    data: {
      name: name.trim(),
      slug,
      area: area?.trim() || null,
      level: level?.trim() || null,
      description: description?.trim() || null,
    },
  });

  return NextResponse.json({ jobRole: role }, { status: 201 });
}
