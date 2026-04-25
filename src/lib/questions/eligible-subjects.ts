import { prisma } from "@/lib/db/prisma";

export async function getEligibleSubjectsForStudentCompetition(input: {
  studentProfileId: string;
  competitionId: string;
}) {
  const enrollment = await prisma.studentCompetition.findUnique({
    where: {
      studentProfileId_competitionId: {
        studentProfileId: input.studentProfileId,
        competitionId: input.competitionId,
      },
    },
    select: { jobRoleId: true },
  });

  if (enrollment?.jobRoleId) {
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId: input.competitionId, jobRoleId: enrollment.jobRoleId },
      select: { subjectId: true },
    });
    return { subjectIds: links.map((l) => l.subjectId), jobRoleId: enrollment.jobRoleId };
  }

  const links = await prisma.competitionSubject.findMany({
    where: { competitionId: input.competitionId },
    select: { subjectId: true },
  });
  return { subjectIds: links.map((l) => l.subjectId), jobRoleId: null };
}

