import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LEGACY_DAILY_LIMIT, LEGACY_MONTHLY_LIMIT } from "@/lib/ai/ai-gate";

/** Detalhe do consumo de IA de um aluno específico — admin */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id: studentProfileId } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: {
      user: { select: { name: true, email: true, createdAt: true } },
      plan: true,
      aiCreditBalance: true,
      aiCreditTransactions: { orderBy: { createdAt: "desc" }, take: 50 },
      aiUsageLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { question: { select: { id: true, code: true, content: true } } },
      },
    },
  });

  if (!profile) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });

  const now = new Date();
  const dailyLimit = profile.aiDailyLimitOverride ?? profile.plan?.aiDailyLimit ?? LEGACY_DAILY_LIMIT;
  const monthlyLimit = profile.aiMonthlyLimitOverride ?? profile.plan?.aiMonthlyLimit ?? LEGACY_MONTHLY_LIMIT;

  const hasActiveSub = profile.accessExpiresAt != null && profile.accessExpiresAt > now;

  return NextResponse.json({
    studentProfileId: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    memberSince: profile.user.createdAt.toISOString(),
    plan: profile.plan
      ? {
          id: profile.plan.id,
          name: profile.plan.name,
          slug: profile.plan.slug,
          priceCents: profile.plan.priceCents,
          aiDailyLimit: dailyLimit,
          aiMonthlyLimit: monthlyLimit,
          aiResponseCharLimit: profile.plan.aiResponseCharLimit,
        }
      : null,
    hasActiveSub,
    accessExpiresAt: profile.accessExpiresAt?.toISOString() ?? null,
    aiBlocked: profile.aiBlockedManually,
    usage: {
      correctionsToday: profile.aiCorrectionsToday,
      dailyLimit,
      correctionsMonth: profile.aiCorrectionsMonth,
      monthlyLimit,
      estimatedCostTodayBrl: profile.aiEstimatedCostTodayBrl,
      estimatedCostMonthBrl: profile.aiEstimatedCostMonthBrl,
      estimatedCostTotalBrl: profile.aiEstimatedCostTotalBrl,
      lastUsageAt: profile.aiLastUsageAt?.toISOString() ?? null,
    },
    extraCredits: {
      available: profile.aiCreditBalance?.availableCredits ?? 0,
      totalPurchased: profile.aiCreditBalance?.totalPurchasedCredits ?? 0,
      totalUsed: profile.aiCreditBalance?.totalUsedExtraCredits ?? 0,
    },
    creditTransactions: profile.aiCreditTransactions.map((t) => ({
      id: t.id,
      type: t.transactionType,
      credits: t.creditsAmount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
    usageLogs: profile.aiUsageLogs.map((l) => ({
      id: l.id,
      questionId: l.questionId,
      questionCode: l.question?.code ?? null,
      questionPreview: l.question?.content?.slice(0, 120) ?? null,
      source: l.usageSource,
      model: l.model,
      inputTokens: l.inputTokens,
      outputTokens: l.outputTokens,
      costBrl: l.estimatedCostBrl,
      status: l.status,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

/** Ações administrativas: ajuste de limites, créditos, bloqueio */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id: studentProfileId } = await params;
  const body = await req.json().catch(() => ({}));

  const actionSchema = z.object({
    action: z.enum([
      "block_ai",
      "unblock_ai",
      "adjust_daily_limit",
      "adjust_monthly_limit",
      "add_extra_credits",
      "remove_extra_credits",
      "reset_daily_usage",
      "reset_monthly_usage",
    ]),
    value: z.number().optional(),
    reason: z.string().optional(),
  });

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { action, value, reason } = parsed.data;

  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: {
      id: true,
      userId: true,
      aiBlockedManually: true,
      aiDailyLimitOverride: true,
      aiMonthlyLimitOverride: true,
      aiCorrectionsToday: true,
      aiCorrectionsMonth: true,
      aiCreditBalance: { select: { availableCredits: true } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });

  let updateData: any = {};
  let previousValue: any;
  let newValue: any;

  switch (action) {
    case "block_ai":
      previousValue = { aiBlockedManually: profile.aiBlockedManually };
      newValue = { aiBlockedManually: true };
      updateData = { aiBlockedManually: true };
      break;

    case "unblock_ai":
      previousValue = { aiBlockedManually: profile.aiBlockedManually };
      newValue = { aiBlockedManually: false };
      updateData = { aiBlockedManually: false };
      break;

    case "adjust_daily_limit":
      if (value == null || value < 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
      previousValue = { aiDailyLimitOverride: profile.aiDailyLimitOverride };
      newValue = { aiDailyLimitOverride: value === 0 ? null : value };
      updateData = { aiDailyLimitOverride: value === 0 ? null : value };
      break;

    case "adjust_monthly_limit":
      if (value == null || value < 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
      previousValue = { aiMonthlyLimitOverride: profile.aiMonthlyLimitOverride };
      newValue = { aiMonthlyLimitOverride: value === 0 ? null : value };
      updateData = { aiMonthlyLimitOverride: value === 0 ? null : value };
      break;

    case "reset_daily_usage":
      previousValue = { aiCorrectionsToday: profile.aiCorrectionsToday };
      newValue = { aiCorrectionsToday: 0 };
      updateData = { aiCorrectionsToday: 0, aiLastDailyResetAt: new Date() };
      break;

    case "reset_monthly_usage":
      previousValue = { aiCorrectionsMonth: profile.aiCorrectionsMonth };
      newValue = { aiCorrectionsMonth: 0 };
      updateData = { aiCorrectionsMonth: 0, aiLastMonthlyResetAt: new Date() };
      break;

    case "add_extra_credits":
    case "remove_extra_credits": {
      if (value == null || value <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
      const current = profile.aiCreditBalance?.availableCredits ?? 0;
      const delta = action === "add_extra_credits" ? value : -value;
      const newBalance = Math.max(0, current + delta);

      await prisma.$transaction(async (p) => {
        await p.studentAiCreditBalance.upsert({
          where: { studentProfileId },
          update: { availableCredits: newBalance },
          create: { studentProfileId, availableCredits: newBalance, totalPurchasedCredits: 0, totalUsedExtraCredits: 0 },
        });

        await p.aiCreditTransaction.create({
          data: {
            studentProfileId,
            transactionType: "manual_adjustment",
            creditsAmount: delta,
            balanceBefore: current,
            balanceAfter: newBalance,
            description: `Ajuste manual pelo admin: ${reason ?? "sem motivo informado"}`,
          },
        });

        await p.adminActionLog.create({
          data: {
            adminUserId: session.user.id,
            targetUserId: profile.userId,
            actionType: action,
            previousValue: { credits: current },
            newValue: { credits: newBalance },
            reason: reason ?? null,
          },
        });
      });

      return NextResponse.json({ ok: true, action, newBalance });
    }

    default:
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  }

  await prisma.$transaction(async (p) => {
    await p.studentProfile.update({ where: { id: studentProfileId }, data: updateData });
    await p.adminActionLog.create({
      data: {
        adminUserId: session.user.id,
        targetUserId: profile.userId,
        actionType: action,
        previousValue,
        newValue,
        reason: reason ?? null,
      },
    });
  });

  return NextResponse.json({ ok: true, action });
}
