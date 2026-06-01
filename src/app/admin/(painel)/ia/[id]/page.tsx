"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

type StudentDetail = {
  studentProfileId: string;
  userId: string;
  name: string;
  email: string;
  memberSince: string;
  plan: { name: string; slug: string; priceCents: number | null; aiDailyLimit: number; aiMonthlyLimit: number; aiResponseCharLimit: number | null } | null;
  hasActiveSub: boolean;
  accessExpiresAt: string | null;
  aiBlocked: boolean;
  usage: {
    correctionsToday: number;
    dailyLimit: number;
    correctionsMonth: number;
    monthlyLimit: number;
    estimatedCostTodayBrl: number;
    estimatedCostMonthBrl: number;
    estimatedCostTotalBrl: number;
    lastUsageAt: string | null;
  };
  extraCredits: { available: number; totalPurchased: number; totalUsed: number };
  creditTransactions: { id: string; type: string; credits: number; balanceBefore: number; balanceAfter: number; description: string | null; createdAt: string }[];
  usageLogs: { id: string; questionCode: string | null; questionPreview: string | null; source: string; model: string | null; inputTokens: number | null; outputTokens: number | null; costBrl: number | null; status: string; errorMessage: string | null; createdAt: string }[];
};

const SOURCE_LABELS: Record<string, string> = {
  plan_quota: "Cota do plano",
  extra_credit: "Crédito extra",
  admin_bonus: "Bônus admin",
  legacy_allowance: "Permissão legada",
};

export default function AdminStudentIaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState("");
  const [limitDailyInput, setLimitDailyInput] = useState("");
  const [limitMonthlyInput, setLimitMonthlyInput] = useState("");

  async function fetchData() {
    setLoading(true);
    const res = await fetch(`/api/admin/ai-usage/students/${id}`);
    if (res.ok) setData(await res.json());
    else toast.error("Erro ao carregar dados do aluno");
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [id]);

  async function doAction(action: string, value?: number, reason?: string) {
    setActionLoading(action);
    const res = await fetch(`/api/admin/ai-usage/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, value, reason }),
    });
    const resp = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(`Ação "${action}" realizada com sucesso`);
      fetchData();
    } else {
      toast.error((resp as any)?.error ?? "Erro ao executar ação");
    }
    setActionLoading(null);
  }

  if (loading) return <div className="py-10 text-center text-slate-400">Carregando...</div>;
  if (!data) return <div className="py-10 text-center text-slate-400">Aluno não encontrado.</div>;

  const fmtBrl = (v: number) => `R$ ${v.toFixed(2)}`;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          ← Voltar
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A]">{data.name}</h1>
          <p className="text-sm text-slate-400">{data.email} · Membro desde {new Date(data.memberSince).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Plano</p>
          <p className="mt-1 font-bold text-slate-800">{data.plan?.name ?? "—"}</p>
          <p className="text-xs text-slate-400">{data.hasActiveSub ? "Ativo" : "Inativo"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Hoje</p>
          <p className="mt-1 font-bold text-slate-800">{data.usage.correctionsToday}/{data.usage.dailyLimit}</p>
          <p className="text-xs text-slate-400">{fmtBrl(data.usage.estimatedCostTodayBrl)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Este mês</p>
          <p className="mt-1 font-bold text-slate-800">{data.usage.correctionsMonth}/{data.usage.monthlyLimit}</p>
          <p className="text-xs text-slate-400">{fmtBrl(data.usage.estimatedCostMonthBrl)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-bold uppercase text-slate-400">Créditos extras</p>
          <p className="mt-1 font-bold text-green-600">{data.extraCredits.available} disponíveis</p>
          <p className="text-xs text-slate-400">comprou: {data.extraCredits.totalPurchased} · usou: {data.extraCredits.totalUsed}</p>
        </div>
      </div>

      {/* Ações administrativas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Ações administrativas</h2>
        <div className="flex flex-wrap gap-3">
          {data.aiBlocked ? (
            <button
              onClick={() => doAction("unblock_ai")}
              disabled={actionLoading === "unblock_ai"}
              className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50"
            >
              ✓ Liberar IA
            </button>
          ) : (
            <button
              onClick={() => doAction("block_ai")}
              disabled={actionLoading === "block_ai"}
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              ✗ Bloquear IA
            </button>
          )}

          <button
            onClick={() => doAction("reset_daily_usage")}
            disabled={actionLoading === "reset_daily_usage"}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Zerar uso diário
          </button>

          <button
            onClick={() => doAction("reset_monthly_usage")}
            disabled={actionLoading === "reset_monthly_usage"}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Zerar uso mensal
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {/* Ajustar limite diário */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="Novo limite diário (0 = padrão)"
              value={limitDailyInput}
              onChange={(e) => setLimitDailyInput(e.target.value)}
              className="w-44 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => { const v = parseInt(limitDailyInput); if (!isNaN(v) && v >= 0) doAction("adjust_daily_limit", v); }}
              disabled={actionLoading === "adjust_daily_limit"}
              className="rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-50"
            >
              Aplicar limite diário
            </button>
          </div>

          {/* Ajustar limite mensal */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              placeholder="Novo limite mensal (0 = padrão)"
              value={limitMonthlyInput}
              onChange={(e) => setLimitMonthlyInput(e.target.value)}
              className="w-44 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => { const v = parseInt(limitMonthlyInput); if (!isNaN(v) && v >= 0) doAction("adjust_monthly_limit", v); }}
              disabled={actionLoading === "adjust_monthly_limit"}
              className="rounded-xl bg-violet-500 px-3 py-2 text-sm font-bold text-white hover:bg-violet-600 disabled:opacity-50"
            >
              Aplicar limite mensal
            </button>
          </div>

          {/* Adicionar créditos */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              placeholder="Qtd. de créditos"
              value={creditInput}
              onChange={(e) => setCreditInput(e.target.value)}
              className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={() => { const v = parseInt(creditInput); if (!isNaN(v) && v > 0) doAction("add_extra_credits", v, "Bônus administrativo"); }}
              disabled={actionLoading === "add_extra_credits"}
              className="rounded-xl bg-green-500 px-3 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50"
            >
              + Adicionar créditos
            </button>
            <button
              onClick={() => { const v = parseInt(creditInput); if (!isNaN(v) && v > 0) doAction("remove_extra_credits", v, "Remoção administrativa"); }}
              disabled={actionLoading === "remove_extra_credits"}
              className="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              - Remover créditos
            </button>
          </div>
        </div>
      </div>

      {/* Histórico de uso */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Histórico de chamadas de IA (últimas 50)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2 text-left">Data/hora</th>
                <th className="px-4 py-2 text-left">Questão</th>
                <th className="px-4 py-2 text-left">Origem</th>
                <th className="px-4 py-2 text-left">Modelo</th>
                <th className="px-4 py-2 text-right">Tokens in</th>
                <th className="px-4 py-2 text-right">Tokens out</th>
                <th className="px-4 py-2 text-right">Custo R$</th>
                <th className="px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.usageLogs.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-300">Nenhuma chamada registrada.</td></tr>
              ) : data.usageLogs.map((l) => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-500">{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="max-w-[180px] px-4 py-2 text-slate-700">
                    {l.questionCode && <span className="font-mono text-[10px] text-slate-400">{l.questionCode} · </span>}
                    <span className="line-clamp-1">{l.questionPreview ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      l.source === "extra_credit" ? "bg-blue-50 text-blue-600" :
                      l.source === "plan_quota" ? "bg-violet-50 text-violet-600" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {SOURCE_LABELS[l.source] ?? l.source}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{l.model ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{l.inputTokens ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{l.outputTokens ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{l.costBrl != null ? fmtBrl(l.costBrl) : "—"}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`font-semibold ${l.status === "success" ? "text-green-500" : "text-red-400"}`}>
                      {l.status === "success" ? "✓" : "✗"}
                    </span>
                    {l.errorMessage && <p className="text-[10px] text-red-400">{l.errorMessage.slice(0, 60)}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de créditos */}
      {data.creditTransactions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Movimentações de créditos extras</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2 text-left">Data</th>
                  <th className="px-4 py-2 text-left">Tipo</th>
                  <th className="px-4 py-2 text-right">Créditos</th>
                  <th className="px-4 py-2 text-right">Saldo antes</th>
                  <th className="px-4 py-2 text-right">Saldo depois</th>
                  <th className="px-4 py-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {data.creditTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-400">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">
                      <span className={`font-semibold ${t.type === "purchase" ? "text-green-600" : t.type === "usage" ? "text-blue-600" : "text-orange-600"}`}>
                        {t.type}
                      </span>
                    </td>
                  <td className={`px-4 py-2 text-right font-bold ${t.credits > 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.credits > 0 ? `+${t.credits}` : t.credits}
                  </td>
                    <td className="px-4 py-2 text-right text-slate-400">{t.balanceBefore}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-700">{t.balanceAfter}</td>
                    <td className="px-4 py-2 text-slate-500">{t.description ?? "—"}</td>
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
