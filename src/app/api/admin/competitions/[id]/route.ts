import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(role?: string) { return role === "ADMIN" || role === "SUPER_ADMIN"; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const competition = await prisma.competition.findUnique({
    where: { id },
    include: {
      city: true, examBoard: true,
      subjects: { include: { subject: true } },
      jobRoles: { include: { jobRole: true } },
      _count: { select: { questions: true, students: true } },
    },
  });
  if (!competition) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ competition });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { name, cityId, organization, examBoardId, examBoardDefined, examDate, status, description, editalUrl, subjectIds } = body;

  const competition = await prisma.competition.update({
    where: { id },
    data: {
      name,
      cityId,
      organization: organization || null,
      examBoardId: examBoardId || null,
      examBoardDefined: examBoardDefined ?? false,
      examDate: examDate ? new Date(examDate) : null,
      status,
      description: description || null,
      editalUrl: editalUrl || null,
    },
    include: { city: true, examBoard: true },
  });

  if (subjectIds !== undefined) {
    await prisma.competitionSubject.deleteMany({ where: { competitionId: id } });
    if (subjectIds.length > 0) {
      await prisma.competitionSubject.createMany({
        data: subjectIds.map((sid: string) => ({ competitionId: id, subjectId: sid })),
      });
    }
  }

  return NextResponse.json({ competition });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.competition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
