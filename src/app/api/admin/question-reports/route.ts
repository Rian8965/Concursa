import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const take = 30;
  const skip = (page - 1) * take;

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(category ? { category: category as never } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.questionReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        aiReview: true,
        question: {
          select: {
            id: true,
            code: true,
            content: true,
            correctAnswer: true,
            isMarkedSuspect: true,
            status: true,
            year: true,
            difficulty: true,
            subject: { select: { name: true } },
            topic: { select: { name: true } },
            competition: { select: { name: true } },
            examBoard: { select: { acronym: true } },
            city: { select: { name: true, state: true } },
            jobRole: { select: { name: true, level: true } },
          },
        },
        studentProfile: {
          select: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.questionReport.count({ where }),
  ]);

  return NextResponse.json({ reports, total, page, pages: Math.ceil(total / take) });
}
