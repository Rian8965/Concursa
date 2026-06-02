/**
 * Checkout de conversão para alunos em teste grátis (já logados).
 * Cria o link de pagamento usando os dados do usuário logado.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { ensurePlanoAvancado, ensurePlanoPremium, PLAN_AVANCADO, PLAN_PREMIUM } from "@/lib/billing/plan";
import { getAppUrl, getInfinitepayWebhookUrl, infinitepayCreateCheckoutLink } from "@/lib/billing/infinitepay";

const schema = z.object({
  planSlug: z.enum(["avancado", "premium"]),
});

function makeOrderNsu() {
  return `SUB_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizePhone(phone?: string | null) {
  const p = (phone ?? "").trim();
  if (!p) return undefined;
  const digits = p.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("55")) return `+${digits}`;
  return `+55${digits}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

  const { planSlug } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { studentProfile: true },
  });
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const profile = user.studentProfile;

  // Buscar dados do plano
  const plan = planSlug === "premium" ? await ensurePlanoPremium() : await ensurePlanoAvancado();
  const planInfo = planSlug === "premium" ? PLAN_PREMIUM : PLAN_AVANCADO;

  // Dados do concurso vinculado (se vier do trial)
  const originSlug = (profile as any)?.freeTrialOriginSlug as string | null;
  let competitionId: string | null = null;
  if (originSlug) {
    const comp = await prisma.competition.findFirst({
      where: { slug: originSlug, isActive: true },
      select: { id: true },
    });
    competitionId = comp?.id ?? null;
  }

  const orderNsu = makeOrderNsu();
  const phoneNormalized = normalizePhone(profile?.phone);

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
        fromTrial: true,
        trialUserId: user.id,
        customer: {
          name: user.name,
          email: user.email,
          phone: phoneNormalized ?? null,
        },
        ...(competitionId && originSlug
          ? { competitionId, competitionSlug: originSlug }
          : {}),
      } as any,
    },
  });

  const redirectUrl = `${getAppUrl()}/checkout/obrigado?order_nsu=${encodeURIComponent(orderNsu)}`;
  const webhookUrl = getInfinitepayWebhookUrl();

  try {
    const created = await infinitepayCreateCheckoutLink({
      orderNsu,
      redirectUrl,
      webhookUrl,
      items: [{ quantity: 1, price: planInfo.priceCents, description: plan.name }],
      customer: { name: user.name, email: user.email, phone_number: phoneNormalized },
    });

    if (!created.checkoutUrl) throw new Error("Sem URL de checkout");

    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        invoiceSlug: created.invoiceSlug ?? undefined,
        raw: { ...(tx.raw as any), infinitepay: created.raw } as any,
      },
    });

    return NextResponse.json({ checkoutUrl: created.checkoutUrl, orderNsu });
  } catch (e: any) {
    await prisma.paymentTransaction.update({
      where: { id: tx.id },
      data: { status: "REFUSED", raw: { ...(tx.raw as any), error: String(e?.message ?? e) } as any },
    });
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento" }, { status: 502 });
  }
}
