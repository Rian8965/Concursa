"use client";

import { useState } from "react";
import { toast } from "sonner";

const PLANS = [
  {
    slug: "avancado" as const,
    name: "Avançado",
    price: "R$ 39,90",
    priceCents: 3990,
    badge: "Melhor custo-benefício",
    badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
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
    highlight: false,
  },
  {
    slug: "premium" as const,
    name: "Premium",
    price: "R$ 69,90",
    priceCents: 6990,
    badge: "Para quem estuda pesado",
    badgeClass: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
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
    highlight: true,
  },
] as const;

export default function AssinarPage() {
  const [selectedPlan, setSelectedPlan] = useState<"avancado" | "premium">("avancado");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  function normalizeCheckoutUrl(url: string) {
    const u = url.trim();
    if (u.startsWith("http://")) return `https://${u.slice("http://".length)}`;
    return u;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome"); return; }
    if (!email.trim() || !email.includes("@")) { toast.error("Informe um e-mail válido"); return; }

    setCheckoutUrl(null);
    setLoading(true);
    const res = await fetch("/api/billing/infinitepay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, planSlug: selectedPlan }),
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

  const plan = PLANS.find((p) => p.slug === selectedPlan)!;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#020617]">
      {/* Fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(157,77,221,0.35),transparent_60%),radial-gradient(900px_500px_at_80%_30%,rgba(168,85,247,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.85),rgba(2,6,23,0.92))]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="text-center text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/60">Escolha seu plano</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Descomplique seu <span className="text-[#9d4edd]">Concurso</span>
          </h1>
          <p className="mt-4 text-base text-white/60">
            As correções com IA possuem limite diário e mensal para garantir estabilidade, velocidade e qualidade.
          </p>
          <p className="mt-1 text-sm font-semibold text-white/40">Não existe plano ilimitado de correções com IA.</p>
        </div>

        {/* Cards de planos */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {PLANS.map((p) => (
            <button
              key={p.slug}
              onClick={() => setSelectedPlan(p.slug)}
              className={`relative rounded-3xl border p-8 text-left transition-all ${
                selectedPlan === p.slug
                  ? "border-[#9d4edd] bg-[#9d4edd]/10 shadow-[0_0_40px_rgba(157,77,221,0.25)]"
                  : "border-white/10 bg-white/[0.04] hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${p.badgeClass}`}>
                    {p.badge}
                  </span>
                  <h2 className="mt-3 text-2xl font-extrabold text-white">{p.name}</h2>
                  <p className="mt-1 text-3xl font-black text-[#9d4edd]">{p.price}<span className="ml-1 text-base font-normal text-white/50">/mês</span></p>
                </div>
                <div className={`mt-1 h-6 w-6 rounded-full border-2 flex items-center justify-center ${selectedPlan === p.slug ? "border-[#9d4edd]" : "border-white/20"}`}>
                  {selectedPlan === p.slug && <div className="h-3 w-3 rounded-full bg-[#9d4edd]" />}
                </div>
              </div>

              <ul className="mt-6 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#9d4edd]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          Créditos extras de IA disponíveis para compra quando acabar a cota mensal.
        </p>

        {/* Formulário */}
        <div className="mx-auto mt-12 max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">
            <p className="text-sm font-bold text-white/60 uppercase tracking-wider">
              Assinar — {plan.name} · {plan.price}/mês
            </p>

            <form onSubmit={submit} className="mt-6 grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-white/50">Seu nome</label>
                <input
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-white/50">Seu e-mail</label>
                <input
                  className="input w-full"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-white/50">WhatsApp (opcional)</label>
                <input
                  className="input w-full"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55..."
                />
              </div>

              <button className="btn btn-primary mt-2 w-full rounded-2xl text-base font-bold py-3" disabled={loading}>
                {loading ? "Abrindo pagamento..." : `Assinar ${plan.name} — ${plan.price}/mês`}
              </button>
            </form>

            {checkoutUrl && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-white">Se não abrir automaticamente:</p>
                <p className="mt-1 break-all text-xs text-white/50">
                  <a className="underline" href={checkoutUrl} target="_blank" rel="noopener noreferrer">{checkoutUrl}</a>
                </p>
                <div className="mt-3 flex gap-2">
                  <a className="btn btn-primary rounded-xl text-sm" href={checkoutUrl} target="_blank" rel="noopener noreferrer">Abrir checkout</a>
                  <button
                    type="button"
                    className="btn btn-ghost rounded-xl text-sm"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(checkoutUrl); toast.success("Link copiado."); }
                      catch { toast.error("Não foi possível copiar."); }
                    }}
                  >
                    Copiar link
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-white/40">
              Após o pagamento aprovado, você recebe um e-mail para criar sua senha e acessar.
              Acesso liberado automaticamente. Pagamento via InfinityPay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
