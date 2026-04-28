import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  competitionId: z.string().min(1).optional(),
  jobRoleId: z.string().min(1).optional(),
  manualJobRoleText: z.string().min(1).max(120).optional(),
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });

  const { competitionId, jobRoleId, manualJobRoleText } = parsed.data;

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // Validação leve
  if (competitionId && !jobRoleId) {
    return NextResponse.json({ error: "Selecione um cargo" }, { status: 400 });
  }
  if (!competitionId && !manualJobRoleText) {
    return NextResponse.json({ error: "Informe um cargo" }, { status: 400 });
  }

  // 1) Caminho com concurso + cargo
  if (competitionId && jobRoleId) {
    await prisma.studentCompetition.upsert({
      where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId } },
      create: { studentProfileId: profile.id, competitionId, jobRoleId, isActive: true },
      update: { jobRoleId, isActive: true },
    });

    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        preferredCompetitionId: competitionId,
        preferredJobRoleId: jobRoleId,
        preferredJobRoleText: null,
        onboardingCompletedAt: new Date(),
        needsOnboarding: false,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // 2) Caminho sem concurso: salva trilha preferida por cargo (sem bloquear aluno).
  let effectiveJobRoleId: string | null = jobRoleId ?? null;
  if (!effectiveJobRoleId && manualJobRoleText) {
    const norm = normalize(manualJobRoleText);
    const tokens = norm.split(" ").filter((t) => t.length >= 3).slice(0, 6);
    if (tokens.length) {
      const match = await prisma.jobRole.findFirst({
        where: { isActive: true, OR: tokens.map((t) => ({ name: { contains: t, mode: "insensitive" as const } })) },
        select: { id: true },
        orderBy: { updatedAt: "desc" },
      });
      if (match?.id) effectiveJobRoleId = match.id;
    }
  }

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: {
      preferredCompetitionId: null,
      preferredJobRoleId: effectiveJobRoleId,
      preferredJobRoleText: manualJobRoleText ?? null,
      onboardingCompletedAt: new Date(),
      needsOnboarding: false,
    },
  });

  return NextResponse.json({ ok: true });
}

