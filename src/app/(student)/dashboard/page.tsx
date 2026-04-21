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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">

        {/* ── Coluna esquerda: Concursos ── */}
        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight text-[#111827]">Meus concursos</h2>
            <Link href="/concursos" className="orbit-link inline-flex items-center gap-1.5">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {profile?.studentCompetitions.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-black/[0.12] bg-white px-6 py-10 text-center shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_28px_rgba(17,24,39,0.05)]">
                <Trophy className="mx-auto mb-3 h-9 w-9 text-[#D1D5DB]" />
                <p className="text-[14px] font-semibold text-[#374151]">Nenhum concurso vinculado ainda</p>
                <p className="mt-1 text-[13px] text-[#9CA3AF]">Aguarde o administrador configurar seu acesso</p>
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
                    <div className="rounded-[18px] border border-black/[0.07] bg-white px-6 py-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_28px_rgba(17,24,39,0.05)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(17,24,39,0.07)] active:scale-[0.99]">
                      <div className="flex items-start justify-between gap-4">
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

                          <p className="truncate text-[15px] font-bold tracking-tight text-[#111827]">
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
                          className="btn btn-purple flex-shrink-0 !px-4 !py-2 text-[12.5px]"
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
        </div>

        {/* ── Coluna direita: Ações ── */}
        <div className="flex flex-col gap-6">

          {/* Ações rápidas */}
          <div>
            <h3 className="mb-3 text-[14px] font-bold tracking-tight text-[#111827]">Estudar agora</h3>
            <div className="flex flex-col gap-2">
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
                <div key={action.label} className="transition-transform hover:-translate-y-px active:scale-[0.99]">
                  <Link
                    href={action.href}
                    className="flex items-center gap-3 rounded-[14px] border border-black/[0.07] bg-white px-4 py-3 no-underline shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_26px_rgba(17,24,39,0.04)] transition-colors hover:bg-[#FBFAFF]"
                  >
                    <div
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[12px]"
                      style={{
                        background: `${action.accent}12`,
                        border: `1px solid ${action.accent}22`,
                      }}
                    >
                      <action.icon className="h-4 w-4" style={{ color: action.accent }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-none text-[#111827]">{action.label}</p>
                      <p className="mt-1 text-[11.5px] text-[#9CA3AF]">{action.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#D1D5DB]" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Card do plano */}
          {profile?.plan && (
            <div
              className="relative overflow-hidden rounded-[18px] border border-[rgba(124,58,237,0.25)] bg-[linear-gradient(135deg,#7C3AED_0%,#A855F7_100%)] px-5 py-4 shadow-[0_14px_42px_rgba(124,58,237,0.25)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div className="absolute inset-0 opacity-[0.25]" style={{ background: "radial-gradient(700px 240px at 25% 10%, rgba(255,255,255,0.35), transparent 60%)" }} />
              <div className="relative">
                <div className="mb-1 flex items-center gap-2">
                  <Zap className="h-3 w-3 text-white/75" />
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.10em] text-white/70">
                    Seu plano
                  </p>
                </div>
                <p className="text-[16px] font-extrabold tracking-tight text-white">{profile.plan.name}</p>
                {profile.accessExpiresAt && (
                  <p className="mt-1 text-[11.5px] font-medium text-white/60">
                    Válido até {formatDate(profile.accessExpiresAt)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
