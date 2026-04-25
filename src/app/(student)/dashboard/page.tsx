import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Target, Trophy, Zap,
  ArrowRight, Calendar, MapPin, Briefcase,
  Play, TrendingUp, CheckCircle2, Database,
  Building2, Sparkles, ChevronRight,
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
          jobRole: { select: { id: true, name: true, area: true } },
        },
        take: 3,
      },
    },
  });

  const profileId = profile?.id ?? "";
  const mainComp = profile?.studentCompetitions?.[0] ?? null;

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

  const jobRoleArea =
    mainComp?.jobRole && "area" in mainComp.jobRole
      ? (mainComp.jobRole as { area?: string | null }).area ?? null
      : null;

  return (
    <div className="space-y-10 pb-12">

      {/* ═══════════════════════════════════════════════════════════════
          HEADER — saudação premium + card "70 dias" destacado
         ═══════════════════════════════════════════════════════════════ */}
      <header className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-violet-600">
            {greeting},
          </p>
          <h1 className="mt-2 text-[40px] font-extrabold leading-[1.05] tracking-tight text-[#0F172A] sm:text-[44px]">
            {firstName}
          </h1>
          <p className="mt-4 flex items-center gap-2 text-[14px] font-medium text-[#475569]">
            <Calendar className="h-[15px] w-[15px] text-violet-400" />
            {formatDate(now, "EEEE, dd 'de' MMMM 'de' yyyy")}
          </p>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-[#64748B]">
            <Sparkles className="h-[14px] w-[14px] text-amber-500" />
            Cada questão te aproxima da aprovação. Continue firme!
          </p>
        </div>

        {daysLeft !== null && (
          <div className="dash-exam-countdown shrink-0 self-start lg:min-w-[260px]">
            <Calendar className="h-8 w-8 shrink-0 text-amber-700/80" strokeWidth={1.8} />
            <div className="relative z-10">
              <p className="text-[44px] font-extrabold leading-none tracking-tight text-amber-900">
                {daysLeft}
              </p>
              <p className="mt-2 text-[12.5px] font-semibold leading-snug text-amber-800">
                {daysLeft === 1 ? "dia" : "dias"} para a prova
              </p>
            </div>
            <span className="dash-exam-countdown__icon" aria-hidden>🏆</span>
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          MÉTRICAS — 4 cards com ícones em blocos coloridos
         ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Questões respondidas",
            value: totalAnswered,
            icon: BookOpen,
            color: "#7C3AED",
            bg: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
            sub: `${weekTotal} essa semana`,
          },
          {
            label: "Taxa de acerto",
            value: `${accuracy}%`,
            icon: Target,
            color: accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626",
            bg:
              accuracy >= 70
                ? "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)"
                : accuracy >= 50
                ? "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)"
                : "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
            sub: `${correctAnswers} acertos no total`,
          },
          {
            label: "Treinos realizados",
            value: trainingSessions,
            icon: Zap,
            color: "#7C3AED",
            bg: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
            sub: "sessões de treino",
          },
          {
            label: "Simulados feitos",
            value: simulatedExams,
            icon: Trophy,
            color: "#059669",
            bg: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
            sub: "simulados completos",
          },
        ].map((s) => (
          <div key={s.label} className="dash-metric">
            <div className="dash-metric__icon" style={{ background: s.bg }}>
              <s.icon className="h-7 w-7" style={{ color: s.color }} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-tight text-[#64748B]">
                {s.label}
              </p>
              <p
                className="mt-3 text-[34px] font-extrabold leading-none tracking-tight"
                style={{ color: s.color }}
              >
                {s.value}
              </p>
              <p className="mt-3 text-[12px] leading-snug text-[#94A3B8]">{s.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          GRADE PRINCIPAL — concurso ativo (esq) + ações rápidas (dir)
         ═══════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">

        {/* ───── Coluna esquerda ───── */}
        <div className="space-y-7">

          {/* CARD HERO: Concurso ativo */}
          {mainComp ? (
            <div className="dash-card relative overflow-hidden border-[10px] rotate-[360deg] p-9 sm:p-12">
              {/* Ícone decorativo de fundo (afastado) */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-10 hidden text-violet-100 sm:block"
                style={{ opacity: 0.32 }}
              >
                <Building2 className="h-44 w-44" strokeWidth={1.1} />
              </div>

              <div className="relative m-[10px] p-[10px]">
                {/* ─── BADGES com pill-style premium e ponto pulsante ─── */}
                <div className="mb-7 flex flex-wrap items-center gap-3">
                  {mainComp.competition.status === "ACTIVE" ? (
                    <span className="dash-hero-badge--active">Ativo</span>
                  ) : (
                    <Badge variant="upcoming">Em breve</Badge>
                  )}
                  {mainComp.competition.examBoard && (
                    <span className="dash-hero-badge--banca">
                      {mainComp.competition.examBoard.acronym}
                    </span>
                  )}
                </div>

                {/* ─── TÍTULO afastado das bordas e do ícone decorativo ─── */}
                <h2 className="max-w-[640px] pr-2 text-[24px] font-extrabold leading-[1.32] tracking-tight text-[#0F172A] sm:text-[26px]">
                  {mainComp.competition.name}
                </h2>

                {/* ─── INFO em chips premium (grid 2 colunas) ─── */}
                <div className="mt-8 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {mainComp.competition.city && (
                    <div className="dash-hero-chip">
                      <span className="dash-hero-chip__icon">
                        <MapPin className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="dash-hero-chip__label">Local</span>
                        <span className="dash-hero-chip__value">
                          {mainComp.competition.city.name}, {mainComp.competition.city.state}
                        </span>
                      </div>
                    </div>
                  )}
                  {mainComp.jobRole && (
                    <div className="dash-hero-chip">
                      <span className="dash-hero-chip__icon">
                        <Briefcase className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="dash-hero-chip__label">Cargo</span>
                        <span className="dash-hero-chip__value">{mainComp.jobRole.name}</span>
                      </div>
                    </div>
                  )}
                  {jobRoleArea && (
                    <div className="dash-hero-chip">
                      <span className="dash-hero-chip__icon">
                        <Sparkles className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="dash-hero-chip__label">Área</span>
                        <span className="dash-hero-chip__value">{jobRoleArea}</span>
                      </div>
                    </div>
                  )}
                  {mainComp.competition.examDate && (
                    <div className="dash-hero-chip">
                      <span className="dash-hero-chip__icon">
                        <Calendar className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="dash-hero-chip__label">Data da prova</span>
                        <span className="dash-hero-chip__value">
                          {formatDate(mainComp.competition.examDate)}
                          {daysLeft !== null && daysLeft > 0 && (
                            <span className="ml-1.5 font-semibold text-violet-700">
                              · {formatCountdown(mainComp.competition.examDate)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Bloco "questões disponíveis" ─── */}
                {availableQuestions > 0 && (
                  <div className="mt-8 flex items-center gap-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50/50 px-6 py-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Database className="h-5 w-5 text-violet-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold leading-snug text-violet-900">
                        {availableQuestions.toLocaleString("pt-BR")} questões disponíveis
                      </p>
                      <p className="mt-1 text-[12.5px] text-violet-700/80">
                        {questionsBanca
                          ? `Da banca ${questionsBanca} nas suas matérias`
                          : "Nas suas matérias"}
                      </p>
                    </div>
                  </div>
                )}

                {/* ─── Botões maiores com mais respiro ─── */}
                <div className="mt-9 flex flex-wrap items-center gap-4 p-[10px]">
                  <Link
                    href={`/concursos/${mainComp.competitionId}/treino`}
                    className="dash-btn-primary"
                  >
                    <Play className="h-[17px] w-[17px]" strokeWidth={2.4} />
                    Treinar agora
                  </Link>
                  <Link
                    href={`/concursos/${mainComp.competitionId}`}
                    className="dash-btn-secondary"
                  >
                    Ver detalhes
                    <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="dash-card flex flex-col items-center justify-center px-8 py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
                <Trophy className="h-8 w-8 text-violet-300" strokeWidth={1.5} />
              </div>
              <p className="text-[16px] font-bold text-[#0F172A]">Nenhum concurso vinculado</p>
              <p className="mt-2 max-w-md text-[13.5px] text-[#64748B]">
                O administrador precisa vincular você a um concurso para liberar o conteúdo.
              </p>
            </div>
          )}

          {/* GRÁFICOS — lado a lado, cards generosos */}
          <div className="grid m-2.5 grid-cols-1 gap-6 p-2.5 lg:grid-cols-2">
            {/* Evolução semanal */}
            <div className="dash-card m-2.5 p-2.5">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-bold tracking-tight text-[#0F172A]">
                    Evolução semanal
                  </h3>
                  <p className="mt-1.5 text-[12px] text-[#94A3B8]">
                    Questões e acertos · 7 dias
                  </p>
                </div>
                {weekTotal > 0 && (
                  <div className="text-right">
                    <p className="text-[22px] font-extrabold leading-none text-violet-700">
                      {weekTotal}
                    </p>
                    <p className="mt-1.5 text-[10.5px] font-medium text-[#94A3B8]">
                      respondidas
                    </p>
                  </div>
                )}
              </div>
              <WeeklyPerformanceChart data={weekData} />
              {weekTotal > 0 && (
                <div className="mt-6 flex items-center gap-5 border-t border-slate-100 pt-4 text-[11.5px] text-[#64748B]">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />
                    Acertos
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200" />
                    Total
                  </span>
                </div>
              )}
            </div>

            {/* Taxa de acerto */}
            <div className="dash-card m-2.5 p-2.5">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-bold tracking-tight text-[#0F172A]">
                    Taxa de acerto
                  </h3>
                  <p className="mt-1.5 text-[12px] text-[#94A3B8]">
                    Evolução diária · 7 dias
                  </p>
                </div>
                {weekTotal > 0 && (
                  <span className="shrink-0 rounded-full bg-violet-50 px-3.5 py-1.5 text-[11.5px] font-bold text-violet-700">
                    Semana: {Math.round((weekCorrect / weekTotal) * 100)}%
                  </span>
                )}
              </div>
              <AccuracyTrendChart data={weekData} />
              {weekTotal > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-4 text-right text-[11.5px] text-[#94A3B8]">
                  {weekCorrect} de {weekTotal} acertos
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ───── Coluna direita: Ações rápidas + Plano + Outros ───── */}
        <aside className="space-y-6">

          {/* AÇÕES RÁPIDAS */}
          <div className="dash-card p-6 sm:p-7">
            <h3 className="m-2.5 p-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Ações rápidas
            </h3>
            <div>
              {[
                {
                  icon: Play,
                  label: "Iniciar Treino",
                  sub: "Questões das suas matérias",
                  href: mainComp ? `/concursos/${mainComp.competitionId}/treino` : "/concursos",
                  color: "#7C3AED",
                  bg: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
                  highlight: true,
                },
                {
                  icon: Target,
                  label: "Novo Simulado",
                  sub: "Teste cronometrado",
                  href: mainComp ? `/concursos/${mainComp.competitionId}/simulado` : "/concursos",
                  color: "#059669",
                  bg: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                },
                {
                  icon: TrendingUp,
                  label: "Ver Desempenho",
                  sub: "Análise completa",
                  href: mainComp ? `/concursos/${mainComp.competitionId}/desempenho` : "/concursos",
                  color: "#2563EB",
                  bg: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
                },
                {
                  icon: CheckCircle2,
                  label: "Revisar Erros",
                  sub: "Com explicação da IA",
                  href: "/revisar-erros",
                  color: "#D97706",
                  bg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                },
              ].map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="dash-quick-action group"
                >
                  <div
                    className="dash-quick-action__icon"
                    style={{ background: a.bg }}
                  >
                    <a.icon className="h-5 w-5" style={{ color: a.color }} strokeWidth={2.2} />
                  </div>
                  <div className="dash-quick-action__text">
                    <p className="truncate text-[14px] font-bold leading-tight text-[#0F172A]">
                      {a.label}
                    </p>
                    <p className="truncate text-[11.5px] leading-snug text-[#94A3B8]">
                      {a.sub}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* PLANO */}
          {profile?.plan && (
            <div className="dash-plan-card">
              <div className="relative z-10">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] opacity-80">
                  Seu plano
                </p>
                <p className="mt-2.5 text-[22px] font-extrabold leading-tight">
                  {profile.plan.name}
                </p>
                {profile.accessExpiresAt && (
                  <p className="mt-3 text-[12.5px] opacity-80">
                    Válido até {formatDate(profile.accessExpiresAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* OUTROS CONCURSOS */}
          {(profile?.studentCompetitions.length ?? 0) > 1 && (
            <div className="dash-card p-6 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  Mais concursos
                </h3>
                <Link
                  href="/concursos"
                  className="text-[12.5px] font-bold text-violet-600 hover:text-violet-700"
                >
                  Ver todos →
                </Link>
              </div>
              <div>
                {(profile?.studentCompetitions ?? []).slice(1).map((sc) => (
                  <Link
                    key={sc.id}
                    href={`/concursos/${sc.competitionId}`}
                    className="dash-quick-action group"
                  >
                    <div
                      className="dash-quick-action__icon"
                      style={{ background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)" }}
                    >
                      <Trophy className="h-5 w-5 text-violet-500" />
                    </div>
                    <span className="flex-1 truncate text-[13.5px] font-semibold text-[#0F172A]">
                      {sc.competition.name}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-violet-500" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
