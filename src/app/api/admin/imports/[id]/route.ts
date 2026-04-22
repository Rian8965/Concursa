import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getQuestionOptionalLinkColumns } from "@/lib/db/questions-table-columns";
import { deleteImportPdfFile } from "@/lib/import-pdf-storage";
import {
  analyzeEnunciadoHeuristic,
  getDependencyBlockUserMessage,
  mergeDependencyOr,
} from "@/lib/import/enunciado-dependency-core";
import { analyzeEnunciadoBatchLlm } from "@/lib/import/enunciado-llm";
import {
  alternativasVisuaisAtivas,
  detectLikelyVisualAlternatives,
  isVinculoSatisfiedForReview,
  missingAlternativeImageLinks,
  parseImportRawText,
  reviewLinkStatsFromPrismaJoins,
} from "@/lib/import/review-flags";
import {
  isImportedQuestionMetaComplete,
  metaMissingLabels,
  resolveImportedQuestionPublishMeta,
  type ImportContextMeta,
} from "@/lib/import/imported-question-meta";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

/** JSON de importação às vezes vem como array ou como objeto indexado. */
function normalizeImportedAlternatives(raw: unknown): { letter: string; content: string }[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object") arr = Object.values(raw as Record<string, unknown>);

  const out: { letter: string; content: string }[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const letter = String(o.letter ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 4);
    const content = String(o.content ?? "").trim();
    if (!letter || !content) continue;
    if (seen.has(letter)) continue;
    seen.add(letter);
    out.push({ letter, content });
  }
  return out;
}

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
          questionLinks: { select: { id: true, importedQuestionId: true, role: true, alternativeLetter: true } },
        },
      },
    },
  });
  if (!imp) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const [examBoard, subject, city, jobRole] = await Promise.all([
    imp.examBoardId ? prisma.examBoard.findUnique({ where: { id: imp.examBoardId }, select: { name: true, acronym: true } }) : null,
    imp.subjectId ? prisma.subject.findUnique({ where: { id: imp.subjectId }, select: { name: true } }) : null,
    imp.cityId ? prisma.city.findUnique({ where: { id: imp.cityId }, select: { name: true, state: true } }) : null,
    imp.jobRoleId ? prisma.jobRole.findUnique({ where: { id: imp.jobRoleId }, select: { name: true } }) : null,
  ]);

  return NextResponse.json({
    import: {
      ...imp,
      examBoard,
      subject,
      city,
      jobRole,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    decisions?: { questionId: string; action: "approve" | "reject"; subjectId?: string; topicId?: string }[];
  };
  const { status, decisions } = body;
  const reviewerId = typeof session.user.id === "string" ? session.user.id : null;
  const reviewedAt = new Date();

  const importRow = await prisma.pDFImport.findUnique({
    where: { id },
    select: { id: true, competitionId: true, examBoardId: true, cityId: true, jobRoleId: true, year: true },
  });

  let afterReview: { importStatus: "REVIEW_PENDING" | "COMPLETED"; stillInReview: number } | null = null;

  if (decisions?.length) {
    if (!importRow) {
      return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });
    }

    const importCtx: ImportContextMeta = {
      year: importRow.year,
      examBoardId: importRow.examBoardId,
      competitionId: importRow.competitionId,
      cityId: importRow.cityId,
      jobRoleId: importRow.jobRoleId,
    };

    try {
      const linkCols = await getQuestionOptionalLinkColumns(prisma);
      const decisionQids = [...new Set(decisions.map((d) => d.questionId))];
      const allIqs = await prisma.importedQuestion.findMany({ where: { importId: id, id: { in: decisionQids } } });
      const iqById = new Map(allIqs.map((i) => [i.id, i]));

      const allIqsForLinks = allIqs.map((i) => i.id);
      const allAssetLinks = allIqsForLinks.length
        ? await prisma.importedQuestionAsset.findMany({
            where: { importedQuestionId: { in: allIqsForLinks } },
            include: { importAsset: true },
          })
        : [];
      const linksByIqId = new Map<string, (typeof allAssetLinks)[number][]>();
      for (const row of allAssetLinks) {
        const list = linksByIqId.get(row.importedQuestionId) ?? [];
        list.push(row);
        linksByIqId.set(row.importedQuestionId, list);
      }

      const approveDecisions = decisions.filter((d) => d.action === "approve");
      const iqsForLlm =
        approveDecisions.length > 0
          ? approveDecisions
              .map((d) => iqById.get(d.questionId))
              .filter((iq): iq is (typeof allIqs)[number] => Boolean(iq))
              .map((q) => ({ id: q.id, content: q.content }))
          : [];
      const llmEnunciadoMap =
        iqsForLlm.length > 0
          ? await analyzeEnunciadoBatchLlm(iqsForLlm.map((q) => ({ id: q.id, content: q.content })))
          : null;

      // Validação (enunciado / alternativas) fora da transação — evita $transaction 5s default + N queries
      for (const d of decisions) {
        if (d.action !== "approve") continue;
        const iq = iqById.get(d.questionId);
        if (!iq) continue;
        if (iq.status === "PUBLISHED" && iq.publishedQuestionId) continue;
        const alternatives = normalizeImportedAlternatives(iq.alternatives);
        if (alternatives.length === 0) {
          throw new Error(
            `Questão importada sem alternativas válidas (id: ${d.questionId}). Edite a questão e tente de novo.`,
          );
        }
        const assetLinks = linksByIqId.get(iq.id) ?? [];
        const heur = analyzeEnunciadoHeuristic(iq.content);
        const dep = mergeDependencyOr(heur, llmEnunciadoMap?.[iq.id] ?? null);
        const { review } = parseImportRawText(iq.rawText);
        const linkStats = reviewLinkStatsFromPrismaJoins(assetLinks);
        const vg = isVinculoSatisfiedForReview(
          dep.needsTextSupport,
          dep.needsFigure,
          linkStats.hasTextBlockLink,
          linkStats.hasMainImageLink,
          review,
        );
        if (!vg.ok) {
          throw new Error(`Questão ${d.questionId.slice(0, 8)}…: ${getDependencyBlockUserMessage(vg.missing)}`);
        }
        const alts = normalizeImportedAlternatives(iq.alternatives);
        const heurVis = detectLikelyVisualAlternatives(alts);
        if (alternativasVisuaisAtivas(review, heurVis)) {
          const letters = alts.map((a) => a.letter.trim().toUpperCase().slice(0, 1));
          const hasByLetter: Record<string, boolean> = {};
          for (const L of letters) {
            if (L) hasByLetter[L] = Boolean(linkStats.altImageDataByLetter[L]);
          }
          const miss = missingAlternativeImageLinks(letters, hasByLetter);
          if (miss.length) {
            throw new Error(
              `Questão ${d.questionId.slice(0, 8)}…: faltam recortes de imagem nas alternativas: ${miss.join(", ")}.`,
            );
          }
        }
        const metaRes = isImportedQuestionMetaComplete(
          {
            suggestedSubjectId: iq.suggestedSubjectId,
            suggestedTopicId: iq.suggestedTopicId,
            year: iq.year,
            examBoardId: iq.examBoardId,
            competitionId: iq.competitionId,
            cityId: iq.cityId,
            jobRoleId: iq.jobRoleId,
            difficulty: iq.difficulty,
            tags: iq.tags ?? [],
          },
          importCtx,
        );
        if (!metaRes.ok) {
          throw new Error(
            `Questão ${d.questionId.slice(0, 8)}…: preencha os metadados: ${metaMissingLabels(metaRes.missing).join(", ")}. Guarde a questão antes de integrar.`,
          );
        }
      }

      afterReview = await prisma.$transaction(
        async (tx) => {
          for (const d of decisions) {
            if (d.action === "approve") {
              const freshIq = await tx.importedQuestion.findUnique({ where: { id: d.questionId } });
              if (!freshIq) continue;
              if (freshIq.status === "PUBLISHED" && freshIq.publishedQuestionId) continue;

              const alternatives = normalizeImportedAlternatives(freshIq.alternatives);
              if (alternatives.length === 0) {
                throw new Error(
                  `Questão importada sem alternativas válidas (id: ${d.questionId}). Edite a questão e tente de novo.`,
                );
              }
              const assetLinks = linksByIqId.get(freshIq.id) ?? [];
              const supportParts = assetLinks
                .filter(
                  (l) =>
                    l.role === "SUPPORT_TEXT" &&
                    l.importAsset.kind === "TEXT_BLOCK" &&
                    l.importAsset.extractedText?.trim(),
                )
                .map((l) => l.importAsset.extractedText!.trim());
              const supportText = supportParts.length > 0 ? supportParts.join("\n\n") : null;
              const mainFig = assetLinks.find(
                (l) => l.role === "FIGURE" && l.importAsset.kind === "IMAGE" && !l.alternativeLetter,
              );
              const imageFromAsset = mainFig?.importAsset?.imageDataUrl?.trim() || null;
              const finalImageUrl = imageFromAsset || freshIq.imageUrl || null;
              const finalHasImage = Boolean(finalImageUrl);

              const meta = resolveImportedQuestionPublishMeta(
                {
                  suggestedSubjectId: freshIq.suggestedSubjectId,
                  suggestedTopicId: freshIq.suggestedTopicId,
                  year: freshIq.year,
                  examBoardId: freshIq.examBoardId,
                  competitionId: freshIq.competitionId,
                  cityId: freshIq.cityId,
                  jobRoleId: freshIq.jobRoleId,
                  difficulty: freshIq.difficulty,
                  tags: freshIq.tags ?? [],
                },
                importCtx,
              );

              let subjectId: string | null = meta.subjectId;
              if (subjectId) {
                const s = await tx.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
                if (!s) subjectId = null;
              }

              let topicId: string | null = meta.topicId;
              if (topicId) {
                const t = await tx.topic.findUnique({ where: { id: topicId }, select: { id: true } });
                if (!t) topicId = null;
              }

              let ca = (freshIq.correctAnswer ?? "A").trim().toUpperCase();
              if (!alternatives.some((a) => a.letter === ca)) {
                ca = alternatives[0]!.letter;
              }

              const q = await tx.question.create({
                data: {
                  content: freshIq.content,
                  supportText,
                  correctAnswer: ca,
                  subjectId,
                  topicId,
                  examBoardId: meta.examBoardId,
                  ...(linkCols.hasCityId ? { cityId: meta.cityId } : {}),
                  ...(linkCols.hasJobRoleId ? { jobRoleId: meta.jobRoleId } : {}),
                  year: meta.year,
                  competitionId: meta.competitionId,
                  importId: id,
                  status: "ACTIVE",
                  sourcePage: freshIq.sourcePage,
                  sourcePosition: freshIq.sourcePosition,
                  hasImage: finalHasImage,
                  imageUrl: finalImageUrl,
                  difficulty: meta.difficulty,
                  tags: meta.tags,
                  alternatives: {
                    create: alternatives.map((a, i) => {
                      const L = a.letter.trim().toUpperCase().slice(0, 1);
                      const fromAlt = assetLinks.find(
                        (l) =>
                          l.alternativeLetter?.toUpperCase() === L &&
                          l.role === "FIGURE" &&
                          l.importAsset.kind === "IMAGE",
                      );
                      const altUrl = fromAlt?.importAsset?.imageDataUrl?.trim() || null;
                      const content = (a.content ?? "").trim() || (altUrl ? "·" : "·");
                      return { letter: a.letter, content, order: i + 1, imageUrl: altUrl };
                    }),
                  },
                },
              });

              await tx.importedQuestion.update({
                where: { id: d.questionId },
                data: {
                  status: "PUBLISHED",
                  publishedQuestionId: q.id,
                  reviewedBy: reviewerId,
                  reviewedAt,
                },
              });
            } else {
              const result = await tx.importedQuestion.updateMany({
                where: { id: d.questionId, importId: id },
                data: { status: "REJECTED", reviewedBy: reviewerId, reviewedAt },
              });
              if (result.count === 0) {
                // id inválido ou fora desta importação: ignora
              }
            }
          }

          const approved = await tx.importedQuestion.count({ where: { importId: id, status: "PUBLISHED" } });
          const rejected = await tx.importedQuestion.count({ where: { importId: id, status: "REJECTED" } });
          const stillInReview = await tx.importedQuestion.count({ where: { importId: id, status: "PENDING_REVIEW" } });

          await tx.pDFImport.update({
            where: { id },
            data: {
              totalApproved: approved,
              totalRejected: rejected,
              status: stillInReview > 0 ? "REVIEW_PENDING" : "COMPLETED",
            },
          });
          return {
            importStatus: (stillInReview > 0 ? "REVIEW_PENDING" : "COMPLETED") as "REVIEW_PENDING" | "COMPLETED",
            stillInReview,
          };
        },
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2003") {
          return NextResponse.json(
            { error: "Referência inválida (matéria, tópico ou cadastro vinculado). Ajuste a questão e tente de novo." },
            { status: 400 },
          );
        }
        if (e.code === "P2002") {
          return NextResponse.json(
            { error: "Conflito ao gravar (dados duplicados). Tente de novo em alguns segundos." },
            { status: 409 },
          );
        }
      }
      const message = e instanceof Error ? e.message : "Falha ao aplicar decisões";
      const isUserFacing = /Questão importada|alternativas válidas|Precisa vincular|faltam recortes|faltam imagens/i.test(
        message,
      );
      return NextResponse.json(
        { error: message || "Falha ao salvar revisão" },
        { status: isUserFacing ? 400 : 500 },
      );
    }
  }

  if (status) {
    await prisma.pDFImport.update({
      where: { id },
      data: { status: status as "PENDING" | "PROCESSING" | "REVIEW_PENDING" | "COMPLETED" | "FAILED" },
    });
  }

  return NextResponse.json({
    ok: true,
    ...(afterReview
      ? { importStatus: afterReview.importStatus, stillInReview: afterReview.stillInReview }
      : {}),
  });
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
