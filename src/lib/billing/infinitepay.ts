import { z } from "zod";

// Docs oficiais (2026): https://www.infinitepay.io/checkout-documentacao
// Mantemos override via env para facilitar testes.
const INFINITEPAY_BASE = (process.env.INFINITEPAY_API_BASE ?? "https://api.checkout.infinitepay.io").replace(/\/+$/, "");

export const infinitepayCheckoutResponseSchema = z.object({
  url: z.string().url().optional(),
  checkout_url: z.string().url().optional(),
  invoice_slug: z.string().optional(),
  slug: z.string().optional(),
}).passthrough();

export const infinitepayPaymentCheckResponseSchema = z.object({
  success: z.boolean().optional(),
  paid: z.boolean().optional(),
  amount: z.number().optional(),
  paid_amount: z.number().optional(),
  installments: z.number().optional(),
  capture_method: z.string().optional(),
}).passthrough();

export function getInfinitepayHandle() {
  const h = (process.env.INFINITEPAY_HANDLE ?? "").trim();
  if (!h) throw new Error("INFINITEPAY_HANDLE não configurado");
  return h;
}

export function getInfinitepayWebhookUrl() {
  const u = (process.env.INFINITEPAY_WEBHOOK_URL ?? "").trim();
  if (u) return u;
  // Fallback seguro para DEV (evita 500 no localhost)
  if (process.env.NODE_ENV !== "production") return `${getAppUrl()}/api/webhooks/infinitepay`;
  throw new Error("INFINITEPAY_WEBHOOK_URL não configurado");
}

export function getAppUrl() {
  const u = (process.env.APP_URL ?? "").trim();
  if (u) return u.replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("APP_URL não configurado");
}

/** URL da landing page pública (domínio de vendas) */
export function getLandingUrl() {
  const u = (process.env.LANDING_URL ?? "").trim();
  if (u) return u.replace(/\/+$/, "");
  // Fallback fixo para produção — landing sempre no domínio raiz
  if (process.env.NODE_ENV === "production") return "https://descompliqueseuconcurso.com.br";
  return "http://localhost:3000";
}

/** Domínios permitidos para CORS (landing + app) */
export function getCorsOrigins(): string[] {
  const origins: string[] = [];
  const app = (process.env.APP_URL ?? "").trim();
  const landing = (process.env.LANDING_URL ?? "").trim();
  if (app) origins.push(app);
  // Fallback fixo para produção — landing sempre no domínio raiz
  origins.push(landing || "https://descompliqueseuconcurso.com.br");
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000", "http://localhost:5173");
  }
  return origins;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = getCorsOrigins();
  // Se a origem está na lista, usa ela; caso contrário, permite a landing page
  const use =
    origin && allowed.includes(origin)
      ? origin
      : allowed.find((o) => o.includes("descompliqueseuconcurso.com.br") && !o.includes("app.")) ?? "*";
  return {
    "Access-Control-Allow-Origin": use,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export async function infinitepayCreateCheckoutLink(input: {
  orderNsu: string;
  redirectUrl: string;
  webhookUrl: string;
  items: { quantity: number; price: number; description: string }[];
  customer?: { name?: string; email?: string; phone_number?: string };
}) {
  const body: any = {
    handle: getInfinitepayHandle(),
    order_nsu: input.orderNsu,
    redirect_url: input.redirectUrl,
    webhook_url: input.webhookUrl,
    items: input.items,
  };
  if (input.customer && (input.customer.email || input.customer.name || input.customer.phone_number)) {
    body.customer = input.customer;
  }

  const res = await fetch(`${INFINITEPAY_BASE}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error ?? (json as any)?.message ?? "Falha ao criar checkout InfinityPay";
    // Importante: não inclui segredos; apenas status e mensagem do provedor.
    throw new Error(`InfinityPay links ${res.status}: ${msg}`);
  }

  const parsed = infinitepayCheckoutResponseSchema.safeParse(json);
  if (!parsed.success) return { raw: json, checkoutUrl: null as string | null, invoiceSlug: null as string | null };

  const checkoutUrl = parsed.data.checkout_url ?? parsed.data.url ?? null;
  const invoiceSlug = parsed.data.invoice_slug ?? parsed.data.slug ?? null;
  return { raw: json, checkoutUrl, invoiceSlug };
}

export async function infinitepayPaymentCheck(input: {
  orderNsu?: string | null;
  transactionNsu?: string | null;
  slug?: string | null;
}) {
  const body: any = {
    handle: getInfinitepayHandle(),
  };
  if (input.orderNsu) body.order_nsu = input.orderNsu;
  if (input.transactionNsu) body.transaction_nsu = input.transactionNsu;
  if (input.slug) body.slug = input.slug;

  const res = await fetch(`${INFINITEPAY_BASE}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error ?? (json as any)?.message ?? "Falha ao checar pagamento InfinityPay";
    throw new Error(`InfinityPay payment_check ${res.status}: ${msg}`);
  }
  const parsed = infinitepayPaymentCheckResponseSchema.safeParse(json);
  return { raw: json, paid: parsed.success ? !!parsed.data.paid : false };
}

