import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      studentProfile: {
        include: {
          plan: true,
          studentCompetitions: {
            include: {
              competition: { select: { id: true, name: true } },
              jobRole: { select: { id: true, name: true } },
            },
          },
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
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { isActive, planId, accessExpiresAt, competitions, name, email, password } = body as {
    isActive?: boolean;
    planId?: string;
    accessExpiresAt?: string | null;
    name?: string;
    email?: string;
    password?: string | null;
    /** Nova estrutura: lista de concurso+cargo */
    competitions?: { competitionId: string; jobRoleId?: string | null }[];
    /** Legado (suportado para backward compat) */
    competitionIds?: string[];
  };

  const userUpdateData: Record<string, unknown> = {
    ...(isActive !== undefined && { isActive }),
    ...(typeof name === "string" && name.trim() && { name: name.trim() }),
    ...(typeof email === "string" && email.trim() && { email: email.trim().toLowerCase() }),
  };

  if (typeof password === "string" && password.trim().length >= 6) {
    const bcrypt = await import("bcryptjs");
    userUpdateData.password = await bcrypt.hash(password.trim(), 10);
  }

  await prisma.$transaction(async (tx) => {
    // Atualiza usuário
    await tx.user.update({ where: { id }, data: userUpdateData });

    // Atualiza perfil (plano, validade)
    if (planId !== undefined || accessExpiresAt !== undefined) {
      await tx.studentProfile.upsert({
        where: { userId: id },
        create: { userId: id, planId: planId || null, accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null },
        update: {
          ...(planId !== undefined && { planId: planId || null }),
          ...(accessExpiresAt !== undefined && { accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null }),
        },
      });
    }

    // Atualiza vínculos concurso+cargo
    if (Array.isArray(competitions)) {
      const profile = await tx.studentProfile.findUnique({ where: { userId: id }, select: { id: true } });
      if (profile) {
        // Remove vínculos existentes que não estão na nova lista
        const newCompIds = competitions.map((c) => c.competitionId).filter(Boolean);
        await tx.studentCompetition.deleteMany({
          where: { studentProfileId: profile.id, competitionId: { notIn: newCompIds } },
        });
        // Upsert cada vínculo
        for (const c of competitions) {
          if (!c.competitionId) continue;
          await tx.studentCompetition.upsert({
            where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: c.competitionId } },
            create: { studentProfileId: profile.id, competitionId: c.competitionId, jobRoleId: c.jobRoleId || null },
            update: { jobRoleId: c.jobRoleId || null },
          });
        }
      }
    } else if (Array.isArray(body.competitionIds)) {
      // Backward compat: array de IDs sem cargo
      const profile = await tx.studentProfile.findUnique({ where: { userId: id }, select: { id: true } });
      if (profile) {
        await tx.studentCompetition.deleteMany({ where: { studentProfileId: profile.id } });
        if (body.competitionIds.length > 0) {
          await tx.studentCompetition.createMany({
            data: (body.competitionIds as string[]).map((cid) => ({ studentProfileId: profile.id, competitionId: cid })),
            skipDuplicates: true,
          });
        }
      }
    }
  });

  const user = await prisma.user.findUnique({ where: { id } });
  return NextResponse.json({ user });
}
