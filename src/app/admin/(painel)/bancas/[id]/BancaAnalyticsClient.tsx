"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpen, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

function pctLabel(v: number | null) {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function diffLabelFromAcc(acc: number | null) {
  if (acc == null) return "—";
  if (acc > 0.7) return "Fácil";
  if (acc >= 0.5) return "Média";
  return "Difícil";
}

function BadgeKpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="orbit-card-premium p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-violet-50 p-2 text-violet-700 ring-1 ring-violet-200/60">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
          <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">{value}</p>
          {hint ? <p className="mt-1 text-[12px] text-[var(--text-muted)]">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function BancaAnalyticsClient({ boardId, subjectId }: { boardId: string; subjectId: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [qLoading, setQLoading] = useState(false);
  const [qData, setQData] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/exam-boards/${boardId}/analytics`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [boardId]);

  const subjects = (data?.subjects ?? []) as Array<any>;
  const kpis = data?.kpis ?? {};
  const boardAcronym = data?.board?.acronym ?? "";

  const selectedSubject = useMemo(() => {
    if (!subjectId) return null;
    return subjects.find((s) => s.subjectId === subjectId) ?? null;
  }, [subjectId, subjects]);

  useEffect(() => {
    if (!subjectId) { setQData(null); return; }
    setQLoading(true);
    const sp = new URLSearchParams();
    sp.set("subjectId", subjectId);
    sp.set("page", String(page));
    sp.set("limit", "25");
    if (search.trim()) sp.set("search", search.trim());
    if (status) sp.set("status", status);
    fetch(`/api/admin/exam-boards/${boardId}/questions?${sp.toString()}`)
      .then((r) => r.json())
      .then((d) => setQData(d))
      .finally(() => setQLoading(false));
  }, [boardId, subjectId, page, search, status]);

  if (loading) {
    return <div className="py-10 text-center text-sm text-[var(--text-muted)]">Carregando estatísticas…</div>;
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <BadgeKpi
          icon={<BarChart3 className="h-4 w-4" />}
          label="Taxa média de acerto"
          value={pctLabel(kpis.accuracy ?? null)}
          hint={`Dificuldade estimada: ${diffLabelFromAcc(kpis.accuracy ?? null)}`}
        />
        <BadgeKpi
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Respostas de alunos"
          value={(kpis.totalAnswers ?? 0).toLocaleString("pt-BR")}
          hint="Total de respostas registradas em questões dessa banca"
        />
        <BadgeKpi
          icon={<BookOpen className="h-4 w-4" />}
          label="Matérias com questões"
          value={(kpis.totalSubjects ?? 0).toLocaleString("pt-BR")}
          hint="Matérias que possuem ao menos 1 questão dessa banca"
        />
      </div>

      <div className="orbit-panel">
        <div className="orbit-panel-header">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Navegação</p>
            <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
              Matérias da banca
            </p>
          </div>
          {subjectId ? (
            <button className="btn btn-ghost rounded-2xl" type="button" onClick={() => router.push(`/admin/bancas/${boardId}`)}>
              Limpar filtro
            </button>
          ) : null}
        </div>
        <div className="orbit-panel-body">
          {subjects.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Ainda não há matérias vinculadas (sem questões com matéria definida).</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => {
                const isSelected = subjectId === s.subjectId;
                const acc = s.accuracy as number | null;
                return (
                  <button
                    key={s.subjectId}
                    type="button"
                    onClick={() => { setPage(1); router.push(`/admin/bancas/${boardId}?subjectId=${encodeURIComponent(s.subjectId)}`); }}
                    className={isSelected ? "orbit-card-premium p-4 ring-2 ring-violet-200" : "orbit-card-premium p-4 hover:shadow-sm"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-extrabold text-[var(--text-primary)]">{s.subjectName}</p>
                        <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                          {s.totalQuestions.toLocaleString("pt-BR")} questão(ões)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-extrabold text-[var(--text-primary)]">{pctLabel(acc)}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]">
                          {acc != null && acc < 0.5 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                          {diffLabelFromAcc(acc)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {subjectId && (
        <div className="orbit-panel">
          <div className="orbit-panel-header">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Questões</p>
              <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                {selectedSubject?.subjectName ?? "Matéria"} · {boardAcronym}
              </p>
            </div>
          </div>
          <div className="orbit-panel-body">
            <div className="flex flex-wrap gap-2">
              <input className="input w-full sm:w-[380px]" placeholder="Buscar por DQ001 ou texto..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="input w-full sm:w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Status (todos)</option>
                <option value="ACTIVE">Ativa</option>
                <option value="INACTIVE">Inativa</option>
                <option value="PENDING_REVIEW">Pendente</option>
                <option value="REJECTED">Rejeitada</option>
              </select>
              <button type="button" className="btn btn-primary rounded-2xl" onClick={() => setPage(1)}>
                Buscar
              </button>
            </div>

            {qLoading ? (
              <p className="mt-6 text-sm text-[var(--text-muted)]">Carregando questões…</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {(qData?.questions ?? []).map((q: any) => (
                  <div key={q.id} className="orbit-card-premium p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {q.code ? (
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-800">
                          {q.code}
                        </span>
                      ) : null}
                      {q.year ? (
                        <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700">{q.year}</span>
                      ) : null}
                      {q.topicName ? (
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">{q.topicName}</span>
                      ) : null}
                      {q.jobRoleName ? (
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                          {q.jobRoleName}{q.jobRoleLevel ? ` (${q.jobRoleLevel})` : ""}
                        </span>
                      ) : null}
                      <span className="ml-auto text-[11px] font-bold text-[var(--text-muted)]">
                        Resp.: {q.totalAnswers.toLocaleString("pt-BR")} · Acerto: {q.accuracy == null ? "—" : `${Math.round(q.accuracy * 100)}%`}
                      </span>
                    </div>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{q.snippet}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link className="btn btn-ghost rounded-2xl" href={`/admin/questoes?preview=${encodeURIComponent(q.id)}`}>
                        Visualizar
                      </Link>
                      <Link className="btn btn-ghost rounded-2xl" href={`/admin/questoes?edit=${encodeURIComponent(q.id)}`}>
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}

                <div className="mt-2 flex items-center justify-between text-sm text-[var(--text-muted)]">
                  <span>{qData?.total ?? 0} questão(ões)</span>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-ghost rounded-2xl" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Anterior
                    </button>
                    <button type="button" className="btn btn-ghost rounded-2xl" disabled={(page * (qData?.limit ?? 25)) >= (qData?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

