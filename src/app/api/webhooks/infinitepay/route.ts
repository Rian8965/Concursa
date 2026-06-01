import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { infinitepayPaymentCheck } from "@/lib/billing/infinitepay";
import { approvePaidTransaction } from "@/lib/billing/approve";
import { approveCreditsTransaction } from "@/lib/billing/approve-credits";

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

export async function POST(req: NextRequest) {
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

  console.info("[infinitepay.webhook] recebido", { orderNsu, invoiceSlug, transactionNsu });

  if (!orderNsu) {
    console.warn("[infinitepay.webhook] order_nsu ausente", { rawBody: rawBody.slice(0, 500) });
    return NextResponse.json({ ok: true });
  }

  const envHandle = (process.env.INFINITEPAY_HANDLE ?? "").trim() || "missing";

  // Buscar transação existente
  const tx =
    (await prisma.paymentTransaction.findFirst({ where: { handle: envHandle, orderNsu } })) ??
    (await prisma.paymentTransaction.findFirst({ where: { orderNsu }, orderBy: { createdAt: "desc" } }));

  if (!tx) {
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
      console.error("[infinitepay.webhook] falha ao registrar tx nova", { orderNsu, message: String(e?.message ?? e) });
    }
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: {
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
    return NextResponse.json({ ok: true });
  }

  // Confirmar pagamento via payment_check
  let check: { raw: unknown; paid: boolean } | null = null;
  try {
    check = await infinitepayPaymentCheck({ orderNsu, transactionNsu, slug: invoiceSlug });
  } catch (e: any) {
    console.error("[infinitepay.webhook] falha no payment_check", { orderNsu, message: String(e?.message ?? e) });
    return NextResponse.json({ ok: true });
  }

  if (!check.paid) {
    await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { status: "PENDING" } });
    return NextResponse.json({ ok: true });
  }

  // Determinar tipo da transação pelo metadado `raw.type`
  const txRaw = tx.raw as any;
  const txType = txRaw?.type ?? "subscription";

  try {
    if (txType === "ai_credit_purchase") {
      // Compra de pacote de créditos extras
      await approveCreditsTransaction({
        handle: envHandle,
        orderNsu,
        invoiceSlug,
        transactionNsu,
        paymentCheckRaw: check.raw,
      });
      console.info("[infinitepay.webhook] créditos extras aprovados", { orderNsu });
    } else {
      // Compra/renovação de assinatura (padrão)
      await approvePaidTransaction({
        handle: envHandle,
        orderNsu,
        invoiceSlug,
        transactionNsu,
        paymentCheckRaw: check.raw,
      });
      console.info("[infinitepay.webhook] assinatura aprovada e processada", { orderNsu });
    }
  } catch (e: any) {
    console.error("[infinitepay.webhook] falha ao aprovar/processar", { orderNsu, txType, message: String(e?.message ?? e) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
