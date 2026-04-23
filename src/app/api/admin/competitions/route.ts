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
  const {
    name, cityId, organization, examBoardId, examBoardDefined,
    examDate, status, description, editalUrl,
    jobRolesWithSubjects,
    stages,
    // legacy flat subjectIds kept for backward compat
    subjectIds,
  } = body;

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();

  const competition = await prisma.$transaction(async (tx) => {
    const comp = await tx.competition.create({
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
      },
      include: { city: true, examBoard: true },
    });

    // New: cargos + matérias por cargo
    if (Array.isArray(jobRolesWithSubjects) && jobRolesWithSubjects.length > 0) {
      const allSubjectIdsForLegacy = new Set<string>();
      for (const jr of jobRolesWithSubjects as Array<{ name: string; subjectIds: string[] }>) {
        if (!jr.name?.trim()) continue;
        // Find or create job role by name
        const slug = jr.name.toLowerCase().normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + `-${Date.now().toString(36).slice(-4)}`;
        const existing = await tx.jobRole.findFirst({
          where: { name: { equals: jr.name.trim(), mode: "insensitive" } },
          select: { id: true },
        });
        const jobRoleId = existing?.id ?? (await tx.jobRole.create({
          data: { name: jr.name.trim(), slug },
          select: { id: true },
        })).id;

        await tx.competitionJobRole.upsert({
          where: { competitionId_jobRoleId: { competitionId: comp.id, jobRoleId } },
          create: { competitionId: comp.id, jobRoleId },
          update: {},
        });

        for (const subjectId of jr.subjectIds ?? []) {
          await tx.competitionJobRoleSubject.create({
            data: { competitionId: comp.id, jobRoleId, subjectId },
          }).catch(() => {}); // ignore unique constraint if duplicate
          allSubjectIdsForLegacy.add(subjectId);
        }
      }
      // Keep CompetitionSubject in sync (legacy)
      if (allSubjectIdsForLegacy.size > 0) {
        await tx.competitionSubject.createMany({
          data: [...allSubjectIdsForLegacy].map((sid) => ({ competitionId: comp.id, subjectId: sid })),
          skipDuplicates: true,
        });
      }
    } else if (subjectIds?.length) {
      // Legacy fallback: flat subject list (no specific cargo)
      await tx.competitionSubject.createMany({
        data: (subjectIds as string[]).map((sid) => ({ competitionId: comp.id, subjectId: sid })),
      });
    }

    // Etapas
    if (Array.isArray(stages)) {
      let order = 0;
      for (const s of stages as string[]) {
        if (s?.trim()) {
          await tx.competitionStage.create({
            data: { competitionId: comp.id, name: s.trim(), order: order++ },
          });
        }
      }
    }

    return comp;
  });

  return NextResponse.json({ competition }, { status: 201 });
}
