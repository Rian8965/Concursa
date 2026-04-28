import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { ensurePlanoCompleto, PLAN_COMPLETO } from "@/lib/billing/plan";
import { sendFirstAccessEmail } from "@/lib/email/first-access";
import { sendRenewalEmail } from "@/lib/email/renewal";
import { getAppUrl } from "@/lib/billing/infinitepay";
import { createAdminNotification } from "@/lib/admin/notifications";

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
  if (existing?.studentProfile) return { user: existing, profile: existing.studentProfile, createdNew: false as const };

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
  // Flags do fluxo de pagamento (feito separado para evitar inconsistência de tipos em alguns ambientes)
  await prisma.studentProfile.update({
    where: { id: user.studentProfile!.id },
    data: { createdByPayment: true, needsOnboarding: true } as any,
  });

  void createAdminNotification({
    type: "PAYMENT_STUDENT_CREATED",
    title: "Novo aluno criado por pagamento",
    body: `${user.name} · ${user.email}`,
    href: "/admin/alunos",
    meta: { userId: user.id, studentProfileId: user.studentProfile?.id ?? null },
  });

  return { user, profile: user.studentProfile!, createdNew: true as const };
}

export async function approvePaidTransaction(input: {
  handle: string;
  orderNsu: string;
  invoiceSlug?: string | null;
  transactionNsu?: string | null;
  paymentCheckRaw?: unknown;
}) {
  const plan = await ensurePlanoCompleto();
  const durationDays = plan.durationDays ?? 30;

  // Garante TX sem perder `raw.customer` (e-mail/nome) que veio do checkout.
  // Importante: em produção pode existir divergência de handle (ex.: "missing") por env errada antiga.
  // Então tentamos:
  // 1) handle+orderNsu (padrão)
  // 2) qualquer tx com o mesmo orderNsu (fallback)
  const existingTx =
    (await prisma.paymentTransaction.findUnique({
      where: { handle_orderNsu: { handle: input.handle, orderNsu: input.orderNsu } },
    })) ??
    (await prisma.paymentTransaction.findFirst({
      where: { orderNsu: input.orderNsu },
      orderBy: { createdAt: "desc" },
    }));

  const tx = existingTx
    ? await prisma.paymentTransaction.update({
        where: { id: existingTx.id },
        data: {
          // normaliza o handle para o do ambiente atual (se possível)
          handle: input.handle,
          invoiceSlug: input.invoiceSlug ?? existingTx.invoiceSlug ?? undefined,
          transactionNsu: input.transactionNsu ?? existingTx.transactionNsu ?? undefined,
          raw: {
            ...(existingTx.raw as any),
            ...(input.paymentCheckRaw ? { payment_check: input.paymentCheckRaw } : {}),
          } as any,
        },
      })
    : await prisma.paymentTransaction.create({
        data: {
          status: "PENDING",
          amountCents: PLAN_COMPLETO.priceCents,
          handle: input.handle,
          orderNsu: input.orderNsu,
          invoiceSlug: input.invoiceSlug ?? undefined,
          transactionNsu: input.transactionNsu ?? undefined,
          raw: { payment_check: input.paymentCheckRaw ?? null } as any,
        },
      });

  if (tx.status === "APPROVED") {
    return { ok: true, alreadyApproved: true, txId: tx.id };
  }

  const { user, profile, createdNew } = await ensureStudentFromTransaction(tx as any);
  const userId = user.id;
  let createdToken: string | null = null;
  let renewedUntil: Date | null = null;

  await prisma.$transaction(async (p) => {
    await p.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        amountCents: PLAN_COMPLETO.priceCents,
        invoiceSlug: input.invoiceSlug ?? tx.invoiceSlug ?? undefined,
        transactionNsu: input.transactionNsu ?? tx.transactionNsu ?? undefined,
        raw: { ...(tx.raw as any), ...(input.paymentCheckRaw ? { payment_check: input.paymentCheckRaw } : {}) } as any,
      },
    });

    // Calcula novo vencimento: se já existe um vencimento no futuro, soma a partir dele.
    const current = await p.studentProfile.findUnique({
      where: { id: profile.id },
      select: { accessExpiresAt: true },
    });
    const base = current?.accessExpiresAt && current.accessExpiresAt.getTime() > Date.now()
      ? current.accessExpiresAt
      : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + durationDays);
    renewedUntil = newEnd;

    await p.studentProfile.update({
      where: { id: profile.id },
      data: {
        planId: plan.id,
        accessExpiresAt: newEnd,
      },
    });

    // Upsert de assinatura: mantém uma assinatura APPROVED e atualiza período.
    const existingSub = await p.subscription.findFirst({
      where: { studentProfileId: profile.id, planId: plan.id },
      orderBy: { currentPeriodEnd: "desc" },
      select: { id: true, startedAt: true },
    });
    if (existingSub) {
      await p.subscription.update({
        where: { id: existingSub.id },
        data: {
          status: "APPROVED",
          cancelledAt: null,
          startedAt: existingSub.startedAt ?? new Date(),
          currentPeriodEnd: newEnd,
          transactions: { connect: { id: tx.id } },
        },
      });
    } else {
      await p.subscription.create({
        data: {
          studentProfileId: profile.id,
          planId: plan.id,
          status: "APPROVED",
          startedAt: new Date(),
          currentPeriodEnd: newEnd,
          transactions: { connect: { id: tx.id } },
        },
      });
    }

    // Token de primeiro acesso só para conta criada agora
    if (createdNew) {
      const token = randomToken();
      await p.firstAccessToken.create({
        data: {
          userId,
          token,
          expiresAt: nowPlusDays(7),
        },
      });
      createdToken = token;
    }
  });

  const firstAccessUrl = createdToken
    ? `${getAppUrl()}/primeiro-acesso?token=${encodeURIComponent(createdToken)}`
    : null;

  try {
    if (createdToken) {
      await sendFirstAccessEmail({
        to: user.email,
        name: user.name,
        token: createdToken,
        planName: plan.name,
        accessUntil: renewedUntil ?? nowPlusDays(durationDays),
        orderNsu: tx.orderNsu ?? null,
      });
    } else if (renewedUntil) {
      await sendRenewalEmail({
        to: user.email,
        name: user.name,
        accessUntil: renewedUntil,
      });
    }
  } catch (e: any) {
    console.error("[email.first-access] falha ao enviar", { to: user.email, message: String(e?.message ?? e) });
  }

  return {
    ok: true,
    alreadyApproved: false,
    txId: tx.id,
    firstAccessUrl,
    // Para UI/confirm: renovação não exige senha.
    isFirstAccess: Boolean(createdToken),
    renewedUntil: renewedUntil ? (renewedUntil as any).toISOString() : null,
  };
}

