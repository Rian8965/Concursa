import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { infinitepayPaymentCheck } from "@/lib/billing/infinitepay";
import { approvePaidTransaction } from "@/lib/billing/approve";
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
  // A InfinitePay envia JSON, mas protegemos contra payload inválido para não retornar 500.
  const rawBody = await req.text().catch(() => "");
  const payload = (() => {
    try {
      return (rawBody ? JSON.parse(rawBody) : {}) as WebhookPayload;
    } catch {
      return {} as WebhookPayload;
    }
  })();

  const orderNsu = payload.order_nsu?.toString().trim() ?? "";
  const invoiceSlug = (payload.invoice_slug ?? payload.slug)?.toString().trim() ?? null;
  const transactionNsu = payload.transaction_nsu?.toString().trim() ?? null;
  const captureMethod = payload.capture_method?.toString().trim() ?? null;

  console.info("[infinitepay.webhook] recebido", {
    orderNsu,
    invoiceSlug,
    transactionNsu,
    captureMethod,
  });

  if (!orderNsu) {
    // não retorne 500; apenas sinalize para log/diagnóstico
    console.warn("[infinitepay.webhook] order_nsu ausente", { rawBody: rawBody.slice(0, 500) });
    return NextResponse.json({ ok: true });
  }

  const envHandle = (process.env.INFINITEPAY_HANDLE ?? "").trim() || "missing";
  // Primeiro tenta pelo handle+orderNsu (padrão), mas se não achar tenta só por orderNsu.
  const tx =
    (await prisma.paymentTransaction.findFirst({
      where: { handle: envHandle, orderNsu },
    })) ??
    (await prisma.paymentTransaction.findFirst({
      where: { orderNsu },
      orderBy: { createdAt: "desc" },
    }));

  if (!tx) {
    // registra mesmo assim, para não perder eventos
    try {
      await prisma.paymentTransaction.create({
        data: {
          status: "PENDING",
          amountCents: payload.amount ?? 0,
          paidAmountCents: payload.paid_amount ?? null,
          installments: payload.installments ?? null,
          captureMethod: payload.capture_method ?? null,
          receiptUrl: payload.receipt_url ?? null,
          handle: envHandle,
          orderNsu,
          invoiceSlug,
          transactionNsu,
          raw: payload as any,
        },
      });
    } catch (e: any) {
      // não deixar webhook 500 por conflito/duplicidade
      console.error("[infinitepay.webhook] falha ao registrar tx", { orderNsu, message: String(e?.message ?? e) });
    }
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        // garante handle consistente com o ambiente (sem quebrar lookup)
        handle: envHandle,
        invoiceSlug: invoiceSlug ?? tx.invoiceSlug ?? undefined,
        transactionNsu: transactionNsu ?? tx.transactionNsu ?? undefined,
        paidAmountCents: payload.paid_amount ?? tx.paidAmountCents ?? undefined,
        installments: payload.installments ?? tx.installments ?? undefined,
        captureMethod: payload.capture_method ?? tx.captureMethod ?? undefined,
        receiptUrl: payload.receipt_url ?? tx.receiptUrl ?? undefined,
        raw: { ...(tx.raw as any), webhook: payload } as any,
      },
    });
  } catch (e: any) {
    console.error("[infinitepay.webhook] falha ao atualizar tx", { orderNsu, txId: tx.id, message: String(e?.message ?? e) });
    // não retorna 500: reconcile vai conseguir dar baixa depois
    return NextResponse.json({ ok: true });
  }

  // Confirma “pago” via payment_check antes de liberar acesso
  let check: { raw: unknown; paid: boolean } | null = null;
  try {
    check = await infinitepayPaymentCheck({
      orderNsu,
      transactionNsu,
      slug: invoiceSlug,
    });
  } catch (e: any) {
    console.error("[infinitepay.webhook] falha no payment_check", { orderNsu, message: String(e?.message ?? e) });
    return NextResponse.json({ ok: true });
  }

  if (!check.paid) {
    console.info("[infinitepay.webhook] payment_check: ainda não pago", { orderNsu });
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: "PENDING" },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    await approvePaidTransaction({
      handle: envHandle,
      orderNsu,
      invoiceSlug,
      transactionNsu,
      paymentCheckRaw: check.raw,
    });
  } catch (e: any) {
    // crucial: não retornar 500 para o provedor; reconcile fica responsável
    console.error("[infinitepay.webhook] falha ao aprovar/processar", { orderNsu, message: String(e?.message ?? e) });
    return NextResponse.json({ ok: true });
  }

  console.info("[infinitepay.webhook] aprovado e processado", { orderNsu });
  return NextResponse.json({ ok: true });
}

