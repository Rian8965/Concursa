"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  ArrowLeft,
  Users,
  Trophy,
  Activity,
  Target,
  TrendingUp,
  RefreshCw,
  Mail,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type CompetitionSummary = {
  id: string;
  name: string;
  status: string;
  examDate: string | null;
  examBoard: { acronym: string } | null;
  city: { name: string; state: string };
};

type StudentRow = {
  studentProfileId: string;
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  jobRole: string | null;
  answeredTotal: number;
  accuracy: number;
  correct: number;
  trainings: number;
  exams: number;
  lastActivityAt: string | null;
  weeklyAnswered: number;
  score: number;
  rank: number;
};

export default function AdminConcursoAlunosPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState<CompetitionSummary | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [summary, setSummary] = useState<{ students: number; answered: number; accuracyAvg: number; examsCompleted: number; trainingsCompleted: number } | null>(null);
  const [answersLast14d, setAnswersLast14d] = useState<Array<{ day: string; answered: number }>>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"rank" | "accuracy" | "answered" | "weekly">("rank");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/${id}/students`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar alunos");
      setCompetition(data.competition ?? null);
      setStudents(data.students ?? []);
      setSummary(data.summary ?? null);
      setAnswersLast14d(data.charts?.answersLast14d ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q
      ? students
      : students.filter((s) => (`${s.name} ${s.email} ${s.jobRole ?? ""}`).toLowerCase().includes(q));
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sort === "accuracy") return b.accuracy - a.accuracy || b.answeredTotal - a.answeredTotal;
      if (sort === "answered") return b.answeredTotal - a.answeredTotal || b.accuracy - a.accuracy;
      if (sort === "weekly") return b.weeklyAnswered - a.weeklyAnswered || b.accuracy - a.accuracy;
      return a.rank - b.rank;
    });
    return sorted;
  }, [students, search, sort]);

  const statusBadge = (s?: string) => {
    if (s === "ACTIVE") return <Badge variant="active">Ativo</Badge>;
    if (s === "UPCOMING") return <Badge variant="upcoming">Em breve</Badge>;
    if (s === "PAST") return <Badge variant="past">Encerrado</Badge>;
    if (s === "CANCELLED") return <Badge variant="cancelled">Cancelado</Badge>;
    return <Badge variant="secondary">{s ?? "-"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alunos do concurso"
        description={competition ? competition.name : "Carregando..."}
      >
        <div className="flex items-center gap-2">
          <Link href="/admin/concursos" className="btn btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </button>
        </div>
      </PageHeader>

      {competition && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Concurso</p>
                <p className="mt-1 line-clamp-2 text-[15px] font-extrabold text-slate-900">{competition.name}</p>
                <p className="mt-1 text-[12px] font-semibold text-slate-600">
                  {competition.city.name} — {competition.city.state}
                  {competition.examBoard?.acronym ? ` · ${competition.examBoard.acronym}` : ""}
                </p>
              </div>
              <div className="shrink-0">{statusBadge(competition.status)}</div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Participação</p>
                <p className="mt-1 text-[30px] font-black tracking-tight text-slate-900">{summary?.students ?? 0}</p>
                <p className="text-[12px] font-semibold text-slate-600">alunos ativos no concurso</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-slate-600">
              <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
                <p className="font-bold text-slate-800">{(summary?.trainingsCompleted ?? 0).toLocaleString("pt-BR")}</p>
                <p className="text-[11px]">treinos concluídos</p>
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
                <p className="font-bold text-slate-800">{(summary?.examsCompleted ?? 0).toLocaleString("pt-BR")}</p>
                <p className="text-[11px]">simulados concluídos</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Desempenho médio</p>
                <p className="mt-1 text-[30px] font-black tracking-tight text-slate-900">{summary?.accuracyAvg ?? 0}%</p>
                <p className="text-[12px] font-semibold text-slate-600">{(summary?.answered ?? 0).toLocaleString("pt-BR")} respostas no total</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-extrabold text-slate-900">Participação (últimos 14 dias)</p>
              <p className="text-[12px] text-slate-500">Volume de questões respondidas por dia</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={answersLast14d}>
                <defs>
                  <linearGradient id="a14" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="answered" stroke="#7C3AED" fill="url(#a14)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-extrabold text-slate-900">Ranking geral</p>
              <p className="text-[12px] text-slate-500">Ordenação por pontuação (desempenho + consistência)</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-2">
            {(filtered.slice(0, 8)).map((s) => (
              <Link
                key={s.studentProfileId}
                href={`/admin/concursos/${id}/alunos/${s.studentProfileId}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 transition hover:bg-violet-50/50",
                  s.rank <= 3 && "ring-1 ring-amber-200/70",
                )}
              >
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black",
                  s.rank === 1 && "bg-amber-100 text-amber-800",
                  s.rank === 2 && "bg-slate-200 text-slate-800",
                  s.rank === 3 && "bg-orange-100 text-orange-800",
                  s.rank > 3 && "bg-slate-100 text-slate-700",
                )}>
                  {s.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-extrabold text-slate-900">{s.name}</p>
                  <p className="truncate text-[11px] font-semibold text-slate-500">{s.jobRole ?? "Sem cargo"} · {s.accuracy}% · {s.answeredTotal} resp.</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-extrabold text-slate-900">Alunos inscritos</p>
            <p className="text-[12px] text-slate-500">Clique no aluno para abrir o relatório individual</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input h-10 w-[min(320px,100%)]"
              placeholder="Buscar aluno, email, cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="input h-10 w-[220px]" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="rank">Ordenar por ranking</option>
              <option value="accuracy">Ordenar por taxa de acerto</option>
              <option value="answered">Ordenar por respondidas</option>
              <option value="weekly">Ordenar por atividade (7d)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-14 text-center"><div className="orbit-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Nenhum aluno encontrado.</div>
        ) : (
          <div className="orbit-data-table-scroll orbit-data-table-scroll--lg">
            <div className="orbit-table-wrap">
              <table className="orbit-admin-table">
                <thead>
                  <tr>
                    {["#", "Aluno", "Cargo", "Respondidas", "Acerto", "Treinos", "Simulados", "Atividade (7d)", "Última atividade"].map((h) => (
                      <th key={h} className={cn((h === "#" || h === "Respondidas" || h === "Acerto" || h === "Treinos" || h === "Simulados" || h.includes("Atividade")) ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.studentProfileId}>
                      <td className="text-right tabular-nums font-extrabold text-slate-700">{s.rank}</td>
                      <td className="min-w-0">
                        <Link href={`/admin/concursos/${id}/alunos/${s.studentProfileId}`} className="block">
                          <p className="truncate font-extrabold text-[var(--text-primary)]">{s.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-slate-500">
                            <Mail className="h-3.5 w-3.5" /> {s.email}
                          </p>
                        </Link>
                      </td>
                      <td className="min-w-0 text-[13px] font-semibold text-[var(--text-secondary)]">{s.jobRole ?? "—"}</td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{s.answeredTotal}</td>
                      <td className="text-right tabular-nums font-extrabold text-slate-800">{s.accuracy}%</td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{s.trainings}</td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{s.exams}</td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{s.weeklyAnswered}</td>
                      <td className="text-right text-xs font-semibold text-slate-500">
                        {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

