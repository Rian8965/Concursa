"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const PLANS = [
  {
    slug: "avancado" as const,
    name: "Avançado",
    price: "R$ 39,90",
    priceCents: 3990,
    badge: "Melhor custo-benefício",
    badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    accentColor: "#9d4edd",
    features: [
      "Até 20 correções com IA por dia",
      "Até 500 correções com IA por mês",
      "Explicações simples e objetivas da IA",
      "Treinos ilimitados por matéria",
      "Simulados completos com cronômetro",
      "Quiz do edital inteligente",
      "Relatórios de desempenho",
      "Apostilas e revisão de erros",
    ],
  },
  {
    slug: "premium" as const,
    name: "Premium",
    price: "R$ 69,90",
    priceCents: 6990,
    badge: "Para quem estuda pesado",
    badgeClass: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    accentColor: "#f59e0b",
    features: [
      "Até 50 correções com IA por dia",
      "Até 1.200 correções com IA por mês",
      "Explicações mais completas da IA",
      "Treinos ilimitados por matéria",
      "Simulados completos com cronômetro",
      "Quiz do edital inteligente",
      "Relatórios de desempenho",
      "Apostilas e revisão de erros",
    ],
  },
] as const;

function normalizeCheckoutUrl(url: string) {
  const u = url.trim();
  if (u.startsWith("http://")) return `https://${u.slice("http://".length)}`;
  return u;
}

function formatWhatsApp(v: string) {
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function AssinarContent() {
  const params = useSearchParams();
  const planoParam = params.get("plano") as "avancado" | "premium" | null;
  const plan = PLANS.find((p) => p.slug === planoParam) ?? PLANS[0];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome completo"); return; }
    if (!email.trim() || !email.includes("@")) { toast.error("Informe um e-mail válido"); return; }

    setCheckoutUrl(null);
    setLoading(true);
    const res = await fetch("/api/billing/infinitepay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: whatsapp.trim() || undefined,
        planSlug: plan.slug,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error((data as any)?.error ?? "Não foi possível iniciar o pagamento");
      return;
    }

    const url = (data as any)?.checkoutUrl as string | undefined;
    if (!url) { toast.error("Link de pagamento não retornou"); return; }
    const normalized = normalizeCheckoutUrl(url);
    setCheckoutUrl(normalized);
    window.location.assign(normalized);
  }

  const isPremium = plan.slug === "premium";

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#020617]">
      {/* Fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: isPremium
              ? "radial-gradient(1200px 600px at 20% 10%,rgba(245,158,11,0.20),transparent 60%), radial-gradient(900px 500px at 80% 30%,rgba(245,158,11,0.12),transparent 55%)"
              : "radial-gradient(1200px 600px at 20% 10%,rgba(157,77,221,0.35),transparent 60%), radial-gradient(900px 500px at 80% 30%,rgba(168,85,247,0.22),transparent 55%)",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.85),rgba(2,6,23,0.92))]" />
        <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="mx-auto max-w-5xl px-6 py-14">
        {/* Header */}
        <div className="mb-10 text-center">
          <a href="https://descompliqueseuconcurso.com.br" className="inline-block mb-6">
            <span className="text-xl font-black text-white tracking-tight">
              Descomplique seu <span style={{ color: "#9d4edd" }}>Concurso</span>
            </span>
          </a>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/50 mb-2">Assinar plano</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Plano <span style={{ color: plan.accentColor }}>{plan.name}</span>
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Não é o plano certo?{" "}
            <a
              href="/assinar?plano=avancado"
              className="underline text-white/70 hover:text-white transition-colors"
            >
              {isPremium ? "Ver Avançado (R$ 39,90)" : "Ver Premium (R$ 69,90)"}
            </a>
          </p>
        </div>

        {/* Layout: Plano + Formulário */}
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">

          {/* Card do plano */}
          <div
            className="rounded-3xl p-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${plan.accentColor}40`,
              boxShadow: `0 0 60px ${plan.accentColor}15`,
            }}
          >
            {/* Badge */}
            <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${plan.badgeClass}`}>
              {plan.badge}
            </span>

            {/* Preço */}
            <div className="mt-5 flex items-end gap-1">
              <span className="text-lg text-white/40 font-light mb-1">R$</span>
              <span className="text-6xl font-extrabold tracking-tighter text-white leading-none">
                {plan.price.replace("R$ ", "").replace(",", ".")}
              </span>
              <span className="text-base text-white/40 font-light mb-1">/mês</span>
            </div>
            <p className="mt-1 text-xs text-white/40">Cobrança mensal · Cancele quando quiser</p>

            {/* Divisor */}
            <div className="my-6 h-px bg-white/[0.07]" />

            {/* Features */}
            <ul className="space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    style={{ color: plan.accentColor }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-white/80 leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            {/* Rodapé do card */}
            <div className="mt-8 rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
              <p className="text-xs text-white/50 leading-relaxed">
                💡 Precisa de mais correções?{" "}
                <span className="text-white/70 font-medium">Créditos extras disponíveis</span>{" "}
                para compra após assinar, a partir de R$ 5,00.
              </p>
            </div>
          </div>

          {/* Formulário */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 backdrop-blur-xl">
            <p className="text-base font-bold text-white">Criar sua conta</p>
            <p className="mt-1 text-sm text-white/50">Preencha os dados para ir ao pagamento</p>

            <form onSubmit={submit} className="mt-6 grid gap-4">
              {/* Nome */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">
                  Nome completo <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/[0.08] transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                />
              </div>

              {/* E-mail */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">
                  E-mail <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/[0.08] transition-colors"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
                <p className="mt-1 text-[11px] text-white/40">
                  Você receberá o link de acesso neste e-mail após o pagamento.
                </p>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">
                  WhatsApp <span className="text-white/30 font-normal">(opcional)</span>
                </label>
                <input
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/[0.08] transition-colors"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  inputMode="numeric"
                />
              </div>

              {/* Resumo do plano */}
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
                style={{ background: `${plan.accentColor}10`, border: `1px solid ${plan.accentColor}30` }}
              >
                <span className="text-white/70 font-medium">Plano {plan.name}</span>
                <span className="font-black text-white">{plan.price}<span className="text-white/40 font-normal">/mês</span></span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-2xl py-4 text-base font-black text-white transition-all disabled:opacity-60"
                style={{
                  background: `linear-gradient(135deg, ${plan.accentColor}, ${plan.accentColor}cc)`,
                  boxShadow: `0 4px 24px ${plan.accentColor}40`,
                }}
              >
                {loading ? "Abrindo pagamento…" : `Assinar ${plan.name} — ${plan.price}/mês`}
              </button>
            </form>

            {checkoutUrl && (
              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-white/80">Se não abrir automaticamente:</p>
                <p className="mt-1 break-all text-xs text-white/50">
                  <a className="underline hover:text-white/70" href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                    {checkoutUrl}
                  </a>
                </p>
                <div className="mt-3 flex gap-2">
                  <a
                    className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-all"
                    style={{ background: plan.accentColor }}
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir checkout
                  </a>
                  <button
                    type="button"
                    className="rounded-xl border border-white/[0.10] px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(checkoutUrl); toast.success("Link copiado!"); }
                      catch { toast.error("Não foi possível copiar."); }
                    }}
                  >
                    Copiar link
                  </button>
                </div>
              </div>
            )}

            <p className="mt-5 text-[11px] leading-relaxed text-white/35">
              Após o pagamento aprovado, você recebe um e-mail com o link para criar sua senha e acessar a plataforma imediatamente. Pagamento via InfinityPay — ambiente seguro.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AssinarPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#020617]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#9d4edd] border-t-transparent" />
      </div>
    }>
      <AssinarContent />
    </Suspense>
  );
}
