"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Zap, Trophy, Star } from "lucide-react";

const POPUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const LS_KEY = "trial_popup_last_shown";

interface TrialData {
  status: string | null;
  aiUsedToday: number;
  aiUsedTotal: number;
  originSlug: string | null;
}

export function TrialConversionPopup() {
  const router = useRouter();
  const [trial, setTrial] = useState<TrialData | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedRef = useRef(false);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(true);
      trackPopup();
    }, POPUP_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    fetch("/api/student/trial-status")
      .then((r) => r.json())
      .then((d) => {
        if (!d.trial || d.trial.status !== "active") return;
        setTrial(d.trial);

        // Verificar quando foi mostrado pela última vez
        const lastShown = parseInt(localStorage.getItem(LS_KEY) ?? "0", 10);
        const elapsed = Date.now() - lastShown;
        const delay = elapsed >= POPUP_INTERVAL_MS ? 0 : POPUP_INTERVAL_MS - elapsed;

        // Não mostrar imediatamente ao abrir — espera pelo menos 2 min na primeira sessão
        const firstDelay = delay === 0 && lastShown === 0 ? 2 * 60 * 1000 : delay;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setVisible(true);
          trackPopup();
        }, firstDelay);
      })
      .catch(() => {});

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function trackPopup() {
    localStorage.setItem(LS_KEY, String(Date.now()));
    fetch("/api/student/trial-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "popup_shown" }),
    }).catch(() => {});
  }

  function handleClose() {
    setVisible(false);
    scheduleNext();
  }

  function handleSubscribe(plan: "avancado" | "premium") {
    setVisible(false);
    const slug = trial?.originSlug;
    const href = `/assinar?plano=${plan}${slug ? `&concurso=${slug}` : ""}`;
    router.push(href);
  }

  if (!visible || !trial) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Fechar */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-6 py-8 text-white">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-300" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-200">
              Continue sem limites
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight">
            Você está no Teste Grátis
          </h2>
          <p className="mt-2 text-sm text-violet-200">
            Para liberar simulados completos, treinos ilimitados e mais correções com IA, escolha um plano.
          </p>
        </div>

        {/* Planos */}
        <div className="grid grid-cols-2 gap-3 p-5">
          {/* Avançado */}
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-violet-600" />
              <p className="text-xs font-bold text-violet-700">Plano Avançado</p>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-violet-900">R$ 39,90</p>
            <p className="text-[11px] text-violet-700">por 30 dias</p>
            <ul className="mt-2.5 space-y-1 text-[11px] text-violet-800">
              <li>✓ 20 correções IA/dia</li>
              <li>✓ 500 no ciclo</li>
              <li>✓ Simulados completos</li>
              <li>✓ Treinos completos</li>
            </ul>
            <button
              onClick={() => handleSubscribe("avancado")}
              className="mt-4 w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-colors"
            >
              Assinar Avançado
            </button>
          </div>

          {/* Premium */}
          <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-bold text-purple-700">Plano Premium</p>
            </div>
            <p className="mt-1.5 text-2xl font-extrabold text-purple-900">R$ 69,90</p>
            <p className="text-[11px] text-purple-700">por 30 dias</p>
            <ul className="mt-2.5 space-y-1 text-[11px] text-purple-800">
              <li>✓ 50 correções IA/dia</li>
              <li>✓ 1.200 no ciclo</li>
              <li>✓ Simulados completos</li>
              <li>✓ Acesso prioritário</li>
            </ul>
            <button
              onClick={() => handleSubscribe("premium")}
              className="mt-4 w-full rounded-xl bg-purple-600 py-2 text-xs font-bold text-white hover:bg-purple-700 transition-colors"
            >
              Assinar Premium
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="border-t px-5 pb-5 pt-0">
          <button
            onClick={handleClose}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Continuar no teste grátis
          </button>
        </div>
      </div>
    </div>
  );
}
