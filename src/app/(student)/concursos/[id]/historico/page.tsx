import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import { BookOpen, Target, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { CompetitionTabs } from "@/components/student/CompetitionTabs";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HistoricoConcursoPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const enrollment = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
    include: { competition: { select: { name: true } } },
  });
  if (!enrollment) notFound();

  const [trainingSessions, simulatedExams] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { studentProfileId: profile.id, competitionId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.simulatedExam.findMany({
      where: { studentProfileId: profile.id, competitionId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <CompetitionTabs competitionId={id} />

      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight text-[#111827]">Histórico</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">{enrollment.competition.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Treinos */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
              <BookOpen className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <p className="text-[13px] font-bold text-[#111827]">
              Treinos <span className="ml-1 text-[12px] font-medium text-gray-400">({trainingSessions.length})</span>
            </p>
          </div>

          {trainingSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.08] bg-white px-5 py-8 text-center">
              <p className="text-[13px] text-gray-400">Nenhum treino registrado ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {trainingSessions.map((t) => {
                const acc =
                  typeof t.correctAnswers === "number" && t.totalQuestions > 0
                    ? Math.round((t.correctAnswers / t.totalQuestions) * 100)
                    : null;
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                      <BookOpen className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {t.totalQuestions} questões
                      </p>
                      <p className="text-[11.5px] text-gray-400">{formatDate(t.createdAt)}</p>
                    </div>
                    {acc !== null && (
                      <span
                        className={cn(
                          "text-[12.5px] font-extrabold",
                          acc >= 70 ? "text-emerald-600" : acc >= 50 ? "text-amber-600" : "text-red-500",
                        )}
                      >
                        {acc}%
                      </span>
                    )}
                    {t.completedAt ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simulados */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <Target className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-[13px] font-bold text-[#111827]">
              Simulados <span className="ml-1 text-[12px] font-medium text-gray-400">({simulatedExams.length})</span>
            </p>
          </div>

          {simulatedExams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.08] bg-white px-5 py-8 text-center">
              <p className="text-[13px] text-gray-400">Nenhum simulado registrado ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {simulatedExams.map((e) => {
                const isCompleted = e.status === "COMPLETED";
                const isAbandoned = e.status === "ABANDONED";
                const acc =
                  typeof e.correctAnswers === "number" && e.totalQuestions > 0
                    ? Math.round((e.correctAnswers / e.totalQuestions) * 100)
                    : null;
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <Target className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {e.totalQuestions} questões
                      </p>
                      <p className="text-[11.5px] text-gray-400">{formatDate(e.createdAt)}</p>
                    </div>
                    {isCompleted && acc !== null && (
                      <span
                        className={cn(
                          "text-[12.5px] font-extrabold",
                          acc >= 70 ? "text-emerald-600" : acc >= 50 ? "text-amber-600" : "text-red-500",
                        )}
                      >
                        {acc}%
                      </span>
                    )}
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : isAbandoned ? (
                      <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
