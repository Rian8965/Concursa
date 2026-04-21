"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Search, Edit2, Trash2, Trophy, Upload } from "lucide-react";

interface Competition {
  id: string;
  name: string;
  status: string;
  city: { name: string; state: string };
  examBoard?: { acronym: string } | null;
  examDate?: string | null;
  _count: { questions: number; students: number };
}

const STATUS_MAP: Record<string, { label: string; variant: "active" | "upcoming" | "past" | "cancelled" }> = {
  ACTIVE: { label: "Ativo", variant: "active" },
  UPCOMING: { label: "Em breve", variant: "upcoming" },
  PAST: { label: "Encerrado", variant: "past" },
  CANCELLED: { label: "Cancelado", variant: "cancelled" },
};

export default function AdminConcursosPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showEdital, setShowEdital] = useState(false);
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  async function load(q = "") {
    setLoading(true);
    const res = await fetch(`/api/admin/competitions?search=${encodeURIComponent(q)}&limit=50`);
    const data = await res.json();
    setCompetitions(data.competitions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Concurso excluído");
      load(search);
    } else toast.error("Erro ao excluir");
    setDeleting(null);
  }

  async function parseEdital() {
    if (!editalFile) return;
    setParsing(true);
    setDraft(null);
    try {
      const fd = new FormData();
      fd.append("file", editalFile);
      const res = await fetch("/api/admin/competitions/edital/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao analisar edital");

      const ab = await editalFile.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      setPdfBase64(b64);
      setDraft(data.draft ?? null);
      toast.success("Edital analisado. Revise e confirme.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao analisar edital";
      toast.error(msg);
    } finally {
      setParsing(false);
    }
  }

  async function confirmCreate() {
    if (!draft || !pdfBase64) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/competitions/edital/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, pdfBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao criar concurso");
      toast.success("Concurso criado a partir do edital!");
      setShowEdital(false);
      setEditalFile(null);
      setDraft(null);
      setPdfBase64(null);
      load(search);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar concurso";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="orbit-stack max-w-5xl animate-fade-up">
      <PageHeader
        eyebrow="Estrutura"
        title="Concursos"
        description={`${total} concurso${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowEdital(true)} className="btn btn-ghost transition-transform hover:-translate-y-px">
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            Subir edital
          </button>
          <Link href="/admin/concursos/novo" className="btn btn-primary inline-flex items-center gap-2 rounded-2xl">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Novo concurso
          </Link>
        </div>
      </PageHeader>

      <div className="orbit-search-wrap">
        <Search className="orbit-search-icon" aria-hidden />
        <input
          className="input"
          placeholder="Buscar concursos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
        />
      </div>

      {loading ? (
        <div className="py-14 text-center">
          <div className="orbit-spinner" />
        </div>
      ) : competitions.length === 0 ? (
        <div className="orbit-empty-state">
          <Trophy className="mx-auto mb-4 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhum concurso encontrado</p>
          <Link href="/admin/concursos/novo" className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-2xl text-[13px]">
            <Plus className="h-3.5 w-3.5" />
            Criar primeiro concurso
          </Link>
        </div>
      ) : (
        <div className="orbit-panel overflow-hidden p-0">
          <div className="orbit-table-wrap border-0 shadow-none">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Concurso", "Localidade / Banca", "Status", "Questões", "Alunos", "Ações"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitions.map((c) => {
                  const s = STATUS_MAP[c.status] ?? { label: c.status, variant: "secondary" as const };
                  return (
                    <tr key={c.id} className="border-t border-black/[0.04] transition-colors hover:bg-[var(--bg-muted)]/80">
                      <td className="px-4 py-3.5">
                        <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{c.name}</p>
                        {c.examDate && (
                          <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                            {new Date(c.examDate).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[13px] text-[var(--text-secondary)]">
                          {c.city.name} — {c.city.state}
                        </p>
                        {c.examBoard && (
                          <p className="text-[11.5px] font-semibold text-violet-700">{c.examBoard.acronym}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-bold text-[var(--text-secondary)]">{c._count.questions}</td>
                      <td className="px-4 py-3.5 text-[13px] font-bold text-[var(--text-secondary)]">{c._count.students}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1.5">
                          <Link href={`/admin/concursos/${c.id}`} className="orbit-icon-btn" title="Editar">
                            <Edit2 className="h-3 w-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id, c.name)}
                            disabled={deleting === c.id}
                            className="orbit-icon-btn orbit-icon-btn--danger"
                            title="Excluir"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showEdital && (
        <div
          className="orbit-modal-backdrop z-[120]"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setShowEdital(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edital-modal-title"
            className="orbit-modal-panel orbit-modal-panel--lg orbit-modal-panel--flex shadow-[0_18px_70px_rgba(0,0,0,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orbit-modal-panel__head">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 pr-2">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted)]">IA • Cadastro por edital</p>
                  <h2 id="edital-modal-title" className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                    Subir edital (PDF)
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    Envie o edital, revise os dados extraídos e confirme para criar o concurso automaticamente.
                  </p>
                </div>
                <button type="button" className="orbit-modal-close shrink-0" onClick={() => setShowEdital(false)} aria-label="Fechar">
                  ×
                </button>
              </div>
            </div>

            <div className="orbit-modal-panel__body">
              <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
                <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-[var(--bg-elevated)] p-4">
                  <p className="text-[12px] font-semibold text-[var(--text-primary)]">1) Enviar PDF</p>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="mt-2 block w-full min-w-0 text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-800"
                    onChange={(e) => setEditalFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary rounded-2xl" disabled={!editalFile || parsing} onClick={parseEdital}>
                      {parsing ? "Analisando..." : "Analisar edital"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost rounded-2xl"
                      onClick={() => {
                        setEditalFile(null);
                        setDraft(null);
                        setPdfBase64(null);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  <p className="mt-3 text-[12px] text-[var(--text-muted)]">Dica: PDFs escaneados podem levar mais tempo.</p>
                </div>

                <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-[var(--bg-surface)] p-4">
                  <p className="text-[12px] font-semibold text-[var(--text-primary)]">2) Revisar dados</p>
                  {!draft ? (
                    <p className="mt-2 text-[13px] text-[var(--text-muted)]">Depois de analisar, o rascunho aparecerá aqui.</p>
                  ) : (
                    <div className="orbit-form-stack mt-3">
                      <div>
                        <label className="orbit-form-label">Nome *</label>
                        <input
                          className="input"
                          value={(draft.name as string) ?? ""}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                          <label className="orbit-form-label">Banca (sigla)</label>
                          <input
                            className="input"
                            value={((draft.examBoard as { acronym?: string } | undefined)?.acronym as string) ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                examBoard: { ...((draft.examBoard as object) ?? {}), acronym: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="orbit-form-label">Organização</label>
                          <input
                            className="input"
                            value={(draft.organization as string) ?? ""}
                            onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                          <label className="orbit-form-label">Cidade (principal) *</label>
                          <input
                            className="input"
                            value={((draft.cities as { name?: string; state?: string }[] | undefined)?.[0]?.name as string) ?? ""}
                            onChange={(e) => {
                              const cities = Array.isArray(draft.cities) ? [...(draft.cities as object[])] : [{ name: "", state: "" }];
                              cities[0] = { ...(cities[0] as object), name: e.target.value };
                              setDraft({ ...draft, cities });
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="orbit-form-label">UF *</label>
                          <input
                            className="input"
                            value={((draft.cities as { name?: string; state?: string }[] | undefined)?.[0]?.state as string) ?? ""}
                            onChange={(e) => {
                              const cities = Array.isArray(draft.cities) ? [...(draft.cities as object[])] : [{ name: "", state: "" }];
                              cities[0] = { ...(cities[0] as object), state: e.target.value };
                              setDraft({ ...draft, cities });
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="orbit-form-label">Data da prova (YYYY-MM-DD)</label>
                        <input
                          className="input"
                          value={(draft.examDate as string) ?? ""}
                          onChange={(e) => setDraft({ ...draft, examDate: e.target.value || null })}
                          placeholder="2026-08-10"
                        />
                      </div>
                      <div>
                        <label className="orbit-form-label">Descrição / notas</label>
                        <textarea
                          className="input min-h-[88px] resize-y"
                          rows={3}
                          value={(draft.description as string) ?? ""}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {draft && (
              <div className="orbit-modal-panel__foot">
                <button
                  type="button"
                  className="btn btn-ghost rounded-2xl"
                  disabled={confirming}
                  onClick={() => {
                    setDraft(null);
                    setPdfBase64(null);
                  }}
                >
                  Limpar rascunho
                </button>
                <button type="button" className="btn btn-primary min-w-[160px] rounded-2xl" disabled={confirming} onClick={confirmCreate}>
                  {confirming ? "Criando..." : "Confirmar e criar concurso"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
