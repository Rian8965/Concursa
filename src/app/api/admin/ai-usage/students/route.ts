import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { LEGACY_DAILY_LIMIT, LEGACY_MONTHLY_LIMIT } from "@/lib/ai/ai-gate";

/** Lista todos os alunos com dados de consumo de IA — painel admin */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? "";
  const planFilter = url.searchParams.get("plan") ?? "";
  const alertFilter = url.searchParams.get("alert") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const perPage = 50;

  const where: any = {};
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }
  if (planFilter) {
    where.plan = { slug: planFilter };
  }

  const [profiles, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { aiEstimatedCostMonthBrl: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, slug: true, aiDailyLimit: true, aiMonthlyLimit: true } },
        aiCreditBalance: { select: { availableCredits: true, totalPurchasedCredits: true, totalUsedExtraCredits: true } },
      },
    }),
    prisma.studentProfile.count({ where }),
  ]);

  const now = new Date();

  const rows = profiles.map((p) => {
    const dailyLimit = p.aiDailyLimitOverride ?? p.plan?.aiDailyLimit ?? LEGACY_DAILY_LIMIT;
    const monthlyLimit = p.aiMonthlyLimitOverride ?? p.plan?.aiMonthlyLimit ?? LEGACY_MONTHLY_LIMIT;
    const today = now;

    const dailyNeedsReset =
      !p.aiLastDailyResetAt ||
      p.aiLastDailyResetAt.getUTCDate() !== today.getUTCDate() ||
      p.aiLastDailyResetAt.getUTCMonth() !== today.getUTCMonth() ||
      p.aiLastDailyResetAt.getUTCFullYear() !== today.getUTCFullYear();

    const monthlyNeedsReset =
      !p.aiLastMonthlyResetAt ||
      p.aiLastMonthlyResetAt.getUTCMonth() !== today.getUTCMonth() ||
      p.aiLastMonthlyResetAt.getUTCFullYear() !== today.getUTCFullYear();

    const correctionsToday = dailyNeedsReset ? 0 : p.aiCorrectionsToday;
    const correctionsMonth = monthlyNeedsReset ? 0 : p.aiCorrectionsMonth;

    const dailyPct = dailyLimit > 0 ? (correctionsToday / dailyLimit) * 100 : 0;
    const monthlyPct = monthlyLimit > 0 ? (correctionsMonth / monthlyLimit) * 100 : 0;

    const hasActiveSub = p.accessExpiresAt != null && p.accessExpiresAt > now;
    const extraCredits = p.aiCreditBalance?.availableCredits ?? 0;

    let alertStatus = "normal";
    if (p.aiBlockedManually) alertStatus = "blocked_manual";
    else if (correctionsToday >= dailyLimit || correctionsMonth >= monthlyLimit) {
      if (extraCredits > 0) alertStatus = "using_credits";
      else alertStatus = "blocked";
    } else if (dailyPct >= 90 || monthlyPct >= 90) alertStatus = "critical";
    else if (dailyPct >= 70 || monthlyPct >= 70) alertStatus = "warning";

    // Filtro de alerta
    if (alertFilter === "blocked" && alertStatus !== "blocked") return null;
    if (alertFilter === "warning" && !["warning", "critical", "blocked"].includes(alertStatus)) return null;
    if (alertFilter === "monthly_exhausted" && correctionsMonth < monthlyLimit) return null;
    if (alertFilter === "has_credits" && extraCredits === 0) return null;

    return {
      studentProfileId: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      plan: p.plan?.name ?? "Legado",
      planSlug: p.plan?.slug ?? "legacy",
      hasActiveSub,
      accessExpiresAt: p.accessExpiresAt?.toISOString() ?? null,
      correctionsToday,
      dailyLimit,
      dailyPct: Math.round(dailyPct),
      correctionsMonth,
      monthlyLimit,
      monthlyPct: Math.round(monthlyPct),
      extraCreditsAvailable: extraCredits,
      extraCreditsPurchased: p.aiCreditBalance?.totalPurchasedCredits ?? 0,
      extraCreditsUsed: p.aiCreditBalance?.totalUsedExtraCredits ?? 0,
      estimatedCostTodayBrl: p.aiEstimatedCostTodayBrl,
      estimatedCostMonthBrl: p.aiEstimatedCostMonthBrl,
      estimatedCostTotalBrl: p.aiEstimatedCostTotalBrl,
      lastUsageAt: p.aiLastUsageAt?.toISOString() ?? null,
      aiBlocked: p.aiBlockedManually,
      alertStatus,
    };
  }).filter(Boolean);

  return NextResponse.json({ rows, total, page, perPage, totalPages: Math.ceil(total / perPage) });
}
