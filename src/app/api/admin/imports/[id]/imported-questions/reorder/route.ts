import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function posKey(p: number | null | undefined): number {
  if (p == null || !Number.isFinite(p)) return 1_000_000_000;
  return p;
}

/**
 * Troca a posição na lista (sourcePosition) entre duas questões.
 * `fromPosition` e `toPosition` são 1-based na ordem exibida (ordenando por sourcePosition).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id: importId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    fromPosition?: unknown;
    toPosition?: unknown;
  };

  const fromPosition = typeof body.fromPosition === "number" ? Math.floor(body.fromPosition) : NaN;
  const toPosition = typeof body.toPosition === "number" ? Math.floor(body.toPosition) : NaN;

  if (!Number.isFinite(fromPosition) || !Number.isFinite(toPosition) || fromPosition < 1 || toPosition < 1) {
    return NextResponse.json({ error: "fromPosition e toPosition devem ser inteiros ≥ 1." }, { status: 400 });
  }

  if (fromPosition === toPosition) {
    return NextResponse.json({ error: "As posições são iguais; nada a alterar." }, { status: 400 });
  }

  const rows = await prisma.importedQuestion.findMany({
    where: { importId },
    select: { id: true, sourcePosition: true },
  });

  if (rows.length < 2) {
    return NextResponse.json({ error: "Não há questões suficientes para reordenar." }, { status: 400 });
  }

  const sorted = [...rows].sort((a, b) => {
    const d = posKey(a.sourcePosition) - posKey(b.sourcePosition);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });

  if (fromPosition > sorted.length || toPosition > sorted.length) {
    return NextResponse.json(
      { error: `Posição inválida. Esta importação tem ${sorted.length} questões.` },
      { status: 400 },
    );
  }

  const a = sorted[fromPosition - 1];
  const b = sorted[toPosition - 1];
  const spA = a.sourcePosition;
  const spB = b.sourcePosition;

  await prisma.$transaction([
    prisma.importedQuestion.update({
      where: { id: a.id },
      data: { sourcePosition: spB ?? toPosition },
    }),
    prisma.importedQuestion.update({
      where: { id: b.id },
      data: { sourcePosition: spA ?? fromPosition },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
