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

  const studentCompetitions = await prisma.studentCompetition.findMany({
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Meus Concursos"
        description="Todos os concursos vinculados ao seu plano de estudos"
      />

      {studentCompetitions.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1.5px dashed #E5E7EB",
            borderRadius: 20,
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#F3F2FB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Trophy style={{ width: 26, height: 26, color: "#7C3AED" }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
            Nenhum concurso disponível
          </h3>
          <p style={{ fontSize: 13.5, color: "#9CA3AF", maxWidth: 320, margin: "0 auto" }}>
            Seu plano não possui concursos vinculados ainda. Entre em contato com o administrador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                  style={{
                    height: 3,
                    background: "linear-gradient(90deg, #7C3AED 0%, #A855F7 100%)",
                  }}
                />

                <div className="p-6">
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
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {comp.city.name}, {comp.city.state}
                    </div>
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
                          <span className="font-medium" style={{ color: "#7C3AED" }}>
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {formatCountdown(comp.examDate)}
                          </span>
                        ) : daysLeft === 0 ? (
                          <span className="font-medium" style={{ color: "#D97706" }}>Hoje!</span>
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
                          className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full"
                        >
                          {cs.subject.name}
                        </span>
                      ))}
                      {comp.subjects.length > 4 && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                          +{comp.subjects.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <Link
                    href={`/concursos/${comp.id}`}
                    className="btn btn-primary w-full"
                    style={{ justifyContent: "center", borderRadius: 12, height: 40, fontSize: 13 }}
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
