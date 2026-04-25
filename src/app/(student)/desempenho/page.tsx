import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Target, Trophy, TrendingUp, ArrowRight } from "lucide-react";

export default async function DesempenhoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      studentCompetitions: {
        where: { isActive: true },
        include: { competition: { select: { id: true, name: true } } },
        take: 5,
      },
    },
  });
  if (!profile) redirect("/dashboard");

  const [totalAnswered, correctAnswers, trainingSessions, simulatedExams] = await Promise.all([
    prisma.studentAnswer.count({ where: { studentProfileId: profile.id } }),
    prisma.studentAnswer.count({ where: { studentProfileId: profile.id, isCorrect: true } }),
    prisma.trainingSession.count({ where: { studentProfileId: profile.id } }),
    prisma.simulatedExam.count({ where: { studentProfileId: profile.id, status: "COMPLETED" } }),
  ]);

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

  const subjects = await prisma.subject.findMany({
    where: { questions: { some: { studentAnswers: { some: { studentProfileId: profile.id } } } } },
    select: { id: true, name: true, color: true },
    take: 12,
  });

  const subjectPerf = await Promise.all(
    subjects.map(async (s) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({ where: { studentProfileId: profile.id, question: { subjectId: s.id } } }),
        prisma.studentAnswer.count({ where: { studentProfileId: profile.id, isCorrect: true, question: { subjectId: s.id } } }),
      ]);
      return { ...s, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
    })
  );
  subjectPerf.sort((a, b) => b.total - a.total);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAnswers = await prisma.studentAnswer.count({
    where: { studentProfileId: profile.id, answeredAt: { gte: sevenDaysAgo } },
  });

  const stats = [
    {
      label: "Questões respondidas",
      value: totalAnswered.toLocaleString("pt-BR"),
      sub: `${recentAnswers} nos últimos 7 dias`,
      icon: BookOpen,
      color: "#7C3AED",
      bg: "#F5F3FF",
    },
    {
      label: "Taxa de acerto",
      value: `${accuracy}%`,
      sub: `${correctAnswers} acertos no total`,
      icon: Target,
      color: accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626",
      bg: accuracy >= 70 ? "#F0FDF4" : accuracy >= 50 ? "#FFFBEB" : "#FEF2F2",
    },
    {
      label: "Treinos realizados",
      value: trainingSessions,
      sub: "sessões de treino",
      icon: TrendingUp,
      color: "#7C3AED",
      bg: "#F5F3FF",
    },
    {
      label: "Simulados completos",
      value: simulatedExams,
      sub: "simulados concluídos",
      icon: Trophy,
      color: "#059669",
      bg: "#F0FDF4",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#111827]">Desempenho</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">Análise completa da sua evolução nos estudos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11.5px] font-semibold text-gray-500">{s.label}</p>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: s.bg }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-[24px] font-extrabold leading-none tracking-tight" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="mt-1.5 text-[11px] text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Desempenho por matéria + Concursos */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        {/* Por matéria */}
        <div className="rounded-xl border border-black/[0.07] bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-[14px] font-bold text-[#111827]">Desempenho por matéria</h3>
          {subjectPerf.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <BookOpen className="mb-3 h-8 w-8 text-gray-300" strokeWidth={1.5} />
              <p className="text-[13px] text-gray-400">
                Responda questões para ver seu desempenho por matéria
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {subjectPerf.map((s) => (
                <div key={s.id}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: s.color ?? "#7C3AED" }}
                      />
                      <span className="text-[13px] font-semibold text-[#374151]">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="text-gray-400">{s.total} questões</span>
                      <span
                        className="font-bold"
                        style={{
                          color: s.accuracy >= 70 ? "#059669" : s.accuracy >= 50 ? "#D97706" : "#DC2626",
                        }}
                      >
                        {s.accuracy}%
                      </span>
                    </div>
                  </div>
                  <Progress value={s.accuracy} className="h-[5px]" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          {/* Atividade recente */}
          <div className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-400">
              Últimos 7 dias
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                <TrendingUp className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-[28px] font-extrabold leading-none tracking-tight text-[#111827]">
                  {recentAnswers}
                </p>
                <p className="mt-1 text-[12px] text-gray-400">questões respondidas</p>
              </div>
            </div>
          </div>

          {/* Meus concursos */}
          <div className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-gray-400">Meus concursos</p>
              <Link href="/concursos" className="text-[12px] font-semibold text-violet-600 hover:text-violet-800">
                Ver todos <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
            {profile.studentCompetitions.length === 0 ? (
              <p className="text-[13px] text-gray-400">Nenhum concurso vinculado</p>
            ) : (
              <div className="flex flex-col gap-2">
                {profile.studentCompetitions.map((sc) => (
                  <Link
                    key={sc.id}
                    href={`/concursos/${sc.competitionId}/desempenho`}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50"
                  >
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    <span className="flex-1 truncate text-[13px] font-medium text-[#374151]">
                      {sc.competition.name}
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
