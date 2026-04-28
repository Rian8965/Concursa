import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { hasValidFinanceAuthCookie } from "@/lib/finance/extra-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

const bodySchema = z.object({
  adminPassword: z.string().min(4).max(200),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!(await hasValidFinanceAuthCookie())) {
    return NextResponse.json({ error: "Senha extra necessária" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { id } = await params;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, password: true } });
  if (!me?.password) return NextResponse.json({ error: "Admin sem senha configurada" }, { status: 500 });

  const ok = await bcrypt.compare(parsed.data.adminPassword, me.password);
  if (!ok) return NextResponse.json({ error: "Senha administrativa incorreta" }, { status: 403 });

  const tx = await prisma.paymentTransaction.findUnique({
    where: { id },
    select: { id: true, status: true, subscriptionId: true, raw: true },
  });
  if (!tx) return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  if (tx.status === "CANCELLED") return NextResponse.json({ ok: true, alreadyCancelled: true });

  const now = new Date();

  await prisma.$transaction(async (p) => {
    await p.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: "CANCELLED",
        approvedAt: null,
        raw: {
          ...(tx.raw as any),
          cancelled: {
            at: now.toISOString(),
            byUserId: session.user.id,
            reason: "manual_admin",
          },
        } as any,
      },
    });

    if (tx.subscriptionId) {
      const sub = await p.subscription.findUnique({
        where: { id: tx.subscriptionId },
        select: { id: true, studentProfileId: true },
      });
      if (sub) {
        await p.subscription.update({
          where: { id: sub.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        // evita manter como ativo no sistema (requisito: não aparecer como ativa)
        await p.studentProfile.update({
          where: { id: sub.studentProfileId },
          data: { planId: null, accessExpiresAt: now },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

