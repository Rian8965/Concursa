import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatsCard } from "@/components/shared/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, Target, Trophy, Zap,
  ArrowRight, Clock, Calendar,
  Play, BarChart3, CheckCircle2, TrendingUp,
} from "lucide-react";
import { formatDate, formatCountdown } from "@/lib/utils/date";

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
          jobRole: true,
        },
        take: 4,
      },
    },
  });

  const profileId = profile?.id ?? "";

  const [totalAnswered, correctAnswers, trainingSessions, simulatedExams] =
    await Promise.all([
      prisma.studentAnswer.count({ where: { studentProfileId: profileId } }),
      prisma.studentAnswer.count({ where: { studentProfileId: profileId, isCorrect: true } }),
      prisma.trainingSession.count({ where: { studentProfileId: profileId } }),
      prisma.simulatedExam.count({ where: { studentProfileId: profileId, status: "COMPLETED" } }),
    ]);

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
  const firstName = session.user.name?.split(" ")[0] ?? "Aluno";

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const mainCompetition = profile?.studentCompetitions[0];
  const daysLeft = mainCompetition?.competition?.examDate
    ? Math.max(0, Math.floor((mainCompetition.competition.examDate.getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="orbit-stack w-full max-w-[1120px] animate-fade-up">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="orbit-kicker">{greeting}</p>
          <h1 className="text-[clamp(1.8rem,3.1vw,2.35rem)] font-extrabold tracking-tight text-[var(--text-primary)]">
            {firstName}
          </h1>
          <p className="mt-2 text-[13.5px] font-medium text-[var(--text-muted)]">
            {formatDate(now, "EEEE, dd 'de' MMMM")}
          </p>
        </div>

        {daysLeft !== null && mainCompetition?.competition?.examDate && (
          <div
            className="relative overflow-hidden rounded-[18px] border border-[rgba(217,119,6,0.22)] bg-amber-50/70 px-5 py-3.5 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset,0_10px_30px_rgba(217,119,6,0.10)]"
          >
            <div className="absolute inset-0 opacity-[0.22]" style={{ background: "radial-gradient(600px 150px at 30% 10%, rgba(217,119,6,0.25), transparent 60%)" }} />
            <div className="relative text-center">
              <p className="text-[34px] font-extrabold leading-none tracking-tight text-amber-950">
                {daysLeft}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-amber-900/70">
                {daysLeft === 1 ? "dia para a prova" : "dias para a prova"}
              </p>
            </div>
          </div>
        )}
      </header>

      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Respondidas"
          value={totalAnswered}
          description="questões no total"
          icon={<BookOpen className="h-4 w-4" />}
          accent="#7C3AED"
          highlight
        />
        <StatsCard
          title="Taxa de acerto"
          value={accuracy}
          description={`${correctAnswers.toLocaleString("pt-BR")} acertos`}
          icon={<Target className="h-4 w-4" />}
          accent={accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626"}
        />
        <StatsCard
          title="Treinos"
          value={trainingSessions}
          description="sessões realizadas"
          icon={<Zap className="h-4 w-4" />}
          accent="#7C3AED"
        />
        <StatsCard
          title="Simulados"
          value={simulatedExams}
          description="concluídos"
          icon={<Trophy className="h-4 w-4" />}
          accent="#059669"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:gap-10">

        {/* ── Coluna esquerda: Concursos ── */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-[17px]">Meus concursos</h2>
            <Link href="/concursos" className="orbit-link inline-flex shrink-0 items-center gap-1.5 text-sm">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {profile?.studentCompetitions.length === 0 ? (
              <div className="rounded-[var(--r-3xl)] border border-dashed border-black/[0.12] bg-gradient-to-b from-white to-slate-50/80 px-6 py-10 text-center shadow-[var(--shadow-card)] sm:px-8 sm:py-12">
                <Trophy className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" strokeWidth={1.25} />
                <p className="text-[15px] font-semibold leading-snug text-[var(--text-primary)]">Nenhum concurso vinculado ainda</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
                  Aguarde o administrador configurar seu acesso
                </p>
              </div>
            ) : (
              profile?.studentCompetitions.map((sc, i) => {
                const comp = sc.competition;
                const days = comp.examDate
                  ? Math.max(0, Math.floor((comp.examDate.getTime() - Date.now()) / 86400000))
                  : null;
                const pct = days !== null ? Math.min(100, ((365 - days) / 365) * 100) : 0;

                return (
                  <div key={sc.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="rounded-2xl border border-black/[0.07] bg-white px-5 py-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-float)] sm:px-6 sm:py-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2.5 flex flex-wrap gap-1.5">
                            <Badge variant={comp.status === "ACTIVE" ? "active" : "upcoming"}>
                              {comp.status === "ACTIVE" ? "Ativo" : "Em breve"}
                            </Badge>
                            {comp.examBoard && (
                              <Badge variant="secondary">{comp.examBoard.acronym}</Badge>
                            )}
                            {!comp.examBoardDefined && (
                              <Badge variant="warning">Banca indefinida</Badge>
                            )}
                          </div>

                          <p className="break-words text-[15px] font-bold leading-snug tracking-tight text-[var(--text-primary)] sm:text-base">
                            {comp.name}
                          </p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[#6B7280]">
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden>📍</span> {comp.city.name}, {comp.city.state}
                            </span>
                            {sc.jobRole && (
                              <span className="inline-flex items-center gap-1">
                                <span aria-hidden>💼</span> {sc.jobRole.name}
                              </span>
                            )}
                            {comp.examDate && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(comp.examDate)}
                              </span>
                            )}
                          </div>

                          {days !== null && days > 0 && (
                            <div className="mt-3">
                              <span className="mb-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#7C3AED]">
                                <Clock className="h-3 w-3" />
                                {formatCountdown(comp.examDate!)}
                              </span>
                              <Progress value={pct} className="h-[3px]" />
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/concursos/${comp.id}`}
                          className="btn btn-purple w-full shrink-0 justify-center sm:w-auto sm:justify-center !px-5 !py-2.5 text-[13px] font-bold"
                        >
                          Estudar
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Coluna direita: Ações + plano ── */}
        <aside className="flex w-full min-w-0 flex-col gap-8 lg:max-w-none">
          <div>
            <h3 className="mb-4 text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-[17px]">Estudar agora</h3>
            <div className="flex flex-col gap-3">
              {[
                {
                  icon: Play,
                  label: "Iniciar Treino",
                  desc: "Questões aleatórias",
                  href: mainCompetition
                    ? `/concursos/${mainCompetition.competitionId}/treino`
                    : "/concursos",
                  accent: "#7C3AED",
                },
                {
                  icon: Target,
                  label: "Novo Simulado",
                  desc: "Teste cronometrado",
                  href: mainCompetition
                    ? `/concursos/${mainCompetition.competitionId}/simulado`
                    : "/concursos",
                  accent: "#059669",
                },
                {
                  icon: TrendingUp,
                  label: "Ver Desempenho",
                  desc: "Análise de evolução",
                  href: mainCompetition
                    ? `/concursos/${mainCompetition.competitionId}/desempenho`
                    : "/concursos",
                  accent: "#2563EB",
                },
                {
                  icon: CheckCircle2,
                  label: "Revisar Erros",
                  desc: "Questões que errei",
                  href: "/historico",
                  accent: "#D97706",
                },
              ].map((action) => (
                <div key={action.label}>
                  <Link
                    href={action.href}
                    className="group flex min-h-[4.5rem] items-center gap-4 rounded-2xl border border-black/[0.07] bg-white px-4 py-3.5 no-underline shadow-[var(--shadow-sm)] transition-all hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-md active:scale-[0.99] sm:px-5 sm:py-4"
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
                      style={{
                        background: `${action.accent}14`,
                        border: `1px solid ${action.accent}28`,
                      }}
                    >
                      <action.icon className="h-[18px] w-[18px]" style={{ color: action.accent }} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="text-[14px] font-semibold leading-snug text-[var(--text-primary)]">{action.label}</p>
                      <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">{action.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" aria-hidden />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {profile?.plan && (
            <div className="relative isolate rounded-2xl border border-white/25 bg-gradient-to-br from-violet-600 via-violet-600 to-fuchsia-500 px-5 py-5 shadow-[0_16px_40px_rgba(124,58,237,0.28)] sm:px-6 sm:py-6">
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
                <div
                  className="absolute inset-0 opacity-[0.28]"
                  style={{ background: "radial-gradient(720px 280px at 20% 0%, rgba(255,255,255,0.45), transparent 55%)" }}
                />
              </div>
              <div className="relative z-[1] space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-white/85" aria-hidden />
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/80">Seu plano</p>
                </div>
                <p className="break-words text-lg font-extrabold leading-snug tracking-tight text-white sm:text-xl">{profile.plan.name}</p>
                {profile.accessExpiresAt && (
                  <p className="pt-0.5 text-[13px] font-medium leading-snug text-white/75">
                    Válido até {formatDate(profile.accessExpiresAt)}
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
