import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

type AltDTO = { letter: string; content: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: importId } = await params;
  const body = (await req.json()) as {
    content: string;
    alternatives?: AltDTO[];
    correctAnswer?: string | null;
    suggestedSubjectId?: string | null;
    sourcePage?: number | null;
    sourcePosition?: number | null;
    rawText?: string | null;
    confidence?: number | null;
  };

  const imp = await prisma.pDFImport.findUnique({ where: { id: importId }, select: { id: true } });
  if (!imp) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  const content = String(body.content ?? "").trim();
  if (content.length < 1) return NextResponse.json({ error: "content é obrigatório" }, { status: 400 });

  const maxPos = await prisma.importedQuestion.aggregate({
    where: { importId },
    _max: { sourcePosition: true },
  });
  const nextPos = body.sourcePosition ?? ((maxPos._max.sourcePosition ?? 0) + 1);

  const created = await prisma.importedQuestion.create({
    data: {
      importId,
      content,
      alternatives: (body.alternatives ?? []) as any,
      correctAnswer: body.correctAnswer ?? null,
      suggestedSubjectId: body.suggestedSubjectId ?? null,
      sourcePage: body.sourcePage ?? null,
      sourcePosition: nextPos,
      hasImage: false,
      imageUrl: null,
      rawText: body.rawText ?? null,
      confidence: body.confidence ?? null,
      status: "PENDING_REVIEW",
    },
  });

  return NextResponse.json({ question: created }, { status: 201 });
}

