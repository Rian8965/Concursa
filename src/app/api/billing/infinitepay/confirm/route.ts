import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { infinitepayPaymentCheck } from "@/lib/billing/infinitepay";
import { ensurePlanoCompleto, PLAN_COMPLETO } from "@/lib/billing/plan";
import bcrypt from "bcryptjs";
import { sendFirstAccessEmail } from "@/lib/email/first-access";
import { getAppUrl } from "@/lib/billing/infinitepay";

const bodySchema = z.object({
  order_nsu: z.string().min(3).max(120),
  slug: z.string().optional().nullable(),
  transaction_nsu: z.string().optional().nullable(),
});

function nowPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function randomToken() {
  return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2)}`;
}

async function ensureStudentFromTransaction(tx: { raw: any }) {
  const email = (tx.raw?.customer?.email ?? "").toString().trim().toLowerCase();
  const name = (tx.raw?.customer?.name ?? "Aluno").toString().trim();
  if (!email) throw new Error("Transação sem e-mail do comprador");

  const existing = await prisma.user.findUnique({ where: { email }, include: { studentProfile: true } });
  if (existing?.studentProfile) return { user: existing, profile: existing.studentProfile };

  const passwordTemp = randomToken().slice(0, 16);
  const passwordHash = await bcrypt.hash(passwordTemp, 10);

  const user = await prisma.user.create({
    data: {
      name: name || "Aluno",
      email,
      password: passwordHash,
      role: "STUDENT",
      studentProfile: { create: {} },
    },
    include: { studentProfile: true },
  });
  return { user, profile: user.studentProfile! };
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const orderNsu = parsed.data.order_nsu.trim();
  const invoiceSlug = (parsed.data.slug ?? "").toString().trim() || null;
  const transactionNsu = (parsed.data.transaction_nsu ?? "").toString().trim() || null;

  const handle = (process.env.INFINITEPAY_HANDLE ?? "").trim();
  if (!handle) return NextResponse.json({ error: "INFINITEPAY_HANDLE não configurado" }, { status: 500 });

  const check = await infinitepayPaymentCheck({
    orderNsu,
    slug: invoiceSlug,
    transactionNsu,
  });

  if (!check.paid) {
    return NextResponse.json({ ok: true, paid: false });
  }

  const plan = await ensurePlanoCompleto();

  // Garante transação registrada (caso webhook não tenha chegado)
  const tx = await prisma.paymentTransaction.upsert({
    where: { handle_orderNsu: { handle, orderNsu } },
    create: {
      status: "PENDING",
      amountCents: PLAN_COMPLETO.priceCents,
      handle,
      orderNsu,
      invoiceSlug: invoiceSlug ?? undefined,
      transactionNsu: transactionNsu ?? undefined,
      raw: { payment_check: check.raw } as any,
    },
    update: {
      invoiceSlug: invoiceSlug ?? undefined,
      transactionNsu: transactionNsu ?? undefined,
      raw: { ...(check.raw ? { payment_check: check.raw } : {}) } as any,
    },
  });

  // Se já aprovado, só garante um token e retorna o link
  if (tx.status === "APPROVED") {
    const email = (tx.raw as any)?.customer?.email?.toString()?.trim()?.toLowerCase() ?? null;
    if (!email) return NextResponse.json({ ok: true, paid: true });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: true, paid: true });

    const existingToken = await prisma.firstAccessToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    const token = existingToken?.token ?? randomToken();
    if (!existingToken) {
      await prisma.firstAccessToken.create({
        data: { userId: user.id, token, expiresAt: nowPlusDays(7) },
      });
    }

    const link = `${getAppUrl()}/primeiro-acesso?token=${encodeURIComponent(token)}`;
    return NextResponse.json({ ok: true, paid: true, firstAccessUrl: link });
  }

  const { user, profile } = await ensureStudentFromTransaction(tx as any);

  const periodEnd = nowPlusDays(plan.durationDays ?? 30);
  let createdToken: string | null = null;

  await prisma.$transaction(async (p) => {
    await p.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        amountCents: PLAN_COMPLETO.priceCents,
        invoiceSlug: invoiceSlug ?? tx.invoiceSlug ?? undefined,
        transactionNsu: transactionNsu ?? tx.transactionNsu ?? undefined,
        raw: { ...(tx.raw as any), payment_check: check.raw } as any,
      },
    });

    await p.studentProfile.update({
      where: { id: profile.id },
      data: {
        planId: plan.id,
        accessExpiresAt: periodEnd,
      },
    });

    await p.subscription.create({
      data: {
        studentProfileId: profile.id,
        planId: plan.id,
        status: "APPROVED",
        startedAt: new Date(),
        currentPeriodEnd: periodEnd,
        transactions: { connect: { id: tx.id } },
      },
    });

    const token = randomToken();
    await p.firstAccessToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: nowPlusDays(7),
      },
    });
    createdToken = token;
  });

  const firstAccessUrl = createdToken ? `${getAppUrl()}/primeiro-acesso?token=${encodeURIComponent(createdToken)}` : null;

  try {
    if (createdToken) {
      await sendFirstAccessEmail({
        to: user.email,
        name: user.name,
        token: createdToken,
        planName: plan.name,
        accessUntil: periodEnd,
        orderNsu: tx.orderNsu ?? null,
      });
    }
  } catch (e: any) {
    console.error("[email.first-access] falha ao enviar", {
      to: user.email,
      message: String(e?.message ?? e),
    });
  }

  return NextResponse.json({ ok: true, paid: true, firstAccessUrl });
}

