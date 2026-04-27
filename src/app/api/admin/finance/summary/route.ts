import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { hasValidFinanceAuthCookie } from "@/lib/finance/extra-auth";
import { getGoogleBillingMonthCostCents, getMaintenanceMonthlyCents } from "@/lib/finance/google-billing";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function parseDate(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!(await hasValidFinanceAuthCookie())) return NextResponse.json({ error: "Senha extra necessária" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));

  const createdAtWhere = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
  const approvedAtWhere = from || to ? { approvedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

  const [
    activeSubs,
    cancelledSubs,
    payingStudents,
    totalApproved,
    approvedCount,
    pendingCount,
    refusedCount,
    googleCost,
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: "APPROVED" } }),
    prisma.subscription.count({ where: { status: "CANCELLED" } }),
    prisma.studentProfile.count({ where: { planId: { not: null } } }),
    prisma.paymentTransaction.aggregate({
      where: { status: "APPROVED", ...approvedAtWhere },
      _sum: { paidAmountCents: true, amountCents: true },
    }),
    prisma.paymentTransaction.count({ where: { status: "APPROVED", ...createdAtWhere } }),
    prisma.paymentTransaction.count({ where: { status: "PENDING", ...createdAtWhere } }),
    prisma.paymentTransaction.count({ where: { status: "REFUSED", ...createdAtWhere } }),
    getGoogleBillingMonthCostCents(),
  ]);

  const revenueCents = totalApproved._sum.paidAmountCents ?? totalApproved._sum.amountCents ?? 0;
  const maintenanceCents = getMaintenanceMonthlyCents();
  const googleCostCents = googleCost.costCents ?? 0;
  const totalCostCents = googleCostCents + maintenanceCents;
  const netCents = revenueCents - totalCostCents;

  // Receita por mês (últimos 12 meses, independente do filtro, para visual)
  const monthly = await prisma.$queryRaw<Array<{ ym: string; revenue: bigint; qty: bigint }>>`
SELECT
  to_char(date_trunc('month', coalesce(pt."approvedAt", pt."createdAt")), 'YYYY-MM') AS ym,
  SUM(coalesce(pt."paidAmountCents", pt."amountCents"))::bigint AS revenue,
  COUNT(*)::bigint AS qty
FROM "payment_transactions" pt
WHERE pt."status" = 'APPROVED'
  AND coalesce(pt."approvedAt", pt."createdAt") >= (now() - interval '12 months')
GROUP BY 1
ORDER BY 1 ASC
`;

  // Transações (últimas 50)
  const txs = await prisma.paymentTransaction.findMany({
    where: { ...createdAtWhere },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      amountCents: true,
      paidAmountCents: true,
      captureMethod: true,
      installments: true,
      receiptUrl: true,
      orderNsu: true,
      invoiceSlug: true,
      transactionNsu: true,
      createdAt: true,
      approvedAt: true,
      raw: true,
    },
  });

  return NextResponse.json({
    kpis: {
      activeSubs,
      cancelledSubs,
      payingStudents,
      revenueCents,
      approvedCount,
      pendingCount,
      refusedCount,
      googleCostMonthCents: googleCost.costCents,
      maintenanceMonthCents: maintenanceCents,
      totalCostMonthCents: totalCostCents,
      netMonthCents: netCents,
      googleCostCurrency: googleCost.currency,
      googleCostLastUpdatedTime: googleCost.lastUpdatedTime,
    },
    monthly: monthly.map((m) => ({ ym: m.ym, revenueCents: Number(m.revenue ?? 0), qty: Number(m.qty ?? 0) })),
    transactions: txs.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      approvedAt: t.approvedAt ? t.approvedAt.toISOString() : null,
    })),
  });
}

