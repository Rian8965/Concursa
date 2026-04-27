import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { infinitepayPaymentCheck } from "@/lib/billing/infinitepay";
import { ensurePlanoCompleto, PLAN_COMPLETO } from "@/lib/billing/plan";
import bcrypt from "bcryptjs";

type WebhookPayload = {
  invoice_slug?: string;
  slug?: string;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
  transaction_nsu?: string;
  order_nsu?: string;
  receipt_url?: string;
  items?: any[];
};

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
  const payload = (await req.json().catch(() => ({}))) as WebhookPayload;

  const orderNsu = payload.order_nsu?.toString().trim() ?? "";
  const invoiceSlug = (payload.invoice_slug ?? payload.slug)?.toString().trim() ?? null;
  const transactionNsu = payload.transaction_nsu?.toString().trim() ?? null;

  if (!orderNsu) return NextResponse.json({ error: "order_nsu ausente" }, { status: 400 });

  const tx = await prisma.paymentTransaction.findFirst({
    where: {
      handle: process.env.INFINITEPAY_HANDLE ?? "missing",
      orderNsu,
    },
  });

  if (!tx) {
    // registra mesmo assim, para não perder eventos
    await prisma.paymentTransaction.create({
      data: {
        status: "PENDING",
        amountCents: payload.amount ?? 0,
        paidAmountCents: payload.paid_amount ?? null,
        installments: payload.installments ?? null,
        captureMethod: payload.capture_method ?? null,
        receiptUrl: payload.receipt_url ?? null,
        handle: process.env.INFINITEPAY_HANDLE ?? "missing",
        orderNsu,
        invoiceSlug,
        transactionNsu,
        raw: payload as any,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      invoiceSlug: invoiceSlug ?? tx.invoiceSlug ?? undefined,
      transactionNsu: transactionNsu ?? tx.transactionNsu ?? undefined,
      paidAmountCents: payload.paid_amount ?? tx.paidAmountCents ?? undefined,
      installments: payload.installments ?? tx.installments ?? undefined,
      captureMethod: payload.capture_method ?? tx.captureMethod ?? undefined,
      receiptUrl: payload.receipt_url ?? tx.receiptUrl ?? undefined,
      raw: { ...(tx.raw as any), webhook: payload } as any,
    },
  });

  // Confirma “pago” via payment_check antes de liberar acesso
  const check = await infinitepayPaymentCheck({
    orderNsu,
    transactionNsu,
    slug: invoiceSlug,
  });

  if (!check.paid) {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: "PENDING" },
    });
    return NextResponse.json({ ok: true });
  }

  const plan = await ensurePlanoCompleto();
  const { user, profile } = await ensureStudentFromTransaction(tx);

  // Ativa assinatura + libera acesso (30 dias)
  const periodEnd = nowPlusDays(plan.durationDays ?? 30);

  await prisma.$transaction(async (p) => {
    await p.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        amountCents: PLAN_COMPLETO.priceCents,
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

    // Token de primeiro acesso (definir senha)
    const token = randomToken();
    await p.firstAccessToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: nowPlusDays(7),
      },
    });
  });

  // E-mail será implementado em seguida (SMTP). Por enquanto apenas finaliza o webhook.
  return NextResponse.json({ ok: true });
}

