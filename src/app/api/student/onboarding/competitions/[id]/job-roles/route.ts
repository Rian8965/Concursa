import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const rows = await prisma.competitionJobRole.findMany({
    where: { competitionId: id },
    select: { jobRole: { select: { id: true, name: true } } },
    orderBy: { jobRole: { name: "asc" } },
    take: 500,
  });

  return NextResponse.json({ jobRoles: rows.map((r) => r.jobRole) });
}

