import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { CompetitionTabs } from "@/components/student/CompetitionTabs";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DesempenhoConcursoPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const enrollment = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
    include: {
      competition: { include: { examBoard: true } },
      jobRole: { select: { id: true, name: true } },
    },
  });
  if (!enrollment) notFound();

  const comp = enrollment.competition;

  // Busca subjects pelo cargo ou todos do concurso
  let subjectLinks: { subjectId: string; subject: { id: string; name: string; color: string | null } }[] = [];
  if (enrollment.jobRoleId) {
    subjectLinks = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId: id, jobRoleId: enrollment.jobRoleId },
      include: { subject: { select: { id: true, name: true, color: true } } },
      orderBy: { subject: { name: "asc" } },
    });
  } else {
    const links = await prisma.competitionSubject.findMany({
      where: { competitionId: id },
      include: { subject: { select: { id: true, name: true, color: true } } },
      orderBy: { subject: { name: "asc" } },
    });
    subjectLinks = links.map((l) => ({ subjectId: l.subjectId, subject: l.subject }));
  }

  const subjects = subjectLinks.map((l) => l.subject);
  const subjectIds = subjects.map((s) => s.id);

  // Stats gerais por matéria (sem filtrar por competitionId nas questões, mas por subjectId)
  const hasBanca = comp.examBoardDefined && comp.examBoardId;

  const [totalAnswered, correctAnswers] = await Promise.all([
    prisma.studentAnswer.count({
      where: { studentProfileId: profile.id, question: { subjectId: { in: subjectIds } } },
    }),
    prisma.studentAnswer.count({
      where: { studentProfileId: profile.id, isCorrect: true, question: { subjectId: { in: subjectIds } } },
    }),
  ]);

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

  const subjectPerf = await Promise.all(
    subjects.map(async (s) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, question: { subjectId: s.id } },
        }),
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, isCorrect: true, question: { subjectId: s.id } },
        }),
      ]);
      const available = await prisma.question.count({
        where: {
          status: "ACTIVE",
          alternatives: { some: {} },
          subjectId: s.id,
          ...(hasBanca && { examBoardId: comp.examBoardId! }),
        },
      });
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        total,
        correct,
        available,
        acc: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    })
  );

  const sorted = [...subjectPerf].sort((a, b) => b.total - a.total);

  return (
    <div className="animate-fade-in space-y-5 pb-8">
      <CompetitionTabs competitionId={id} />

      {/* Cabeçalho */}
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight text-[#111827]">Desempenho</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          {comp.name}
          {enrollment.jobRole && <span className="ml-1 text-violet-600">· {enrollment.jobRole.name}</span>}
        </p>
      </div>

      {/* Card geral */}
      <div className="overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-sm">
        <div className="h-[3px] bg-gradient-to-r from-violet-600 to-fuchsia-500" />
        <div className="p-6">
          <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-gray-400">Desempenho geral</p>
          <div className="flex items-baseline gap-3">
            <span
              className="text-[42px] font-extrabold leading-none tracking-tight"
              style={{
                color:
                  accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626",
              }}
            >
              {accuracy}%
            </span>
            <span className="text-[14px] text-gray-500">
              {correctAnswers} acertos · {totalAnswered} respondidas
            </span>
          </div>
          <Progress value={accuracy} className="mt-4 h-2" />
          {hasBanca && comp.examBoard && (
            <p className="mt-2 text-[11.5px] text-violet-600">
              Banca: {comp.examBoard.name ?? comp.examBoard.acronym}
            </p>
          )}
        </div>
      </div>

      {/* Por matéria */}
      {sorted.length > 0 ? (
        <div>
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-gray-400">Por matéria</p>
          <div className="flex flex-col gap-3">
            {sorted.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3.5 rounded-xl border border-black/[0.06] bg-white px-5 py-4 shadow-sm"
              >
                <div
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: s.color ?? "#8B5CF6" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[#111827]">{s.name}</span>
                    <span
                      className="text-[13px] font-extrabold"
                      style={{
                        color: s.acc >= 70 ? "#059669" : s.acc >= 50 ? "#D97706" : s.total === 0 ? "#9CA3AF" : "#DC2626",
                      }}
                    >
                      {s.total === 0 ? "—" : `${s.acc}%`}
                    </span>
                  </div>
                  <Progress value={s.acc} className="h-[4px]" />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      {s.total === 0 ? "Nenhuma respondida" : `${s.correct} de ${s.total} acertos`}
                    </span>
                    {s.available > 0 && (
                      <span>{s.available.toLocaleString("pt-BR")} disponível{s.available !== 1 ? "is" : ""}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-black/[0.08] bg-white px-6 py-10 text-center">
          <p className="text-[14px] font-semibold text-gray-500">Nenhuma matéria vinculada</p>
          <p className="mt-1 text-[12.5px] text-gray-400">O administrador precisa vincular matérias ao seu cargo.</p>
        </div>
      )}
    </div>
  );
}
