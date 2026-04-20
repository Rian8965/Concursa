import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

/**
 * Questões que compartilham o mesmo texto de apoio (e opcionalmente o mesmo concurso).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const supportText = (searchParams.get("supportText") ?? "").trim();
  const competitionId = searchParams.get("competitionId") || undefined;
  const excludeId = searchParams.get("excludeId") || undefined;

  if (supportText.length < 10) {
    return NextResponse.json({ questions: [], count: 0 });
  }

  const where: Record<string, unknown> = {
    supportText: { equals: supportText },
    ...(competitionId ? { competitionId } : {}),
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  const questions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      content: true,
      createdAt: true,
      competition: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ questions, count: questions.length });
}
