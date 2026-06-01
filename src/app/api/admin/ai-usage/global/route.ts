import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Resumo global do consumo de IA — painel admin */
export async function GET() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const [globalConfig, todayLogs, monthLogs, studentsWithUsageToday, studentsWithUsageMonth] =
    await Promise.all([
      prisma.aiGlobalConfig.findFirst(),
      prisma.aiUsageLog.aggregate({
        _sum: { estimatedCostBrl: true },
        _count: { id: true },
        where: { createdAt: { gte: startOfToday }, status: "success" },
      }),
      prisma.aiUsageLog.aggregate({
        _sum: { estimatedCostBrl: true },
        _count: { id: true },
        where: { createdAt: { gte: startOfMonth }, status: "success" },
      }),
      prisma.aiUsageLog.groupBy({
        by: ["studentProfileId"],
        where: { createdAt: { gte: startOfToday }, status: "success" },
        _count: { id: true },
      }).then((r) => r.length),
      prisma.aiUsageLog.groupBy({
        by: ["studentProfileId"],
        where: { createdAt: { gte: startOfMonth }, status: "success" },
        _count: { id: true },
      }).then((r) => r.length),
    ]);

  // Top 10 alunos hoje
  const top10Today = await prisma.aiUsageLog.groupBy({
    by: ["studentProfileId"],
    where: { createdAt: { gte: startOfToday }, status: "success" },
    _count: { id: true },
    _sum: { estimatedCostBrl: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const top10TodayWithNames = await Promise.all(
    top10Today.map(async (row) => {
      const profile = await prisma.studentProfile.findUnique({
        where: { id: row.studentProfileId },
        include: { user: { select: { name: true, email: true } } },
      });
      return {
        studentProfileId: row.studentProfileId,
        name: profile?.user.name ?? "—",
        email: profile?.user.email ?? "—",
        corrections: row._count.id,
        costBrl: row._sum.estimatedCostBrl ?? 0,
      };
    }),
  );

  // Top 10 alunos no mês
  const top10Month = await prisma.aiUsageLog.groupBy({
    by: ["studentProfileId"],
    where: { createdAt: { gte: startOfMonth }, status: "success" },
    _count: { id: true },
    _sum: { estimatedCostBrl: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const top10MonthWithNames = await Promise.all(
    top10Month.map(async (row) => {
      const profile = await prisma.studentProfile.findUnique({
        where: { id: row.studentProfileId },
        include: { user: { select: { name: true, email: true } } },
      });
      return {
        studentProfileId: row.studentProfileId,
        name: profile?.user.name ?? "—",
        email: profile?.user.email ?? "—",
        corrections: row._count.id,
        costBrl: row._sum.estimatedCostBrl ?? 0,
      };
    }),
  );

  // Receita com créditos extras
  const creditRevenue = await prisma.aiCreditTransaction.aggregate({
    _sum: {},
    where: { transactionType: "purchase", createdAt: { gte: startOfMonth } },
  });
  const creditRevenueToday = await prisma.aiCreditTransaction.findMany({
    where: { transactionType: "purchase", createdAt: { gte: startOfToday } },
    include: { package: { select: { priceBrl: true } } },
  });
  const revenueTodayBrl = creditRevenueToday.reduce((acc, t) => acc + (t.package?.priceBrl ?? 0), 0);

  const creditRevenueMonth = await prisma.aiCreditTransaction.findMany({
    where: { transactionType: "purchase", createdAt: { gte: startOfMonth } },
    include: { package: { select: { priceBrl: true } } },
  });
  const revenueMonthBrl = creditRevenueMonth.reduce((acc, t) => acc + (t.package?.priceBrl ?? 0), 0);

  return NextResponse.json({
    aiEnabled: globalConfig?.aiEnabled ?? true,
    manualBlockUntil: globalConfig?.manualBlockUntil?.toISOString() ?? null,
    today: {
      totalCostBrl: todayLogs._sum.estimatedCostBrl ?? 0,
      totalCalls: todayLogs._count.id ?? 0,
      activeStudents: studentsWithUsageToday,
      creditRevenueBrl: revenueTodayBrl,
    },
    month: {
      totalCostBrl: monthLogs._sum.estimatedCostBrl ?? 0,
      totalCalls: monthLogs._count.id ?? 0,
      activeStudents: studentsWithUsageMonth,
      creditRevenueBrl: revenueMonthBrl,
    },
    globalLimits: {
      dailyCostLimitBrl: globalConfig?.globalDailyCostLimitBrl ?? 80,
      dailyCostUsedBrl: globalConfig?.globalDailyCostUsedBrl ?? 0,
      dailyCallLimit: globalConfig?.globalDailyCallLimit ?? 5000,
      dailyCallsUsed: globalConfig?.globalDailyCallsUsed ?? 0,
    },
    top10Today: top10TodayWithNames,
    top10Month: top10MonthWithNames,
  });
}

/** Pausar/liberar IA ou atualizar configurações globais */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, value } = body as { action?: string; value?: unknown };

  const config = await prisma.aiGlobalConfig.findFirst();
  if (!config) return NextResponse.json({ error: "Configuração não encontrada" }, { status: 404 });

  if (action === "pause_ai") {
    const until = value ? new Date(value as string) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.aiGlobalConfig.update({
      where: { id: config.id },
      data: { aiEnabled: false, manualBlockUntil: until, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, aiEnabled: false });
  }

  if (action === "resume_ai") {
    await prisma.aiGlobalConfig.update({
      where: { id: config.id },
      data: { aiEnabled: true, manualBlockUntil: null, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, aiEnabled: true });
  }

  if (action === "update_exchange_rate") {
    const rate = parseFloat(String(value));
    if (isNaN(rate) || rate <= 0) return NextResponse.json({ error: "Taxa inválida" }, { status: 400 });
    await prisma.aiGlobalConfig.update({
      where: { id: config.id },
      data: { exchangeRateUsdBrl: rate, exchangeRateUpdatedAt: new Date(), updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, exchangeRateUsdBrl: rate });
  }

  return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
}
