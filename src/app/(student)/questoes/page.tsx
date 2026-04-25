"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Search, Filter, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

type Row = {
  questionId: string;
  snippet: string;
  subjectName: string | null;
  topicName: string | null;
  examBoardAcronym: string | null;
  year: number | null;
  status: "CORRECT" | "WRONG" | "UNANSWERED";
  lastAnsweredAt: string | null;
  wrongCount: number;
  origin: string | null;
};

export default function QuestoesPage() {
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ questions: Row[]; total: number; limit: number } | null>(null);

  const [filters, setFilters] = useState({
    subjectId: "",
    topicId: "",
    examBoardId: "",
    year: "",
    status: "ALL",
    origin: "ALL",
  });

  const [meta, setMeta] = useState({
    subjects: [] as { id: string; name: string }[],
    topics: [] as { id: string; name: string }[],
    examBoards: [] as { id: string; acronym: string; name: string }[],
  });

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("limit", "25");
      if (search.trim()) sp.set("search", search.trim());
      if (filters.subjectId) sp.set("subjectId", filters.subjectId);
      if (filters.topicId) sp.set("topicId", filters.topicId);
      if (filters.examBoardId) sp.set("examBoardId", filters.examBoardId);
      if (filters.year) sp.set("year", filters.year);
      if (filters.status) sp.set("status", filters.status);
      if (filters.origin) sp.set("origin", filters.origin);
      const res = await fetch(`/api/student/questions?${sp.toString()}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Falha ao carregar");
      setData({ questions: j.questions ?? [], total: j.total ?? 0, limit: j.limit ?? 25 });
      setPage(j.page ?? p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [filters, page, search]);

  useEffect(() => {
    fetch("/api/student/question-filters")
      .then((r) => r.json())
      .then((d: { subjects?: { id: string; name: string }[]; examBoards?: { id: string; acronym: string; name: string }[] }) => {
        setMeta((prev) => ({ ...prev, subjects: d.subjects ?? [], examBoards: d.examBoards ?? [] }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.subjectId) { setMeta((p) => ({ ...p, topics: [] })); return; }
    fetch(`/api/student/topics?subjectId=${filters.subjectId}`)
      .then((r) => r.json())
      .then((d: { topics?: { id: string; name: string }[] }) => setMeta((p) => ({ ...p, topics: d.topics ?? [] })))
      .catch(() => {});
  }, [filters.subjectId]);

  useEffect(() => { void load(1); }, [load]);

  const total = data?.total ?? 0;
  const list = data?.questions ?? [];

  const empty = useMemo(() => ({
    subjectId: "", topicId: "", examBoardId: "", year: "", status: "ALL", origin: "ALL",
  }), []);

  return (
    <div className="orbit-stack max-w-4xl animate-fade-in">
      <PageHeader
        title="Questões"
        description="Filtre e encontre questões que você respondeu (ou que foram entregues e ainda não respondeu)."
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilterOpen((v) => !v)} className="btn btn-ghost inline-flex items-center gap-2 rounded-2xl">
            <Filter className="h-3.5 w-3.5" />
            Filtros
          </button>
        </div>
      </PageHeader>

      {filterOpen && (
        <div className="orbit-card-premium">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Matéria</label>
              <select className="input" value={filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value, topicId: "" }))}>
                <option value="">Todas</option>
                {meta.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Conteúdo</label>
              <select className="input" value={filters.topicId} disabled={!filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, topicId: e.target.value }))}>
                <option value="">{filters.subjectId ? "Todos" : "— escolha matéria —"}</option>
                {meta.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Banca</label>
              <select className="input" value={filters.examBoardId} onChange={(e) => setFilters((p) => ({ ...p, examBoardId: e.target.value }))}>
                <option value="">Todas</option>
                {meta.examBoards.map((b) => <option key={b.id} value={b.id}>{b.acronym}</option>)}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Ano</label>
              <input className="input" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2024" />
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Status</label>
              <select className="input" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                {["ALL","CORRECT","WRONG","UNANSWERED"].map((v) => (
                  <option key={v} value={v}>
                    {v === "ALL" ? "Todos" : v === "CORRECT" ? "Acertadas" : v === "WRONG" ? "Erradas" : "Não respondidas"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Tipo</label>
              <select className="input" value={filters.origin} onChange={(e) => setFilters((p) => ({ ...p, origin: e.target.value }))}>
                {["ALL","TRAINING","EXAM","MANUAL"].map((v) => (
                  <option key={v} value={v}>
                    {v === "ALL" ? "Todos" : v === "TRAINING" ? "Treino" : v === "EXAM" ? "Simulado" : "Apostila/Gabarito manual"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost rounded-2xl" onClick={() => { setFilters(empty); void load(1); }}>
              Limpar
            </button>
            <button type="button" className="btn btn-primary rounded-2xl" onClick={() => void load(1)}>
              Aplicar
            </button>
          </div>
        </div>
      )}

      <div className="orbit-search-wrap">
        <Search className="orbit-search-icon" aria-hidden />
        <input
          className="input"
          placeholder="Buscar por palavra-chave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(1)}
        />
      </div>

      {loading ? (
        <div className="py-14 text-center"><div className="orbit-spinner" /></div>
      ) : list.length === 0 ? (
        <div className="orbit-empty-state">
          <BookOpen className="mx-auto mb-4 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma questão encontrada</p>
          <Link href="/concursos" className="orbit-link mt-3 inline-block text-sm font-semibold">Ir para treino →</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[12px] text-[var(--text-muted)]">{total} resultado(s)</p>
          {list.map((r) => (
            <Link key={r.questionId} href={`/questoes/${r.questionId}`} className="orbit-card-premium hover:shadow-sm">
              <div className="flex gap-3">
                <div className="mt-0.5 shrink-0">
                  {r.status === "CORRECT" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                  ) : r.status === "WRONG" ? (
                    <XCircle className="h-5 w-5 text-red-500" strokeWidth={2} />
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-slate-200 bg-slate-50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {r.subjectName && (
                      <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                        {r.subjectName}
                      </span>
                    )}
                    {r.examBoardAcronym && (
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {r.examBoardAcronym}
                      </span>
                    )}
                    {r.year && (
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {r.year}
                      </span>
                    )}
                    {r.origin && (
                      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                        {r.origin === "TRAINING" ? "Treino" : r.origin === "EXAM" ? "Simulado" : r.origin === "MANUAL" ? "Manual" : r.origin}
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{r.snippet}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span>Status: <strong className={cn(r.status === "CORRECT" && "text-emerald-700", r.status === "WRONG" && "text-red-700")}>
                      {r.status === "CORRECT" ? "Acertou" : r.status === "WRONG" ? "Errou" : "Não respondeu"}
                    </strong></span>
                    {r.lastAnsweredAt && <span className="ml-auto">{formatDate(r.lastAnsweredAt)}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
