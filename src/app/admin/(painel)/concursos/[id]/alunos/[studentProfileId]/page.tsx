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
  Activity,
  TrendingUp,
  Target,
  Timer,
  BookOpen,
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
  BarChart,
  Bar,
} from "recharts";

type CompetitionSummary = {
  id: string;
  name: string;
  status: string;
  examDate: string | null;
  examBoard: { acronym: string } | null;
  city: { name: string; state: string };
};

type StudentSummary = {
  studentProfileId: string;
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  jobRole: string | null;
  enrolledAt: string;
  lastActivityAt: string | null;
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number;
  trainingsCompleted: number;
  examsCompleted: number;
  avgTimePerQuestionSeconds: number;
};

export default function AdminConcursoAlunoReportPage() {
  const { id, studentProfileId } = useParams<{ id: string; studentProfileId: string }>();
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState<CompetitionSummary | null>(null);
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [subjectPerf, setSubjectPerf] = useState<Array<{ subject: string; total: number; correct: number; accuracy: number }>>([]);
  const [evolution, setEvolution] = useState<Array<{ day: string; answered: number; accuracy: number }>>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/${id}/students/${studentProfileId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar relatório");
      setCompetition(data.competition ?? null);
      setStudent(data.student ?? null);
      setSubjectPerf(data.subjectPerformance ?? []);
      setEvolution(data.evolution ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id, studentProfileId]);

  const statusBadge = (s?: string) => {
    if (s === "ACTIVE") return <Badge variant="active">Ativo</Badge>;
    if (s === "UPCOMING") return <Badge variant="upcoming">Em breve</Badge>;
    if (s === "PAST") return <Badge variant="past">Encerrado</Badge>;
    if (s === "CANCELLED") return <Badge variant="cancelled">Cancelado</Badge>;
    return <Badge variant="secondary">{s ?? "-"}</Badge>;
  };

  const avgTimeLabel = useMemo(() => {
    const s = student?.avgTimePerQuestionSeconds ?? 0;
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")} / questão`;
  }, [student?.avgTimePerQuestionSeconds]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório do aluno"
        description={competition && student ? `${student.name} · ${competition.name}` : "Carregando..."}
      >
        <div className="flex items-center gap-2">
          <Link href={`/admin/concursos/${id}/alunos`} className="btn btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <button type="button" className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </button>
        </div>
      </PageHeader>

      {competition && student && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Aluno</p>
                <p className="mt-1 truncate text-[18px] font-black text-slate-900">{student.name}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-[12px] font-semibold text-slate-600">
                  <Mail className="h-3.5 w-3.5" /> {student.email}
                </p>
                <p className="mt-2 text-[12px] font-semibold text-slate-600">
                  Cargo: <span className="font-extrabold text-slate-900">{student.jobRole ?? "—"}</span>
                </p>
              </div>
              <div className="shrink-0">{statusBadge(competition.status)}</div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Última atividade: {student.lastActivityAt ? new Date(student.lastActivityAt).toLocaleString("pt-BR") : "—"}
            </p>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Taxa de acerto</p>
                <p className="mt-1 text-[34px] font-black tracking-tight text-slate-900">{student.accuracy}%</p>
                <p className="text-[12px] font-semibold text-slate-600">{student.totalCorrect} acertos · {student.totalAnswered} respondidas</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-slate-600">
              <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
                <p className="font-bold text-slate-800">{student.trainingsCompleted}</p>
                <p className="text-[11px]">treinos</p>
              </div>
              <div className="rounded-xl border border-black/[0.06] bg-white px-3 py-2">
                <p className="font-bold text-slate-800">{student.examsCompleted}</p>
                <p className="text-[11px]">simulados</p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Ritmo</p>
                <p className="mt-1 text-[20px] font-black tracking-tight text-slate-900">{avgTimeLabel}</p>
                <p className="text-[12px] font-semibold text-slate-600">tempo médio estimado</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Timer className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-extrabold text-slate-900">Evolução (30 dias)</p>
              <p className="text-[12px] text-slate-500">Respondidas e acerto estimado por dia</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={evolution}>
                <defs>
                  <linearGradient id="evo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Area yAxisId="left" type="monotone" dataKey="answered" stroke="#7C3AED" fill="url(#evo)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="accuracy" stroke="#059669" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-extrabold text-slate-900">Melhores/piores matérias</p>
              <p className="text-[12px] text-slate-500">Taxa de acerto por matéria</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={subjectPerf.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                <XAxis dataKey="subject" hide />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="accuracy" fill="#7C3AED" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {subjectPerf.slice(0, 6).map((s) => (
              <div key={s.subject} className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-[12px]">
                <span className="truncate font-bold text-slate-800">{s.subject}</span>
                <span className="shrink-0 font-extrabold text-slate-900">{s.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-14 text-center"><div className="orbit-spinner" /></div>
      )}
    </div>
  );
}

