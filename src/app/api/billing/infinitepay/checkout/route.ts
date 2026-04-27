import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { ensurePlanoCompleto, PLAN_COMPLETO } from "@/lib/billing/plan";
import { getAppUrl, getInfinitepayWebhookUrl, infinitepayCreateCheckoutLink } from "@/lib/billing/infinitepay";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().optional(),
});

function makeOrderNsu() {
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SUB_${Date.now()}_${rnd}`;
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const plan = await ensurePlanoCompleto();
  const orderNsu = makeOrderNsu();

  const tx = await prisma.paymentTransaction.create({
    data: {
      status: "PENDING",
      amountCents: PLAN_COMPLETO.priceCents,
      handle: process.env.INFINITEPAY_HANDLE ?? "missing",
      orderNsu,
      raw: { customer: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone ?? null } } as any,
    },
  });

  const redirectUrl = `${getAppUrl()}/checkout/obrigado?order_nsu=${encodeURIComponent(orderNsu)}`;
  const webhookUrl = getInfinitepayWebhookUrl();

  const { checkoutUrl, invoiceSlug, raw } = await infinitepayCreateCheckoutLink({
    orderNsu,
    redirectUrl,
    webhookUrl,
    items: [{ quantity: 1, price: PLAN_COMPLETO.priceCents, description: PLAN_COMPLETO.name }],
    customer: { name: parsed.data.name, email: parsed.data.email, phone_number: parsed.data.phone },
  });

  if (!checkoutUrl) {
    await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { status: "REFUSED", raw: raw as any } });
    return NextResponse.json({ error: "Não foi possível gerar link de pagamento" }, { status: 502 });
  }

  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      invoiceSlug: invoiceSlug ?? undefined,
      raw: { ...(tx.raw as any), infinitepay: raw } as any,
    },
  });

  return NextResponse.json({ checkoutUrl, orderNsu });
}

