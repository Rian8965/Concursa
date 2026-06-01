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
    badgeColor: "#9d4edd",
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
    badgeColor: "#f59e0b",
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

type CompetitionData = {
  id: string;
  name: string;
  slug: string;
  organization: string | null;
  city: { name: string; state: string } | null;
  examBoard: { acronym: string } | null;
};

function formatWhatsApp(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function normalizeUrl(url: string) {
  const u = url.trim();
  return u.startsWith("http://") ? `https://${u.slice(7)}` : u;
}

export function CompetitionCheckout({ competition }: { competition: CompetitionData }) {
  const [selectedPlan, setSelectedPlan] = useState<"avancado" | "premium" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const plan = PLANS.find((p) => p.slug === selectedPlan);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) { toast.error("Escolha um plano antes de continuar"); return; }
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
        planSlug: selectedPlan,
        competitionSlug: competition.slug,
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
    const normalized = normalizeUrl(url);
    setCheckoutUrl(normalized);
    window.location.assign(normalized);
  }

  const subtitle = [
    competition.organization,
    competition.city ? `${competition.city.name} — ${competition.city.state}` : null,
    competition.examBoard ? `Banca: ${competition.examBoard.acronym}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#020617]">
      {/* Fundo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(157,77,221,0.28),transparent_60%),radial-gradient(900px_500px_at_80%_40%,rgba(79,70,229,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.80),rgba(2,6,23,0.95))]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="mx-auto max-w-5xl px-6 py-14">
        {/* Header */}
        <div className="mb-10 text-center">
          <a href="https://descompliqueseuconcurso.com.br" className="inline-block mb-5">
            <span className="text-lg font-black text-white tracking-tight">
              Descomplique seu <span className="text-[#9d4edd]">Concurso</span>
            </span>
          </a>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#9d4edd]/30 bg-[#9d4edd]/10 px-4 py-1.5 mb-4">
            <span className="h-2 w-2 rounded-full bg-[#9d4edd] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#9d4edd]">Inscrição aberta</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Concurso <span className="text-[#9d4edd]">{competition.name}</span>
          </h1>
          {subtitle && <p className="mt-2 text-sm text-white/50">{subtitle}</p>}
          <p className="mt-4 max-w-xl mx-auto text-sm text-white/60 leading-relaxed">
            Ao assinar por esta página, seu acesso será vinculado automaticamente ao concurso{" "}
            <span className="font-semibold text-white/80">{competition.name}</span>. Você não precisará escolher o concurso manualmente.
          </p>
        </div>

        {/* Aviso IA */}
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-center">
          <p className="text-xs text-white/50">
            As correções com IA possuem limite diário e mensal para garantir estabilidade e qualidade.{" "}
            <span className="text-white/70 font-medium">Não existe plano ilimitado de correções com IA.</span>
          </p>
        </div>

        {/* Grid: planos + formulário */}
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">

          {/* Planos */}
          <div className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">Escolha seu plano</p>
            {PLANS.map((p) => {
              const selected = selectedPlan === p.slug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setSelectedPlan(p.slug)}
                  className="w-full text-left rounded-3xl border p-7 transition-all"
                  style={{
                    background: selected ? `${p.badgeColor}0d` : "rgba(255,255,255,0.03)",
                    borderColor: selected ? p.badgeColor : "rgba(255,255,255,0.08)",
                    boxShadow: selected ? `0 0 40px ${p.badgeColor}18` : "none",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className="inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                          style={{
                            background: `${p.badgeColor}18`,
                            color: p.badgeColor,
                            border: `1px solid ${p.badgeColor}30`,
                          }}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <div className="flex items-end gap-1 mb-4">
                        <span className="text-base text-white/40 font-light mb-0.5">R$</span>
                        <span className="text-5xl font-extrabold tracking-tighter text-white leading-none">
                          {p.price.replace("R$ ", "").replace(",", ".")}
                        </span>
                        <span className="text-sm text-white/40 font-light mb-0.5">/mês</span>
                      </div>
                      <ul className="space-y-2">
                        {p.features.slice(0, 4).map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: p.badgeColor }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-[13px] text-white/70 leading-snug">{f}</span>
                          </li>
                        ))}
                        {p.features.length > 4 && (
                          <li className="text-[12px] text-white/40 pl-5">+{p.features.length - 4} recursos incluídos</li>
                        )}
                      </ul>
                    </div>
                    <div
                      className="mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: selected ? p.badgeColor : "rgba(255,255,255,0.20)" }}
                    >
                      {selected && <div className="h-2.5 w-2.5 rounded-full" style={{ background: p.badgeColor }} />}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Extra credits note */}
            <p className="text-center text-xs text-white/30 mt-2">
              Créditos extras de IA disponíveis para compra após assinar, a partir de R$ 5,00.
            </p>
          </div>

          {/* Formulário */}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-7 backdrop-blur-xl lg:sticky lg:top-8">
            <p className="text-sm font-bold text-white">Criar sua conta</p>
            <p className="mt-1 text-xs text-white/50 mb-5">
              {selectedPlan
                ? `Plano ${plan!.name} selecionado — ${plan!.price}/mês`
                : "Selecione um plano e preencha seus dados"}
            </p>

            <form onSubmit={submit} className="space-y-3">
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
                <p className="mt-1 text-[11px] text-white/35">Você receberá o link de acesso neste e-mail após o pagamento.</p>
              </div>

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
                  inputMode="numeric"
                />
              </div>

              {selectedPlan && (
                <div
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm mt-1"
                  style={{
                    background: `${plan!.badgeColor}10`,
                    border: `1px solid ${plan!.badgeColor}30`,
                  }}
                >
                  <div>
                    <p className="text-white/60 text-xs">Concurso</p>
                    <p className="text-white font-semibold text-sm">{competition.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-xs">Plano</p>
                    <p className="font-black text-white">{plan!.price}<span className="text-white/40 font-normal text-xs">/mês</span></p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !selectedPlan}
                className="mt-2 w-full rounded-2xl py-4 text-sm font-black text-white transition-all disabled:opacity-40"
                style={{
                  background: selectedPlan
                    ? `linear-gradient(135deg, ${plan!.badgeColor}, ${plan!.badgeColor}cc)`
                    : "rgba(255,255,255,0.10)",
                  boxShadow: selectedPlan ? `0 4px 24px ${plan!.badgeColor}35` : "none",
                }}
              >
                {loading
                  ? "Abrindo pagamento…"
                  : selectedPlan
                  ? `Assinar ${plan!.name} para ${competition.name}`
                  : "Selecione um plano"}
              </button>
            </form>

            {checkoutUrl && (
              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-white/80">Se não abrir automaticamente:</p>
                <div className="mt-2 flex gap-2">
                  <a
                    className="rounded-xl px-4 py-2 text-xs font-bold text-white"
                    style={{ background: "#9d4edd" }}
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir checkout
                  </a>
                  <button
                    type="button"
                    className="rounded-xl border border-white/[0.10] px-4 py-2 text-xs font-medium text-white/70 hover:text-white"
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(checkoutUrl); toast.success("Link copiado!"); }
                      catch { toast.error("Não foi possível copiar."); }
                    }}
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-white/30">
              Após o pagamento aprovado, você recebe um e-mail para criar sua senha. Pagamento via InfinityPay — ambiente seguro. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
