import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { ensurePlanoCompleto, PLAN_COMPLETO } from "@/lib/billing/plan";
import { sendFirstAccessEmail } from "@/lib/email/first-access";
import { getAppUrl } from "@/lib/billing/infinitepay";

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

export async function approvePaidTransaction(input: {
  handle: string;
  orderNsu: string;
  invoiceSlug?: string | null;
  transactionNsu?: string | null;
  paymentCheckRaw?: unknown;
}) {
  const plan = await ensurePlanoCompleto();
  const periodEnd = nowPlusDays(plan.durationDays ?? 30);

  // Garante TX
  const tx = await prisma.paymentTransaction.upsert({
    where: { handle_orderNsu: { handle: input.handle, orderNsu: input.orderNsu } },
    create: {
      status: "PENDING",
      amountCents: PLAN_COMPLETO.priceCents,
      handle: input.handle,
      orderNsu: input.orderNsu,
      invoiceSlug: input.invoiceSlug ?? undefined,
      transactionNsu: input.transactionNsu ?? undefined,
      raw: { payment_check: input.paymentCheckRaw ?? null } as any,
    },
    update: {
      invoiceSlug: input.invoiceSlug ?? undefined,
      transactionNsu: input.transactionNsu ?? undefined,
      raw: { ...(input.paymentCheckRaw ? { payment_check: input.paymentCheckRaw } : {}) } as any,
    },
  });

  if (tx.status === "APPROVED") {
    return { ok: true, alreadyApproved: true, txId: tx.id };
  }

  const { user, profile } = await ensureStudentFromTransaction(tx as any);
  let createdToken: string | null = null;

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

    await p.studentProfile.update({
      where: { id: profile.id },
      data: {
        planId: plan.id,
        accessExpiresAt: periodEnd,
      },
    });

    // evita duplicar assinatura se webhook/confirm rodarem juntos
    const existingSub = await p.subscription.findFirst({
      where: { studentProfileId: profile.id, planId: plan.id, status: "APPROVED" },
      select: { id: true },
    });
    if (!existingSub) {
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
    }

    const token = randomToken();
    await p.firstAccessToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: nowPlusDays(7),
      },
    });
    createdToken = token;
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
        accessUntil: periodEnd,
        orderNsu: tx.orderNsu ?? null,
      });
    }
  } catch (e: any) {
    console.error("[email.first-access] falha ao enviar", { to: user.email, message: String(e?.message ?? e) });
  }

  return { ok: true, alreadyApproved: false, txId: tx.id, firstAccessUrl };
}

