import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { CheckCircle2, XCircle, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils/date";

export default async function QuestoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const answers = await prisma.studentAnswer.findMany({
    where: { studentProfileId: profile.id },
    include: {
      question: { include: { subject: { select: { name: true, color: true } }, alternatives: { orderBy: { order: "asc" } } } },
    },
    orderBy: { answeredAt: "desc" },
    take: 40,
  });

  const totalCorrect = answers.filter((a) => a.isCorrect).length;
  const accuracy = answers.length > 0 ? Math.round((totalCorrect / answers.length) * 100) : 0;

  return (
    <div className="orbit-stack max-w-4xl animate-fade-in">
      <PageHeader title="Questões" description="Histórico de todas as questões respondidas" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {[
          { label: "Respondidas", value: answers.length, className: "text-violet-700" },
          { label: "Acertos", value: totalCorrect, className: "text-emerald-600" },
          {
            label: "Taxa de acerto",
            value: `${accuracy}%`,
            className: accuracy >= 70 ? "text-emerald-600" : accuracy >= 50 ? "text-orange-600" : "text-red-600",
          },
        ].map((s) => (
          <div key={s.label} className="orbit-card-premium">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">{s.label}</p>
            <p className={`mt-2 text-[1.75rem] font-extrabold tracking-tight leading-none ${s.className}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {answers.length === 0 ? (
        <div className="orbit-empty-state">
          <BookOpen className="mx-auto mb-4 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma questão respondida ainda</p>
          <Link href="/concursos" className="orbit-link mt-3 inline-block text-sm font-semibold">
            Ir para treino →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {answers.map((ans) => (
            <div key={ans.id} className="orbit-card-premium py-5">
              <div className="flex gap-4">
                <div className="mt-0.5 shrink-0">
                  {ans.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" strokeWidth={2} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {ans.question.subject && (
                      <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                        {ans.question.subject.name}
                      </span>
                    )}
                    <span
                      className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                        ans.isCorrect ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {ans.isCorrect ? "Correta" : "Incorreta"}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                    {ans.question.content.length > 180 ? `${ans.question.content.slice(0, 180)}…` : ans.question.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span>
                      Sua resposta:{" "}
                      <strong className={ans.isCorrect ? "text-emerald-600" : "text-red-600"}>{ans.selectedAnswer}</strong>
                    </span>
                    {!ans.isCorrect && (
                      <span>
                        Correta: <strong className="text-emerald-600">{ans.question.correctAnswer}</strong>
                      </span>
                    )}
                    <span className="ml-auto font-medium">{formatDate(ans.answeredAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
