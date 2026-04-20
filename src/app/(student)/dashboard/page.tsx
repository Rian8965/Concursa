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
    <div className="animate-fade-up" style={{ maxWidth: 1080 }}>

      {/* ── Header ── */}
      <div
        className="flex items-start justify-between"
        style={{ marginBottom: 32 }}
      >
        <div>
          <p
            style={{
              fontSize: 12,
              color: "#9CA3AF",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {greeting}
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
            }}
          >
            {firstName}
          </h1>
          <p style={{ fontSize: 13.5, color: "#9CA3AF", marginTop: 4 }}>
            {formatDate(now, "EEEE, dd 'de' MMMM")}
          </p>
        </div>

        {daysLeft !== null && mainCompetition?.competition?.examDate && (
          <div
            style={{
              background: "#FAF5FF",
              border: "1px solid #E9D5FF",
              borderRadius: 16,
              padding: "14px 22px",
              textAlign: "center",
              minWidth: 120,
            }}
          >
            <p
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: "#7C3AED",
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              {daysLeft}
            </p>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, fontWeight: 500 }}>
              {daysLeft === 1 ? "dia para a prova" : "dias para a prova"}
            </p>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 32 }}
      >
        <div className="animate-fade-up delay-1">
          <StatsCard
            title="Respondidas"
            value={totalAnswered.toLocaleString("pt-BR")}
            description="questões no total"
            icon={<BookOpen style={{ width: 16, height: 16 }} />}
            accent="#7C3AED"
          />
        </div>
        <div className="animate-fade-up delay-2">
          <StatsCard
            title="Taxa de Acerto"
            value={`${accuracy}%`}
            description={`${correctAnswers} acertos`}
            icon={<Target style={{ width: 16, height: 16 }} />}
            accent={accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626"}
          />
        </div>
        <div className="animate-fade-up delay-3">
          <StatsCard
            title="Treinos"
            value={trainingSessions}
            description="sessões realizadas"
            icon={<Zap style={{ width: 16, height: 16 }} />}
            accent="#7C3AED"
          />
        </div>
        <div className="animate-fade-up delay-4">
          <StatsCard
            title="Simulados"
            value={simulatedExams}
            description="concluídos"
            icon={<Trophy style={{ width: 16, height: 16 }} />}
            accent="#059669"
          />
        </div>
      </div>

      {/* ── Grid principal ── */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 290px" }}>

        {/* ── Coluna esquerda: Concursos ── */}
        <div>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 14 }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.02em",
              }}
            >
              Meus Concursos
            </h2>
            <Link
              href="/concursos"
              className="flex items-center gap-1"
              style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}
            >
              Ver todos <ArrowRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profile?.studentCompetitions.length === 0 ? (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1.5px dashed #E5E7EB",
                  borderRadius: 16,
                  padding: "40px 24px",
                  textAlign: "center",
                }}
              >
                <Trophy style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>
                  Nenhum concurso vinculado ainda
                </p>
                <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>
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
                  <div
                    key={sc.id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div
                      className="card card-interactive"
                      style={{ padding: "20px 22px" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 10 }}>
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

                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#111827",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {comp.name}
                          </p>

                          <div
                            className="flex flex-wrap items-center gap-x-4 gap-y-1"
                            style={{ marginTop: 6 }}
                          >
                            <span style={{ fontSize: 12.5, color: "#6B7280" }}>
                              📍 {comp.city.name}, {comp.city.state}
                            </span>
                            {sc.jobRole && (
                              <span style={{ fontSize: 12.5, color: "#6B7280" }}>
                                💼 {sc.jobRole.name}
                              </span>
                            )}
                            {comp.examDate && (
                              <span
                                className="flex items-center gap-1"
                                style={{ fontSize: 12.5, color: "#6B7280" }}
                              >
                                <Calendar style={{ width: 11, height: 11 }} />
                                {formatDate(comp.examDate)}
                              </span>
                            )}
                          </div>

                          {days !== null && days > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <span
                                className="flex items-center gap-1"
                                style={{ fontSize: 11.5, color: "#7C3AED", fontWeight: 600, marginBottom: 6 }}
                              >
                                <Clock style={{ width: 10, height: 10 }} />
                                {formatCountdown(comp.examDate!)}
                              </span>
                              <Progress value={pct} className="h-[3px]" />
                            </div>
                          )}
                        </div>

                        <Link
                          href={`/concursos/${comp.id}`}
                          className="btn btn-purple flex-shrink-0"
                          style={{ fontSize: 12.5, padding: "7px 14px", gap: 6 }}
                        >
                          Estudar
                          <ArrowRight style={{ width: 12, height: 12 }} />
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Ações rápidas */}
          <div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              Estudar agora
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                <Link
                  key={action.label}
                  href={action.href}
                  className="hover-action flex items-center gap-3"
                  style={{
                    padding: "11px 14px",
                    borderRadius: 12,
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    textDecoration: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: `${action.accent}12`,
                      border: `1px solid ${action.accent}22`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <action.icon style={{ width: 14, height: 14, color: action.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1 }}>
                      {action.label}
                    </p>
                    <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>
                      {action.desc}
                    </p>
                  </div>
                  <ArrowRight style={{ width: 12, height: 12, color: "#D1D5DB" }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Card do plano */}
          {profile?.plan && (
            <div
              style={{
                borderRadius: 16,
                padding: "18px 20px",
                background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
                boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <Zap style={{ width: 12, height: 12, color: "rgba(255,255,255,0.7)" }} />
                <p
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.65)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Seu plano
                </p>
              </div>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                {profile.plan.name}
              </p>
              {profile.accessExpiresAt && (
                <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                  Válido até {formatDate(profile.accessExpiresAt)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
