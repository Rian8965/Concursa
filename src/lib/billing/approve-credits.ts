/**
 * approve-credits.ts
 * Processa aprovação de compra de pacote de créditos extras.
 * Chamado pelo webhook do InfinityPay após confirmação de pagamento.
 * É idempotente: se o orderNsu já foi processado, retorna alreadyApproved=true.
 */
import { prisma } from "@/lib/db/prisma";

export async function approveCreditsTransaction(input: {
  handle: string;
  orderNsu: string;
  invoiceSlug?: string | null;
  transactionNsu?: string | null;
  paymentCheckRaw?: unknown;
}) {
  // Buscar transação
  const tx =
    (await prisma.paymentTransaction.findUnique({
      where: { handle_orderNsu: { handle: input.handle, orderNsu: input.orderNsu } },
    })) ??
    (await prisma.paymentTransaction.findFirst({
      where: { orderNsu: input.orderNsu },
      orderBy: { createdAt: "desc" },
    }));

  if (!tx) throw new Error(`Transação não encontrada: ${input.orderNsu}`);

  // Idempotência: já aprovado
  if (tx.status === "APPROVED") {
    return { ok: true, alreadyApproved: true, txId: tx.id };
  }

  const raw = tx.raw as any;
  if (raw?.type !== "ai_credit_purchase") {
    throw new Error(`Transação ${input.orderNsu} não é do tipo ai_credit_purchase`);
  }

  const { studentProfileId, packageId, creditsAmount, packageName } = raw as {
    studentProfileId: string;
    packageId: string;
    creditsAmount: number;
    packageName: string;
  };

  if (!studentProfileId || !packageId || !creditsAmount) {
    throw new Error(`Metadados incompletos na transação ${input.orderNsu}`);
  }

  await prisma.$transaction(async (p) => {
    // Marcar transação como aprovada
    await p.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        handle: input.handle,
        invoiceSlug: input.invoiceSlug ?? tx.invoiceSlug ?? undefined,
        transactionNsu: input.transactionNsu ?? tx.transactionNsu ?? undefined,
        raw: { ...(tx.raw as any), payment_check: input.paymentCheckRaw ?? null } as any,
      },
    });

    // Buscar saldo atual
    const existing = await p.studentAiCreditBalance.findUnique({
      where: { studentProfileId },
    });

    const balanceBefore = existing?.availableCredits ?? 0;
    const balanceAfter = balanceBefore + creditsAmount;

    // Upsert do saldo
    await p.studentAiCreditBalance.upsert({
      where: { studentProfileId },
      update: {
        availableCredits: { increment: creditsAmount },
        totalPurchasedCredits: { increment: creditsAmount },
      },
      create: {
        studentProfileId,
        availableCredits: creditsAmount,
        totalPurchasedCredits: creditsAmount,
        totalUsedExtraCredits: 0,
      },
    });

    // Registrar transação de crédito
    await p.aiCreditTransaction.create({
      data: {
        studentProfileId,
        transactionType: "purchase",
        creditsAmount,
        balanceBefore,
        balanceAfter,
        relatedPaymentId: tx.id,
        packageId,
        description: `Compra do ${packageName}`,
      },
    });
  });

  return { ok: true, alreadyApproved: false, txId: tx.id, creditsAdded: creditsAmount };
}
