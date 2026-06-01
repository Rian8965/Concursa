import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import {
  getAppUrl,
  getInfinitepayWebhookUrl,
  infinitepayCreateCheckoutLink,
} from "@/lib/billing/infinitepay";

const bodySchema = z.object({
  packageSlug: z.string().min(1),
});

function makeOrderNsu(prefix = "CREDITS") {
  const rnd = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}_${Date.now()}_${rnd}`;
}

/**
 * Cria um link de pagamento único para compra de pacote de créditos extras.
 * O aluno precisa estar autenticado e ter assinatura ativa.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const userId = session.user.id;

  // Verificar perfil e assinatura ativa
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const now = new Date();
  const hasActiveSubscription = profile.accessExpiresAt != null && profile.accessExpiresAt > now;
  if (!hasActiveSubscription) {
    return NextResponse.json(
      { error: "É necessário ter uma assinatura ativa para comprar créditos extras." },
      { status: 403 },
    );
  }

  // Buscar o pacote
  const pkg = await prisma.aiCreditPackage.findUnique({
    where: { slug: parsed.data.packageSlug },
  });
  if (!pkg || !pkg.active) {
    return NextResponse.json({ error: "Pacote não encontrado ou indisponível" }, { status: 404 });
  }

  const orderNsu = makeOrderNsu("CRED");
  const priceCents = Math.round(pkg.priceBrl * 100);
  const redirectUrl = `${getAppUrl()}/creditos/obrigado?order_nsu=${encodeURIComponent(orderNsu)}`;
  const webhookUrl = getInfinitepayWebhookUrl();

  // Registrar transação pendente de crédito no banco como metadado no PaymentTransaction
  await prisma.paymentTransaction.create({
    data: {
      status: "PENDING",
      amountCents: priceCents,
      handle: process.env.INFINITEPAY_HANDLE ?? "missing",
      orderNsu,
      raw: {
        type: "ai_credit_purchase",
        userId,
        studentProfileId: profile.id,
        packageId: pkg.id,
        packageSlug: pkg.slug,
        packageName: pkg.name,
        creditsAmount: pkg.creditsAmount,
        customer: {
          name: profile.user.name,
          email: profile.user.email,
        },
      } as any,
    },
  });

  let checkoutUrl: string | null = null;
  try {
    const created = await infinitepayCreateCheckoutLink({
      orderNsu,
      redirectUrl,
      webhookUrl,
      items: [{ quantity: 1, price: priceCents, description: pkg.name }],
      customer: { name: profile.user.name, email: profile.user.email },
    });
    checkoutUrl = created.checkoutUrl;

    if (created.invoiceSlug) {
      await prisma.paymentTransaction.update({
        where: { handle_orderNsu: { handle: process.env.INFINITEPAY_HANDLE ?? "missing", orderNsu } },
        data: { invoiceSlug: created.invoiceSlug },
      });
    }
  } catch (e: any) {
    await prisma.paymentTransaction.updateMany({
      where: { orderNsu },
      data: { status: "REFUSED" },
    });
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento" }, { status: 502 });
  }

  if (!checkoutUrl) {
    await prisma.paymentTransaction.updateMany({
      where: { orderNsu },
      data: { status: "REFUSED" },
    });
    return NextResponse.json({ error: "Link de pagamento não gerado" }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl, orderNsu, package: { name: pkg.name, credits: pkg.creditsAmount, priceBrl: pkg.priceBrl } });
}
