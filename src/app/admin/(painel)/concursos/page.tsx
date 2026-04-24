"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Plus, Search, Edit2, Trash2, Trophy, Upload, ChevronDown, ChevronRight, X,
  FileText, Sparkles, Building2, MapPin, Calendar, BookOpen, Layers, CheckCircle2,
  AlertCircle, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

type DraftJobRole = {
  _key: string;
  name: string;
  subjects: string[];
  expanded: boolean;
};

type DraftStage = {
  name: string;
  dateStart?: string;
  dateEnd?: string;
};

type EditalDraft = {
  name?: string;
  organization?: string;
  examBoard?: { acronym?: string; name?: string };
  cities?: { name?: string; state?: string }[];
  jobRoles?: { name: string; subjects?: { name: string }[] }[];
  stages?: { name: string; dateStart?: string | null; dateEnd?: string | null }[];
  examDate?: string;
  description?: string;
  notes?: string;
  confidence?: number;
};

function draftToLocalJobRoles(jobRoles: EditalDraft["jobRoles"]): DraftJobRole[] {
  return (jobRoles ?? []).map((jr) => ({
    _key: Math.random().toString(36).slice(2),
    name: jr.name ?? "",
    subjects: (jr.subjects ?? []).map((s) => s.name).filter(Boolean),
    expanded: false,
  }));
}

function draftToLocalStages(stages: EditalDraft["stages"]): DraftStage[] {
  return (stages ?? []).map((s) => ({
    name: s.name,
    dateStart: s.dateStart ?? undefined,
    dateEnd: s.dateEnd ?? undefined,
  }));
}

function formatDateBR(d?: string | null) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
}

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

  const [draft, setDraft] = useState<EditalDraft | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [draftJobRoles, setDraftJobRoles] = useState<DraftJobRole[]>([]);
  const [draftStages, setDraftStages] = useState<DraftStage[]>([]);

  async function load(q = "") {
    setLoading(true);
    const res = await fetch(`/api/admin/competitions?search=${encodeURIComponent(q)}&limit=50`);
    const data = await res.json();
    setCompetitions(data.competitions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Concurso excluído"); load(search); }
    else toast.error("Erro ao excluir");
    setDeleting(null);
  }

  async function parseEdital() {
    if (!editalFile) return;
    setParsing(true);
    setDraft(null);
    setDraftJobRoles([]);
    setDraftStages([]);
    try {
      const fd = new FormData();
      fd.append("file", editalFile);
      const res = await fetch("/api/admin/competitions/edital/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao analisar edital");

      // Converte PDF em base64 em chunks para evitar stack overflow
      const ab = await editalFile.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const CHUNK = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      setPdfBase64(btoa(binary));

      const d: EditalDraft = data.draft ?? {};
      setDraft(d);
      setDraftJobRoles(draftToLocalJobRoles(d.jobRoles));
      setDraftStages(draftToLocalStages(d.stages));
      toast.success("Edital analisado com sucesso!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao analisar edital");
    } finally {
      setParsing(false);
    }
  }

  async function confirmCreate() {
    if (!draft || !pdfBase64) return;
    setConfirming(true);
    try {
      const payload = {
        draft: {
          ...draft,
          jobRoles: draftJobRoles.map((jr) => ({ name: jr.name, subjects: jr.subjects.map((s) => ({ name: s })) })),
          stages: draftStages.map((s) => ({ name: s.name, dateStart: s.dateStart ?? null, dateEnd: s.dateEnd ?? null })),
        },
        pdfBase64,
      };
      const res = await fetch("/api/admin/competitions/edital/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao criar concurso");
      toast.success("Concurso criado a partir do edital!");
      setShowEdital(false);
      setEditalFile(null);
      setDraft(null);
      setPdfBase64(null);
      setDraftJobRoles([]);
      setDraftStages([]);
      load(search);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar concurso");
    } finally {
      setConfirming(false);
    }
  }

  function resetDraft() {
    setEditalFile(null);
    setDraft(null);
    setPdfBase64(null);
    setDraftJobRoles([]);
    setDraftStages([]);
  }

  // Cargo helpers
  function addDraftJobRole() {
    setDraftJobRoles((p) => [...p, { _key: Math.random().toString(36).slice(2), name: "", subjects: [], expanded: true }]);
  }
  function removeDraftJobRole(key: string) {
    setDraftJobRoles((p) => p.filter((jr) => jr._key !== key));
  }
  function updateDraftJobRoleName(key: string, name: string) {
    setDraftJobRoles((p) => p.map((jr) => jr._key === key ? { ...jr, name } : jr));
  }
  function toggleDraftJobRole(key: string) {
    setDraftJobRoles((p) => p.map((jr) => jr._key === key ? { ...jr, expanded: !jr.expanded } : jr));
  }
  function addSubjectToJobRole(key: string, name: string) {
    const t = name.trim();
    if (!t) return;
    setDraftJobRoles((p) =>
      p.map((jr) => jr._key === key && !jr.subjects.includes(t) ? { ...jr, subjects: [...jr.subjects, t] } : jr),
    );
  }
  function removeSubjectFromJobRole(key: string, name: string) {
    setDraftJobRoles((p) => p.map((jr) => jr._key === key ? { ...jr, subjects: jr.subjects.filter((s) => s !== name) } : jr));
  }

  // Stage helpers
  function updateStage(idx: number, patch: Partial<DraftStage>) {
    setDraftStages((p) => p.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }
  function removeStage(idx: number) {
    setDraftStages((p) => p.filter((_, i) => i !== idx));
  }
  function addStage() {
    setDraftStages((p) => [...p, { name: "", dateStart: "", dateEnd: "" }]);
  }

  return (
    <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
      <PageHeader
        eyebrow="Estrutura"
        title="Concursos"
        description={`${total} concurso${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowEdital(true)} className="btn btn-ghost">
            <Upload className="h-3.5 w-3.5" strokeWidth={2} />
            Subir edital
          </button>
          <Link href="/admin/concursos/novo" className="btn btn-primary inline-flex items-center gap-2 rounded-xl">
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
        <div className="py-14 text-center"><div className="orbit-spinner" /></div>
      ) : competitions.length === 0 ? (
        <div className="orbit-empty-state">
          <Trophy className="mx-auto mb-4 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhum concurso encontrado</p>
          <Link href="/admin/concursos/novo" className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-xl text-[13px]">
            <Plus className="h-3.5 w-3.5" />Criar primeiro concurso
          </Link>
        </div>
      ) : (
        <div className="orbit-data-table-scroll orbit-data-table-scroll--lg">
          <div className="orbit-table-wrap">
            <table className="orbit-admin-table">
              <colgroup>
                <col className="min-w-[220px] w-[32%]" />
                <col className="min-w-[160px] w-[26%]" />
                <col className="min-w-[120px] w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="min-w-[96px] w-[10%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Concurso", "Localidade / Banca", "Status", "Questões", "Alunos", "Ações"].map((h) => (
                    <th key={h} className={h === "Questões" || h === "Alunos" || h === "Ações" ? "text-right" : "text-left"}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitions.map((c) => {
                  const s = STATUS_MAP[c.status] ?? { label: c.status, variant: "secondary" as const };
                  return (
                    <tr key={c.id}>
                      <td className="min-w-0">
                        <p className="line-clamp-2 font-semibold leading-snug text-[var(--text-primary)]">{c.name}</p>
                        {c.examDate && (
                          <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(c.examDate).toLocaleDateString("pt-BR")}</p>
                        )}
                      </td>
                      <td className="min-w-0">
                        <p className="leading-snug text-[var(--text-secondary)]">{c.city.name} — {c.city.state}</p>
                        {c.examBoard && <p className="mt-1 text-xs font-semibold text-violet-700">{c.examBoard.acronym}</p>}
                      </td>
                      <td><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{c._count.questions}</td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{c._count.students}</td>
                      <td className="text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <Link href={`/admin/concursos/${c.id}`} className="orbit-icon-btn" title="Editar"><Edit2 className="h-3.5 w-3.5" /></Link>
                          <button type="button" onClick={() => handleDelete(c.id, c.name)} disabled={deleting === c.id} className="orbit-icon-btn orbit-icon-btn--danger" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* ══ Modal: Subir Edital ══ */}
      {showEdital && (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowEdital(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[900px] rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Topo colorido */}
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-black/[0.07] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet-600">IA • Cadastro por edital</p>
                  <h2 className="text-[17px] font-extrabold tracking-tight text-[#111827]">
                    {draft ? "Revisar dados extraídos" : "Analisar edital em PDF"}
                  </h2>
                </div>
              </div>
              <button type="button" onClick={() => setShowEdital(false)} className="mt-0.5 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[75vh] overflow-y-auto px-6 py-5">

              {/* ─ Fase 1: Upload ─ */}
              {!draft ? (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="w-full max-w-md">
                    <label
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-8 py-10 text-center transition-colors",
                        editalFile ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/40",
                      )}
                    >
                      <FileText className={cn("h-10 w-10", editalFile ? "text-violet-500" : "text-gray-300")} strokeWidth={1.5} />
                      {editalFile ? (
                        <>
                          <p className="text-[14px] font-semibold text-violet-800">{editalFile.name}</p>
                          <p className="text-[12px] text-violet-600">{(editalFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[14px] font-semibold text-gray-700">Clique para selecionar o PDF</p>
                          <p className="text-[12px] text-gray-400">ou arraste o arquivo aqui</p>
                        </>
                      )}
                      <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setEditalFile(e.target.files?.[0] ?? null)} />
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
                      disabled={!editalFile || parsing}
                      onClick={parseEdital}
                    >
                      <Sparkles className="h-4 w-4" />
                      {parsing ? "Analisando com IA…" : "Analisar com IA"}
                    </button>
                    {editalFile && (
                      <button type="button" className="btn btn-ghost rounded-xl" onClick={() => setEditalFile(null)}>
                        Limpar
                      </button>
                    )}
                  </div>
                  {parsing && (
                    <p className="text-[12px] text-gray-500">Isso pode levar alguns segundos para editais longos…</p>
                  )}
                  <p className="text-[11px] text-gray-400">
                    PDFs com até 50+ páginas são suportados. Processamento direto pelo Gemini.
                  </p>
                </div>
              ) : (

              /* ─ Fase 2: Revisão dos dados ─ */
              <div className="space-y-5">

                {/* Confiança da IA */}
                {draft.confidence != null && (
                  <div className={cn(
                    "flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-semibold",
                    draft.confidence >= 0.7 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
                  )}>
                    {draft.confidence >= 0.7
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <AlertCircle className="h-4 w-4 shrink-0" />}
                    Confiança da IA: {Math.round(draft.confidence * 100)}%
                    {draft.confidence < 0.7 && " — Revise com atenção os dados abaixo."}
                  </div>
                )}

                {/* Grade: Dados Gerais + Cargos */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

                  {/* ─ Dados Gerais ─ */}
                  <div className="rounded-xl border border-black/[0.07] bg-[var(--bg-surface)] p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-violet-500" />
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-muted)]">Dados Gerais</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="orbit-form-label">Nome do concurso *</label>
                        <input className="input" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="orbit-form-label">Banca (sigla)</label>
                          <input className="input" placeholder="ex: CEBRASPE" value={draft.examBoard?.acronym ?? ""} onChange={(e) => setDraft({ ...draft, examBoard: { ...draft.examBoard, acronym: e.target.value } })} />
                        </div>
                        <div>
                          <label className="orbit-form-label">Organização</label>
                          <input className="input" value={draft.organization ?? ""} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="orbit-form-label flex items-center gap-1"><MapPin className="h-3 w-3" /> Cidade *</label>
                          <input className="input" value={draft.cities?.[0]?.name ?? ""} onChange={(e) => {
                            const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
                            cities[0] = { ...cities[0], name: e.target.value };
                            setDraft({ ...draft, cities });
                          }} />
                        </div>
                        <div>
                          <label className="orbit-form-label">UF *</label>
                          <input className="input uppercase" maxLength={2} value={draft.cities?.[0]?.state ?? ""} onChange={(e) => {
                            const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
                            cities[0] = { ...cities[0], state: e.target.value.toUpperCase() };
                            setDraft({ ...draft, cities });
                          }} />
                        </div>
                      </div>
                      <div>
                        <label className="orbit-form-label flex items-center gap-1"><Calendar className="h-3 w-3" /> Data da prova</label>
                        <input type="date" className="input" value={draft.examDate ?? ""} onChange={(e) => setDraft({ ...draft, examDate: e.target.value || undefined })} />
                      </div>
                      <div>
                        <label className="orbit-form-label">Descrição</label>
                        <textarea className="input min-h-[60px] resize-y text-[13px]" rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* ─ Cargos e Matérias ─ */}
                  <div className="rounded-xl border border-black/[0.07] bg-[var(--bg-surface)] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-violet-500" />
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                          Cargos e Matérias
                          <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{draftJobRoles.length}</span>
                        </p>
                      </div>
                      <button type="button" onClick={addDraftJobRole} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">
                        <Plus className="h-3 w-3" /> Cargo
                      </button>
                    </div>

                    {draftJobRoles.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-[12px] text-gray-400">
                        A IA não identificou cargos. Adicione manualmente.
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 360 }}>
                        {draftJobRoles.map((jr) => (
                          <div key={jr._key} className="overflow-hidden rounded-lg border border-black/[0.07]">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
                              <button type="button" onClick={() => toggleDraftJobRole(jr._key)} className="shrink-0 text-gray-400">
                                {jr.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <input
                                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-gray-800 outline-none placeholder:text-gray-400"
                                placeholder="Nome do cargo"
                                value={jr.name}
                                onChange={(e) => updateDraftJobRoleName(jr._key, e.target.value)}
                              />
                              <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                                {jr.subjects.length} mat.
                              </span>
                              <button type="button" onClick={() => removeDraftJobRole(jr._key)} className="shrink-0 text-gray-400 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {jr.expanded && (
                              <div className="px-3 pb-3 pt-2.5">
                                {jr.subjects.length > 0 && (
                                  <div className="mb-2 flex flex-wrap gap-1">
                                    {jr.subjects.map((s) => (
                                      <span key={s} className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                                        {s}
                                        <button type="button" onClick={() => removeSubjectFromJobRole(jr._key, s)} className="hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <SubjectAdder onAdd={(name) => addSubjectToJobRole(jr._key, name)} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─ Etapas / Cronograma ─ */}
                <div className="rounded-xl border border-black/[0.07] bg-[var(--bg-surface)] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-violet-500" />
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                        Cronograma / Etapas
                        <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{draftStages.length}</span>
                      </p>
                    </div>
                    <button type="button" onClick={addStage} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">
                      <Plus className="h-3 w-3" /> Etapa
                    </button>
                  </div>

                  {draftStages.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-[12px] text-gray-400">
                      Nenhuma etapa identificada. Adicione manualmente.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {draftStages.map((stage, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                          <input
                            className="min-w-0 bg-transparent text-[13px] font-semibold text-gray-800 outline-none placeholder:text-gray-400"
                            placeholder="Nome da etapa"
                            value={stage.name}
                            onChange={(e) => updateStage(idx, { name: e.target.value })}
                          />
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <input
                              type="date"
                              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700"
                              value={stage.dateStart ?? ""}
                              onChange={(e) => updateStage(idx, { dateStart: e.target.value || undefined })}
                              title="Data início"
                            />
                            {stage.dateStart && (
                              <>
                                <span className="text-[11px] text-gray-400">até</span>
                                <input
                                  type="date"
                                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700"
                                  value={stage.dateEnd ?? ""}
                                  onChange={(e) => updateStage(idx, { dateEnd: e.target.value || undefined })}
                                  title="Data fim (opcional)"
                                />
                              </>
                            )}
                          </div>
                          {/* Badge de data */}
                          {stage.dateStart && (
                            <span className="hidden whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 sm:inline">
                              {formatDateBR(stage.dateStart)}{stage.dateEnd ? ` – ${formatDateBR(stage.dateEnd)}` : ""}
                            </span>
                          )}
                          <button type="button" onClick={() => removeStage(idx)} className="shrink-0 text-gray-400 hover:text-red-500">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-black/[0.07] px-6 py-4">
              <button type="button" className="btn btn-ghost rounded-xl" onClick={resetDraft}>
                {draft ? "Recomeçar" : "Cancelar"}
              </button>
              {draft && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-50"
                  disabled={confirming || !draft.name}
                  onClick={confirmCreate}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirming ? "Criando concurso…" : "Confirmar e criar concurso"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-1.5">
      <input
        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-200"
        placeholder="Adicionar matéria..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); } }
        }}
      />
      <button
        type="button"
        onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(""); } }}
        className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700 hover:bg-violet-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
