"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Pencil,
  X,
  Eye,
  ShoppingCart,
  TrendingUp,
  Users,
  DollarSign,
} from "lucide-react";
import { formatDate } from "@/lib/utils/date";

type SalesLinkData = {
  competition: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    salesLinkActive: boolean;
    salesLinkVisits: number;
  };
  publicLink: string;
  stats: {
    visits: number;
    checkoutsStarted: number;
    totalSales: number;
    totalRevenueCents: number;
    totalRevenueFormatted: string;
  };
  sales: Array<{
    name: string;
    email: string;
    plan: string;
    approvedAt: string | null;
    amountCents: number;
  }>;
};

const PLAN_LABELS: Record<string, string> = {
  avancado: "Avançado",
  premium: "Premium",
};

export default function LinkVendaPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<SalesLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edição de slug
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/competitions/${id}/sales-link`);
    const json = await res.json();
    if (res.ok) {
      setData(json);
      setSlugInput(json.competition.slug ?? "");
    } else {
      toast.error(json.error ?? "Erro ao carregar dados");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive() {
    if (!data) return;
    setSaving(true);
    const res = await fetch(`/api/admin/competitions/${id}/sales-link`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesLinkActive: !data.competition.salesLinkActive }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success(json.competition.salesLinkActive ? "Link ativado!" : "Link desativado.");
      await load();
    } else {
      toast.error(json.error ?? "Erro ao atualizar");
    }
  }

  async function saveSlug() {
    setSaving(true);
    const res = await fetch(`/api/admin/competitions/${id}/sales-link`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slugInput }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success("Slug atualizado!");
      setEditingSlug(false);
      await load();
    } else {
      toast.error(json.error ?? "Erro ao atualizar slug");
    }
  }

  async function copyLink() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.publicLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!data) return null;

  const { competition, publicLink, stats, sales } = data;
  const isActive = competition.salesLinkActive && competition.isActive;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/concursos/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            Concursos · {competition.name}
          </p>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Link de Venda
          </h1>
        </div>
      </div>

      {/* Status + Toggle */}
      <div className="orbit-panel flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}
          >
            {isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              Link de venda {isActive ? "ativo" : "inativo"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {isActive
                ? "Alunos podem acessar o link e assinar agora."
                : competition.isActive
                ? "Ative para liberar a venda pelo link."
                : "O concurso está inativo — reative-o primeiro."}
            </p>
          </div>
        </div>
        <button
          onClick={toggleActive}
          disabled={saving || !competition.isActive}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 ${
            competition.salesLinkActive
              ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {saving ? "Salvando…" : competition.salesLinkActive ? "Desativar link" : "Ativar link"}
        </button>
      </div>

      {/* Link público */}
      <div className="orbit-panel p-5 space-y-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          Link público
        </p>

        {/* URL atual */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-2.5">
            <p className="truncate text-sm font-mono font-medium text-[var(--text-primary)]">{publicLink}</p>
          </div>
          <button
            onClick={copyLink}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Copiar link"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
          <a
            href={publicLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Abrir link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Edição de slug */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Slug (parte final do link)</p>
            {!editingSlug && (
              <button
                onClick={() => setEditingSlug(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
              >
                <Pencil className="h-3 w-3" /> Editar slug
              </button>
            )}
          </div>

          {editingSlug ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] shrink-0">/c/</span>
              <input
                className="input flex-1 font-mono text-sm"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="ex: urandi"
                autoFocus
              />
              <button
                onClick={saveSlug}
                disabled={saving || !slugInput || slugInput === competition.slug}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-violet-700 transition-colors"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <button
                onClick={() => { setEditingSlug(false); setSlugInput(competition.slug); }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-2.5">
              <p className="font-mono text-sm text-[var(--text-secondary)]">/c/{competition.slug}</p>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            Use letras minúsculas, números e hífens. Exemplo: <code className="bg-[var(--bg-muted)] px-1 rounded">urandi</code> ou <code className="bg-[var(--bg-muted)] px-1 rounded">guarda-municipal-ba</code>.
            Slugs são únicos — não é possível repetir.
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: Eye, label: "Visitas", value: stats.visits, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: ShoppingCart, label: "Checkouts iniciados", value: stats.checkoutsStarted, color: "text-orange-600", bg: "bg-orange-50" },
          { icon: TrendingUp, label: "Vendas concluídas", value: stats.totalSales, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: DollarSign, label: "Receita gerada", value: stats.totalRevenueFormatted, color: "text-violet-600", bg: "bg-violet-50" },
        ].map((s) => (
          <div key={s.label} className="orbit-panel p-5">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela de vendas */}
      <div className="orbit-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-widest text-[var(--text-muted)]">
            Alunos que compraram por este link
          </p>
          <div className="flex items-center gap-1.5 rounded-full bg-[var(--bg-muted)] px-3 py-1">
            <Users className="h-3 w-3 text-[var(--text-muted)]" />
            <span className="text-xs font-bold text-[var(--text-secondary)]">{sales.length}</span>
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] py-12 text-center">
            <ShoppingCart className="mb-2 h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Nenhuma venda ainda</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Compartilhe o link acima para começar a vender.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Aluno</th>
                  <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Plano</th>
                  <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Valor</th>
                  <th className="pb-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sales.map((s, i) => (
                  <tr key={i} className="hover:bg-[var(--bg-muted)] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[var(--text-primary)]">{s.name || "—"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{s.email}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        s.plan === "premium"
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                          : "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                      }`}>
                        {PLAN_LABELS[s.plan] ?? s.plan}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-[var(--text-primary)]">
                        R$ {(s.amountCents / 100).toFixed(2).replace(".", ",")}
                      </p>
                    </td>
                    <td className="py-3">
                      <p className="text-[var(--text-secondary)]">
                        {s.approvedAt ? formatDate(new Date(s.approvedAt)) : "—"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--text-secondary)]">Como funciona:</strong> Quando um aluno acessa{" "}
          <code className="bg-[var(--bg-card)] px-1 rounded text-[var(--text-primary)]">/c/{competition.slug}</code>{" "}
          e conclui a compra, ele é automaticamente matriculado no concurso{" "}
          <strong className="text-[var(--text-secondary)]">{competition.name}</strong> e não precisa escolher o
          concurso manualmente. Se for um novo aluno, a conta é criada e vinculada diretamente.
        </p>
      </div>
    </div>
  );
}
