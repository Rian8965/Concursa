import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function requireCronSecret(req: NextRequest) {
  const expected = (process.env.BILLING_CRON_SECRET ?? "").trim();
  if (!expected) throw new Error("BILLING_CRON_SECRET não configurado");
  const got = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!got || got !== expected) throw new Error("Segredo inválido");
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    requireCronSecret(req);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Fecha tickets RESPONDED sem resposta do usuário nas últimas 48h.
  // Heurística: se o último message é ADMIN e ele é antigo, encerramos automaticamente.
  const candidates = await prisma.supportTicket.findMany({
    where: { status: "RESPONDED", updatedAt: { lte: cutoff } },
    select: { id: true },
    take: 200,
  });

  let closed = 0;
  for (const t of candidates) {
    const last = await prisma.supportMessage.findFirst({
      where: { ticketId: t.id },
      orderBy: { createdAt: "desc" },
      select: { actor: true, createdAt: true },
    });
    if (!last) continue;
    if (last.actor !== "ADMIN") continue;
    if (last.createdAt > cutoff) continue;

    await prisma.supportTicket.update({
      where: { id: t.id },
      data: {
        status: "AUTO_CLOSED",
        closedAt: new Date(),
        closedReason: "Encerrado automaticamente após 48h sem retorno do usuário.",
      },
    });
    await prisma.supportMessage.create({
      data: {
        ticketId: t.id,
        actor: "SYSTEM",
        content: "Encerrado automaticamente após 48h sem retorno do usuário.",
      },
    });
    closed++;
  }

  return NextResponse.json({ ok: true, closed, candidates: candidates.length });
}

