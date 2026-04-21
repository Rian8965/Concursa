import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, Target, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

export default async function HistoricoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const [trainingSessions, simulatedExams] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.simulatedExam.findMany({
      where: { studentProfileId: profile.id },
      include: { competition: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  function accuracyTextClass(accuracy: number, total: number) {
    if (total === 0) return "text-[var(--text-muted)]";
    if (accuracy >= 70) return "text-emerald-600";
    if (accuracy >= 50) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <div className="orbit-stack max-w-4xl animate-fade-up">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-[26px]">Histórico</h1>
        <p className="text-[14px] text-[var(--text-secondary)]">Todas as suas sessões de treino e simulados</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-6">
        <section>
          <div className="mb-3.5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
              <BookOpen className="h-3.5 w-3.5 text-violet-700" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Treinos</h2>
            <span className="text-xs text-[var(--text-muted)]">({trainingSessions.length})</span>
          </div>

          {trainingSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.08] bg-[var(--bg-card)] px-4 py-10 text-center">
              <p className="text-[13px] text-[var(--text-muted)]">Nenhum treino realizado ainda</p>
              <Link href="/concursos" className="mt-2 inline-block text-[13px] font-semibold text-violet-700 hover:text-violet-900">
                Iniciar treino →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {trainingSessions.map((ts) => {
                const accuracy = ts.totalQuestions > 0 ? Math.round((ts.correctAnswers / ts.totalQuestions) * 100) : 0;
                const mins = Math.floor((ts.timeSpentSeconds ?? 0) / 60);
                return (
                  <div key={ts.id} className="orbit-card-premium px-4 py-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={cn("text-[13px] font-bold", accuracyTextClass(accuracy, ts.totalQuestions))}>
                        {accuracy}% de acerto
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatDate(ts.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                        {ts.correctAnswers} corretas
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <XCircle className="h-2.5 w-2.5 text-red-600" />
                        {ts.totalQuestions - ts.correctAnswers} erros
                      </span>
                      {mins > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                          <Clock className="h-2.5 w-2.5" />
                          {mins}min
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3.5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
              <Target className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Simulados</h2>
            <span className="text-xs text-[var(--text-muted)]">({simulatedExams.length})</span>
          </div>

          {simulatedExams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.08] bg-[var(--bg-card)] px-4 py-10 text-center">
              <p className="text-[13px] text-[var(--text-muted)]">Nenhum simulado realizado ainda</p>
              <Link href="/concursos" className="mt-2 inline-block text-[13px] font-semibold text-violet-700 hover:text-violet-900">
                Fazer simulado →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {simulatedExams.map((se) => {
                const pct = se.totalQuestions > 0 ? Math.round((se.correctAnswers / se.totalQuestions) * 100) : 0;
                const mins = Math.floor((se.timeSpentSeconds ?? 0) / 60);
                return (
                  <div key={se.id} className="orbit-card-premium px-4 py-3.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={cn("text-[13px] font-bold", accuracyTextClass(pct, se.totalQuestions))}>{pct}%</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{formatDate(se.createdAt)}</span>
                    </div>
                    {se.competition && (
                      <p className="mb-1 text-xs font-semibold text-violet-700">{se.competition.name}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                        {se.correctAnswers}/{se.totalQuestions}
                      </span>
                      {mins > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                          <Clock className="h-2.5 w-2.5" />
                          {mins}min
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          se.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80",
                        )}
                      >
                        {se.status === "COMPLETED" ? "Concluído" : "Em andamento"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
