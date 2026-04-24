import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Trophy,
  MapPin,
  Calendar,
  Building2,
  Briefcase,
  ArrowRight,
  Clock,
} from "lucide-react";
import { formatDate, formatCountdown } from "@/lib/utils/date";

const statusLabels: Record<string, string> = {
  UPCOMING: "Em breve",
  ACTIVE: "Ativo",
  PAST: "Encerrado",
  CANCELLED: "Cancelado",
};

const statusVariants: Record<string, "upcoming" | "active" | "past" | "cancelled"> = {
  UPCOMING: "upcoming",
  ACTIVE: "active",
  PAST: "past",
  CANCELLED: "cancelled",
};

export default async function CompetitionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) redirect("/dashboard");

  // #region agent log - H1/H4
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let studentCompetitions: any[] = [];
  try {
    studentCompetitions = await prisma.studentCompetition.findMany({
      where: { studentProfileId: profile.id, isActive: true },
      include: {
        competition: {
          include: {
            city: true,
            examBoard: true,
            subjects: { include: { subject: true } },
          },
        },
        jobRole: true,
      },
      orderBy: { enrolledAt: "desc" },
    });
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"03dbee"},body:JSON.stringify({sessionId:"03dbee",location:"concursos/page.tsx:query",message:"query ok",data:{count:studentCompetitions.length},hypothesisId:"H4",timestamp:Date.now()})}).catch(()=>{});
  } catch (err) {
    console.error("[concursos] studentCompetition query failed:", err);
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"03dbee"},body:JSON.stringify({sessionId:"03dbee",location:"concursos/page.tsx:query-error",message:"query FAILED",data:{error:String(err)},hypothesisId:"H4",timestamp:Date.now()})}).catch(()=>{});
    throw err;
  }
  // #endregion

  return (
    <div className="orbit-stack animate-fade-in">
      <PageHeader
        title="Meus Concursos"
        description="Todos os concursos vinculados ao seu plano de estudos"
      />

      {studentCompetitions.length === 0 ? (
        <div className="orbit-empty-state">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 ring-1 ring-violet-200/60">
            <Trophy className="h-8 w-8 text-violet-600" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Nenhum concurso disponível</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
            Seu plano não possui concursos vinculados ainda. Entre em contato com o administrador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {studentCompetitions.map((sc) => {
            const comp = sc.competition;
            const daysLeft = comp.examDate
              ? Math.floor(
                  (comp.examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              : null;

            return (
              <div
                key={sc.id}
                className="card card-interactive overflow-hidden"
              >
                {/* Linha de cor no topo */}
                <div
                  className="h-1"
                  style={{
                    background: "linear-gradient(90deg, #EA580C 0%, #FB923C 22%, #7C3AED 72%, #A855F7 100%)",
                  }}
                />

                <div className="p-7 sm:p-8">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusVariants[comp.status] ?? "secondary"}>
                        {statusLabels[comp.status]}
                      </Badge>
                      {comp.examBoard && (
                        <Badge variant="secondary">{comp.examBoard.acronym}</Badge>
                      )}
                      {!comp.examBoardDefined && (
                        <Badge variant="warning">Banca não definida</Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                    {comp.name}
                  </h3>

                  {comp.organization && (
                    <p className="text-sm text-gray-500 mb-3">{comp.organization}</p>
                  )}

                  <div className="space-y-1.5 mb-5">
                    {comp.city && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {comp.city.name}, {comp.city.state}
                      </div>
                    )}
                    {sc.jobRole && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {sc.jobRole.name}
                      </div>
                    )}
                    {comp.examBoard && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {comp.examBoard.name}
                      </div>
                    )}
                    {comp.examDate && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {formatDate(comp.examDate)} —{" "}
                        {daysLeft !== null && daysLeft > 0 ? (
                          <span className="font-semibold text-violet-700">
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {formatCountdown(comp.examDate)}
                          </span>
                        ) : daysLeft === 0 ? (
                          <span className="font-semibold text-orange-600">Hoje!</span>
                        ) : (
                          <span className="text-gray-400">Prova realizada</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Matérias preview */}
                  {comp.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {comp.subjects.slice(0, 4).map((cs) => (
                        <span
                          key={cs.subjectId}
                          className="rounded-lg border border-gray-200/80 bg-gray-50/90 px-2.5 py-1 text-xs font-medium text-gray-600"
                        >
                          {cs.subject.name}
                        </span>
                      ))}
                      {comp.subjects.length > 4 && (
                        <span className="rounded-lg border border-dashed border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500">
                          +{comp.subjects.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <Link
                    href={`/concursos/${comp.id}`}
                    className="btn btn-primary mt-1 flex h-11 w-full items-center justify-center rounded-2xl text-[13px]"
                  >
                    Entrar no concurso
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
