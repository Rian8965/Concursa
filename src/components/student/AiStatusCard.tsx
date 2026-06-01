"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

type AiStatus = {
  hasActiveSubscription: boolean;
  plan: {
    name: string;
    slug: string;
    priceCents: number;
    aiDailyLimit: number;
    aiMonthlyLimit: number;
  } | null;
  accessExpiresAt: string | null;
  usage: {
    correctionsToday: number;
    dailyLimit: number;
    dailyPercent: number;
    correctionsMonth: number;
    monthlyLimit: number;
    monthlyPercent: number;
    monthlyExhausted: boolean;
    estimatedCostTodayBrl: number;
    estimatedCostMonthBrl: number;
    lastUsageAt: string | null;
  };
  extraCredits: {
    available: number;
    totalPurchased: number;
    totalUsed: number;
  };
  aiBlocked: boolean;
};

type Package = {
  id: string;
  name: string;
  slug: string;
  priceBrl: number;
  creditsAmount: number;
};

function ProgressBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export function AiStatusCard() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [buyingSlug, setBuyingSlug] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/student/ai-status");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/credits/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data.packages ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchPackages();
  }, [fetchStatus, fetchPackages]);

  async function buyCredits(pkg: Package) {
    setBuyingSlug(pkg.slug);
    try {
      const res = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageSlug: pkg.slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as any)?.error ?? "Não foi possível iniciar o pagamento");
        return;
      }
      const url = (data as any)?.checkoutUrl as string | undefined;
      if (url) window.location.assign(url);
      else toast.error("Link de pagamento não retornou");
    } catch {
      toast.error("Erro ao iniciar pagamento");
    } finally {
      setBuyingSlug(null);
    }
  }

  if (!status) return null;

  const { usage, extraCredits, plan } = status;
  const dailyColor =
    usage.dailyPercent >= 100 ? "bg-red-500" :
    usage.dailyPercent >= 90 ? "bg-orange-500" :
    usage.dailyPercent >= 70 ? "bg-yellow-400" : "bg-purple-500";

  const monthlyColor =
    usage.monthlyPercent >= 100 ? "bg-red-500" :
    usage.monthlyPercent >= 90 ? "bg-orange-500" :
    usage.monthlyPercent >= 70 ? "bg-yellow-400" : "bg-purple-500";

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white/80">Correções com IA</h3>
          {extraCredits.available > 0 && (
            <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-semibold text-green-400 border border-green-500/30">
              {extraCredits.available} créditos extras
            </span>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {/* Hoje */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/50">
              <span>Hoje</span>
              <span className="font-semibold text-white/70">{usage.correctionsToday} / {usage.dailyLimit}</span>
            </div>
            <ProgressBar percent={usage.dailyPercent} colorClass={dailyColor} />
          </div>

          {/* Mês */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/50">
              <span>Este mês</span>
              <span className="font-semibold text-white/70">{usage.correctionsMonth} / {usage.monthlyLimit}</span>
            </div>
            <ProgressBar percent={usage.monthlyPercent} colorClass={monthlyColor} />
          </div>
        </div>

        {/* Aviso de cota esgotada */}
        {usage.monthlyExhausted && (
          <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
            <p className="text-xs font-semibold text-orange-300">Limite mensal atingido</p>
            <p className="mt-1 text-xs text-orange-200/70">
              {extraCredits.available > 0
                ? `Você está usando créditos extras. Saldo disponível: ${extraCredits.available} créditos.`
                : "Compre créditos extras para continuar recebendo explicações da IA."}
            </p>
            {extraCredits.available === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 transition-colors"
              >
                Comprar créditos extras
              </button>
            )}
          </div>
        )}

        {/* Botão de compra sempre visível */}
        {!usage.monthlyExhausted && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.07] transition-colors"
          >
            Comprar créditos extras
          </button>
        )}

        {/* Renovação */}
        {status.accessExpiresAt && (
          <p className="mt-3 text-[11px] text-white/30">
            Renovação: {new Date(status.accessExpiresAt).toLocaleDateString("pt-BR")}
            {plan && ` · Plano ${plan.name}`}
          </p>
        )}
      </div>

      {/* Modal de compra de créditos */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0f0f1a] p-6 shadow-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-lg font-extrabold text-white">Créditos extras de IA</h2>
            {usage.monthlyExhausted ? (
              <p className="mt-1 text-sm text-white/60">
                Você usou todas as correções com IA do seu plano este mês.
                Compre créditos extras para continuar estudando.
              </p>
            ) : (
              <p className="mt-1 text-sm text-white/60">
                Compre créditos extras para usar quando acabar sua cota mensal.
              </p>
            )}

            <div className="mt-5 grid gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.slug}
                  onClick={() => buyCredits(pkg)}
                  disabled={buyingSlug === pkg.slug}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left hover:border-[#9d4edd]/50 hover:bg-[#9d4edd]/10 transition-all disabled:opacity-60"
                >
                  <div>
                    <p className="font-bold text-white">{pkg.creditsAmount} correções extras com IA</p>
                    {pkg.creditsAmount === 120 && (
                      <span className="mt-0.5 inline-block rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">Mais popular</span>
                    )}
                    {pkg.creditsAmount === 300 && (
                      <span className="mt-0.5 inline-block rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-300">Melhor custo-benefício</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-[#9d4edd]">R$ {pkg.priceBrl.toFixed(2)}</p>
                    <p className="text-[11px] text-white/40">R$ {(pkg.priceBrl / pkg.creditsAmount * 100).toFixed(1)}¢ / correção</p>
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-white/30 text-center">
              Cada crédito equivale a 1 correção com IA. Créditos não utilizados ficam disponíveis nos próximos meses.
              Créditos extras não tornam o plano ilimitado.
              É necessário ter assinatura ativa para usar créditos extras.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
