import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/shared/StatsCard";
import {
  Users, Trophy, HelpCircle, TrendingUp,
  AlertCircle, CheckCircle, Clock, Upload,
  ArrowRight, Plus,
} from "lucide-react";
import { formatDate } from "@/lib/utils/date";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  try {
    const [
      totalStudents, activeStudents,
      totalCompetitions, activeCompetitions,
      totalQuestions, activeQuestions,
      pendingImports,
      recentCompetitions, recentImports,
      totalAnswered, correctAnswers,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STUDENT", isActive: true } }),
      prisma.competition.count(),
      prisma.competition.count({ where: { status: "ACTIVE" } }),
      prisma.question.count(),
      prisma.question.count({ where: { status: "ACTIVE" } }),
      prisma.pDFImport.count({ where: { status: "REVIEW_PENDING" } }),
      prisma.competition.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { city: true, examBoard: true } }),
      prisma.pDFImport.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
      prisma.studentAnswer.count(),
      prisma.studentAnswer.count({ where: { isCorrect: true } }),
    ]);

    const avgAccuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

    return (
      <div className="admin-dashboard-root animate-fade-up w-full max-w-none">
        <header className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="orbit-kicker">Painel administrativo</p>
            <h1 className="text-[clamp(1.9rem,3.4vw,2.45rem)] font-extrabold tracking-tight text-[#111827]">
              Visão Geral
            </h1>
            <p className="mt-3 text-[14px] font-medium text-[#8B92A0]">
              {formatDate(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy")}
            </p>
          </div>

          <div className="transition-transform hover:-translate-y-px active:scale-[0.99]">
            <Link
              href="/admin/importacoes"
              className="btn btn-primary inline-flex min-h-[48px] items-center gap-2.5 self-start px-7 text-[15px] shadow-[0_12px_36px_rgba(124,58,237,0.28)] lg:self-auto"
            >
              <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              Importar PDF
            </Link>
          </div>
        </header>

        {pendingImports > 0 && (
          <div className="orbit-alert mb-12 items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-amber-100/90 text-amber-700 shadow-sm ring-1 ring-amber-200/80">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-amber-950">
                {pendingImports} importação{pendingImports > 1 ? "ões" : ""} aguardando revisão
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-amber-900/80">
                Revise e publique as questões para disponibilizá-las aos alunos.
              </p>
            </div>
            <Link
              href="/admin/importacoes"
              className="inline-flex flex-shrink-0 items-center gap-1.5 text-[14px] font-semibold text-amber-900 no-underline transition-colors hover:text-amber-950"
            >
              Revisar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-6 2xl:grid-cols-4">
          <StatsCard
            title="Alunos"
            value={totalStudents}
            description={`${activeStudents} ativos`}
            icon={<Users className="h-5 w-5" strokeWidth={2} />}
            accent="#7C3AED"
            highlight
          />
          <StatsCard
            title="Concursos"
            value={totalCompetitions}
            description={`${activeCompetitions} ativos`}
            icon={<Trophy className="h-5 w-5" strokeWidth={2} />}
            accent="#2563EB"
          />
          <StatsCard
            title="Questões"
            value={activeQuestions}
            description={`${totalQuestions.toLocaleString("pt-BR")} total`}
            icon={<HelpCircle className="h-5 w-5" strokeWidth={2} />}
            accent="#059669"
          />
          <StatsCard
            title="Desempenho médio"
            value={avgAccuracy}
            description={`${totalAnswered.toLocaleString("pt-BR")} respostas`}
            icon={<TrendingUp className="h-5 w-5" strokeWidth={2} />}
            accent="#D97706"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
        <section className="orbit-panel orbit-panel--dashboard-lists flex flex-col">
          <div className="orbit-panel-header items-center">
            <h2 className="text-lg font-bold tracking-tight text-[#111827]">Concursos recentes</h2>
            <Link href="/admin/concursos" className="orbit-link inline-flex items-center gap-1.5">
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="orbit-panel-body flex flex-1 flex-col space-y-1.5 pt-1">
            {recentCompetitions.length === 0 ? (
              <p className="flex flex-1 items-center justify-center py-16 text-center text-[14px] text-[#9CA3AF]">
                Nenhum concurso cadastrado
              </p>
            ) : (
              recentCompetitions.map((comp) => (
                <Link
                  key={comp.id}
                  href={`/admin/concursos/${comp.id}`}
                  className="hover-row flex items-center gap-4 rounded-2xl px-3 py-3.5 no-underline"
                >
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] border border-[rgba(124,58,237,0.12)]"
                    style={{
                      background: "linear-gradient(145deg, rgba(124,58,237,0.12), rgba(124,58,237,0.04))",
                      boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset",
                    }}
                  >
                    <Trophy className="h-5 w-5 text-[#7C3AED]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-snug text-[#111827]">{comp.name}</p>
                    <p className="mt-1 text-[13px] text-[#9CA3AF]">
                      {comp.city.name} — {comp.city.state}
                      {comp.examBoard && ` · ${comp.examBoard.acronym}`}
                    </p>
                  </div>
                  <Badge variant={comp.status === "ACTIVE" ? "active" : "upcoming"} className="text-xs">
                    {comp.status === "ACTIVE" ? "Ativo" : "Em breve"}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="orbit-panel orbit-panel--dashboard-lists flex flex-col">
          <div className="orbit-panel-header items-center">
            <h2 className="text-lg font-bold tracking-tight text-[#111827]">Importações recentes</h2>
            <Link href="/admin/importacoes" className="orbit-link inline-flex items-center gap-1.5">
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="orbit-panel-body flex flex-1 flex-col space-y-1.5 pt-1">
            {recentImports.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <Upload className="mb-4 h-11 w-11 text-[#D1D5DB]" />
                <p className="text-[14px] text-[#9CA3AF]">Nenhuma importação ainda</p>
                <Link href="/admin/importacoes" className="orbit-link mt-3 inline-block">
                  Importar primeiro PDF →
                </Link>
              </div>
            ) : (
              recentImports.map((imp) => {
                const statusConfig = {
                  COMPLETED:      { icon: CheckCircle, color: "#059669", bg: "rgba(5,150,105,0.1)", label: "Concluído" },
                  REVIEW_PENDING: { icon: AlertCircle, color: "#D97706", bg: "rgba(217,119,6,0.1)", label: "Revisão" },
                  PROCESSING:     { icon: Clock,       color: "#2563EB", bg: "rgba(37,99,235,0.1)", label: "Processando" },
                  PENDING:        { icon: Clock,       color: "#9CA3AF", bg: "#F3F4F6",               label: "Aguardando" },
                  FAILED:         { icon: AlertCircle, color: "#DC2626", bg: "rgba(220,38,38,0.1)", label: "Falhou" },
                }[imp.status] ?? { icon: Upload, color: "#9CA3AF", bg: "#F3F4F6", label: imp.status };

                const Icon = statusConfig.icon;

                return (
                  <Link
                    key={imp.id}
                    href={
                      imp.status === "REVIEW_PENDING"
                        ? `/admin/importacoes/${imp.id}/revisao`
                        : "/admin/importacoes"
                    }
                    className="hover-row flex items-center gap-4 rounded-2xl px-3 py-3.5 no-underline"
                  >
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] border border-black/[0.04]"
                      style={{
                        background: statusConfig.bg,
                        boxShadow: "0 1px 0 rgba(255,255,255,0.85) inset",
                      }}
                    >
                      <Icon className="h-5 w-5" style={{ color: statusConfig.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold leading-snug text-[#111827]">
                        {imp.originalFilename}
                      </p>
                      <p className="mt-1 text-[13px] text-[#9CA3AF]">
                        {imp.totalExtracted} questões · {formatDate(imp.createdAt)}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 rounded-[10px] px-2.5 py-1 text-xs font-bold"
                      style={{ color: statusConfig.color, background: statusConfig.bg }}
                    >
                      {statusConfig.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
        </div>
      </div>
    );
  } catch (e) {
    throw e;
  }
}
