import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Target } from "lucide-react";
import { formatDate } from "@/lib/utils/date";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HistoricoConcursoPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) redirect("/dashboard");

  const enrollment = await prisma.studentCompetition.findUnique({
    where: {
      studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id },
    },
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
    <div style={{ maxWidth: 900 }}>
      <Link
        href={`/concursos/${id}`}
        style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar ao concurso
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", marginBottom: 4 }}>
        Histórico
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>{enrollment.competition.name}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <BookOpen style={{ width: 16, height: 16, color: "#7C3AED" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Treinos</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trainingSessions.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum treino registrado ainda.</p>
            ) : (
              trainingSessions.map((t) => (
                <div key={t.id} className="card" style={{ padding: 12, fontSize: 13 }}>
                  <span style={{ color: "#6B7280" }}>{formatDate(t.createdAt)}</span>
                  <span style={{ marginLeft: 8, color: "#111827", fontWeight: 600 }}>
                    {t.totalQuestions} questões
                    {t.completedAt && typeof t.correctAnswers === "number" ? (
                      <span style={{ color: "#7C3AED", marginLeft: 6 }}>
                        · {t.correctAnswers} acertos
                      </span>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Target style={{ width: 16, height: 16, color: "#7C3AED" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Simulados</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {simulatedExams.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum simulado registrado ainda.</p>
            ) : (
              simulatedExams.map((e) => (
                <div key={e.id} className="card" style={{ padding: 12, fontSize: 13 }}>
                  <span style={{ color: "#6B7280" }}>{formatDate(e.createdAt)}</span>
                  <span style={{ marginLeft: 8, color: "#111827", fontWeight: 600 }}>
                    {e.totalQuestions} questões · {e.status === "COMPLETED" ? "Concluído" : "Em andamento"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
