import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MateriasPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const sc = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
    include: {
      competition: {
        include: { subjects: { include: { subject: { include: { topics: { select: { id: true, name: true } } } } } } },
      },
    },
  });
  if (!sc) notFound();

  const subjectStats = await Promise.all(
    sc.competition.subjects.map(async (cs) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({ where: { studentProfileId: profile.id, question: { competitionId: id, subjectId: cs.subjectId } } }),
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, isCorrect: true, question: { competitionId: id, subjectId: cs.subjectId } },
        }),
      ]);
      return { ...cs, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
    }),
  );

  return (
    <div className="orbit-stack max-w-4xl animate-fade-up">
      <div className="space-y-2">
        <Link href={`/concursos/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900">
          ← {sc.competition.name}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-[26px]">Matérias</h1>
        <p className="text-[14px] text-[var(--text-secondary)]">
          {subjectStats.length} matérias cadastradas para este concurso
        </p>
      </div>

      {subjectStats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.08] bg-[var(--bg-card)] px-6 py-14 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma matéria cadastrada</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {subjectStats.map((cs) => (
            <div key={cs.subjectId} className="orbit-card-premium flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn("h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-violet-600 to-fuchsia-500")}
                    style={cs.subject.color ? { background: cs.subject.color } : undefined}
                  />
                  <div>
                    <p className="text-[15px] font-bold text-[var(--text-primary)]">{cs.subject.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{cs.subject.topics.length} assuntos</p>
                  </div>
                </div>

                <div className="pl-3.5 sm:pl-4">
                  <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                    <span>{cs.total} questões respondidas</span>
                    <span
                      className={cn(
                        "font-bold",
                        cs.total === 0 && "text-[var(--text-muted)]",
                        cs.total > 0 && cs.accuracy >= 70 && "text-emerald-600",
                        cs.total > 0 && cs.accuracy >= 50 && cs.accuracy < 70 && "text-amber-600",
                        cs.total > 0 && cs.accuracy < 50 && "text-red-600",
                      )}
                    >
                      {cs.total > 0 ? `${cs.accuracy}%` : "Não iniciado"}
                    </span>
                  </div>
                  <Progress value={cs.accuracy} className="h-1" />
                </div>

                {cs.subject.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-3.5 sm:pl-4">
                    {cs.subject.topics.slice(0, 5).map((t) => (
                      <span key={t.id} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        {t.name}
                      </span>
                    ))}
                    {cs.subject.topics.length > 5 && (
                      <span className="self-center text-[11px] text-[var(--text-muted)]">+{cs.subject.topics.length - 5}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-1.5 sm:pt-0">
                <Link
                  href={`/concursos/${id}/treino?subject=${cs.subjectId}`}
                  className="btn btn-purple inline-flex h-auto items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-semibold"
                >
                  <Play className="h-3 w-3" />
                  Treinar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
