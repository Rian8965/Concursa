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
      city: true,
      examBoard: true,
      subjects: { include: { subject: true } },
      jobRoles: { include: { jobRole: true } },
      jobRoleSubjects: {
        include: { jobRole: true, subject: true },
        orderBy: [{ jobRoleId: "asc" }],
      },
      stages: { orderBy: { order: "asc" } },
      _count: { select: { questions: true, students: true } },
    },
  });
  if (!competition) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  // Transform jobRoleSubjects → grouped by cargo for easy consumption by UI
  const jobRolesMap = new Map<string, { jobRoleId: string; name: string; subjectIds: string[]; subjects: { id: string; name: string }[] }>();
  for (const jrs of competition.jobRoleSubjects) {
    const existing = jobRolesMap.get(jrs.jobRoleId);
    if (existing) {
      existing.subjectIds.push(jrs.subjectId);
      existing.subjects.push({ id: jrs.subjectId, name: jrs.subject.name });
    } else {
      jobRolesMap.set(jrs.jobRoleId, {
        jobRoleId: jrs.jobRoleId,
        name: jrs.jobRole.name,
        subjectIds: [jrs.subjectId],
        subjects: [{ id: jrs.subjectId, name: jrs.subject.name }],
      });
    }
  }
  // Also include jobRoles that exist in CompetitionJobRole but have no subjects yet
  for (const jr of competition.jobRoles) {
    if (!jobRolesMap.has(jr.jobRoleId)) {
      jobRolesMap.set(jr.jobRoleId, {
        jobRoleId: jr.jobRoleId,
        name: jr.jobRole.name,
        subjectIds: [],
        subjects: [],
      });
    }
  }
  const jobRolesWithSubjects = [...jobRolesMap.values()];

  return NextResponse.json({
    competition: {
      ...competition,
      jobRolesWithSubjects,
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const {
    name, cityId, organization, examBoardId, examBoardDefined,
    examDate, status, description, editalUrl,
    jobRolesWithSubjects,
    stages,
    subjectIds, // legacy fallback
  } = body;

  const competition = await prisma.$transaction(async (tx) => {
    const comp = await tx.competition.update({
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

    // Replace cargos + matérias
    if (Array.isArray(jobRolesWithSubjects)) {
      // Clear existing job role subjects and job role links
      await tx.competitionJobRoleSubject.deleteMany({ where: { competitionId: id } });
      await tx.competitionJobRole.deleteMany({ where: { competitionId: id } });
      await tx.competitionSubject.deleteMany({ where: { competitionId: id } });

      const allSubjectIdsForLegacy = new Set<string>();
      for (const jr of jobRolesWithSubjects as Array<{ name: string; subjectIds: string[] }>) {
        if (!jr.name?.trim()) continue;
        const jrSlug = jr.name.toLowerCase().normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + `-${Date.now().toString(36).slice(-4)}`;
        const existing = await tx.jobRole.findFirst({
          where: { name: { equals: jr.name.trim(), mode: "insensitive" } },
          select: { id: true },
        });
        const jobRoleId = existing?.id ?? (await tx.jobRole.create({
          data: { name: jr.name.trim(), slug: jrSlug },
          select: { id: true },
        })).id;

        await tx.competitionJobRole.create({ data: { competitionId: id, jobRoleId } });

        for (const subjectId of jr.subjectIds ?? []) {
          await tx.competitionJobRoleSubject.create({
            data: { competitionId: id, jobRoleId, subjectId },
          }).catch(() => {});
          allSubjectIdsForLegacy.add(subjectId);
        }
      }
      if (allSubjectIdsForLegacy.size > 0) {
        await tx.competitionSubject.createMany({
          data: [...allSubjectIdsForLegacy].map((sid) => ({ competitionId: id, subjectId: sid })),
          skipDuplicates: true,
        });
      }
    } else if (subjectIds !== undefined) {
      // Legacy: flat subject update
      await tx.competitionSubject.deleteMany({ where: { competitionId: id } });
      if ((subjectIds as string[]).length > 0) {
        await tx.competitionSubject.createMany({
          data: (subjectIds as string[]).map((sid: string) => ({ competitionId: id, subjectId: sid })),
        });
      }
    }

    // Replace stages
    if (Array.isArray(stages)) {
      await tx.competitionStage.deleteMany({ where: { competitionId: id } });
      let order = 0;
      for (const s of stages as string[]) {
        if (s?.trim()) {
          await tx.competitionStage.create({
            data: { competitionId: id, name: s.trim(), order: order++ },
          });
        }
      }
    }

    return comp;
  });

  return NextResponse.json({ competition });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.competition.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
