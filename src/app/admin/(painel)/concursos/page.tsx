"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Search, Edit2, Trash2, Trophy, Upload, ChevronDown, ChevronRight, X } from "lucide-react";
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

// ── Edital draft types ──
type DraftJobRole = {
  _key: string;
  name: string;
  subjects: string[]; // subject names (free text from AI)
  expanded: boolean;
};
type DraftStage = string;

type EditalDraft = {
  name?: string;
  organization?: string;
  examBoard?: { acronym?: string; name?: string };
  cities?: { name?: string; state?: string }[];
  jobRoles?: { name: string; subjects?: { name: string }[] }[];
  stages?: { name: string }[];
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
    expanded: true,
  }));
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

  // Draft state (flat fields + cargos + etapas)
  const [draft, setDraft] = useState<EditalDraft | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [draftJobRoles, setDraftJobRoles] = useState<DraftJobRole[]>([]);
  const [draftStages, setDraftStages] = useState<DraftStage[]>([]);
  const [stageInput, setStageInput] = useState("");

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

      const ab = await editalFile.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      setPdfBase64(b64);

      const d: EditalDraft = data.draft ?? {};
      setDraft(d);
      setDraftJobRoles(draftToLocalJobRoles(d.jobRoles));
      setDraftStages((d.stages ?? []).map((s) => s.name).filter(Boolean));
      toast.success("Edital analisado. Revise os dados antes de confirmar.");
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
          jobRoles: draftJobRoles.map((jr) => ({
            name: jr.name,
            subjects: jr.subjects.map((s) => ({ name: s })),
          })),
          stages: draftStages.map((s) => ({ name: s })),
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
  function addDraftStage(name: string) {
    const t = name.trim();
    if (!t || draftStages.includes(t)) return;
    setDraftStages((p) => [...p, t]);
    setStageInput("");
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
        <div className="py-14 text-center"><div className="orbit-spinner" /></div>
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
                    <th key={h} className={h === "Questões" || h === "Alunos" || h === "Ações" ? "text-right" : "text-left"}>
                      {h}
                    </th>
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
                          <p className="mt-1.5 text-xs text-[var(--text-muted)]">{new Date(c.examDate).toLocaleDateString("pt-BR")}</p>
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
                          <Link href={`/admin/concursos/${c.id}`} className="orbit-icon-btn" title="Editar">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id, c.name)}
                            disabled={deleting === c.id}
                            className="orbit-icon-btn orbit-icon-btn--danger"
                            title="Excluir"
                          >
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
          className="orbit-modal-backdrop z-[120]"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setShowEdital(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edital-modal-title"
            className="orbit-modal-panel orbit-modal-panel--lg orbit-modal-panel--flex shadow-[0_18px_70px_rgba(0,0,0,0.22)]"
            style={{ maxWidth: 820 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orbit-modal-panel__head">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted)]">IA • Cadastro por edital</p>
                  <h2 id="edital-modal-title" className="mt-0.5 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                    Subir edital (PDF)
                  </h2>
                </div>
                <button type="button" className="orbit-modal-close shrink-0" onClick={() => setShowEdital(false)} aria-label="Fechar">×</button>
              </div>
            </div>

            <div className="orbit-modal-panel__body overflow-y-auto" style={{ maxHeight: "70vh" }}>
              {/* Step 1: Upload */}
              <div className="mb-5 rounded-2xl border border-black/[0.08] bg-[var(--bg-elevated)] p-4">
                <p className="mb-2 text-[12px] font-semibold text-[var(--text-primary)]">1) Enviar PDF do edital</p>
                <input
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-800"
                  onChange={(e) => setEditalFile(e.target.files?.[0] ?? null)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary rounded-2xl"
                    disabled={!editalFile || parsing}
                    onClick={parseEdital}
                  >
                    {parsing ? "Analisando edital..." : "Analisar com IA"}
                  </button>
                  {(editalFile || draft) && (
                    <button
                      type="button"
                      className="btn btn-ghost rounded-2xl"
                      onClick={() => { setEditalFile(null); setDraft(null); setPdfBase64(null); setDraftJobRoles([]); setDraftStages([]); }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                  PDFs com até 50+ páginas são suportados via processamento por blocos.
                </p>
              </div>

              {/* Step 2: Review (shown after parsing) */}
              {draft && (
                <div className="space-y-4">
                  <p className="text-[12px] font-semibold text-[var(--text-primary)]">2) Revisar e ajustar dados extraídos</p>

                  {/* General info */}
                  <div className="orbit-form-stack rounded-2xl border border-black/[0.08] bg-[var(--bg-surface)] p-4">
                    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Dados Gerais</p>
                    <div>
                      <label className="orbit-form-label">Nome *</label>
                      <input className="input" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="orbit-form-label">Banca (sigla)</label>
                        <input
                          className="input"
                          value={draft.examBoard?.acronym ?? ""}
                          onChange={(e) => setDraft({ ...draft, examBoard: { ...draft.examBoard, acronym: e.target.value } })}
                        />
                      </div>
                      <div>
                        <label className="orbit-form-label">Organização</label>
                        <input className="input" value={draft.organization ?? ""} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="orbit-form-label">Cidade (principal) *</label>
                        <input
                          className="input"
                          value={draft.cities?.[0]?.name ?? ""}
                          onChange={(e) => {
                            const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
                            cities[0] = { ...cities[0], name: e.target.value };
                            setDraft({ ...draft, cities });
                          }}
                        />
                      </div>
                      <div>
                        <label className="orbit-form-label">UF *</label>
                        <input
                          className="input"
                          value={draft.cities?.[0]?.state ?? ""}
                          onChange={(e) => {
                            const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
                            cities[0] = { ...cities[0], state: e.target.value };
                            setDraft({ ...draft, cities });
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="orbit-form-label">Data da prova</label>
                      <input
                        className="input"
                        value={draft.examDate ?? ""}
                        onChange={(e) => setDraft({ ...draft, examDate: e.target.value || undefined })}
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                    <div>
                      <label className="orbit-form-label">Descrição / notas</label>
                      <textarea
                        className="input min-h-[72px] resize-y"
                        rows={2}
                        value={draft.description ?? ""}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Cargos + matérias */}
                  <div className="rounded-2xl border border-black/[0.08] bg-[var(--bg-surface)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                        Cargos e Matérias
                      </p>
                      <button
                        type="button"
                        onClick={addDraftJobRole}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                      >
                        <Plus className="h-3 w-3" /> Cargo
                      </button>
                    </div>

                    {draftJobRoles.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">A IA não identificou cargos. Adicione manualmente.</p>
                    ) : (
                      <div className="space-y-2">
                        {draftJobRoles.map((jr) => (
                          <div key={jr._key} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                            <div className="flex items-center gap-2 bg-[var(--bg-elevated)] px-3 py-2">
                              <button type="button" onClick={() => toggleDraftJobRole(jr._key)} className="shrink-0 text-gray-400">
                                {jr.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                              <input
                                className="input flex-1 bg-transparent py-1 text-[13px] font-semibold"
                                placeholder="Nome do cargo"
                                value={jr.name}
                                onChange={(e) => updateDraftJobRoleName(jr._key, e.target.value)}
                              />
                              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                                {jr.subjects.length} mat.
                              </span>
                              <button type="button" onClick={() => removeDraftJobRole(jr._key)} className="shrink-0 text-gray-400 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {jr.expanded && (
                              <div className="px-3 pb-3 pt-2">
                                {/* Subjects list */}
                                {jr.subjects.length > 0 && (
                                  <div className="mb-2 flex flex-wrap gap-1.5">
                                    {jr.subjects.map((s) => (
                                      <span key={s} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                                        {s}
                                        <button type="button" onClick={() => removeSubjectFromJobRole(jr._key, s)} className="hover:text-red-500">
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Add subject */}
                                <SubjectAdder onAdd={(name) => addSubjectToJobRole(jr._key, name)} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Etapas */}
                  <div className="rounded-2xl border border-black/[0.08] bg-[var(--bg-surface)] p-4">
                    <p className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Etapas</p>
                    {draftStages.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {draftStages.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">
                            {s}
                            <button type="button" onClick={() => setDraftStages((p) => p.filter((x) => x !== s))} className="hover:text-red-500">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-[13px]"
                        placeholder="Adicionar etapa..."
                        value={stageInput}
                        onChange={(e) => setStageInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraftStage(stageInput); } }}
                      />
                      <button type="button" onClick={() => addDraftStage(stageInput)} className="btn btn-ghost rounded-xl px-3 text-xs">
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {draft && (
              <div className="orbit-modal-panel__foot">
                <button
                  type="button"
                  className="btn btn-ghost rounded-2xl"
                  disabled={confirming}
                  onClick={() => { setDraft(null); setPdfBase64(null); setDraftJobRoles([]); setDraftStages([]); }}
                >
                  Limpar rascunho
                </button>
                <button
                  type="button"
                  className="btn btn-primary min-w-[180px] rounded-2xl"
                  disabled={confirming || !draft.name}
                  onClick={confirmCreate}
                >
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

// Small helper component for adding a subject name inline
function SubjectAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-1.5">
      <input
        className="input flex-1 py-1 text-[12px]"
        placeholder="Nome da matéria..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (value.trim()) { onAdd(value.trim()); setValue(""); }
          }
        }}
      />
      <button
        type="button"
        onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(""); } }}
        className={cn("shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100")}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
