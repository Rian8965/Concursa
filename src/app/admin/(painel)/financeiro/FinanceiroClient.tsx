"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function moneyBRL(cents: number) {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

type Summary = {
  kpis: {
    activeSubs: number;
    cancelledSubs: number;
    payingStudents: number;
    revenueCents: number;
    approvedCount: number;
    pendingCount: number;
    refusedCount: number;
  };
  monthly: { ym: string; revenueCents: number; qty: number }[];
  transactions: Array<{
    id: string;
    status: string;
    amountCents: number;
    paidAmountCents: number | null;
    captureMethod: string | null;
    installments: number | null;
    receiptUrl: string | null;
    orderNsu: string | null;
    createdAt: string;
    approvedAt: string | null;
  }>;
};

export default function FinanceiroClient() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/admin/finance/session")
      .then((r) => r.json())
      .then((d) => setUnlocked(!!d?.ok))
      .catch(() => setUnlocked(false));
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    const res = await fetch("/api/admin/finance/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await res.json().catch(() => ({}));
    setUnlocking(false);
    if (!res.ok) {
      toast.error(d?.error ?? "Senha incorreta");
      return;
    }
    setUnlocked(true);
    setPassword("");
    toast.success("Acesso liberado.");
  }

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    return sp.toString();
  }, [from, to]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/finance/summary${qs ? `?${qs}` : ""}`);
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      if (res.status === 403) {
        setUnlocked(false);
        toast.error("Informe a senha extra para acessar o financeiro.");
      } else toast.error(d?.error ?? "Falha ao carregar");
      return;
    }
    setData(d as Summary);
  }

  useEffect(() => {
    if (unlocked) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  if (unlocked === null) {
    return <div className="py-10 text-center text-sm text-[var(--text-muted)]">Carregando…</div>;
  }

  if (!unlocked) {
    return (
      <div className="orbit-stack mx-auto w-full max-w-lg animate-fade-up">
        <PageHeader eyebrow="Privado" title="Relatório Financeiro" description="Acesso protegido por senha extra." />
        <form onSubmit={unlock} className="orbit-card-premium orbit-form-stack">
          <div>
            <label className="orbit-form-label">Senha extra</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Essa senha não é a do admin. Ela é configurada via ambiente (hash).
            </p>
          </div>
          <button className="btn btn-primary w-fit rounded-2xl" disabled={unlocking}>
            {unlocking ? "Validando..." : "Acessar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="orbit-stack mx-auto w-full max-w-6xl animate-fade-up">
      <PageHeader eyebrow="Financeiro" title="Relatório Financeiro" description="Assinaturas, pagamentos e receita." />

      <div className="orbit-card-premium p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="orbit-form-label">De</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="orbit-form-label">Até</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn btn-primary rounded-2xl" type="button" onClick={load} disabled={loading}>
            {loading ? "Carregando..." : "Aplicar filtros"}
          </button>
        </div>
      </div>

      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="orbit-card-premium p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Receita (aprovados)</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-[var(--text-primary)]">{moneyBRL(data.kpis.revenueCents)}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{data.kpis.approvedCount} aprovados</p>
            </div>
            <div className="orbit-card-premium p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Alunos pagantes</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-[var(--text-primary)]">{data.kpis.payingStudents.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Com plano ativo no perfil</p>
            </div>
            <div className="orbit-card-premium p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Assinaturas ativas</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-[var(--text-primary)]">{data.kpis.activeSubs.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{data.kpis.cancelledSubs} canceladas</p>
            </div>
            <div className="orbit-card-premium p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Status</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
                Pendentes: <span className="font-extrabold text-[var(--text-primary)]">{data.kpis.pendingCount}</span>
                <br />
                Recusados: <span className="font-extrabold text-[var(--text-primary)]">{data.kpis.refusedCount}</span>
              </p>
            </div>
          </div>

          <div className="orbit-card-premium p-5">
            <p className="text-[12px] font-extrabold text-[var(--text-primary)]">Receita (últimos 12 meses)</p>
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="ym" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$ ${(Number(v) / 100).toFixed(0)}`} />
                  <Tooltip formatter={(v: any) => moneyBRL(Number(v))} />
                  <Line type="monotone" dataKey="revenueCents" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="orbit-card-premium p-5">
            <p className="text-[12px] font-extrabold text-[var(--text-primary)]">Transações (últimas 50)</p>
            <div className="mt-4 overflow-x-auto">
              <table className="orbit-admin-table">
                <thead>
                  <tr>
                    {["Data", "Status", "Valor", "Método", "Parcelas", "Order NSU", "Comprovante"].map((h) => (
                      <th key={h} className={h === "Valor" ? "text-right" : "text-left"}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="text-xs text-[var(--text-secondary)]">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                      <td className="text-xs font-semibold">{t.status}</td>
                      <td className="text-right text-xs font-extrabold">{moneyBRL(t.paidAmountCents ?? t.amountCents)}</td>
                      <td className="text-xs text-[var(--text-secondary)]">{t.captureMethod ?? "—"}</td>
                      <td className="text-xs text-[var(--text-secondary)]">{t.installments ?? "—"}</td>
                      <td className="text-xs font-mono">{t.orderNsu ?? "—"}</td>
                      <td className="text-xs">
                        {t.receiptUrl ? (
                          <a className="text-violet-700 hover:text-violet-900 font-semibold" href={t.receiptUrl} target="_blank" rel="noopener">
                            abrir
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="py-10 text-center text-sm text-[var(--text-muted)]">Carregue para ver os dados.</div>
      )}
    </div>
  );
}

