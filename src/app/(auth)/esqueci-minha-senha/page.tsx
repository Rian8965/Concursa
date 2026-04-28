"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export default function EsqueciMinhaSenhaPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Informe seu e-mail ou CPF");
      return;
    }
    setLoading(true);
    await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim() }),
    }).catch(() => {});
    setLoading(false);
    toast.success("Se os dados estiverem corretos, você receberá um e-mail para redefinir sua senha.");
    setIdentifier("");
  }

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-6 py-12">
      <div className="orbit-card-premium p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Recuperação</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Esqueci minha senha</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Informe seu e-mail ou CPF. Se estiver correto, enviaremos um link para redefinição.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3">
          <div>
            <label className="orbit-form-label">E-mail ou CPF</label>
            <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="voce@email.com ou 000.000.000-00" />
          </div>
          <button className="btn btn-primary mt-2 w-full rounded-2xl" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/login" className="btn btn-ghost rounded-2xl">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}

