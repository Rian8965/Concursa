import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role === "STUDENT") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { status, adminNote, markQuestionSuspect } = await req.json() as {
    status?: string;
    adminNote?: string;
    markQuestionSuspect?: boolean;
  };

  const report = await prisma.questionReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Denúncia não encontrada" }, { status: 404 });

  const updated = await prisma.questionReport.update({
    where: { id },
    data: {
      ...(status ? { status: status as never } : {}),
      ...(adminNote !== undefined ? { adminNote } : {}),
      ...(status === "RESOLVED" || status === "DISMISSED"
        ? { resolvedAt: new Date(), resolvedBy: session.user.id }
        : {}),
    },
  });

  if (markQuestionSuspect !== undefined) {
    await prisma.question.update({
      where: { id: report.questionId },
      data: { isMarkedSuspect: markQuestionSuspect },
    });
  }

  return NextResponse.json({ ok: true, report: updated });
}
