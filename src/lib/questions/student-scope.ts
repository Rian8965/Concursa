import { prisma } from "@/lib/db/prisma";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getStudentSubjectScope(input: { studentProfileId: string }) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: input.studentProfileId },
    select: { preferredJobRoleId: true, preferredJobRoleText: true },
  });

  let jobRoleId: string | null = profile?.preferredJobRoleId ?? null;

  if (!jobRoleId && profile?.preferredJobRoleText) {
    const norm = normalize(profile.preferredJobRoleText);
    const tokens = norm.split(" ").filter((t) => t.length >= 3).slice(0, 6);
    if (tokens.length) {
      const match = await prisma.jobRole.findFirst({
        where: { isActive: true, OR: tokens.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
      });
      jobRoleId = match?.id ?? null;
    }
  }

  if (jobRoleId) {
    const links = await prisma.jobRoleSubject.findMany({
      where: { jobRoleId },
      select: { subjectId: true },
      take: 300,
    });
    const subjectIds = Array.from(new Set(links.map((l) => l.subjectId).filter(Boolean)));
    if (subjectIds.length) return { mode: "JOB_ROLE" as const, jobRoleId, subjectIds };
  }

  // Fallback extremo: nunca bloquear o aluno — libera pool geral de matérias ativas.
  const subjects = await prisma.subject.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return { mode: "ALL_SUBJECTS" as const, jobRoleId: null, subjectIds: subjects.map((s) => s.id) };
}

