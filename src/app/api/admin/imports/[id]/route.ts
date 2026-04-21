import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { deleteImportPdfFile } from "@/lib/import-pdf-storage";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const imp = await prisma.pDFImport.findUnique({
    where: { id },
    include: {
      competition: { select: { name: true } },
      importedQuestions: { orderBy: { sourcePosition: "asc" } },
      importAssets: {
        orderBy: { createdAt: "asc" },
        include: {
          questionLinks: { select: { id: true, importedQuestionId: true, role: true } },
        },
      },
    },
  });
  if (!imp) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ import: imp });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const { status, decisions } = await req.json() as {
    status?: string;
    decisions?: { questionId: string; action: "approve" | "reject"; subjectId?: string; topicId?: string }[];
  };

  const importRow = await prisma.pDFImport.findUnique({ where: { id }, select: { competitionId: true } });

  if (decisions?.length) {
    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        runId: "pre-fix",
        hypothesisId: "H-publish-flow",
        location: "src/app/api/admin/imports/[id]/route.ts:PATCH",
        message: "starting publish decisions",
        data: { importId: id, decisions: decisions.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    for (const d of decisions) {
      if (d.action === "approve") {
        const iq = await prisma.importedQuestion.findUnique({ where: { id: d.questionId } });
        if (!iq) continue;
        const alternatives = iq.alternatives as { letter: string; content: string }[];

        const assetLinks = await prisma.importedQuestionAsset.findMany({
          where: { importedQuestionId: iq.id },
          include: { importAsset: true },
        });
        const supportParts = assetLinks
          .filter((l) => l.role === "SUPPORT_TEXT" && l.importAsset.extractedText?.trim())
          .map((l) => l.importAsset.extractedText!.trim());
        const supportText = supportParts.length > 0 ? supportParts.join("\n\n") : null;

        const figLink = assetLinks.find((l) => l.role === "FIGURE");
        const imageFromAsset = figLink?.importAsset?.imageDataUrl?.trim() || null;
        const finalImageUrl = imageFromAsset || iq.imageUrl || null;
        const finalHasImage = Boolean(finalImageUrl);

        // #region agent log
        fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
          body: JSON.stringify({
            sessionId: "03dbee",
            runId: "pre-fix",
            hypothesisId: "H-publish-flow",
            location: "src/app/api/admin/imports/[id]/route.ts:PATCH:approve",
            message: "publishing imported question",
            data: {
              importId: id,
              importedQuestionId: d.questionId,
              hasSupportText: Boolean(supportText),
              supportParts: supportParts.length,
              hasImage: finalHasImage,
              alternatives: alternatives.length,
              subjectId: d.subjectId || iq.suggestedSubjectId || null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        const q = await prisma.question.create({
          data: {
            content: iq.content,
            supportText,
            correctAnswer: iq.correctAnswer ?? "A",
            subjectId: d.subjectId || iq.suggestedSubjectId || null,
            topicId: d.topicId || iq.suggestedTopicId || null,
            competitionId: importRow?.competitionId ?? null,
            importId: id,
            status: "ACTIVE",
            sourcePage: iq.sourcePage,
            sourcePosition: iq.sourcePosition,
            hasImage: finalHasImage,
            imageUrl: finalImageUrl,
            alternatives: { create: alternatives.map((a, i) => ({ letter: a.letter, content: a.content, order: i + 1 })) },
          },
        });
        await prisma.importedQuestion.update({
          where: { id: d.questionId },
          data: { status: "PUBLISHED", publishedQuestionId: q.id, reviewedBy: session.user.id, reviewedAt: new Date() },
        });
      } else {
        await prisma.importedQuestion.update({
          where: { id: d.questionId },
          data: { status: "REJECTED", reviewedBy: session.user.id, reviewedAt: new Date() },
        });
      }
    }
    const approved = await prisma.importedQuestion.count({ where: { importId: id, status: "PUBLISHED" } });
    const rejected = await prisma.importedQuestion.count({ where: { importId: id, status: "REJECTED" } });
    await prisma.pDFImport.update({ where: { id }, data: { totalApproved: approved, totalRejected: rejected, status: "COMPLETED" } });
  }

  if (status) {
    await prisma.pDFImport.update({ where: { id }, data: { status: status as "PENDING" | "PROCESSING" | "REVIEW_PENDING" | "COMPLETED" | "FAILED" } });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.pDFImport.findUnique({ where: { id }, select: { id: true, storedPdfPath: true } });
  if (!existing) {
    return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });
  }

  await deleteImportPdfFile(existing.storedPdfPath);

  await prisma.$transaction(async (tx) => {
    await tx.question.updateMany({ where: { importId: id }, data: { importId: null } });
    await tx.pDFImport.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
