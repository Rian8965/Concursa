"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";

export default function PrimeiroAcessoPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10 text-center text-sm text-[var(--text-muted)]">Carregando…</div>}>
      <PrimeiroAcessoInner />
    </Suspense>
  );
}

function PrimeiroAcessoInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = useMemo(() => (sp.get("token") ?? "").trim(), [sp]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { toast.error("Token inválido"); return; }
    if (password.length < 8) { toast.error("A senha deve ter pelo menos 8 caracteres"); return; }
    if (password !== confirm) { toast.error("As senhas não conferem"); return; }

    setSaving(true);
    const res = await fetch("/api/auth/first-access/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error((data as any)?.error ?? "Não foi possível concluir");
      return;
    }
    toast.success("Senha criada! Faça login para entrar.");
    router.push("/login");
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10">
      <div className="orbit-card-premium p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Primeiro acesso</p>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[var(--text-primary)]">Crie sua senha</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Defina uma senha para acessar a plataforma.</p>

        <form onSubmit={submit} className="mt-5 grid gap-3">
          <div>
            <label className="orbit-form-label">Senha</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" />
          </div>
          <div>
            <label className="orbit-form-label">Confirmar senha</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn btn-primary mt-2 w-full rounded-2xl" disabled={saving}>
            {saving ? "Salvando..." : "Criar senha"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Já tem senha? <Link href="/login" className="font-semibold text-violet-700 hover:text-violet-900">Fazer login</Link>
        </div>
      </div>
    </div>
  );
}

