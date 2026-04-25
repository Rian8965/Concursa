import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Target, Trophy, Zap,
  ArrowRight, Clock, Calendar, MapPin, Briefcase,
  Play, TrendingUp, CheckCircle2, Database,
} from "lucide-react";
import { formatDate, formatCountdown } from "@/lib/utils/date";
import { WeeklyPerformanceChart, AccuracyTrendChart } from "@/components/student/PerformanceCharts";

// ─── helpers ──────────────────────────────────────────────────────────────────

function safeMs(d: Date | null | undefined): number {
  if (!d) return NaN;
  try { const t = new Date(d).getTime(); return isNaN(t) ? NaN : t; } catch { return NaN; }
}

const DAYS_BR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildWeekData(answers: { answeredAt: Date; isCorrect: boolean }[]) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dayStr = d.toDateString();
    const dayAnswers = answers.filter((a) => new Date(a.answeredAt).toDateString() === dayStr);
    const total = dayAnswers.length;
    const correct = dayAnswers.filter((a) => a.isCorrect).length;
    return {
      day: DAYS_BR[d.getDay()],
      total,
      correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function StudentDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      plan: true,
      studentCompetitions: {
        where: { isActive: true },
        include: {
          competition: { include: { city: true, examBoard: true } },
          jobRole: { select: { id: true, name: true } },
        },
        take: 3,
      },
    },
  });

  const profileId = profile?.id ?? "";
  const mainComp = profile?.studentCompetitions?.[0] ?? null;

  // Stats gerais
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalAnswered, correctAnswers, trainingSessions, simulatedExams, weekAnswers] = await Promise.all([
    prisma.studentAnswer.count({ where: { studentProfileId: profileId } }),
    prisma.studentAnswer.count({ where: { studentProfileId: profileId, isCorrect: true } }),
    prisma.trainingSession.count({ where: { studentProfileId: profileId } }),
    prisma.simulatedExam.count({ where: { studentProfileId: profileId, status: "COMPLETED" } }),
    prisma.studentAnswer.findMany({
      where: { studentProfileId: profileId, answeredAt: { gte: sevenDaysAgo } },
      select: { answeredAt: true, isCorrect: true },
    }),
  ]);

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
  const weekData = buildWeekData(weekAnswers as { answeredAt: Date; isCorrect: boolean }[]);
  const weekTotal = weekAnswers.length;
  const weekCorrect = weekAnswers.filter((a) => a.isCorrect).length;

  // Questões disponíveis (por banca ou por matérias)
  let availableQuestions = 0;
  let questionsBanca: string | null = null;
  if (mainComp) {
    const subjectIds: string[] = [];
    if (mainComp.jobRoleId) {
      const links = await prisma.competitionJobRoleSubject.findMany({
        where: { competitionId: mainComp.competitionId, jobRoleId: mainComp.jobRoleId },
        select: { subjectId: true },
      });
      subjectIds.push(...links.map((l) => l.subjectId));
    } else {
      const links = await prisma.competitionSubject.findMany({
        where: { competitionId: mainComp.competitionId },
        select: { subjectId: true },
      });
      subjectIds.push(...links.map((l) => l.subjectId));
    }

    const hasBanca = mainComp.competition.examBoardDefined && mainComp.competition.examBoardId;

    if (subjectIds.length > 0) {
      availableQuestions = await prisma.question.count({
        where: {
          status: "ACTIVE",
          alternatives: { some: {} },
          subjectId: { in: subjectIds },
          ...(hasBanca && { examBoardId: mainComp.competition.examBoardId! }),
        },
      });
      questionsBanca = hasBanca ? (mainComp.competition.examBoard?.acronym ?? null) : null;
    }
  }

  const firstName = session.user.name?.split(" ")[0] ?? "Aluno";
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const mainExamMs = safeMs(mainComp?.competition?.examDate);
  const daysLeft = !isNaN(mainExamMs) && mainExamMs > Date.now()
    ? Math.floor((mainExamMs - Date.now()) / 86400000)
    : null;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Cabeçalho ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-violet-500">{greeting}</p>
          <h1 className="mt-0.5 text-[26px] font-extrabold tracking-tight text-[#111827]">{firstName}</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            {formatDate(now, "EEEE, dd 'de' MMMM 'de' yyyy")}
          </p>
        </div>
        {daysLeft !== null && (
          <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-center">
            <p className="text-[28px] font-extrabold leading-none tracking-tight text-amber-900">{daysLeft}</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-700">
              {daysLeft === 1 ? "dia" : "dias"} para a prova
            </p>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Questões respondidas",
            value: totalAnswered,
            icon: BookOpen,
            color: "#7C3AED",
            bg: "#F5F3FF",
            sub: `${weekTotal} essa semana`,
          },
          {
            label: "Taxa de acerto",
            value: `${accuracy}%`,
            icon: Target,
            color: accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626",
            bg: accuracy >= 70 ? "#F0FDF4" : accuracy >= 50 ? "#FFFBEB" : "#FEF2F2",
            sub: `${correctAnswers} acertos no total`,
          },
          {
            label: "Treinos realizados",
            value: trainingSessions,
            icon: Zap,
            color: "#7C3AED",
            bg: "#F5F3FF",
            sub: "sessões de treino",
          },
          {
            label: "Simulados feitos",
            value: simulatedExams,
            icon: Trophy,
            color: "#059669",
            bg: "#F0FDF4",
            sub: "simulados completos",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11.5px] font-semibold text-gray-500">{s.label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: s.bg }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-[24px] font-extrabold leading-none tracking-tight" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Grade principal ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">

        {/* Coluna esquerda */}
        <div className="space-y-5">

          {/* Concurso principal */}
          {mainComp ? (
            <div className="overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-sm">
              <div className="h-[3px] bg-gradient-to-r from-violet-600 to-fuchsia-500" />
              <div className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant={mainComp.competition.status === "ACTIVE" ? "active" : "upcoming"}>
                    {mainComp.competition.status === "ACTIVE" ? "Ativo" : "Em breve"}
                  </Badge>
                  {mainComp.competition.examBoard && (
                    <span className="rounded-md bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                      {mainComp.competition.examBoard.acronym}
                    </span>
                  )}
                </div>

                <h2 className="text-[15px] font-bold leading-snug text-[#111827]">
                  {mainComp.competition.name}
                </h2>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-gray-500">
                  {mainComp.competition.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {mainComp.competition.city.name}, {mainComp.competition.city.state}
                    </span>
                  )}
                  {mainComp.jobRole && (
                    <span className="flex items-center gap-1.5 font-semibold text-[#374151]">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      {mainComp.jobRole.name}
                    </span>
                  )}
                  {mainComp.competition.examDate && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {formatDate(mainComp.competition.examDate)}
                      {daysLeft !== null && daysLeft > 0 && (
                        <span className="font-semibold text-violet-700">
                          · {formatCountdown(mainComp.competition.examDate)}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Questões disponíveis */}
                {availableQuestions > 0 && (
                  <div className="mt-4 flex items-center gap-3 rounded-lg bg-violet-50 px-4 py-3">
                    <Database className="h-4.5 w-4.5 shrink-0 text-violet-500" />
                    <div>
                      <p className="text-[13px] font-bold text-violet-900">
                        {availableQuestions.toLocaleString("pt-BR")} questões disponíveis
                      </p>
                      <p className="text-[11.5px] text-violet-600">
                        {questionsBanca
                          ? `Da banca ${questionsBanca} nas suas matérias`
                          : "Nas suas matérias"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/concursos/${mainComp.competitionId}/treino`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-violet-700"
                  >
                    <Play className="h-3.5 w-3.5" /> Treinar
                  </Link>
                  <Link
                    href={`/concursos/${mainComp.competitionId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
              <Trophy className="mx-auto mb-3 h-9 w-9 text-gray-300" strokeWidth={1.25} />
              <p className="text-[14px] font-semibold text-gray-700">Nenhum concurso vinculado</p>
              <p className="mt-1 text-[12.5px] text-gray-400">O administrador precisa vincular você a um concurso.</p>
            </div>
          )}

          {/* Gráficos lado a lado (weekly + accuracy trend) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Evolução semanal */}
            <div className="rounded-xl border border-black/[0.07] bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-[#111827]">Evolução semanal</h3>
                  <p className="text-[11.5px] text-gray-400">Questões e acertos · 7 dias</p>
                </div>
                {weekTotal > 0 && (
                  <div className="text-right">
                    <p className="text-[13px] font-bold text-violet-700">{weekTotal}</p>
                    <p className="text-[10.5px] text-gray-400">respondidas</p>
                  </div>
                )}
              </div>
              <WeeklyPerformanceChart data={weekData} />
              {weekTotal > 0 && (
                <div className="mt-2 flex items-center gap-3 text-[10.5px]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-violet-500" />
                    Acertos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-gray-200" />
                    Total
                  </span>
                </div>
              )}
            </div>

            {/* Taxa de acerto */}
            <div className="rounded-xl border border-black/[0.07] bg-white p-5 shadow-sm">
              <div className="mb-3">
                <h3 className="text-[13px] font-bold text-[#111827]">Taxa de acerto</h3>
                <p className="text-[11.5px] text-gray-400">Evolução diária · 7 dias</p>
              </div>
              <AccuracyTrendChart data={weekData} />
              {weekTotal > 0 && (
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-violet-700">
                    Semana: {weekTotal > 0 ? Math.round((weekCorrect / weekTotal) * 100) : 0}%
                  </span>
                  <span className="text-gray-400">{weekCorrect} de {weekTotal} acertos</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna direita: ações + outros concursos */}
        <div className="space-y-4">

          {/* Ações rápidas */}
          <div className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">Ações rápidas</h3>
            <div className="space-y-1.5">
              {[
                { icon: Play, label: "Iniciar Treino", sub: "Questões das suas matérias", href: mainComp ? `/concursos/${mainComp.competitionId}/treino` : "/concursos", color: "#7C3AED" },
                { icon: Target, label: "Novo Simulado", sub: "Teste cronometrado", href: mainComp ? `/concursos/${mainComp.competitionId}/simulado` : "/concursos", color: "#059669" },
                { icon: TrendingUp, label: "Ver Desempenho", sub: "Análise completa", href: mainComp ? `/concursos/${mainComp.competitionId}/desempenho` : "/concursos", color: "#2563EB" },
                { icon: CheckCircle2, label: "Revisar Erros", sub: "Com explicação da IA", href: "/revisar-erros", color: "#D97706" },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${a.color}18`, border: `1px solid ${a.color}28` }}>
                    <a.icon className="h-3.5 w-3.5" style={{ color: a.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#111827]">{a.label}</p>
                    <p className="text-[11px] text-gray-400">{a.sub}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-violet-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* Plano */}
          {profile?.plan && (
            <div className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4 text-white shadow-md">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-70">Seu plano</p>
              <p className="mt-1 text-[16px] font-extrabold">{profile.plan.name}</p>
              {profile.accessExpiresAt && (
                <p className="mt-1 text-[12px] opacity-65">Válido até {formatDate(profile.accessExpiresAt)}</p>
              )}
            </div>
          )}

          {/* Outros concursos */}
          {(profile?.studentCompetitions.length ?? 0) > 1 && (
            <div className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">Mais concursos</h3>
                <Link href="/concursos" className="text-[12px] font-semibold text-violet-600 hover:text-violet-800">
                  Ver todos
                </Link>
              </div>
              <div className="space-y-2">
                {(profile?.studentCompetitions ?? []).slice(1).map((sc) => (
                  <Link
                    key={sc.id}
                    href={`/concursos/${sc.competitionId}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                  >
                    <Trophy className="h-4 w-4 shrink-0 text-violet-400" />
                    <span className="flex-1 truncate text-[13px] font-medium text-gray-700">{sc.competition.name}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
