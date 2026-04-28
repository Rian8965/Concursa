"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-6 py-12 text-center text-sm text-[var(--text-muted)]">Carregando…</div>}>
      <RedefinirSenhaInner />
    </Suspense>
  );
}

function RedefinirSenhaInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => (sp.get("token") ?? "").trim(), [sp]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Token ausente");
      return;
    }
    if (password.trim().length < 6) {
      toast.error("Senha muito curta (mínimo 6 caracteres)");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(d?.error ?? "Não foi possível redefinir");
      return;
    }
    toast.success("Senha redefinida. Faça login.");
    router.push("/login");
  }

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-6 py-12">
      <div className="orbit-card-premium p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Segurança</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Redefinir senha</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Defina sua nova senha para acessar a plataforma.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3">
          <div>
            <label className="orbit-form-label">Nova senha</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className="orbit-form-label">Confirmar senha</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita a senha" />
          </div>
          <button className="btn btn-primary mt-2 w-full rounded-2xl" disabled={loading}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/login" className="btn btn-ghost rounded-2xl">Voltar ao login</Link>
        </div>
      </div>
    </div>
  );
}

