"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Search, Users, Zap, BookOpen, CheckCircle2, Clock, XCircle, ShieldX,
  TrendingUp, Calendar, BarChart3, Filter,
} from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

interface TrialUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  cpf: string | null;
  whatsapp: string | null;
  contestName: string | null;
  originSlug: string | null;
  status: string;
  startedAt: string | null;
  endsAt: string | null;
  daysLeft: number;
  aiUsedToday: number;
  aiUsedTotal: number;
  materialsDownloaded: number;
  popupCount: number;
  lastPopupAt: string | null;
  convertedAt: string | null;
  conversionPlanName: string | null;
  createdAt: string;
}

interface Metrics {
  totalActive: number;
  totalExpired: number;
  totalConverted: number;
  totalBlocked: number;
  startedToday: number;
  startedThisMonth: number;
  conversionRate: number;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-green-100 text-green-800" },
  expired: { label: "Expirado", className: "bg-red-100 text-red-800" },
  converted: { label: "Convertido", className: "bg-blue-100 text-blue-800" },
  blocked: { label: "Bloqueado", className: "bg-slate-100 text-slate-700" },
};

export default function TesteGratisAdminPage() {
  const [data, setData] = useState<TrialUser[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<TrialUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async (q = "", st = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: q, limit: "50" });
      if (st) params.set("status", st);
      const res = await fetch(`/api/admin/trials?${params}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
      setMetrics(json.metrics ?? null);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(search, statusFilter); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(search, statusFilter);
  }

  async function handleAction(profileId: string, action: "block" | "end", reason?: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/trials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, action, reason }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === "block" ? "Trial bloqueado" : "Trial encerrado");
      setSelected(null);
      load(search, statusFilter);
    } catch {
      toast.error("Erro ao executar ação");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teste Grátis"
        description={`${total} usuário${total !== 1 ? "s" : ""} em teste grátis`}
      />

      {/* Métricas */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "Ativos", value: metrics.totalActive, icon: Clock, color: "text-green-600 bg-green-50" },
            { label: "Iniciados hoje", value: metrics.startedToday, icon: Calendar, color: "text-violet-600 bg-violet-50" },
            { label: "Este mês", value: metrics.startedThisMonth, icon: BarChart3, color: "text-blue-600 bg-blue-50" },
            { label: "Expirados", value: metrics.totalExpired, icon: XCircle, color: "text-red-600 bg-red-50" },
            { label: "Convertidos", value: metrics.totalConverted, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
            { label: "Bloqueados", value: metrics.totalBlocked, icon: ShieldX, color: "text-slate-600 bg-slate-50" },
            { label: "Conversão", value: `${metrics.conversionRate}%`, icon: TrendingUp, color: "text-amber-600 bg-amber-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="orbit-card-premium flex items-center gap-3 px-4 py-3">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-[var(--text-primary)]">{value}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="orbit-card-premium p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="orbit-input w-full pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); load(search, e.target.value); }}
            className="orbit-input min-w-[160px]"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="expired">Expirado</option>
            <option value="converted">Convertido</option>
            <option value="blocked">Bloqueado</option>
          </select>
          <button type="submit" className="btn btn-primary rounded-xl px-5">
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
        </form>
      </div>

      {/* Tabela */}
      <div className="orbit-card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/70">
                {["Nome / E-mail", "CPF", "WhatsApp", "Concurso", "Início", "Fim", "Dias", "IA hoje", "IA total", "Apostila", "Pop-ups", "Status", "Conversão", "Ações"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={14} className="py-10 text-center text-sm text-[var(--text-muted)]">Carregando…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={14} className="py-10 text-center text-sm text-[var(--text-muted)]">Nenhum usuário encontrado</td></tr>
              ) : data.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-[var(--text-primary)]">{u.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{u.cpf ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{u.whatsapp ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {u.contestName ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        {u.contestName}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                    {u.startedAt ? formatDate(u.startedAt) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                    {u.endsAt ? formatDate(u.endsAt) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold text-[var(--text-primary)]">
                    {u.daysLeft}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("font-bold", u.aiUsedToday >= 5 ? "text-red-600" : "text-[var(--text-primary)]")}>
                      {u.aiUsedToday}/5
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("font-bold", u.aiUsedTotal >= 35 ? "text-red-600" : "text-[var(--text-primary)]")}>
                      {u.aiUsedTotal}/35
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">{u.materialsDownloaded}/1</td>
                  <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{u.popupCount}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_LABELS[u.status]?.className ?? "bg-slate-100 text-slate-700")}>
                      {STATUS_LABELS[u.status]?.label ?? u.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                    {u.convertedAt ? (
                      <span className="font-semibold text-emerald-600">{u.conversionPlanName ?? "Sim"}</span>
                    ) : "Não"}
                  </td>
                  <td className="px-3 py-2.5">
                    {u.status === "active" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setSelected(u)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                          Ações
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de ações */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-extrabold text-[var(--text-primary)]">Ações: {selected.name}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{selected.email}</p>

            <div className="mt-5 space-y-2">
              <button
                disabled={actionLoading}
                onClick={() => {
                  if (confirm("Encerrar o teste grátis deste aluno?")) {
                    handleAction(selected.id, "end", "Encerrado manualmente pelo admin");
                  }
                }}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                Encerrar teste grátis
              </button>
              <button
                disabled={actionLoading}
                onClick={() => {
                  if (confirm("Bloquear este aluno do teste grátis?")) {
                    handleAction(selected.id, "block", "Bloqueado por abuso");
                  }
                }}
                className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Bloquear
              </button>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mt-4 w-full rounded-xl py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
