import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      studentProfile: {
        include: {
          plan: true,
          studentCompetitions: { include: { competition: { select: { name: true } } } },
          _count: { select: { studentAnswers: true, trainingSessions: true, simulatedExams: true } },
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const { isActive, planId, accessExpiresAt, competitionIds } = await req.json();

  const user = await prisma.user.update({
    where: { id },
    data: { ...(isActive !== undefined && { isActive }) },
  });

  if (planId !== undefined || accessExpiresAt !== undefined) {
    await prisma.studentProfile.update({
      where: { userId: id },
      data: {
        ...(planId !== undefined && { planId: planId || null }),
        ...(accessExpiresAt !== undefined && { accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null }),
      },
    });
  }

  if (competitionIds !== undefined) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: id } });
    if (profile) {
      await prisma.studentCompetition.deleteMany({ where: { studentProfileId: profile.id } });
      if (competitionIds.length > 0) {
        await prisma.studentCompetition.createMany({
          data: competitionIds.map((cid: string) => ({ studentProfileId: profile.id, competitionId: cid })),
        });
      }
    }
  }

  return NextResponse.json({ user });
}
