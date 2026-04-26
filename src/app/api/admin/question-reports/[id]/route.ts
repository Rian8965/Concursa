import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
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

  const nextStatus = status ? (status as never) : undefined;
  const now = new Date();

  const shouldResolveMeta = status === "RESOLVED" || status === "DISMISSED";

  // Regra: "suspeita" ou "em análise" deve bloquear uso por alunos.
  // Aqui, "IN_ANALYSIS" e "UNDER_REVIEW" automaticamente marcam suspeita.
  const autoSuspectFromStatus = status === "IN_ANALYSIS" || status === "UNDER_REVIEW";
  const autoUnsuspectFromStatus = status === "RESOLVED";

  const effectiveMarkSuspect =
    markQuestionSuspect !== undefined
      ? markQuestionSuspect
      : autoSuspectFromStatus
        ? true
        : autoUnsuspectFromStatus
          ? false
          : undefined;

  const [updated] = await prisma.$transaction(async (tx) => {
    const upd = await tx.questionReport.update({
      where: { id },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
        ...(shouldResolveMeta ? { resolvedAt: now, resolvedBy: session.user.id } : {}),
      },
    });

    if (effectiveMarkSuspect !== undefined) {
      await tx.question.update({
        where: { id: report.questionId },
        data: { isMarkedSuspect: effectiveMarkSuspect },
      });
    }

    // Auditoria
    const events: any[] = [];
    if (status && status !== report.status) {
      events.push({
        action: "STATUS_CHANGE",
        fromStatus: report.status,
        toStatus: status,
        note: adminNote !== undefined ? adminNote : null,
      });
    } else if (adminNote !== undefined && adminNote !== report.adminNote) {
      events.push({
        action: "NOTE_UPDATE",
        note: adminNote,
      });
    }
    if (effectiveMarkSuspect !== undefined) {
      events.push({
        action: effectiveMarkSuspect ? "MARK_SUSPECT" : "UNMARK_SUSPECT",
        note: adminNote !== undefined ? adminNote : null,
      });
    }
    if (events.length) {
      await tx.questionReportEvent.createMany({
        data: events.map((e) => ({
          reportId: report.id,
          actorUserId: session.user.id,
          action: e.action,
          fromStatus: e.fromStatus as any,
          toStatus: e.toStatus as any,
          note: e.note ?? null,
        })),
      });
    }

    return [upd] as const;
  });

  return NextResponse.json({ ok: true, report: updated });
}
