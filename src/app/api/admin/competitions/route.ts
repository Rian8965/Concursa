import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const search = searchParams.get("search") ?? "";

  const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {};

  const [competitions, total] = await Promise.all([
    prisma.competition.findMany({
      where,
      include: { city: true, examBoard: true, _count: { select: { questions: true, students: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.competition.count({ where }),
  ]);

  return NextResponse.json({ competitions, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, cityId, organization, examBoardId, examBoardDefined, examDate, status, description, editalUrl, subjectIds } = body;

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();

  const competition = await prisma.competition.create({
    data: {
      name,
      slug,
      cityId,
      organization: organization || null,
      examBoardId: examBoardId || null,
      examBoardDefined: examBoardDefined ?? false,
      examDate: examDate ? new Date(examDate) : null,
      status: status ?? "UPCOMING",
      description: description || null,
      editalUrl: editalUrl || null,
      subjects: subjectIds?.length ? { create: subjectIds.map((id: string) => ({ subjectId: id })) } : undefined,
    },
    include: { city: true, examBoard: true },
  });

  return NextResponse.json({ competition }, { status: 201 });
}
