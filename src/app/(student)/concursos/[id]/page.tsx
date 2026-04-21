import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Target,
  BarChart3,
  History,
  Download,
  Clock,
  MapPin,
  Building2,
  Calendar,
  Briefcase,
  ArrowRight,
  Play,
  Trophy,
  FileText,
} from "lucide-react";
import { formatDate, formatCountdown } from "@/lib/utils/date";

interface CompetitionPageProps {
  params: Promise<{ id: string }>;
}

const tabs = [
  { label: "Visão Geral", href: "", icon: Trophy },
  { label: "Matérias", href: "/materias", icon: BookOpen },
  { label: "Treino", href: "/treino", icon: Play },
  { label: "Simulado", href: "/simulado", icon: Target },
  { label: "Apostilas", href: "/apostilas", icon: FileText },
  { label: "Desempenho", href: "/desempenho", icon: BarChart3 },
  { label: "Histórico", href: "/historico", icon: History },
];

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) redirect("/dashboard");

  const studentCompetition = await prisma.studentCompetition.findUnique({
    where: {
      studentProfileId_competitionId: {
        studentProfileId: profile.id,
        competitionId: id,
      },
    },
    include: {
      competition: {
        include: {
          city: true,
          examBoard: true,
          subjects: {
            include: {
              subject: true,
            },
          },
        },
      },
      jobRole: true,
    },
  });

  if (!studentCompetition) notFound();

  const comp = studentCompetition.competition;

  // Desempenho por matéria
  const subjectStats = await Promise.all(
    comp.subjects.slice(0, 6).map(async (cs) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({
          where: {
            studentProfileId: profile.id,
            question: {
              competitionId: id,
              subjectId: cs.subjectId,
            },
          },
        }),
        prisma.studentAnswer.count({
          where: {
            studentProfileId: profile.id,
            isCorrect: true,
            question: {
              competitionId: id,
              subjectId: cs.subjectId,
            },
          },
        }),
      ]);

      return {
        subject: cs.subject,
        total,
        correct,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    })
  );

  const totalAnswered = subjectStats.reduce((acc, s) => acc + s.total, 0);
  const totalCorrect = subjectStats.reduce((acc, s) => acc + s.correct, 0);
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const daysLeft =
    comp.examDate
      ? Math.max(
          0,
          Math.floor((comp.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : null;

  return (
    <div className="animate-fade-in">
      {/* Hero do concurso */}
      <div className="card overflow-hidden" style={{ marginBottom: 20 }}>
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #7C3AED 0%, #A855F7 100%)",
          }}
        />
        <div style={{ padding: "24px 28px" }}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
                <Badge variant={comp.status === "ACTIVE" ? "active" : "upcoming"}>
                  {comp.status === "ACTIVE" ? "Ativo" : "Em breve"}
                </Badge>
                {comp.examBoard && (
                  <Badge variant="secondary">{comp.examBoard.acronym}</Badge>
                )}
                {!comp.examBoardDefined && (
                  <Badge variant="warning">Banca não definida</Badge>
                )}
              </div>

              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#111827",
                  letterSpacing: "-0.03em",
                  marginBottom: 4,
                }}
              >
                {comp.name}
              </h1>
              {comp.organization && (
                <p style={{ fontSize: 14, color: "#6B7280" }}>{comp.organization}</p>
              )}

              <div
                className="flex flex-wrap gap-x-5 gap-y-2"
                style={{ marginTop: 14, fontSize: 13.5, color: "#6B7280" }}
              >
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" style={{ color: "#D1D5DB" }} />
                  {comp.city.name}, {comp.city.state}
                </span>
                {studentCompetition.jobRole && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" style={{ color: "#D1D5DB" }} />
                    {studentCompetition.jobRole.name}
                  </span>
                )}
                {comp.examBoard && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" style={{ color: "#D1D5DB" }} />
                    {comp.examBoard.name}
                  </span>
                )}
                {comp.examDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" style={{ color: "#D1D5DB" }} />
                    {formatDate(comp.examDate)}
                  </span>
                )}
              </div>
            </div>

            {daysLeft !== null && comp.examDate && (
              <div
                className="hidden md:flex flex-col items-center"
                style={{
                  background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
                  borderRadius: 16,
                  padding: "18px 22px",
                  color: "#fff",
                  minWidth: 130,
                  boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
                }}
              >
                <Clock className="w-5 h-5" style={{ color: "rgba(255,255,255,0.6)", marginBottom: 6 }} />
                <p style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>
                  {daysLeft}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>
                  {daysLeft === 1 ? "dia restante" : "dias restantes"}
                </p>
              </div>
            )}
          </div>

          {totalAnswered > 0 && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 16px",
                background: "#F8F7FF",
                borderRadius: 12,
                border: "1px solid #EDE9FE",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ fontSize: 13, marginBottom: 8 }}
              >
                <span style={{ fontWeight: 600, color: "#374151" }}>Desempenho geral</span>
                <span style={{ fontWeight: 800, color: "#7C3AED" }}>{overallAccuracy}%</span>
              </div>
              <Progress value={overallAccuracy} className="h-2" />
              <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 6 }}>
                {totalAnswered} questões respondidas · {totalCorrect} acertos
              </p>
            </div>
          )}
        </div>
      </div>

      {comp.editalUrl && (
        <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p style={{ fontSize: 12, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
                Edital oficial
              </p>
              <p style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>
                Acesse o PDF do edital vinculado a este concurso.
              </p>
            </div>
            <a
              href={comp.editalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-purple"
              style={{ padding: "8px 12px", fontSize: 12.5 }}
            >
              <Download className="h-4 w-4" />
              Abrir edital
            </a>
          </div>
        </div>
      )}

      {/* Abas de navegação */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          border: "1px solid #E5E7EB",
          padding: 5,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: 24,
        }}
      >
        {tabs.map((tab) => {
          const href = `/concursos/${id}${tab.href}`;

          return (
            <Link
              key={tab.label}
              href={href}
              className="flex items-center gap-2 whitespace-nowrap"
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 500,
                color: "#6B7280",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              <tab.icon style={{ width: 14, height: 14 }} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ações */}
        <div className="lg:col-span-1">
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
              marginBottom: 12,
            }}
          >
            Estudar agora
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              {
                icon: Play,
                label: "Iniciar Treino",
                desc: "Questões aleatórias por matéria",
                href: `/concursos/${id}/treino`,
                primary: true,
              },
              {
                icon: Target,
                label: "Novo Simulado",
                desc: "Teste cronometrado completo",
                href: `/concursos/${id}/simulado`,
                primary: false,
              },
              {
                icon: Download,
                label: "Baixar Apostila",
                desc: "PDF gerado automaticamente",
                href: `/concursos/${id}/apostilas`,
                primary: false,
              },
              {
                icon: History,
                label: "Revisar Erros",
                desc: "Questões que errei",
                href: `/concursos/${id}/historico`,
                primary: false,
              },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="hover-action flex items-center gap-3"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: action.primary ? "#7C3AED" : "#FFFFFF",
                  border: action.primary ? "none" : "1px solid #E5E7EB",
                  textDecoration: "none",
                  boxShadow: action.primary
                    ? "0 4px 14px rgba(124,58,237,0.25)"
                    : "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: action.primary ? "rgba(255,255,255,0.15)" : "#F3F2FB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <action.icon
                    style={{
                      width: 14,
                      height: 14,
                      color: action.primary ? "#fff" : "#7C3AED",
                    }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: action.primary ? "#fff" : "#111827",
                      lineHeight: 1,
                    }}
                  >
                    {action.label}
                  </p>
                  <p
                    style={{
                      fontSize: 11.5,
                      color: action.primary ? "rgba(255,255,255,0.65)" : "#9CA3AF",
                      marginTop: 2,
                    }}
                  >
                    {action.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Matérias */}
        <div className="lg:col-span-2">
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#111827",
              letterSpacing: "-0.02em",
              marginBottom: 12,
            }}
          >
            Matérias — Desempenho
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comp.subjects.length === 0 ? (
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: 16,
                  padding: "32px 24px",
                  textAlign: "center",
                }}
              >
                <BookOpen style={{ width: 28, height: 28, color: "#D1D5DB", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13.5, color: "#9CA3AF" }}>
                  Nenhuma matéria cadastrada
                </p>
              </div>
            ) : (
              comp.subjects.map((cs, idx) => {
                const stats = subjectStats[idx];
                const accuracy = stats?.accuracy ?? 0;

                return (
                  <Link
                    key={cs.subjectId}
                    href={`/concursos/${id}/materias/${cs.subjectId}`}
                    className="card card-interactive flex items-center gap-4"
                    style={{ padding: "14px 18px", textDecoration: "none" }}
                  >
                    <div
                      style={{
                        width: 4,
                        height: 40,
                        borderRadius: 4,
                        flexShrink: 0,
                        background: cs.subject.color ?? "linear-gradient(180deg, #7C3AED, #A855F7)",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "#111827",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {cs.subject.name}
                      </p>
                      <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                        <Progress value={accuracy} className="flex-1 h-[5px]" />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#374151",
                            width: 32,
                            textAlign: "right",
                          }}
                        >
                          {accuracy}%
                        </span>
                      </div>
                      <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 3 }}>
                        {stats?.total ?? 0} respondidas
                      </p>
                    </div>
                    <ArrowRight style={{ width: 14, height: 14, color: "#D1D5DB", flexShrink: 0 }} />
                  </Link>
                );
              })
            )}
          </div>

          {comp.subjects.length > 6 && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <Link
                href={`/concursos/${id}/materias`}
                className="flex items-center justify-center gap-1"
                style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none" }}
              >
                Ver todas as {comp.subjects.length} matérias
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
