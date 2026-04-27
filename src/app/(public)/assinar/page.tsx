"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function AssinarPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-6 py-12">
      <div className="orbit-card-premium p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Assinatura</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Plano Completo · R$ 27,90</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Treino ilimitado, simulados, apostilas, explicações com IA, quiz do edital e relatórios.
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
  );
}

