import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

type Body = {
  importAssetId: string;
  importedQuestionIds: string[];
  role: "SUPPORT_TEXT" | "FIGURE";
  alternativeLetter?: string | null;
  /** Se true, pode substituir conflito de alternativeLetter (apaga o vínculo anterior daquela letra) */
  confirmReplace?: boolean;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: importId } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.importAssetId || !Array.isArray(body.importedQuestionIds) || !body.importedQuestionIds.length || !body.role) {
    return NextResponse.json({ error: "importAssetId, importedQuestionIds e role são obrigatórios" }, { status: 400 });
  }
  if (!["SUPPORT_TEXT", "FIGURE"].includes(body.role)) {
    return NextResponse.json({ error: "role inválido" }, { status: 400 });
  }

  const altL = body.alternativeLetter?.trim().toUpperCase() ?? null;
  if (altL) {
    if (!/^[A-E]$/.test(altL)) {
      return NextResponse.json({ error: "alternativeLetter deve ser A, B, C, D ou E" }, { status: 400 });
    }
    if (body.role !== "FIGURE") {
      return NextResponse.json({ error: "Alternativas visuais exigem role FIGURE" }, { status: 400 });
    }
  }

  const asset = await prisma.importAsset.findFirst({
    where: { id: body.importAssetId, importId },
    select: { id: true, kind: true },
  });
  if (!asset) return NextResponse.json({ error: "Ativo não encontrado nesta importação" }, { status: 400 });
  if (altL && asset.kind !== "IMAGE") {
    return NextResponse.json({ error: "Vínculo de alternativa deve ser ativo de imagem" }, { status: 400 });
  }

  const qids = [...new Set(body.importedQuestionIds)].filter(Boolean);
  const questions = await prisma.importedQuestion.findMany({
    where: { id: { in: qids }, importId },
    select: { id: true },
  });
  const validIds = new Set(questions.map((q) => q.id));
  const invalid = qids.filter((id) => !validIds.has(id));
  if (invalid.length) {
    return NextResponse.json({ error: "Uma ou mais questões não pertencem a esta importação", invalid }, { status: 400 });
  }

  // Conflito real: alternativaLetter já existe na questão.
  if (altL) {
    const conflicts = await prisma.importedQuestionAsset.findMany({
      where: { importedQuestionId: { in: qids }, alternativeLetter: altL },
      select: { id: true, importedQuestionId: true, importAssetId: true },
    });
    if (conflicts.length && !body.confirmReplace) {
      return NextResponse.json(
        {
          error: "Conflitos detectados (alternativa já vinculada). Confirme substituição para continuar.",
          conflicts,
        },
        { status: 409 },
      );
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    if (altL && body.confirmReplace) {
      await tx.importedQuestionAsset.deleteMany({
        where: { importedQuestionId: { in: qids }, alternativeLetter: altL },
      });
    }

    const results: Array<{ importedQuestionId: string; created: boolean }> = [];
    for (const importedQuestionId of qids) {
      try {
        await tx.importedQuestionAsset.create({
          data: {
            importedQuestionId,
            importAssetId: body.importAssetId,
            role: body.role,
            alternativeLetter: altL,
          },
        });
        results.push({ importedQuestionId, created: true });
      } catch {
        // já existia (unique), não é erro para fluxo em lote
        results.push({ importedQuestionId, created: false });
      }
    }
    return results;
  });

  return NextResponse.json({ ok: true, results: created }, { status: 201 });
}

