import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { infinitepayPaymentCheck } from "@/lib/billing/infinitepay";
import { approvePaidTransaction } from "@/lib/billing/approve";

function requireCronSecret(req: NextRequest) {
  const expected = (process.env.BILLING_CRON_SECRET ?? "").trim();
  if (!expected) throw new Error("BILLING_CRON_SECRET não configurado");
  const got = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!got || got !== expected) throw new Error("Segredo inválido");
}

export async function GET(req: NextRequest) {
  // Cloud Scheduler às vezes fica em GET por padrão; suportamos ambos.
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    requireCronSecret(req);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 401 });
  }

  const handle = (process.env.INFINITEPAY_HANDLE ?? "").trim();
  if (!handle) return NextResponse.json({ error: "INFINITEPAY_HANDLE não configurado" }, { status: 500 });

  // pega pendentes recentes (últimas 48h) para evitar varrer histórico todo
  const pending = await prisma.paymentTransaction.findMany({
    where: {
      handle,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      orderNsu: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, orderNsu: true, invoiceSlug: true, transactionNsu: true },
  });

  let checked = 0;
  let approved = 0;
  const errors: Array<{ orderNsu: string; message: string }> = [];

  for (const p of pending) {
    const orderNsu = (p.orderNsu ?? "").trim();
    if (!orderNsu) continue;
    checked++;
    try {
      const check = await infinitepayPaymentCheck({
        orderNsu,
        slug: p.invoiceSlug ?? null,
        transactionNsu: p.transactionNsu ?? null,
      });
      if (!check.paid) continue;
      await approvePaidTransaction({
        handle,
        orderNsu,
        invoiceSlug: p.invoiceSlug ?? null,
        transactionNsu: p.transactionNsu ?? null,
        paymentCheckRaw: check.raw,
      });
      approved++;
    } catch (e: any) {
      errors.push({ orderNsu, message: String(e?.message ?? e) });
    }
  }

  return NextResponse.json({ ok: true, checked, approved, errors });
}

