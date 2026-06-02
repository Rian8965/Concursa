import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import {
  ensurePlanoAvancado,
  ensurePlanoPremium,
  PLAN_AVANCADO,
  PLAN_PREMIUM,
} from "@/lib/billing/plan";
import {
  getAppUrl,
  getInfinitepayWebhookUrl,
  infinitepayCreateCheckoutLink,
  corsHeaders,
} from "@/lib/billing/infinitepay";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().optional(),
  planSlug: z.enum(["avancado", "premium"]).default("avancado"),
  competitionSlug: z.string().optional(),
});

function makeOrderNsu() {
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SUB_${Date.now()}_${rnd}`;
}

function normalizePhone(phone?: string | null) {
  const p = (phone ?? "").trim();
  if (!p) return undefined;
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: cors });

  const { name, email, phone, planSlug, competitionSlug } = parsed.data;

  // Resolver plano
  const plan = planSlug === "premium" ? await ensurePlanoPremium() : await ensurePlanoAvancado();
  const planInfo = planSlug === "premium" ? PLAN_PREMIUM : PLAN_AVANCADO;

  // Validar concurso (se informado) — segurança: validação no backend
  let competition: { id: string; name: string; slug: string } | null = null;
  if (competitionSlug) {
    competition = await prisma.competition.findUnique({
      where: { slug: competitionSlug },
      select: { id: true, name: true, slug: true, isActive: true, salesLinkActive: true },
    }).then((c) => {
      if (!c || !(c as any).isActive || !(c as any).salesLinkActive) return null;
      return { id: c.id, name: c.name, slug: c.slug };
    });
    if (!competition) {
      return NextResponse.json({ error: "Concurso não encontrado ou link inativo" }, { status: 400, headers: cors });
    }
  }

  const orderNsu = makeOrderNsu();
  const phoneNormalized = normalizePhone(phone);

  const tx = await prisma.paymentTransaction.create({
    data: {
      status: "PENDING",
      amountCents: planInfo.priceCents,
      handle: process.env.INFINITEPAY_HANDLE ?? "missing",
      orderNsu,
      raw: {
        type: "subscription",
        planSlug: plan.slug,
        planId: plan.id,
        customer: { name, email, phone: phoneNormalized ?? null },
        ...(competition ? { competitionId: competition.id, competitionSlug: competition.slug, competitionName: competition.name } : {}),
      } as any,
    },
  });

  const redirectUrl = `${getAppUrl()}/checkout/obrigado?order_nsu=${encodeURIComponent(orderNsu)}`;
  const webhookUrl = getInfinitepayWebhookUrl();

  let checkoutUrl: string | null = null;
  let invoiceSlug: string | null = null;
  let raw: unknown = null;
  try {
    const created = await infinitepayCreateCheckoutLink({
      orderNsu,
      redirectUrl,
      webhookUrl,
      items: [{ quantity: 1, price: planInfo.priceCents, description: plan.name }],
      customer: { name, email, phone_number: phoneNormalized },
    });
    checkoutUrl = created.checkoutUrl;
    invoiceSlug = created.invoiceSlug;
    raw = created.raw;
  } catch (e: any) {
    console.error("[infinitepay.checkout] falha ao criar link", { orderNsu, txId: tx.id, message: String(e?.message ?? e) });
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: "REFUSED", raw: { ...(tx.raw as any), error: String(e?.message ?? e) } as any },
    });
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento", orderNsu }, { status: 502, headers: cors });
  }

  if (!checkoutUrl) {
    await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { status: "REFUSED", raw: raw as any } });
    return NextResponse.json({ error: "Não foi possível gerar link de pagamento" }, { status: 502, headers: cors });
  }

  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: {
      invoiceSlug: invoiceSlug ?? undefined,
      raw: { ...(tx.raw as any), infinitepay: raw } as any,
    },
  });

  return NextResponse.json(
    { checkoutUrl, orderNsu, plan: { name: plan.name, priceCents: planInfo.priceCents, slug: plan.slug } },
    { headers: cors },
  );
}
