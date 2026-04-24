import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const search = searchParams.get("search") ?? "";

  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }], role: "STUDENT" as const }
    : { role: "STUDENT" as const };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        studentProfile: {
          include: {
            plan: { select: { name: true } },
            _count: { select: { studentAnswers: true, trainingSessions: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { name, email, password, planId, accessExpiresAt, competitions } = body as {
    name: string;
    email: string;
    password: string;
    planId?: string;
    accessExpiresAt?: string;
    competitions?: { competitionId: string; jobRoleId?: string | null }[];
  };

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Nome, e-mail e senha são obrigatórios" }, { status: 400 });
  }

  const bcrypt = await import("bcryptjs");
  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role: "STUDENT",
        isActive: true,
        studentProfile: {
          create: {
            planId: planId || null,
            accessExpiresAt: accessExpiresAt ? new Date(accessExpiresAt) : null,
          },
        },
      },
      include: { studentProfile: { include: { plan: { select: { name: true } } } } },
    });

    // Vincular concurso + cargo
    if (Array.isArray(competitions) && competitions.length > 0 && created.studentProfile) {
      const profileId = created.studentProfile.id;
      for (const c of competitions) {
        if (!c.competitionId) continue;
        await tx.studentCompetition.upsert({
          where: { studentProfileId_competitionId: { studentProfileId: profileId, competitionId: c.competitionId } },
          create: { studentProfileId: profileId, competitionId: c.competitionId, jobRoleId: c.jobRoleId || null },
          update: { jobRoleId: c.jobRoleId || null },
        });
      }
    }

    return created;
  });

  return NextResponse.json({ user }, { status: 201 });
}
