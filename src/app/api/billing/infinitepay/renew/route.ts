import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { infinitepayCreateCheckoutLink, getAppUrl, getInfinitepayWebhookUrl } from "@/lib/billing/infinitepay";
import { ensurePlanoCompleto, PLAN_COMPLETO } from "@/lib/billing/plan";

function makeOrderNsu() {
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `RENEW_${Date.now()}_${rnd}`;
}

function normalizePhone(phone?: string | null) {
  const p = (phone ?? "").trim();
  if (!p) return undefined;
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { studentProfile: true },
  });
  if (!user?.studentProfile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  await ensurePlanoCompleto();
  const orderNsu = makeOrderNsu();
  const phoneNormalized = normalizePhone(user.studentProfile.phone);

  const tx = await prisma.paymentTransaction.create({
    data: {
      status: "PENDING",
      amountCents: PLAN_COMPLETO.priceCents,
      handle: process.env.INFINITEPAY_HANDLE ?? "missing",
      orderNsu,
      raw: { customer: { name: user.name, email: user.email, phone: phoneNormalized ?? null }, renewal: true } as any,
    },
  });

  const redirectUrl = `${getAppUrl()}/checkout/obrigado?order_nsu=${encodeURIComponent(orderNsu)}`;
  const webhookUrl = getInfinitepayWebhookUrl();

  const created = await infinitepayCreateCheckoutLink({
    orderNsu,
    redirectUrl,
    webhookUrl,
    items: [{ quantity: 1, price: PLAN_COMPLETO.priceCents, description: PLAN_COMPLETO.name }],
    customer: { name: user.name, email: user.email, phone_number: phoneNormalized },
  });

  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: { invoiceSlug: created.invoiceSlug ?? undefined, raw: { ...(tx.raw as any), infinitepay: created.raw } as any },
  });

  return NextResponse.json({ checkoutUrl: created.checkoutUrl, orderNsu });
}

