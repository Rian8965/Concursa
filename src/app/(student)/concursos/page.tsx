import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Trophy, MapPin, Calendar, Building2, Briefcase, ArrowRight, Clock, BookOpen, Play,
} from "lucide-react";
import { formatDate, formatCountdown } from "@/lib/utils/date";

const statusLabels: Record<string, string> = {
  UPCOMING: "Em breve", ACTIVE: "Ativo", PAST: "Encerrado", CANCELLED: "Cancelado",
};
const statusVariants: Record<string, "upcoming" | "active" | "past" | "cancelled"> = {
  UPCOMING: "upcoming", ACTIVE: "active", PAST: "past", CANCELLED: "cancelled",
};

export default async function CompetitionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const studentCompetitions = await prisma.studentCompetition.findMany({
    where: { studentProfileId: profile.id, isActive: true },
    include: {
      competition: { include: { city: true, examBoard: true } },
      jobRole: { select: { id: true, name: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const enriched = await Promise.all(
    studentCompetitions.map(async (sc) => {
      let subjects: { id: string; name: string }[] = [];
      if (sc.jobRoleId) {
        const links = await prisma.competitionJobRoleSubject.findMany({
          where: { competitionId: sc.competitionId, jobRoleId: sc.jobRoleId },
          include: { subject: { select: { id: true, name: true } } },
          orderBy: { subject: { name: "asc" } },
          take: 6,
        });
        subjects = links.map((l) => l.subject);
      } else {
        const links = await prisma.competitionSubject.findMany({
          where: { competitionId: sc.competitionId },
          include: { subject: { select: { id: true, name: true } } },
          orderBy: { subject: { name: "asc" } },
          take: 6,
        });
        subjects = links.map((l) => l.subject);
      }
      return { ...sc, displaySubjects: subjects };
    }),
  );

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Meus Concursos"
        description="Concursos e cargos vinculados ao seu perfil"
      />

      {enriched.length === 0 ? (
        <div className="dash-card flex flex-col items-center justify-center px-8 py-14 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <Trophy className="h-8 w-8 text-violet-300" strokeWidth={1.5} />
          </div>
          <p className="text-[16px] font-bold text-[#0F172A]">Nenhum concurso vinculado</p>
          <p className="mt-2 max-w-md text-[13.5px] text-[#64748B]">
            O administrador precisa vincular você a um concurso e cargo para liberar o acesso ao conteúdo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {enriched.map((sc) => {
            const comp = sc.competition;
            let daysLeft: number | null = null;
            if (comp.examDate) {
              try {
                const d = new Date(comp.examDate);
                if (!isNaN(d.getTime())) {
                  const diff = Math.floor((d.getTime() - Date.now()) / 86400000);
                  if (diff >= 0) daysLeft = diff;
                }
              } catch { /* ignorado */ }
            }

            return (
              <article
                key={sc.id}
                className="dash-card relative overflow-hidden p-7 sm:p-9"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-8 hidden text-violet-100 sm:block"
                  style={{ opacity: 0.32 }}
                >
                  <Building2 className="h-36 w-36" strokeWidth={1.1} />
                </div>

                <div className="relative flex flex-col gap-7">
                  {/* ── Cabeçalho alinhado à esquerda (badges + título + organização) ── */}
                  <header>
                    <div className="mb-5 flex flex-wrap items-center gap-3">
                      {comp.status === "ACTIVE" ? (
                        <span className="dash-hero-badge--active">{statusLabels[comp.status]}</span>
                      ) : (
                        <Badge variant={statusVariants[comp.status] ?? "secondary"}>
                          {statusLabels[comp.status] ?? comp.status}
                        </Badge>
                      )}
                      {comp.examBoard && (
                        <span className="dash-hero-badge--banca">{comp.examBoard.acronym}</span>
                      )}
                      {!comp.examBoardDefined && (
                        <Badge variant="warning">Banca não definida</Badge>
                      )}
                    </div>

                    <h3 className="max-w-[640px] pr-2 text-[20px] font-extrabold leading-[1.32] tracking-tight text-[#0F172A] sm:text-[22px]">
                      {comp.name}
                    </h3>
                    {comp.organization && (
                      <p className="mt-2 text-[13px] text-[#64748B]">{comp.organization}</p>
                    )}
                  </header>

                  {/* ── Chips de informação (grid 2 colunas) ── */}
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {comp.city && (
                      <div className="dash-hero-chip">
                        <span className="dash-hero-chip__icon">
                          <MapPin className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="dash-hero-chip__label">Local</span>
                          <span className="dash-hero-chip__value">
                            {comp.city.name}{comp.city.state ? `, ${comp.city.state}` : ""}
                          </span>
                        </div>
                      </div>
                    )}
                    {sc.jobRole && (
                      <div className="dash-hero-chip">
                        <span className="dash-hero-chip__icon">
                          <Briefcase className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="dash-hero-chip__label">Cargo</span>
                          <span className="dash-hero-chip__value">{sc.jobRole.name}</span>
                        </div>
                      </div>
                    )}
                    {comp.examBoard && (
                      <div className="dash-hero-chip">
                        <span className="dash-hero-chip__icon">
                          <Building2 className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="dash-hero-chip__label">Banca</span>
                          <span className="dash-hero-chip__value">{comp.examBoard.name}</span>
                        </div>
                      </div>
                    )}
                    {comp.examDate && (
                      <div className="dash-hero-chip">
                        <span className="dash-hero-chip__icon">
                          <Calendar className="h-3.5 w-3.5 text-violet-500" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="dash-hero-chip__label">Data da prova</span>
                          <span className="dash-hero-chip__value">
                            {formatDate(comp.examDate)}
                            {daysLeft !== null && daysLeft > 0 && (
                              <span className="ml-1.5 inline-flex items-center gap-1 font-semibold text-violet-700">
                                <Clock className="h-3 w-3" />
                                {formatCountdown(comp.examDate)}
                              </span>
                            )}
                            {daysLeft === 0 && (
                              <span className="ml-1.5 font-semibold text-orange-600">Hoje!</span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Matérias liberadas (chips compactos) ── */}
                  {sc.displaySubjects.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                        <BookOpen className="h-3.5 w-3.5 text-violet-400" />
                        Matérias liberadas
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sc.displaySubjects.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-1.5 text-[12px] font-semibold text-violet-700"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Ações (alinhadas à esquerda, botão primário grande) ── */}
                  <div className="flex flex-wrap items-center gap-3.5 pt-1">
                    <Link
                      href={`/concursos/${comp.id}/treino`}
                      className="dash-btn-primary"
                    >
                      <Play className="h-[17px] w-[17px]" strokeWidth={2.4} />
                      Treinar
                    </Link>
                    <Link
                      href={`/concursos/${comp.id}`}
                      className="dash-btn-secondary"
                    >
                      Ver detalhes
                      <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
