"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Lightbulb, Loader2, CheckCircle2, Filter, Search, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";

type Item = {
  questionId: string;
  snippet: string;
  subjectName: string | null;
  topicName: string | null;
  examBoardAcronym: string | null;
  year: number | null;
  wrongCount: number;
  lastAttemptAt: string;
  origin: string | null;
};

export default function RevisarErrosPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({
    subjectId: "",
    topicId: "",
    examBoardId: "",
    year: "",
    origin: "ALL",
    start: "",
    end: "",
  });

  const [meta, setMeta] = useState({
    subjects: [] as { id: string; name: string }[],
    topics: [] as { id: string; name: string }[],
    examBoards: [] as { id: string; acronym: string; name: string }[],
  });

  const load = useCallback(async (p = page) => {
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    sp.set("limit", "25");
    if (search.trim()) sp.set("search", search.trim());
    if (filters.subjectId) sp.set("subjectId", filters.subjectId);
    if (filters.topicId) sp.set("topicId", filters.topicId);
    if (filters.examBoardId) sp.set("examBoardId", filters.examBoardId);
    if (filters.year) sp.set("year", filters.year);
    if (filters.origin) sp.set("origin", filters.origin);
    if (filters.start) sp.set("start", filters.start);
    if (filters.end) sp.set("end", filters.end);

    const res = await fetch(`/api/student/revisar-erros/compact?${sp.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Falha ao carregar");
      setItems([]);
      return;
    }
    setItems(data.items ?? []);
    setPage(data.page ?? p);
    setError(null);
  }, [filters, page, search]);

  useEffect(() => {
    fetch("/api/student/question-filters")
      .then((r) => r.json())
      .then((d: { subjects?: { id: string; name: string }[]; examBoards?: { id: string; acronym: string; name: string }[] }) => {
        setMeta((prev) => ({ ...prev, subjects: d.subjects ?? [], examBoards: d.examBoards ?? [] }));
      })
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!filters.subjectId) { setMeta((p) => ({ ...p, topics: [] })); return; }
    fetch(`/api/student/topics?subjectId=${filters.subjectId}`)
      .then((r) => r.json())
      .then((d: { topics?: { id: string; name: string }[] }) => setMeta((p) => ({ ...p, topics: d.topics ?? [] })))
      .catch(() => {});
  }, [filters.subjectId]);

  useEffect(() => {
    setLoading(true);
    void load(1).finally(() => setLoading(false));
  }, [load]);

  const runEnsure = useCallback(async () => {
    setEnsuring(true);
    try {
      const res = await fetch("/api/student/revisar-erros/ensure", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar explicações");
      toast.success(`Explicações geradas: ${data.filled ?? 0}`);
    } finally {
      setEnsuring(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="orbit-stack max-w-3xl animate-fade-in">
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      </div>
    );
  }

  const empty = { subjectId: "", topicId: "", examBoardId: "", year: "", origin: "ALL", start: "", end: "" };

  if (error) {
    return (
      <div className="orbit-stack max-w-3xl">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const list = items ?? [];

  return (
    <div className="orbit-stack max-w-3xl animate-fade-in">
      <PageHeader
        title="Revisar erros"
        description="Filtre erros por matéria, banca, período e origem. Clique para ver o detalhe completo."
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setFilterOpen((v) => !v)} className="btn btn-ghost inline-flex items-center gap-2 rounded-2xl">
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </button>
        <button
          type="button"
          disabled={ensuring}
          onClick={() => void runEnsure()}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
        >
          {ensuring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
          {ensuring ? "Gerando explicações…" : "Gerar explicações pendentes"}
        </button>
        <Link href="/concursos" className="text-sm font-semibold text-violet-700 hover:underline">
          Ir para treino
        </Link>
      </div>

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
              <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Origem</label>
              <select className="input" value={filters.origin} onChange={(e) => setFilters((p) => ({ ...p, origin: e.target.value }))}>
                {["ALL","TRAINING","EXAM","MANUAL"].map((v) => (
                  <option key={v} value={v}>{v === "ALL" ? "Todas" : v === "TRAINING" ? "Treino" : v === "EXAM" ? "Simulado" : "Apostila/Manual"}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Início</label>
                <input type="date" className="input" value={filters.start} onChange={(e) => setFilters((p) => ({ ...p, start: e.target.value }))} />
              </div>
              <div>
                <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Fim</label>
                <input type="date" className="input" value={filters.end} onChange={(e) => setFilters((p) => ({ ...p, end: e.target.value }))} />
              </div>
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

      {list.length === 0 ? (
        <div className="orbit-empty-state">
          <CheckCircle2 className="mx-auto mb-4 h-9 w-9 text-emerald-500" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhum erro registrado ainda</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Quando errar no treino ou no simulado, as questões aparecem aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((r) => (
            <Link key={r.questionId} href={`/questoes/${r.questionId}`} className="orbit-card-premium hover:shadow-sm">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-5 w-5 text-red-500" />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {r.subjectName && (
                      <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
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
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">{formatDate(r.lastAttemptAt)}</span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{r.snippet}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {r.wrongCount} erro(s) · última tentativa {formatDate(r.lastAttemptAt)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
