"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function AssinarPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const screenshots = [
    // Landing (domínio raiz) - usadas como decoração desfocada.
    "https://descompliqueseuconcurso.com.br/dashboard_preview.png?v=20260427",
    "https://descompliqueseuconcurso.com.br/questoes_interface.png?v=20260427",
    "https://descompliqueseuconcurso.com.br/quiz_edital.png?v=20260427",
    "https://descompliqueseuconcurso.com.br/revisar_erros.png?v=20260427",
    "https://descompliqueseuconcurso.com.br/desempenho_geral.png?v=20260427",
  ] as const;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome"); return; }
    if (!email.trim() || !email.includes("@")) { toast.error("Informe um e-mail válido"); return; }

    setLoading(true);
    const res = await fetch("/api/billing/infinitepay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error((data as any)?.error ?? "Não foi possível iniciar o pagamento");
      return;
    }

    const url = (data as any)?.checkoutUrl as string | undefined;
    if (!url) {
      toast.error("Link de pagamento não retornou");
      return;
    }
    window.location.href = url;
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      {/* Fundo neon premium */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(157,77,221,0.35),transparent_60%),radial-gradient(900px_500px_at_80%_30%,rgba(168,85,247,0.22),transparent_55%),radial-gradient(800px_500px_at_50%_90%,rgba(236,72,153,0.10),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.85),rgba(2,6,23,0.92))]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Prints flutuando desfocados */}
      <div className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
        <div className="absolute left-[-3%] top-[10%] w-[520px] rotate-[-10deg] opacity-35 blur-[1.2px]">
          <img src={screenshots[0]} alt="" className="h-auto w-full rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(157,77,221,0.22)]" />
        </div>
        <div className="absolute right-[-6%] top-[16%] w-[560px] rotate-[12deg] opacity-30 blur-[1.8px]">
          <img src={screenshots[1]} alt="" className="h-auto w-full rounded-3xl border border-white/10 shadow-[0_0_70px_rgba(168,85,247,0.20)]" />
        </div>
        <div className="absolute left-[10%] bottom-[-6%] w-[560px] rotate-[6deg] opacity-25 blur-[2.2px]">
          <img src={screenshots[2]} alt="" className="h-auto w-full rounded-3xl border border-white/10 shadow-[0_0_80px_rgba(236,72,153,0.14)]" />
        </div>
        <div className="absolute right-[12%] bottom-[-10%] w-[520px] rotate-[-8deg] opacity-20 blur-[2.4px]">
          <img src={screenshots[3]} alt="" className="h-auto w-full rounded-3xl border border-white/10" />
        </div>
      </div>

      <div className="mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-[1.05fr_0.95fr]">
        {/* Benefícios */}
        <div className="text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/60">
            Assinatura
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Plano Completo <span className="text-white/60">·</span>{" "}
            <span className="text-[var(--accent,#9d4edd)]">R$ 27,90</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">
            Estudo guiado, revisão inteligente e desempenho na prática — com uma experiência premium, clara e direta ao ponto.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: "Treinos ilimitados", desc: "Monte sessões por matéria e foque no que mais cai." },
              { title: "Simulados completos", desc: "Cronômetro, correção e análise do seu desempenho." },
              { title: "Revisão e erros", desc: "Retome pontos fracos com estratégia e consistência." },
              { title: "Quiz do edital", desc: "Converse com o edital e transforme texto em ação." },
              { title: "Relatórios", desc: "Acompanhe evolução por assunto e dificuldade." },
              { title: "Apostilas e IA", desc: "Explicações, resumos e apoio para destravar dúvidas." },
            ].map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md"
              >
                <p className="text-sm font-bold tracking-tight">{b.title}</p>
                <p className="mt-1 text-sm text-white/60">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-white/55">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Acesso liberado automaticamente</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">E-mail de primeiro acesso</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Pagamento via InfinityPay</span>
          </div>
        </div>

        {/* Card do formulário */}
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] bg-[radial-gradient(500px_250px_at_20%_20%,rgba(157,77,221,0.25),transparent_55%),radial-gradient(500px_250px_at_80%_60%,rgba(168,85,247,0.18),transparent_55%)] blur-2xl" />

          <div className="orbit-card-premium border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Assinar agora</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Preencha seus dados e finalize o pagamento com segurança.
            </p>

            <form onSubmit={submit} className="mt-6 grid gap-3">
              <div>
                <label className="orbit-form-label">Seu nome</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div>
                <label className="orbit-form-label">Seu e-mail</label>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              <div>
                <label className="orbit-form-label">WhatsApp (opcional)</label>
                <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55..." />
              </div>

              <button className="btn btn-primary mt-2 w-full rounded-2xl" disabled={loading}>
                {loading ? "Abrindo pagamento..." : "Assinar agora"}
              </button>
            </form>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Após o pagamento aprovado, você recebe um e-mail para criar sua senha e acessar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

