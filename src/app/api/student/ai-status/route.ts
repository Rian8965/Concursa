import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { LEGACY_DAILY_LIMIT, LEGACY_MONTHLY_LIMIT } from "@/lib/ai/ai-gate";

/** Retorna o status de uso de IA do aluno autenticado */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      plan: { select: { id: true, name: true, slug: true, aiDailyLimit: true, aiMonthlyLimit: true, aiResponseCharLimit: true, priceCents: true } },
      aiCreditBalance: { select: { availableCredits: true, totalPurchasedCredits: true, totalUsedExtraCredits: true } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const now = new Date();
  const hasActiveSubscription = profile.accessExpiresAt != null && profile.accessExpiresAt > now;

  const dailyLimit = profile.aiDailyLimitOverride ?? profile.plan?.aiDailyLimit ?? LEGACY_DAILY_LIMIT;
  const monthlyLimit = profile.aiMonthlyLimitOverride ?? profile.plan?.aiMonthlyLimit ?? LEGACY_MONTHLY_LIMIT;
  const charLimit = profile.plan?.aiResponseCharLimit ?? 900;

  // Verificar se precisa resetar diário/mensal para exibição correta
  const today = now;
  const lastDaily = profile.aiLastDailyResetAt;
  const dailyNeedsReset =
    !lastDaily ||
    lastDaily.getUTCDate() !== today.getUTCDate() ||
    lastDaily.getUTCMonth() !== today.getUTCMonth() ||
    lastDaily.getUTCFullYear() !== today.getUTCFullYear();

  const lastMonthly = profile.aiLastMonthlyResetAt;
  const monthlyNeedsReset =
    !lastMonthly ||
    lastMonthly.getUTCMonth() !== today.getUTCMonth() ||
    lastMonthly.getUTCFullYear() !== today.getUTCFullYear();

  const correctionsToday = dailyNeedsReset ? 0 : profile.aiCorrectionsToday;
  const correctionsMonth = monthlyNeedsReset ? 0 : profile.aiCorrectionsMonth;

  const extraCredits = profile.aiCreditBalance?.availableCredits ?? 0;
  const monthlyExhausted = correctionsMonth >= monthlyLimit;

  return NextResponse.json({
    hasActiveSubscription,
    plan: profile.plan
      ? {
          id: profile.plan.id,
          name: profile.plan.name,
          slug: profile.plan.slug,
          priceCents: profile.plan.priceCents,
          aiDailyLimit: dailyLimit,
          aiMonthlyLimit: monthlyLimit,
          aiResponseCharLimit: charLimit,
        }
      : null,
    accessExpiresAt: profile.accessExpiresAt?.toISOString() ?? null,
    usage: {
      correctionsToday,
      dailyLimit,
      dailyPercent: dailyLimit > 0 ? Math.min(100, Math.round((correctionsToday / dailyLimit) * 100)) : 0,
      correctionsMonth,
      monthlyLimit,
      monthlyPercent: monthlyLimit > 0 ? Math.min(100, Math.round((correctionsMonth / monthlyLimit) * 100)) : 0,
      monthlyExhausted,
      estimatedCostTodayBrl: profile.aiEstimatedCostTodayBrl,
      estimatedCostMonthBrl: profile.aiEstimatedCostMonthBrl,
      lastUsageAt: profile.aiLastUsageAt?.toISOString() ?? null,
    },
    extraCredits: {
      available: extraCredits,
      totalPurchased: profile.aiCreditBalance?.totalPurchasedCredits ?? 0,
      totalUsed: profile.aiCreditBalance?.totalUsedExtraCredits ?? 0,
    },
    aiBlocked: profile.aiBlockedManually,
  });
}
