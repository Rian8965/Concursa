import { google } from "googleapis";

function reqEnv(name: string) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não configurado`);
  return v;
}

function moneyToCents(m?: { units?: string | number | null; nanos?: number | null; currencyCode?: string | null } | null) {
  const units = m?.units == null ? 0 : Number(m.units);
  const nanos = m?.nanos == null ? 0 : Number(m.nanos);
  const total = units + nanos / 1e9;
  return Math.round(total * 100);
}

export async function getGoogleBillingMonthCostCents(): Promise<{
  costCents: number | null;
  currency: string | null;
  lastUpdatedTime: string | null;
  source: "budget" | "not_configured" | "error";
}> {
  const billingAccountId = (process.env.GOOGLE_BILLING_ACCOUNT_ID ?? "").trim();
  const budgetId = (process.env.GOOGLE_BILLING_BUDGET_ID ?? "").trim();
  if (!billingAccountId || !budgetId) {
    return { costCents: null, currency: null, lastUpdatedTime: null, source: "not_configured" };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-billing.readonly"],
    });
    const client = await auth.getClient();
    const billingbudgets = google.billingbudgets({ version: "v1", auth: client as any });

    const name = `billingAccounts/${billingAccountId}/budgets/${budgetId}`;
    const res = await billingbudgets.billingAccounts.budgets.get({ name });
    const b: any = res.data;

    const spend = b?.calculatedSpend ?? b?.calculated_spend ?? null;
    const amount = spend?.amount ?? spend?.amounts ?? spend ?? null;
    const currency = amount?.currencyCode ?? spend?.currencyCode ?? null;
    const costCents = moneyToCents(amount);
    const lastUpdatedTime = b?.lastUpdatedTime ?? spend?.lastUpdatedTime ?? null;

    return { costCents, currency, lastUpdatedTime, source: "budget" };
  } catch {
    return { costCents: null, currency: null, lastUpdatedTime: null, source: "error" };
  }
}

export function getMaintenanceMonthlyCents() {
  const raw = (process.env.FINANCE_MAINTENANCE_MONTHLY_CENTS ?? "11000").trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 11000;
}

