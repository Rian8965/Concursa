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

  // Verifica se o aluno está matriculado neste concurso
  const enrollment = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
    include: {
      competition: { select: { id: true, name: true } },
      jobRole: { select: { id: true, name: true } },
    },
  });
  if (!enrollment) notFound();

  // Busca subjects: por cargo (prioritário) ou todos do concurso (fallback)
  let rawSubjects: { id: string; name: string; color?: string | null; topics: { id: string; name: string }[] }[] = [];

  if (enrollment.jobRoleId) {
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId: id, jobRoleId: enrollment.jobRoleId },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
            topics: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
        },
      },
      orderBy: { subject: { name: "asc" } },
    });
    rawSubjects = links.map((l) => l.subject);
  } else {
    // Fallback: matérias genéricas do concurso
    const links = await prisma.competitionSubject.findMany({
      where: { competitionId: id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            color: true,
            topics: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } },
          },
        },
      },
      orderBy: { subject: { name: "asc" } },
    });
    rawSubjects = links.map((l) => l.subject);
  }

  // Stats de desempenho por matéria
  const subjectStats = await Promise.all(
    rawSubjects.map(async (subject) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, question: { subjectId: subject.id } },
        }),
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, isCorrect: true, question: { subjectId: subject.id } },
        }),
      ]);
      return { ...subject, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
    }),
  );

  const cargoLabel = enrollment.jobRole?.name;

  return (
    <div className="orbit-stack max-w-4xl animate-fade-up">
      <div className="space-y-1">
        <Link
          href={`/concursos/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900"
        >
          ← {enrollment.competition.name}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Matérias</h1>
        {cargoLabel && (
          <p className="text-[13px] text-[var(--text-secondary)]">
            Cargo: <span className="font-semibold">{cargoLabel}</span>
          </p>
        )}
        <p className="text-[13px] text-[var(--text-muted)]">
          {subjectStats.length} matéria{subjectStats.length !== 1 ? "s" : ""} para este{cargoLabel ? " cargo" : " concurso"}
        </p>
      </div>

      {subjectStats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[0.08] bg-[var(--bg-card)] px-6 py-14 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma matéria cadastrada</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {cargoLabel
              ? "O administrador ainda não vinculou matérias a este cargo."
              : "O administrador ainda não adicionou matérias a este concurso."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {subjectStats.map((subject) => (
            <div
              key={subject.id}
              className="rounded-xl border border-black/[0.06] bg-[var(--bg-card)] p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Info da matéria */}
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500"
                      style={subject.color ? { background: subject.color } : undefined}
                    />
                    <div>
                      <p className="text-[15px] font-bold text-[var(--text-primary)]">{subject.name}</p>
                      {subject.topics.length > 0 && (
                        <p className="text-[11px] text-[var(--text-muted)]">{subject.topics.length} assunto{subject.topics.length !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                  </div>

                  {/* Progresso */}
                  <div className="pl-3.5">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>{subject.total > 0 ? `${subject.total} questão${subject.total !== 1 ? "ões" : ""} respondida${subject.total !== 1 ? "s" : ""}` : "Não iniciado"}</span>
                      <span
                        className={cn(
                          "font-bold",
                          subject.total === 0 && "text-[var(--text-muted)]",
                          subject.total > 0 && subject.accuracy >= 70 && "text-emerald-600",
                          subject.total > 0 && subject.accuracy >= 50 && subject.accuracy < 70 && "text-amber-600",
                          subject.total > 0 && subject.accuracy < 50 && "text-red-500",
                        )}
                      >
                        {subject.total > 0 ? `${subject.accuracy}% acerto` : "—"}
                      </span>
                    </div>
                    <Progress value={subject.accuracy} className="h-1" />
                  </div>

                  {/* Assuntos */}
                  {subject.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-3.5">
                      {subject.topics.slice(0, 6).map((t) => (
                        <span
                          key={t.id}
                          className="rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
                        >
                          {t.name}
                        </span>
                      ))}
                      {subject.topics.length > 6 && (
                        <span className="self-center text-[11px] text-[var(--text-muted)]">+{subject.topics.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                  <Link
                    href={`/concursos/${id}/treino?subject=${subject.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-violet-700"
                  >
                    <Play className="h-3 w-3" />
                    Treinar
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
