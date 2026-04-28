import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { infinitepayPaymentCheck } from "@/lib/billing/infinitepay";
import { approvePaidTransaction } from "@/lib/billing/approve";

const bodySchema = z.object({
  order_nsu: z.string().min(3).max(120),
  slug: z.string().optional().nullable(),
  transaction_nsu: z.string().optional().nullable(),
});

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

  const approved = await approvePaidTransaction({
    handle,
    orderNsu,
    invoiceSlug,
    transactionNsu,
    paymentCheckRaw: check.raw,
  });

  return NextResponse.json({
    ok: true,
    paid: true,
    firstAccessUrl: (approved as any)?.firstAccessUrl ?? null,
    isFirstAccess: Boolean((approved as any)?.isFirstAccess),
    renewedUntil: (approved as any)?.renewedUntil ?? null,
  });
}

