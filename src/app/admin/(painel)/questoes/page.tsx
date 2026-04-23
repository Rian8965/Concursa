"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Search, Edit2, Trash2, BookOpen, Filter, Eye, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Question {
  id: string;
  content: string;
  difficulty: string;
  status: string;
  year?: number | null;
  subject?: { name: string } | null;
  competition?: { name: string } | null;
  examBoard?: { acronym: string } | null;
  city?: { name: string; state: string } | null;
  jobRole?: { name: string } | null;
  aiMeta?: {
    confidence?: number | null;
    suggestedYear?: number | null;
    subject?: { name: string } | null;
    topic?: { name: string } | null;
    examBoard?: { acronym: string } | null;
    city?: { name: string; state: string } | null;
    jobRole?: { name: string } | null;
  } | null;
}

const DIFF_LABELS: Record<string, string> = { EASY: "Fácil", MEDIUM: "Médio", HARD: "Difícil" };

function diffBadgeClass(d: string) {
  if (d === "EASY") return "bg-emerald-50 text-emerald-800 ring-emerald-200/80";
  if (d === "MEDIUM") return "bg-amber-50 text-amber-900 ring-amber-200/80";
  if (d === "HARD") return "bg-red-50 text-red-800 ring-red-200/80";
  return "bg-gray-100 text-gray-700 ring-gray-200/80";
}

export default function AdminQuestoesPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    examBoardId: "",
    year: "",
    cityId: "",
    jobRoleId: "",
    subjectId: "",
  });
  const [filterData, setFilterData] = useState({
    examBoards: [] as { id: string; acronym: string; name: string }[],
    cities: [] as { id: string; name: string; state: string }[],
    jobRoles: [] as { id: string; name: string }[],
    subjects: [] as { id: string; name: string }[],
  });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const load = useCallback(async (q = "", f?: typeof filters) => {
    const eff = f ?? filtersRef.current;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("search", q);
    sp.set("limit", "50");
    if (eff.examBoardId) sp.set("examBoardId", eff.examBoardId);
    if (eff.year) sp.set("year", eff.year);
    if (eff.cityId) sp.set("cityId", eff.cityId);
    if (eff.jobRoleId) sp.set("jobRoleId", eff.jobRoleId);
    if (eff.subjectId) sp.set("subjectId", eff.subjectId);
    const res = await fetch(`/api/admin/questions?${sp.toString()}`);
    const data = await res.json();
    setQuestions(data.questions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    Promise.all([
      fetch("/api/admin/exam-boards").then((r) => r.json()),
      fetch("/api/admin/cities").then((r) => r.json()),
      fetch("/api/admin/job-roles").then((r) => r.json()),
      fetch("/api/admin/subjects").then((r) => r.json()),
    ]).then(([bd, cd, jd, sd]) => {
      setFilterData({
        examBoards: bd.examBoards ?? [],
        cities: cd.cities ?? [],
        jobRoles: jd.jobRoles ?? [],
        subjects: sd.subjects ?? [],
      });
    });
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta questão?")) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Questão excluída");
      load(search);
    } else toast.error("Erro ao excluir");
    setDeleting(null);
  }

  const emptyFilters = { examBoardId: "", year: "", cityId: "", jobRoleId: "", subjectId: "" };

  return (
    <>
    <div className="orbit-stack max-w-5xl animate-fade-up">
      <PageHeader
        eyebrow="Conteúdo"
        title="Questões"
        description={`${total} questão${total !== 1 ? "ões" : ""} cadastrada${total !== 1 ? "s" : ""}`}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilterOpen((v) => !v)} className="btn btn-ghost inline-flex items-center gap-2 rounded-2xl">
            <Filter className="h-3.5 w-3.5" />
            Filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
            className="btn btn-primary inline-flex items-center gap-2 rounded-2xl"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova questão
          </button>
        </div>
      </PageHeader>

      {filterOpen && (
        <div className="orbit-card-premium">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Banca</label>
              <select className="input" value={filters.examBoardId} onChange={(e) => setFilters((p) => ({ ...p, examBoardId: e.target.value }))}>
                <option value="">Todas</option>
                {filterData.examBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.acronym}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Ano</label>
              <input className="input" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2024" />
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Cidade</label>
              <select className="input" value={filters.cityId} onChange={(e) => setFilters((p) => ({ ...p, cityId: e.target.value }))}>
                <option value="">Todas</option>
                {filterData.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.state}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Cargo</label>
              <select className="input" value={filters.jobRoleId} onChange={(e) => setFilters((p) => ({ ...p, jobRoleId: e.target.value }))}>
                <option value="">Todos</option>
                {filterData.jobRoles.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Matéria</label>
              <select className="input" value={filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}>
                <option value="">Todas</option>
                {filterData.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost rounded-2xl"
              onClick={() => {
                setFilters(emptyFilters);
                load(search, emptyFilters);
              }}
            >
              Limpar
            </button>
            <button type="button" className="btn btn-primary rounded-2xl" onClick={() => load(search, filters)}>
              Aplicar
            </button>
          </div>
        </div>
      )}

      <div className="orbit-search-wrap">
        <Search className="orbit-search-icon" aria-hidden />
        <input
          className="input"
          placeholder="Buscar questões..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search, filters)}
        />
      </div>

      {loading ? (
        <div className="py-14 text-center">
          <div className="orbit-spinner" />
        </div>
      ) : questions.length === 0 ? (
        <div className="orbit-empty-state">
          <BookOpen className="mx-auto mb-4 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma questão encontrada</p>
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-2xl text-[13px]">
            <Plus className="h-3.5 w-3.5" />
            Cadastrar questão
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <div key={q.id} className="orbit-card-premium py-4">
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {q.subject && (
                      <span className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                        {q.subject.name}
                      </span>
                    )}
                    <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-bold ring-1", diffBadgeClass(q.difficulty))}>
                      {DIFF_LABELS[q.difficulty] ?? q.difficulty}
                    </span>
                    {q.year && (
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] ring-1 ring-gray-200/80">
                        {q.year}
                      </span>
                    )}
                    {!q.year && q.aiMeta?.suggestedYear && (
                      <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200/80">
                        Sugere {q.aiMeta.suggestedYear}
                      </span>
                    )}
                    {q.aiMeta?.confidence != null && (
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] ring-1 ring-gray-200/80">
                        IA {Math.round(q.aiMeta.confidence * 100)}%
                      </span>
                    )}
                    {q.status === "ACTIVE" ? (
                      <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200/80">
                        Ativa
                      </span>
                    ) : (
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] ring-1 ring-gray-200/80">
                        {q.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                    {q.content.length > 200 ? `${q.content.slice(0, 200)}…` : q.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
                    {q.competition && <span>{q.competition.name}</span>}
                    {q.examBoard?.acronym && <span>· {q.examBoard.acronym}</span>}
                    {q.city && (
                      <span>
                        · {q.city.name}/{q.city.state}
                      </span>
                    )}
                    {q.jobRole?.name && <span>· {q.jobRole.name}</span>}
                    {!q.examBoard?.acronym && q.aiMeta?.examBoard?.acronym && <span>· Sugere {q.aiMeta.examBoard.acronym}</span>}
                    {!q.city && q.aiMeta?.city && (
                      <span>
                        · Sugere {q.aiMeta.city.name}/{q.aiMeta.city.state}
                      </span>
                    )}
                    {!q.jobRole?.name && q.aiMeta?.jobRole?.name && <span>· Sugere {q.aiMeta.jobRole.name}</span>}
                    {!q.subject && q.aiMeta?.subject?.name && <span>· Sugere {q.aiMeta.subject.name}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewId(q.id)}
                    className="orbit-icon-btn orbit-icon-btn--purple"
                    title="Visualizar questão (como o aluno vê)"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(q.id);
                      setShowForm(true);
                    }}
                    className="orbit-icon-btn"
                    title="Editar"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="orbit-icon-btn orbit-icon-btn--warn text-xs font-bold"
                    title="IA: sugerir metadados"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/questions/${q.id}/classify`, { method: "POST" });
                        const d = await res.json();
                        if (!res.ok) throw new Error(d?.error ?? "Erro ao classificar");
                        toast.success("IA sugeriu metadados");
                        load(search, filters);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erro ao classificar");
                      }
                    }}
                  >
                    IA
                  </button>
                  {q.aiMeta && (
                    <button
                      type="button"
                      className="orbit-icon-btn orbit-icon-btn--purple px-2 text-xs font-bold"
                      title="Aplicar sugestões da IA"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/admin/questions/${q.id}/apply-ai`, { method: "POST" });
                          const d = await res.json();
                          if (!res.ok) throw new Error(d?.error ?? "Erro ao aplicar sugestões");
                          toast.success("Sugestões aplicadas");
                          load(search, filters);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro ao aplicar sugestões");
                        }
                      }}
                    >
                      Aplicar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    disabled={deleting === q.id}
                    className="orbit-icon-btn orbit-icon-btn--danger"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
      {showForm && (
        <QuestionModal
          id={editingId}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingId(null);
            load(search);
          }}
        />
      )}
      {previewId && (
        <QuestionPreviewModal
          id={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </>
  );
}

interface ModalProps {
  id: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyAlternatives = () => [
  { letter: "A", content: "" },
  { letter: "B", content: "" },
  { letter: "C", content: "" },
  { letter: "D", content: "" },
  { letter: "E", content: "" },
];

function QuestionModal({ id, onClose, onSaved }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [competitions, setCompetitions] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [related, setRelated] = useState<{ id: string; content: string; competition: { name: string } | null }[]>([]);
  const [checkingRelated, setCheckingRelated] = useState(false);
  const [form, setForm] = useState({
    content: "",
    supportText: "",
    competitionId: "",
    subjectId: "",
    difficulty: "MEDIUM",
    year: "",
    correctAnswer: "A",
    imageUrl: "",
    hasImage: false,
    alternatives: emptyAlternatives(),
  });

  useEffect(() => {
    Promise.all([fetch("/api/admin/competitions?limit=100").then((r) => r.json()), fetch("/api/admin/subjects").then((r) => r.json())]).then(
      ([cd, sd]) => {
        setCompetitions(cd.competitions ?? []);
        setSubjects(sd.subjects ?? []);
      },
    );
  }, []);

  useEffect(() => {
    if (!id) {
      setForm({
        content: "",
        supportText: "",
        competitionId: "",
        subjectId: "",
        difficulty: "MEDIUM",
        year: "",
        correctAnswer: "A",
        imageUrl: "",
        hasImage: false,
        alternatives: emptyAlternatives(),
      });
      setRelated([]);
      return;
    }
    fetch(`/api/admin/questions/${id}`)
      .then((r) => r.json())
      .then(({ question }) => {
        if (!question) return;
        const letters = ["A", "B", "C", "D", "E"] as const;
        const rawAlts = question.alternatives ?? [];
        setForm({
          content: question.content,
          supportText: question.supportText ?? "",
          competitionId: question.competitionId ?? "",
          subjectId: question.subjectId ?? "",
          difficulty: question.difficulty,
          year: question.year?.toString() ?? "",
          correctAnswer: question.correctAnswer,
          imageUrl: question.imageUrl ?? "",
          hasImage: Boolean(question.hasImage && question.imageUrl),
          alternatives: letters.map((letter, i) => ({
            letter,
            content: rawAlts[i]?.content ?? "",
          })),
        });
      });
  }, [id]);

  // #region agent log
  useLayoutEffect(() => {
    const el = backdropRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const panel = el.querySelector(".orbit-modal-panel");
    const pr = panel?.getBoundingClientRect();
    const head = el.querySelector("#question-modal-title");
    const hr = head?.getBoundingClientRect();
    let transformAncestors = 0;
    let p: HTMLElement | null = el.parentElement;
    const chain: { d: number; cls: string; transform: string }[] = [];
    for (let d = 0; p && d < 14; d++) {
      const cs = getComputedStyle(p);
      const hasT = cs.transform !== "none";
      if (hasT) transformAncestors++;
      chain.push({ d, cls: String(p.className).slice(0, 100), transform: hasT ? "has-transform" : "none" });
      p = p.parentElement;
    }
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        runId: "post-fix",
        hypothesisId: "H1",
        location: "questoes/page.tsx:QuestionModal",
        message: "modal layout: fixed ancestor + rects",
        data: {
          backdropTop: r.top,
          backdropBottom: r.bottom,
          panelTop: pr?.top,
          titleTop: hr?.top,
          viewportH: window.innerHeight,
          transformAncestors,
          chainFirst4: chain.slice(0, 4),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [id]);
  // #endregion

  async function save() {
    setSaving(true);
    const alts = form.alternatives.filter((a) => a.content.trim());
    if (!form.content.trim() || alts.length < 2) {
      toast.error("Preencha o enunciado e ao menos 2 alternativas");
      setSaving(false);
      return;
    }
    let correctAnswer = form.correctAnswer;
    if (!alts.some((a) => a.letter === correctAnswer)) {
      correctAnswer = alts[0].letter;
    }
    const url = id ? `/api/admin/questions/${id}` : "/api/admin/questions";
    const method = id ? "PUT" : "POST";
    const payload = {
      ...form,
      correctAnswer,
      alternatives: alts,
      status: "ACTIVE" as const,
      supportText: form.supportText.trim() || null,
      hasImage: Boolean(form.imageUrl),
      imageUrl: form.imageUrl || null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      toast.success(id ? "Questão atualizada!" : "Questão criada!");
      onSaved();
    } else {
      let msg = "Erro ao salvar";
      try {
        const text = await res.text();
        if (text.trim()) {
          const d = JSON.parse(text) as { error?: string };
          if (d.error) msg = d.error;
        } else if (res.status === 413) {
          msg = "Payload muito grande (imagem?). Reduza o tamanho ou use imagem menor.";
        } else {
          msg = `Erro ${res.status}${res.statusText ? ` (${res.statusText})` : ""}`;
        }
      } catch {
        msg = `Erro ${res.status}`;
      }
      toast.error(msg);
    }
    setSaving(false);
  }

  return (
    <div ref={backdropRef} className="orbit-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-modal-title"
        className="orbit-modal-panel orbit-modal-panel--md orbit-modal-panel--flex"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="orbit-modal-panel__head">
          <div className="flex items-center justify-between gap-3">
            <h2 id="question-modal-title" className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
              {id ? "Editar questão" : "Nova questão"}
            </h2>
            <button type="button" className="orbit-modal-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        <div className="orbit-modal-panel__body">
          <div className="orbit-form-stack">
          <div>
            <label className="orbit-form-label">Enunciado *</label>
            <textarea
              className="input min-h-[100px] resize-y"
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Digite o enunciado da questão..."
            />
          </div>

          <div>
            <label className="orbit-form-label">Texto de apoio (opcional)</label>
            <textarea
              className="input min-h-[72px] resize-y"
              rows={3}
              value={form.supportText}
              onChange={(e) => setForm({ ...form, supportText: e.target.value })}
              onBlur={async (e) => {
                const st = e.target.value.trim();
                if (st.length < 10) {
                  setRelated([]);
                  return;
                }
                setCheckingRelated(true);
                try {
                  const params = new URLSearchParams({ supportText: st });
                  if (form.competitionId) params.set("competitionId", form.competitionId);
                  if (id) params.set("excludeId", id);
                  const r = await fetch(`/api/admin/questions/related?${params}`);
                  const data = await r.json();
                  setRelated(data.questions ?? []);
                } catch {
                  setRelated([]);
                } finally {
                  setCheckingRelated(false);
                }
              }}
              placeholder="Artigo, trecho ou comando comum a várias questões (mesmo texto = vínculo para busca)"
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Ao sair do campo, o sistema verifica outras questões com o mesmo texto de apoio neste concurso (se selecionado).
            </p>
            {checkingRelated && <p className="mt-1 text-xs font-semibold text-violet-700">Verificando questões relacionadas…</p>}
            {related.length > 0 && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                <strong>{related.length}</strong> questão(ões) já usam exatamente este texto de apoio. Cadastre normalmente: todas ficam com o mesmo
                bloco; na listagem, edite cada uma pelo lápis.
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {related.slice(0, 5).map((q) => (
                    <li key={q.id}>
                      <span className="text-[var(--text-secondary)]">{q.competition?.name ?? "Geral"}</span> — {q.content.slice(0, 80)}
                      {q.content.length > 80 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="orbit-form-label">Imagem da questão (opcional)</label>
            <input
              type="file"
              accept="image/*"
              className="input py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-800"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setForm((prev) => ({
                    ...prev,
                    imageUrl: reader.result as string,
                    hasImage: true,
                  }));
                };
                reader.readAsDataURL(f);
              }}
            />
            {form.imageUrl ? (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="" className="max-h-[220px] max-w-full rounded-xl border border-black/[0.08]" />
                <button
                  type="button"
                  className="btn btn-ghost mt-2 rounded-xl text-xs"
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: "", hasImage: false }))}
                >
                  Remover imagem
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="orbit-form-label">Concurso</label>
              <select className="input" value={form.competitionId} onChange={(e) => setForm({ ...form, competitionId: e.target.value })}>
                <option value="">Geral</option>
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label">Matéria</label>
              <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Nenhuma</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label">Dificuldade</label>
              <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="EASY">Fácil</option>
                <option value="MEDIUM">Médio</option>
                <option value="HARD">Difícil</option>
              </select>
            </div>
          </div>

          <div>
            <label className="orbit-form-label">Alternativas *</label>
            {form.alternatives.map((alt, i) => (
              <div key={alt.letter} className="mb-2 flex items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    value={alt.letter}
                    checked={form.correctAnswer === alt.letter}
                    onChange={() => setForm({ ...form, correctAnswer: alt.letter })}
                    className="h-4 w-4 accent-violet-600"
                  />
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      form.correctAnswer === alt.letter ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
                    )}
                  >
                    {alt.letter}
                  </span>
                </div>
                <input
                  className="input min-w-0 flex-1"
                  value={alt.content}
                  onChange={(e) => {
                    const alts = [...form.alternatives];
                    alts[i] = { ...alts[i], content: e.target.value };
                    setForm({ ...form, alternatives: alts });
                  }}
                  placeholder={`Alternativa ${alt.letter}`}
                />
              </div>
            ))}
            <p className="mt-1 text-xs text-[var(--text-muted)]">Selecione o botão da alternativa correta</p>
          </div>

          <div>
            <label className="orbit-form-label">Ano</label>
            <input className="input w-36" type="number" placeholder="Ex: 2023" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          </div>
        </div>

        <div className="orbit-modal-panel__foot">
          <button type="button" onClick={onClose} className="btn btn-ghost rounded-2xl">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary min-w-[110px] rounded-2xl">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QuestionPreviewModal ──────────────────────────────────────────────────────

interface PreviewQuestion {
  id: string;
  content: string;
  supportText?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
  difficulty: string;
  year?: number | null;
  subject?: { name: string } | null;
  examBoard?: { acronym: string } | null;
  competition?: { name: string } | null;
  alternatives: { id: string; letter: string; content: string; imageUrl?: string | null; order?: number }[];
}

function diffColor(d: string): { bg: string; color: string } {
  if (d === "EASY") return { bg: "#ECFDF5", color: "#059669" };
  if (d === "HARD") return { bg: "#FEF2F2", color: "#DC2626" };
  return { bg: "#FFFBEB", color: "#D97706" };
}

function QuestionPreviewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState<PreviewQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/questions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setQuestion(d.question ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = question;
  const dc = q ? diffColor(q.difficulty) : { bg: "#FFFBEB", color: "#D97706" };
  const diffLabel = q?.difficulty === "EASY" ? "Fácil" : q?.difficulty === "HARD" ? "Difícil" : "Médio";
  const showImage = Boolean(q?.imageUrl && String(q.imageUrl).trim().length > 0);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-semibold text-gray-800">Visualização — como o aluno vê</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6" style={{ fontFamily: "var(--font-sans)" }}>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            </div>
          )}
          {!loading && !q && (
            <p className="py-10 text-center text-sm text-gray-400">Questão não encontrada.</p>
          )}
          {!loading && q && (
            <>
              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
                {q.subject?.name && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 20, letterSpacing: "0.02em" }}>
                    {q.subject.name}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, color: dc.color, background: dc.bg, padding: "3px 10px", borderRadius: 20 }}>
                  {diffLabel}
                </span>
                {q.year && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "3px 10px", borderRadius: 20 }}>
                    {q.year}
                  </span>
                )}
                {q.examBoard?.acronym && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "3px 10px", borderRadius: 20 }}>
                    {q.examBoard.acronym}
                  </span>
                )}
              </div>

              {/* Question card */}
              <div style={{ padding: "20px 24px", background: "#FFFFFF", borderRadius: 16, border: "1px solid #E5E7EB", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                {/* Support text */}
                {q.supportText && (
                  <div style={{ marginBottom: 16, padding: 14, background: "#F8F7FF", borderRadius: 12, border: "1px solid #EDE9FE" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Texto de apoio</p>
                    <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{q.supportText}</p>
                  </div>
                )}

                {/* Content */}
                <p style={{ fontSize: 15.5, color: "#1F2937", lineHeight: 1.7, fontWeight: 500, whiteSpace: "pre-wrap" }}>
                  {q.content}
                </p>

                {/* Question image */}
                {showImage && q.imageUrl && (
                  <div style={{ marginTop: 12 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={q.imageUrl}
                      alt=""
                      style={{ maxWidth: "100%", height: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}
                    />
                  </div>
                )}
              </div>

              {/* Alternatives */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(q.alternatives ?? []).map((alt) => {
                  const isSelected = selected === alt.letter;
                  const bg = isSelected ? "#EDE9FE" : "#FFFFFF";
                  const border = isSelected ? "#7C3AED" : "#E5E7EB";
                  const color = isSelected ? "#5B21B6" : "#374151";
                  const hasAltImage = Boolean(alt.imageUrl && String(alt.imageUrl).trim().length > 0);
                  return (
                    <button
                      key={alt.letter}
                      type="button"
                      onClick={() => setSelected((prev) => (prev === alt.letter ? null : alt.letter))}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 14,
                        padding: "14px 18px", borderRadius: 12,
                        background: bg, border: `1.5px solid ${border}`, color,
                        cursor: "pointer", transition: "all 0.15s", textAlign: "left",
                        width: "100%", fontFamily: "inherit",
                      }}
                    >
                      <span style={{
                        width: 28, height: 28, minWidth: 28, borderRadius: 8, flexShrink: 0,
                        background: isSelected ? "#7C3AED" : "#F3F4F6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700,
                        color: isSelected ? "#fff" : "#6B7280",
                      }}>
                        {alt.letter}
                      </span>
                      {hasAltImage && alt.imageUrl ? (
                        <div style={{ flex: 1 }}>
                          {alt.content && (
                            <span style={{ fontSize: 14, lineHeight: 1.55, display: "block", marginBottom: 6 }}>{alt.content}</span>
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={alt.imageUrl}
                            alt={`Alternativa ${alt.letter}`}
                            style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #E5E7EB" }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: 14, lineHeight: 1.55, paddingTop: 3 }}>{alt.content}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Note */}
              <p style={{ marginTop: 16, fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
                Clique em uma alternativa para destacar · Esta visualização é somente leitura
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
