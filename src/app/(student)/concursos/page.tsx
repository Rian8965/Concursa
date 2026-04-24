import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Trophy, MapPin, Calendar, Building2, Briefcase, ArrowRight, Clock, BookOpen,
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

  // Para cada matrícula, busca matérias do cargo (ou do concurso)
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
    <div className="orbit-stack animate-fade-in max-w-4xl">
      <PageHeader
        title="Meus Concursos"
        description="Concursos e cargos vinculados ao seu perfil"
      />

      {enriched.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[0.10] bg-white px-8 py-14 text-center">
          <Trophy className="mx-auto mb-3 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.25} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhum concurso vinculado</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)]">
            O administrador precisa vincular você a um concurso e cargo para liberar o acesso ao conteúdo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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
              <div key={sc.id} className="overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-sm">
                <div className="h-[3px] bg-gradient-to-r from-violet-600 to-fuchsia-500" />
                <div className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Badges */}
                      <div className="mb-2.5 flex flex-wrap gap-1.5">
                        <Badge variant={statusVariants[comp.status] ?? "secondary"}>
                          {statusLabels[comp.status] ?? comp.status}
                        </Badge>
                        {comp.examBoard && <Badge variant="secondary">{comp.examBoard.acronym}</Badge>}
                        {!comp.examBoardDefined && <Badge variant="warning">Banca não definida</Badge>}
                      </div>

                      <h3 className="text-[15px] font-bold leading-snug text-[var(--text-primary)]">{comp.name}</h3>
                      {comp.organization && (
                        <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)]">{comp.organization}</p>
                      )}

                      {/* Detalhes */}
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {comp.city && (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB]" />
                            {comp.city.name}{comp.city.state ? `, ${comp.city.state}` : ""}
                          </div>
                        )}
                        {sc.jobRole && (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
                            <Briefcase className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB]" />
                            <span className="font-semibold text-[var(--text-primary)]">{sc.jobRole.name}</span>
                          </div>
                        )}
                        {comp.examBoard && (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB]" />
                            {comp.examBoard.name}
                          </div>
                        )}
                        {comp.examDate && (
                          <div className="flex items-center gap-1.5 text-[12.5px] text-[#6B7280]">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB]" />
                            <span>{formatDate(comp.examDate)}</span>
                            {daysLeft !== null && daysLeft > 0 && (
                              <span className="inline-flex items-center gap-1 font-semibold text-violet-700">
                                <Clock className="h-3 w-3" />
                                {formatCountdown(comp.examDate)}
                              </span>
                            )}
                            {daysLeft === 0 && (
                              <span className="font-semibold text-orange-600">Hoje!</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Matérias */}
                      {sc.displaySubjects.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 self-center text-[#D1D5DB]" />
                          {sc.displaySubjects.map((s) => (
                            <span
                              key={s.id}
                              className="rounded-md border border-black/[0.07] bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/concursos/${comp.id}`}
                      className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700 sm:w-auto"
                    >
                      Estudar <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
