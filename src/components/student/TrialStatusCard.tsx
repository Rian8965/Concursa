"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Zap, BookOpen, ChevronRight, AlertCircle } from "lucide-react";

interface TrialData {
  status: string | null;
  startedAt: string | null;
  endsAt: string | null;
  daysLeft: number;
  aiUsedToday: number;
  aiUsedTotal: number;
  materialsDownloaded: number;
  originSlug: string | null;
}

export function TrialStatusCard() {
  const [trial, setTrial] = useState<TrialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/trial-status")
      .then((r) => r.json())
      .then((d) => setTrial(d.trial))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !trial || trial.status !== "active") return null;

  const aiTodayPct = Math.round((trial.aiUsedToday / 5) * 100);
  const aiTotalPct = Math.round((trial.aiUsedTotal / 35) * 100);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-700" />
          <span className="text-sm font-extrabold text-amber-900">Teste Grátis Ativo</span>
        </div>
        <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
          {trial.daysLeft} {trial.daysLeft === 1 ? "dia restante" : "dias restantes"}
        </span>
      </div>

      <div className="p-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/70 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-700">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">IA hoje</span>
            </div>
            <p className="mt-1 text-xl font-extrabold text-amber-900">{trial.aiUsedToday}</p>
            <p className="text-xs text-amber-700">de 5</p>
          </div>
          <div className="rounded-xl bg-white/70 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-700">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">IA total</span>
            </div>
            <p className="mt-1 text-xl font-extrabold text-amber-900">{trial.aiUsedTotal}</p>
            <p className="text-xs text-amber-700">de 35</p>
          </div>
          <div className="rounded-xl bg-white/70 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-700">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">Apostila</span>
            </div>
            <p className="mt-1 text-xl font-extrabold text-amber-900">{trial.materialsDownloaded}</p>
            <p className="text-xs text-amber-700">de 1</p>
          </div>
        </div>

        {/* Progress bars */}
        <div className="mt-4 space-y-2">
          <div>
            <div className="mb-1 flex justify-between text-xs text-amber-800">
              <span>Correções de IA hoje</span>
              <span>{trial.aiUsedToday}/5</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-amber-200">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(100, aiTodayPct)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-amber-800">
              <span>Total no teste</span>
              <span>{trial.aiUsedTotal}/35</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-amber-200">
              <div
                className="h-full rounded-full bg-amber-600 transition-all"
                style={{ width: `${Math.min(100, aiTotalPct)}%` }}
              />
            </div>
          </div>
        </div>

        {trial.originSlug && (
          <p className="mt-3 text-xs text-amber-700">
            Concurso vinculado: <span className="font-semibold capitalize">{trial.originSlug}</span>
          </p>
        )}

        {/* Aviso */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-100/80 px-3 py-2.5 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Acesso limitado. Simulados e treinos completos disponíveis apenas nos planos pagos.</span>
        </div>

        {/* CTAs */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/assinar?plano=avancado"
            className="flex items-center justify-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-colors"
          >
            Assinar Avançado <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            href="/assinar?plano=premium"
            className="flex items-center justify-center gap-1 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 transition-colors"
          >
            Assinar Premium <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
