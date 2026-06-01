"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

type StudentRow = {
  studentProfileId: string;
  userId: string;
  name: string;
  email: string;
  plan: string;
  planSlug: string;
  hasActiveSub: boolean;
  correctionsToday: number;
  dailyLimit: number;
  dailyPct: number;
  correctionsMonth: number;
  monthlyLimit: number;
  monthlyPct: number;
  extraCreditsAvailable: number;
  extraCreditsPurchased: number;
  extraCreditsUsed: number;
  estimatedCostTodayBrl: number;
  estimatedCostMonthBrl: number;
  estimatedCostTotalBrl: number;
  lastUsageAt: string | null;
  aiBlocked: boolean;
  alertStatus: string;
};

type GlobalData = {
  aiEnabled: boolean;
  manualBlockUntil: string | null;
  today: { totalCostBrl: number; totalCalls: number; activeStudents: number; creditRevenueBrl: number };
  month: { totalCostBrl: number; totalCalls: number; activeStudents: number; creditRevenueBrl: number };
  globalLimits: { dailyCostLimitBrl: number; dailyCostUsedBrl: number; dailyCallLimit: number; dailyCallsUsed: number };
  top10Today: { studentProfileId: string; name: string; email: string; corrections: number; costBrl: number }[];
  top10Month: { studentProfileId: string; name: string; email: string; corrections: number; costBrl: number }[];
};

const ALERT_COLORS: Record<string, string> = {
  normal: "text-green-400",
  warning: "text-yellow-400",
  critical: "text-orange-400",
  blocked: "text-red-400",
  blocked_manual: "text-red-500",
  using_credits: "text-blue-400",
};

const ALERT_LABELS: Record<string, string> = {
  normal: "Normal",
  warning: "Atenção",
  critical: "Crítico",
  blocked: "Bloqueado",
  blocked_manual: "Bloq. Manual",
  using_credits: "Usando Extras",
};

function ProgressCell({ value, max, pct }: { value: number; max: number; pct: number }) {
  const color = pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-orange-500" : pct >= 70 ? "bg-yellow-400" : "bg-purple-500";
  return (
    <div className="min-w-[90px]">
      <div className="mb-1 flex justify-between text-xs">
        <span>{value}/{max}</span>
        <span className="opacity-60">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

export default function AdminIaPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [global, setGlobal] = useState<GlobalData | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [alertFilter, setAlertFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);

  const fetchGlobal = useCallback(async () => {
    const res = await fetch("/api/admin/ai-usage/global");
    if (res.ok) setGlobal(await res.json());
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (alertFilter) params.set("alert", alertFilter);
    const res = await fetch(`/api/admin/ai-usage/students?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotalPages(data.totalPages ?? 1);
    }
    setLoading(false);
  }, [page, search, planFilter, alertFilter]);

  useEffect(() => { fetchGlobal(); fetchStudents(); }, [fetchGlobal, fetchStudents]);

  // Auto-refresh a cada 60s
  useEffect(() => {
    const interval = setInterval(() => { fetchGlobal(); fetchStudents(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchGlobal, fetchStudents]);

  async function toggleAi() {
    if (!global) return;
    setTogglingAi(true);
    const action = global.aiEnabled ? "pause_ai" : "resume_ai";
    const res = await fetch("/api/admin/ai-usage/global", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      toast.success(global.aiEnabled ? "IA pausada globalmente" : "IA liberada");
      fetchGlobal();
    } else {
      toast.error("Erro ao alterar status da IA");
    }
    setTogglingAi(false);
  }

  const fmtBrl = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Consumo de IA por aluno</h1>
          <p className="mt-1 text-sm text-[#64748B]">Monitoramento em tempo real · Atualização automática a cada 60s</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { fetchGlobal(); fetchStudents(); }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Atualizar agora
          </button>
          {global && (
            <button
              onClick={toggleAi}
              disabled={togglingAi}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                global.aiEnabled
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
            >
              {togglingAi ? "..." : global.aiEnabled ? "⏸ Pausar IA" : "▶ Liberar IA"}
            </button>
          )}
        </div>
      </div>

      {/* Cards globais */}
      {global && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Custo hoje", value: fmtBrl(global.today.totalCostBrl), sub: `${global.today.totalCalls} chamadas` },
            { label: "Custo este mês", value: fmtBrl(global.month.totalCostBrl), sub: `${global.month.totalCalls} chamadas` },
            { label: "Alunos ativos hoje", value: String(global.today.activeStudents), sub: "usaram a IA hoje" },
            { label: "Receita créditos/mês", value: fmtBrl(global.month.creditRevenueBrl), sub: `hoje: ${fmtBrl(global.today.creditRevenueBrl)}` },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-800">{c.value}</p>
              <p className="mt-1 text-xs text-slate-400">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Status global */}
      {global && !global.aiEnabled && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          ⚠️ IA pausada globalmente. Nenhum aluno consegue usar correções com IA no momento.
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
          placeholder="Buscar nome ou e-mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos os planos</option>
          <option value="avancado">Avançado</option>
          <option value="premium">Premium</option>
          <option value="legacy">Legado</option>
        </select>
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
          value={alertFilter}
          onChange={(e) => { setAlertFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos os alertas</option>
          <option value="warning">Atenção / Crítico</option>
          <option value="blocked">Bloqueados por limite</option>
          <option value="monthly_exhausted">Cota mensal esgotada</option>
          <option value="has_credits">Com créditos extras</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 text-left">Aluno</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-left">Hoje</th>
              <th className="px-4 py-3 text-left">Mês</th>
              <th className="px-4 py-3 text-right">Créditos extras</th>
              <th className="px-4 py-3 text-right">Custo hoje</th>
              <th className="px-4 py-3 text-right">Custo mês</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Último uso</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-10 text-center text-slate-400">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-slate-400">Nenhum resultado encontrado.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.studentProfileId} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="max-w-[180px] px-4 py-3">
                  <p className="truncate font-semibold text-slate-800">{r.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    r.planSlug === "premium" ? "bg-yellow-50 text-yellow-700" :
                    r.planSlug === "avancado" ? "bg-violet-50 text-violet-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>
                    {r.plan}
                  </span>
                  {!r.hasActiveSub && <span className="ml-1 text-[10px] text-red-400">(inativo)</span>}
                </td>
                <td className="px-4 py-3">
                  <ProgressCell value={r.correctionsToday} max={r.dailyLimit} pct={r.dailyPct} />
                </td>
                <td className="px-4 py-3">
                  <ProgressCell value={r.correctionsMonth} max={r.monthlyLimit} pct={r.monthlyPct} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={r.extraCreditsAvailable > 0 ? "font-bold text-green-600" : "text-slate-300"}>
                    {r.extraCreditsAvailable}
                  </span>
                  {r.extraCreditsPurchased > 0 && (
                    <p className="text-[10px] text-slate-400">comprou: {r.extraCreditsPurchased}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmtBrl(r.estimatedCostTodayBrl)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmtBrl(r.estimatedCostMonthBrl)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-bold ${ALERT_COLORS[r.alertStatus] ?? "text-slate-400"}`}>
                    {ALERT_LABELS[r.alertStatus] ?? r.alertStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[11px] text-slate-400">
                  {r.lastUsageAt ? new Date(r.lastUsageAt).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/ia/${r.studentProfileId}`}
                    className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-600 hover:bg-violet-100"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">
            ← Anterior
          </button>
          <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40">
            Próxima →
          </button>
        </div>
      )}

      {/* Top 10 do mês */}
      {global && global.top10Month.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Top 10 — Maior consumo este mês</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-2 text-left">#</th>
                  <th className="pb-2 text-left">Aluno</th>
                  <th className="pb-2 text-right">Correções</th>
                  <th className="pb-2 text-right">Custo estimado</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {global.top10Month.map((row, i) => (
                  <tr key={row.studentProfileId} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-bold text-slate-300">#{i + 1}</td>
                    <td className="py-2">
                      <p className="font-semibold text-slate-800">{row.name}</p>
                      <p className="text-[11px] text-slate-400">{row.email}</p>
                    </td>
                    <td className="py-2 text-right font-bold text-violet-600">{row.corrections}</td>
                    <td className="py-2 text-right font-mono text-xs text-slate-500">{fmtBrl(row.costBrl)}</td>
                    <td className="py-2 pl-3">
                      <Link href={`/admin/ia/${row.studentProfileId}`} className="text-xs font-bold text-violet-500 hover:underline">Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
