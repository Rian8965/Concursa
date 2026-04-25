import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competitionId");
  if (!competitionId) return NextResponse.json({ apostilas: [] });

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ apostilas: [] });

  const apostilas = await prisma.apostila.findMany({
    where: { studentProfileId: profile.id, competitionId },
    orderBy: { generatedAt: "desc" },
    take: 30,
    include: {
      questions: { select: { order: true }, orderBy: { order: "asc" }, take: 1 },
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json({
    apostilas: apostilas.map((a) => ({
      id: a.id,
      title: a.title,
      generatedAt: a.generatedAt,
      totalQuestions: a._count.questions,
    })),
  });
}

