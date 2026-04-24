"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Plus, Search, Edit2, Trash2, Trophy, Upload, ChevronDown, ChevronRight, X,
  FileText, Sparkles, Building2, MapPin, Calendar, CheckCircle2,
  AlertCircle, ClipboardList, ArrowLeft, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function draftToLocalJobRoles(jobRoles: EditalDraft["jobRoles"]): DraftJobRole[] {
  return (jobRoles ?? []).map((jr) => ({
    _key: Math.random().toString(36).slice(2),
    name: jr.name ?? "",
    subjects: (jr.subjects ?? []).map((s) => s.name).filter(Boolean),
    expanded: true,
  }));
}

function draftToLocalStages(stages: EditalDraft["stages"]): DraftStage[] {
  return (stages ?? []).map((s) => ({
    name: s.name,
    dateStart: s.dateStart ?? undefined,
    dateEnd: s.dateEnd ?? undefined,
  }));
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdminConcursosPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);

  // Full-screen review
  const [draft, setDraft] = useState<EditalDraft | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [draftJobRoles, setDraftJobRoles] = useState<DraftJobRole[]>([]);
  const [draftStages, setDraftStages] = useState<DraftStage[]>([]);
  const [confirming, setConfirming] = useState(false);

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
    try {
      const fd = new FormData();
      fd.append("file", editalFile);
      const res = await fetch("/api/admin/competitions/edital/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao analisar edital");

      // Converte em base64 em chunks para não explodir a call stack
      const ab = await editalFile.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const CHUNK = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      setPdfBase64(btoa(binary));

      const d: EditalDraft = data.draft ?? {};
      setDraft(d);
      setDraftJobRoles(draftToLocalJobRoles(d.jobRoles));
      setDraftStages(draftToLocalStages(d.stages));
      setShowUpload(false);
      toast.success("Edital analisado — revise os dados antes de confirmar.");
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
      resetAll();
      load(search);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar concurso");
    } finally {
      setConfirming(false);
    }
  }

  function resetAll() {
    setEditalFile(null);
    setDraft(null);
    setPdfBase64(null);
    setDraftJobRoles([]);
    setDraftStages([]);
    setShowUpload(false);
  }

  // cargo helpers
  function addDraftJobRole() {
    setDraftJobRoles((p) => [...p, { _key: Math.random().toString(36).slice(2), name: "", subjects: [], expanded: true }]);
  }
  function removeDraftJobRole(key: string) { setDraftJobRoles((p) => p.filter((jr) => jr._key !== key)); }
  function updateDraftJobRoleName(key: string, name: string) { setDraftJobRoles((p) => p.map((jr) => jr._key === key ? { ...jr, name } : jr)); }
  function toggleDraftJobRole(key: string) { setDraftJobRoles((p) => p.map((jr) => jr._key === key ? { ...jr, expanded: !jr.expanded } : jr)); }
  function addSubjectToJobRole(key: string, name: string) {
    const t = name.trim(); if (!t) return;
    setDraftJobRoles((p) => p.map((jr) => jr._key === key && !jr.subjects.includes(t) ? { ...jr, subjects: [...jr.subjects, t] } : jr));
  }
  function removeSubjectFromJobRole(key: string, name: string) {
    setDraftJobRoles((p) => p.map((jr) => jr._key === key ? { ...jr, subjects: jr.subjects.filter((s) => s !== name) } : jr));
  }

  // stage helpers
  function updateStage(idx: number, patch: Partial<DraftStage>) { setDraftStages((p) => p.map((s, i) => i === idx ? { ...s, ...patch } : s)); }
  function removeStage(idx: number) { setDraftStages((p) => p.filter((_, i) => i !== idx)); }
  function addStage() { setDraftStages((p) => [...p, { name: "" }]); }

  return (
    <>
      {/* ── Lista de concursos ── */}
      <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
        <PageHeader
          eyebrow="Estrutura"
          title="Concursos"
          description={`${total} concurso${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowUpload(true)} className="btn btn-ghost">
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
          <input className="input" placeholder="Buscar concursos..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(search)} />
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
                  <col className="min-w-[220px] w-[32%]" /><col className="min-w-[160px] w-[26%]" />
                  <col className="min-w-[120px] w-[14%]" /><col className="w-[9%]" /><col className="w-[9%]" />
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
                          {c.examDate && <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(c.examDate).toLocaleDateString("pt-BR")}</p>}
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
                            <button type="button" onClick={() => handleDelete(c.id, c.name)} disabled={deleting === c.id} className="orbit-icon-btn orbit-icon-btn--danger" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
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
      </div>

      {/* ── Modal de upload (pequeno, só para escolher o arquivo) ── */}
      {showUpload && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500" />
            <div className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                    <Sparkles className="h-4.5 w-4.5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet-600">IA • Cadastro por edital</p>
                    <h2 className="text-[16px] font-extrabold text-[#111827]">Analisar edital (PDF)</h2>
                  </div>
                </div>
                <button type="button" onClick={() => setShowUpload(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <label className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                editalFile ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/40",
              )}>
                <FileText className={cn("h-10 w-10", editalFile ? "text-violet-500" : "text-gray-300")} strokeWidth={1.5} />
                {editalFile ? (
                  <>
                    <p className="text-[13px] font-semibold text-violet-800">{editalFile.name}</p>
                    <p className="text-[12px] text-violet-500">{(editalFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold text-gray-700">Clique para selecionar o PDF</p>
                    <p className="text-[12px] text-gray-400">Editais com 50+ páginas são suportados</p>
                  </>
                )}
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setEditalFile(e.target.files?.[0] ?? null)} />
              </label>

              <div className="mt-4 flex gap-3">
                <button type="button" className="btn btn-ghost flex-1 rounded-xl" onClick={() => setShowUpload(false)}>Cancelar</button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  disabled={!editalFile || parsing}
                  onClick={parseEdital}
                >
                  <Sparkles className="h-4 w-4" />
                  {parsing ? "Analisando…" : "Analisar com IA"}
                </button>
              </div>
              {parsing && (
                <p className="mt-3 text-center text-[11.5px] text-gray-500">
                  Lendo todas as páginas do edital… pode demorar alguns segundos.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tela de revisão full-screen ── */}
      {draft && (
        <EditalReviewScreen
          draft={draft}
          setDraft={setDraft}
          draftJobRoles={draftJobRoles}
          draftStages={draftStages}
          confirming={confirming}
          onConfirm={confirmCreate}
          onCancel={resetAll}
          addDraftJobRole={addDraftJobRole}
          removeDraftJobRole={removeDraftJobRole}
          updateDraftJobRoleName={updateDraftJobRoleName}
          toggleDraftJobRole={toggleDraftJobRole}
          addSubjectToJobRole={addSubjectToJobRole}
          removeSubjectFromJobRole={removeSubjectFromJobRole}
          updateStage={updateStage}
          removeStage={removeStage}
          addStage={addStage}
        />
      )}
    </>
  );
}

// ─── Full-screen review ───────────────────────────────────────────────────────

interface ReviewProps {
  draft: EditalDraft;
  setDraft: React.Dispatch<React.SetStateAction<EditalDraft | null>>;
  draftJobRoles: DraftJobRole[];
  draftStages: DraftStage[];
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  addDraftJobRole: () => void;
  removeDraftJobRole: (key: string) => void;
  updateDraftJobRoleName: (key: string, name: string) => void;
  toggleDraftJobRole: (key: string) => void;
  addSubjectToJobRole: (key: string, name: string) => void;
  removeSubjectFromJobRole: (key: string, name: string) => void;
  updateStage: (idx: number, patch: Partial<DraftStage>) => void;
  removeStage: (idx: number) => void;
  addStage: () => void;
}

function EditalReviewScreen({
  draft, setDraft, draftJobRoles, draftStages, confirming,
  onConfirm, onCancel, addDraftJobRole, removeDraftJobRole,
  updateDraftJobRoleName, toggleDraftJobRole, addSubjectToJobRole,
  removeSubjectFromJobRole, updateStage, removeStage, addStage,
}: ReviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bloqueia scroll do body enquanto esta tela está aberta
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const confidence = draft.confidence ?? null;
  const isHighConfidence = confidence !== null && confidence >= 0.75;

  function setCity(key: "name" | "state", value: string) {
    const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
    cities[0] = { ...cities[0], [key]: key === "state" ? value.toUpperCase() : value };
    setDraft((d) => d ? { ...d, cities } : d);
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#F4F5F7]" style={{ fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}>

      {/* ══ Barra superior fixa ══ */}
      <header className="shrink-0 border-b border-black/[0.08] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          {/* Esquerda */}
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800">
              <ArrowLeft className="h-4 w-4" />
              Cancelar
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                <Sparkles className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet-600">IA • Cadastro por edital</p>
                <h1 className="text-[15px] font-extrabold leading-tight text-[#111827]">Revisar dados extraídos</h1>
              </div>
            </div>
          </div>

          {/* Centro: confiança */}
          {confidence !== null && (
            <div className={cn(
              "hidden items-center gap-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold md:flex",
              isHighConfidence ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
            )}>
              {isHighConfidence ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              Confiança da IA: {Math.round(confidence * 100)}%
              {!isHighConfidence && " — revise com atenção"}
            </div>
          )}

          {/* Direita */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming || !draft.name?.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {confirming ? "Criando concurso…" : "Confirmar e criar concurso"}
          </button>
        </div>
      </header>

      {/* ══ Corpo scrollável ══ */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-8">

          {/* Alerta de baixa confiança */}
          {confidence !== null && !isHighConfidence && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-[13.5px] font-semibold text-amber-900">Confiança baixa — revise todos os campos</p>
                <p className="mt-0.5 text-[12.5px] text-amber-700">A IA pode ter interpretado incorretamente partes do edital. Verifique com atenção antes de confirmar.</p>
              </div>
            </div>
          )}

          {/* ── Grade principal: 2 colunas ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[480px_1fr]">

            {/* ── Coluna esquerda: Dados Gerais + Cronograma ── */}
            <div className="flex flex-col gap-6">

              {/* Card: Dados Gerais */}
              <section className="rounded-2xl border border-black/[0.07] bg-white shadow-sm">
                <div className="border-b border-black/[0.06] px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4.5 w-4.5 text-violet-500" />
                    <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-gray-500">Dados Gerais</h2>
                  </div>
                </div>
                <div className="space-y-5 px-6 py-5">
                  <Field label="Nome do concurso *">
                    <input
                      className="field-input"
                      value={draft.name ?? ""}
                      onChange={(e) => setDraft((d) => d ? { ...d, name: e.target.value } : d)}
                      placeholder="Nome completo do concurso"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Banca (sigla)">
                      <input
                        className="field-input"
                        value={draft.examBoard?.acronym ?? ""}
                        onChange={(e) => setDraft((d) => d ? { ...d, examBoard: { ...d.examBoard, acronym: e.target.value } } : d)}
                        placeholder="ex: CEBRASPE"
                      />
                    </Field>
                    <Field label="Organização">
                      <input
                        className="field-input"
                        value={draft.organization ?? ""}
                        onChange={(e) => setDraft((d) => d ? { ...d, organization: e.target.value } : d)}
                        placeholder="Órgão responsável"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-[1fr_90px] gap-4">
                    <Field label="Cidade *">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <input
                          className="field-input"
                          value={draft.cities?.[0]?.name ?? ""}
                          onChange={(e) => setCity("name", e.target.value)}
                          placeholder="Cidade"
                        />
                      </div>
                    </Field>
                    <Field label="UF *">
                      <input
                        className="field-input text-center font-semibold uppercase"
                        maxLength={2}
                        value={draft.cities?.[0]?.state ?? ""}
                        onChange={(e) => setCity("state", e.target.value)}
                        placeholder="UF"
                      />
                    </Field>
                  </div>

                  <Field label="Data da prova">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <input
                        type="date"
                        className="field-input"
                        value={draft.examDate ?? ""}
                        onChange={(e) => setDraft((d) => d ? { ...d, examDate: e.target.value || undefined } : d)}
                      />
                    </div>
                  </Field>

                  <Field label="Descrição / notas">
                    <textarea
                      className="field-input resize-y text-[13px] leading-relaxed"
                      rows={4}
                      value={draft.description ?? ""}
                      onChange={(e) => setDraft((d) => d ? { ...d, description: e.target.value } : d)}
                      placeholder="Resumo do concurso, observações relevantes…"
                    />
                  </Field>
                </div>
              </section>

              {/* Card: Cronograma */}
              <section className="rounded-2xl border border-black/[0.07] bg-white shadow-sm">
                <div className="border-b border-black/[0.06] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4.5 w-4.5 text-violet-500" />
                      <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-gray-500">
                        Cronograma
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{draftStages.length}</span>
                      </h2>
                    </div>
                    <button type="button" onClick={addStage} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1.5 text-[11.5px] font-semibold text-violet-700 hover:bg-violet-100">
                      <Plus className="h-3 w-3" /> Etapa
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-black/[0.04] px-6">
                  {draftStages.length === 0 ? (
                    <p className="py-8 text-center text-[12.5px] text-gray-400">
                      Nenhuma etapa identificada. Clique em &quot;+ Etapa&quot; para adicionar.
                    </p>
                  ) : draftStages.map((stage, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-4">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-violet-200 bg-violet-50">
                        <span className="text-[9px] font-extrabold text-violet-600">{idx + 1}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          className="field-input font-semibold"
                          placeholder="Nome da etapa"
                          value={stage.name}
                          onChange={(e) => updateStage(idx, { name: e.target.value })}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <input
                              type="date"
                              className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12px] text-gray-700 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-200"
                              value={stage.dateStart ?? ""}
                              onChange={(e) => updateStage(idx, { dateStart: e.target.value || undefined })}
                              title="Data de início"
                            />
                          </div>
                          {stage.dateStart && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-gray-400">até</span>
                              <input
                                type="date"
                                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12px] text-gray-700 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-200"
                                value={stage.dateEnd ?? ""}
                                onChange={(e) => updateStage(idx, { dateEnd: e.target.value || undefined })}
                                title="Data de término"
                              />
                            </div>
                          )}
                          {stage.dateStart && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                              {fmtDate(stage.dateStart)}{stage.dateEnd ? ` – ${fmtDate(stage.dateEnd)}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeStage(idx)} className="mt-1 shrink-0 rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* ── Coluna direita: Cargos e Matérias ── */}
            <section className="rounded-2xl border border-black/[0.07] bg-white shadow-sm">
              <div className="border-b border-black/[0.06] px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4.5 w-4.5 text-violet-500" />
                    <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-gray-500">
                      Cargos e Matérias
                      <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{draftJobRoles.length}</span>
                    </h2>
                  </div>
                  <button type="button" onClick={addDraftJobRole} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1.5 text-[11.5px] font-semibold text-violet-700 hover:bg-violet-100">
                    <Plus className="h-3 w-3" /> Cargo
                  </button>
                </div>
              </div>

              <div className="divide-y divide-black/[0.04] overflow-y-auto px-4" style={{ maxHeight: "calc(100vh - 200px)" }}>
                {draftJobRoles.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <Building2 className="h-10 w-10 text-gray-200" strokeWidth={1.5} />
                    <p className="text-[13.5px] font-semibold text-gray-500">Nenhum cargo identificado</p>
                    <p className="text-[12px] text-gray-400">A IA não encontrou cargos neste edital. Adicione manualmente.</p>
                    <button type="button" onClick={addDraftJobRole} className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-violet-700">
                      <Plus className="h-3.5 w-3.5" /> Adicionar cargo
                    </button>
                  </div>
                ) : (
                  draftJobRoles.map((jr, jrIdx) => (
                    <div key={jr._key} className="py-4">
                      {/* Cabeçalho do cargo */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-extrabold text-violet-700">
                          {jrIdx + 1}
                        </div>
                        <input
                          className="min-w-0 flex-1 rounded-lg border border-transparent bg-gray-50 px-3 py-2 text-[14px] font-bold text-gray-800 transition-colors placeholder:font-normal placeholder:text-gray-400 hover:border-gray-200 focus:border-violet-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100"
                          placeholder="Nome do cargo"
                          value={jr.name}
                          onChange={(e) => updateDraftJobRoleName(jr._key, e.target.value)}
                        />
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                            {jr.subjects.length} mat.
                          </span>
                          <button type="button" onClick={() => toggleDraftJobRole(jr._key)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            {jr.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button type="button" onClick={() => removeDraftJobRole(jr._key)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Matérias expandidas */}
                      {jr.expanded && (
                        <div className="mt-3 pl-9">
                          {jr.subjects.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {jr.subjects.map((s) => (
                                <span key={s} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-[12px] font-medium text-violet-700">
                                  {s}
                                  <button type="button" onClick={() => removeSubjectFromJobRole(jr._key, s)} className="rounded p-0.5 hover:bg-violet-200 hover:text-violet-900">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mb-2.5 text-[12px] text-gray-400">Nenhuma matéria. Adicione abaixo.</p>
                          )}
                          <SubjectAdder onAdd={(name) => addSubjectToJobRole(jr._key, name)} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>

          {/* Rodapé de ações */}
          <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-[13px] font-semibold text-gray-700">
                {draftJobRoles.length} cargo{draftJobRoles.length !== 1 ? "s" : ""} · {draftJobRoles.reduce((a, jr) => a + jr.subjects.length, 0)} matérias · {draftStages.length} etapa{draftStages.length !== 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-[12px] text-gray-400">Revise todas as informações antes de confirmar.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirming || !draft.name?.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40"
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirming ? "Criando…" : "Confirmar e criar concurso"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

// ─── Subject adder ────────────────────────────────────────────────────────────

function SubjectAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12.5px] text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
        placeholder="Adicionar matéria…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); } }
        }}
      />
      <button
        type="button"
        onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(""); } }}
        className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700 hover:bg-violet-100"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
