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
  Play, TrendingUp, CheckCircle2,
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
          jobRole: { select: { id: true, name: true } },
        },
        take: 4,
      },
    },
  });

  const profileId = profile?.id ?? "";

  const [totalAnswered, correctAnswers, trainingSessions, simulatedExams] = await Promise.all([
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

  const mainCompetition = profile?.studentCompetitions?.[0] ?? null;
  const mainExamDateMs = mainCompetition?.competition?.examDate
    ? (() => { try { const d = new Date(mainCompetition.competition.examDate!); return isNaN(d.getTime()) ? NaN : d.getTime(); } catch { return NaN; } })()
    : NaN;
  const daysLeft = !isNaN(mainExamDateMs) && mainExamDateMs > Date.now()
    ? Math.floor((mainExamDateMs - Date.now()) / 86400000)
    : null;

  const competitions = profile?.studentCompetitions ?? [];

  return (
    <div className="orbit-stack w-full max-w-[1100px] animate-fade-up">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="orbit-kicker">{greeting}</p>
          <h1 className="text-[clamp(1.7rem,3vw,2.2rem)] font-extrabold tracking-tight text-[var(--text-primary)]">
            {firstName}
          </h1>
          <p className="mt-1.5 text-[13px] font-medium text-[var(--text-muted)]">
            {formatDate(now, "EEEE, dd 'de' MMMM")}
          </p>
        </div>

        {daysLeft !== null && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-5 py-3 text-center">
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-amber-950">{daysLeft}</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-800/70">
              {daysLeft === 1 ? "dia para a prova" : "dias para a prova"}
            </p>
          </div>
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          title="Respondidas"
          value={totalAnswered}
          description="total de questões"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Concursos */}
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">Meus concursos</h2>
            <Link href="/concursos" className="orbit-link inline-flex items-center gap-1 text-[13px]">
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {competitions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/[0.10] bg-white px-6 py-10 text-center">
                <Trophy className="mx-auto mb-3 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.25} />
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">Nenhum concurso vinculado</p>
                <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">
                  O administrador precisa vincular você a um concurso e cargo.
                </p>
              </div>
            ) : (
              competitions.map((sc, i) => {
                const comp = sc.competition;
                let days: number | null = null;
                let pct = 0;
                if (comp.examDate) {
                  try {
                    const d = new Date(comp.examDate);
                    if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
                      days = Math.floor((d.getTime() - Date.now()) / 86400000);
                      pct = Math.min(100, ((365 - days) / 365) * 100);
                    }
                  } catch { /* ignorado */ }
                }

                return (
                  <div key={sc.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            <Badge variant={comp.status === "ACTIVE" ? "active" : "upcoming"}>
                              {comp.status === "ACTIVE" ? "Ativo" : "Em breve"}
                            </Badge>
                            {comp.examBoard && <Badge variant="secondary">{comp.examBoard.acronym}</Badge>}
                          </div>

                          <p className="text-[14px] font-bold leading-snug text-[var(--text-primary)]">{comp.name}</p>

                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#6B7280]">
                            {comp.city && (
                              <span>📍 {comp.city.name}{comp.city.state ? `, ${comp.city.state}` : ""}</span>
                            )}
                            {sc.jobRole && <span>💼 {sc.jobRole.name}</span>}
                            {comp.examDate && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(comp.examDate)}
                              </span>
                            )}
                          </div>

                          {days !== null && days > 0 && (
                            <div className="mt-2.5">
                              <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700">
                                <Clock className="h-3 w-3" />
                                {formatCountdown(comp.examDate!)}
                              </span>
                              <Progress value={pct} className="h-[3px]" />
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/concursos/${comp.id}`}
                          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700 sm:w-auto"
                        >
                          Estudar <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Ações + plano */}
        <aside className="flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-[14px] font-bold tracking-tight text-[var(--text-primary)]">Ações rápidas</h3>
            <div className="flex flex-col gap-2">
              {[
                { icon: Play, label: "Iniciar Treino", desc: "Questões aleatórias", href: mainCompetition ? `/concursos/${mainCompetition.competitionId}/treino` : "/concursos", accent: "#7C3AED" },
                { icon: Target, label: "Novo Simulado", desc: "Teste cronometrado", href: mainCompetition ? `/concursos/${mainCompetition.competitionId}/simulado` : "/concursos", accent: "#059669" },
                { icon: TrendingUp, label: "Ver Desempenho", desc: "Análise de evolução", href: mainCompetition ? `/concursos/${mainCompetition.competitionId}/desempenho` : "/concursos", accent: "#2563EB" },
                { icon: CheckCircle2, label: "Revisar Erros", desc: "Com explicação da IA", href: "/revisar-erros", accent: "#D97706" },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white px-3.5 py-3 transition-all hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-sm"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${action.accent}18`, border: `1px solid ${action.accent}28` }}
                  >
                    <action.icon className="h-4 w-4" style={{ color: action.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{action.label}</p>
                    <p className="text-[11.5px] text-[var(--text-muted)]">{action.desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB] transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
                </Link>
              ))}
            </div>
          </div>

          {profile?.plan && (
            <div className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4 text-white shadow-md">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] opacity-75">Seu plano</p>
              <p className="mt-1.5 text-[17px] font-extrabold tracking-tight">{profile.plan.name}</p>
              {profile.accessExpiresAt && (
                <p className="mt-1 text-[12px] opacity-70">Válido até {formatDate(profile.accessExpiresAt)}</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
