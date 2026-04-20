import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { StatsCard } from "@/components/shared/StatsCard";
import { BookOpen, Target, Trophy, TrendingUp } from "lucide-react";

export default async function DesempenhoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { studentCompetitions: { where: { isActive: true }, include: { competition: { select: { id: true, name: true } } }, take: 5 } },
  });
  if (!profile) redirect("/dashboard");

  const [totalAnswered, correctAnswers, trainingSessions, simulatedExams] = await Promise.all([
    prisma.studentAnswer.count({ where: { studentProfileId: profile.id } }),
    prisma.studentAnswer.count({ where: { studentProfileId: profile.id, isCorrect: true } }),
    prisma.trainingSession.count({ where: { studentProfileId: profile.id } }),
    prisma.simulatedExam.count({ where: { studentProfileId: profile.id, status: "COMPLETED" } }),
  ]);

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

  // Performance by subject
  const subjects = await prisma.subject.findMany({
    where: { questions: { some: { studentAnswers: { some: { studentProfileId: profile.id } } } } },
    select: { id: true, name: true, color: true },
    take: 10,
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

  // Last 7 days activity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAnswers = await prisma.studentAnswer.count({
    where: { studentProfileId: profile.id, answeredAt: { gte: sevenDaysAgo } },
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Desempenho</h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>Análise completa da sua evolução nos estudos</p>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatsCard title="Respondidas" value={totalAnswered.toLocaleString("pt-BR")} description="no total" icon={<BookOpen style={{ width: 16, height: 16 }} />} accent="#7C3AED" />
        <StatsCard title="Taxa de Acerto" value={`${accuracy}%`} description={`${correctAnswers} acertos`} icon={<Target style={{ width: 16, height: 16 }} />} accent={accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626"} />
        <StatsCard title="Treinos" value={trainingSessions} description="sessões" icon={<TrendingUp style={{ width: 16, height: 16 }} />} accent="#7C3AED" />
        <StatsCard title="Simulados" value={simulatedExams} description="concluídos" icon={<Trophy style={{ width: 16, height: 16 }} />} accent="#059669" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Desempenho por matéria */}
        <div className="card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16, letterSpacing: "-0.02em" }}>
            Desempenho por Matéria
          </h3>
          {subjectPerf.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "24px 0" }}>
              Responda questões para ver seu desempenho por matéria
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {subjectPerf.map((s) => (
                <div key={s.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 4, height: 16, borderRadius: 2, background: s.color ?? "#7C3AED", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{s.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "#9CA3AF" }}>
                      <span>{s.total} questões</span>
                      <span style={{ fontWeight: 700, color: s.accuracy >= 70 ? "#059669" : s.accuracy >= 50 ? "#D97706" : "#DC2626" }}>
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

        {/* Resumo */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Atividade recente */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12, letterSpacing: "-0.02em" }}>
              Últimos 7 dias
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp style={{ width: 22, height: 22, color: "#7C3AED" }} />
              </div>
              <div>
                <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.04em", lineHeight: 1 }}>{recentAnswers}</p>
                <p style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>questões respondidas</p>
              </div>
            </div>
          </div>

          {/* Concursos */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12, letterSpacing: "-0.02em" }}>
              Meus Concursos
            </h3>
            {profile.studentCompetitions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum concurso vinculado</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {profile.studentCompetitions.map((sc) => (
                  <div key={sc.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C3AED" }} />
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{sc.competition.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
