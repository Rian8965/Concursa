"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { CreditCard, ArrowRight } from "lucide-react";

export default function RenovarClient(input: { planName: string; accessExpiresAt: string | null }) {
  const [loading, setLoading] = useState(false);

  const label = useMemo(() => {
    if (!input.accessExpiresAt) return "Seu acesso está expirado.";
    const exp = new Date(input.accessExpiresAt);
    if (isNaN(exp.getTime())) return "Seu acesso está expirado.";
    const msLeft = exp.getTime() - Date.now();
    if (msLeft >= 0) return `Seu acesso está válido até ${exp.toLocaleDateString("pt-BR")}.`;
    return `Seu acesso venceu em ${exp.toLocaleDateString("pt-BR")}.`;
  }, [input.accessExpiresAt]);

  async function renew() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/infinitepay/renew", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Não foi possível iniciar a renovação");
      const url = String(d?.checkoutUrl ?? "");
      if (!url) throw new Error("Checkout não disponível");
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao renovar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-12">
      <div className="orbit-card-premium p-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
          <CreditCard className="h-8 w-8 text-violet-500" strokeWidth={1.8} />
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F172A]">Renovar assinatura</h1>
        <p className="mt-2 text-[13.5px] text-[#64748B]">
          {label} Renove para continuar estudando sem interrupções.
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">{input.planName}</p>

        <button
          type="button"
          className="btn btn-primary mt-6 w-full rounded-2xl"
          disabled={loading}
          onClick={() => void renew()}
        >
          {loading ? "Abrindo checkout..." : "Renovar agora"}
          <ArrowRight className="ml-1 h-4 w-4" />
        </button>

        <Link href="/dashboard" className="btn btn-ghost mt-3 w-full rounded-2xl">
          Voltar
        </Link>
      </div>
    </div>
  );
}

