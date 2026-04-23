import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Retorna as matérias disponíveis para o aluno neste concurso.
 * Se o aluno tiver cargo vinculado → filtra pelas matérias do cargo.
 * Caso contrário → retorna todas as matérias do concurso.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competitionId");
  if (!competitionId) return NextResponse.json({ subjects: [] });

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ subjects: [] });

  const enrollment = await prisma.studentCompetition.findUnique({
    where: {
      studentProfileId_competitionId: { studentProfileId: profile.id, competitionId },
    },
    select: { jobRoleId: true },
  });

  let subjects: { id: string; name: string }[] = [];

  if (enrollment?.jobRoleId) {
    // Matérias específicas do cargo no concurso
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId, jobRoleId: enrollment.jobRoleId },
      include: { subject: { select: { id: true, name: true } } },
    });
    subjects = links.map((l) => l.subject);
  } else {
    // Todas as matérias do concurso
    const links = await prisma.competitionSubject.findMany({
      where: { competitionId },
      include: { subject: { select: { id: true, name: true } } },
    });
    subjects = links.map((l) => l.subject);
  }

  return NextResponse.json({ subjects });
}
