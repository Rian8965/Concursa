import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, Trophy, Target, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils/date";

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

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Histórico</h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Todas as suas sessões de treino e simulados
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Treinos */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen style={{ width: 14, height: 14, color: "#7C3AED" }} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Treinos</h2>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>({trainingSessions.length})</span>
          </div>

          {trainingSessions.length === 0 ? (
            <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 12, padding: "32px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum treino realizado ainda</p>
              <Link href="/concursos" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, marginTop: 8, display: "inline-block", textDecoration: "none" }}>
                Iniciar treino →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {trainingSessions.map((ts) => {
                const accuracy = ts.totalQuestions > 0 ? Math.round((ts.correctAnswers / ts.totalQuestions) * 100) : 0;
                const color = accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626";
                const mins = Math.floor((ts.timeSpentSeconds ?? 0) / 60);
                return (
                  <div key={ts.id} className="card" style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>
                        {accuracy}% de acerto
                      </span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDate(ts.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <CheckCircle2 style={{ width: 11, height: 11, color: "#059669" }} /> {ts.correctAnswers} corretas
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <XCircle style={{ width: 11, height: 11, color: "#DC2626" }} /> {ts.totalQuestions - ts.correctAnswers} erros
                      </span>
                      {mins > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock style={{ width: 11, height: 11 }} /> {mins}min
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Simulados */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Target style={{ width: 14, height: 14, color: "#059669" }} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Simulados</h2>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>({simulatedExams.length})</span>
          </div>

          {simulatedExams.length === 0 ? (
            <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 12, padding: "32px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum simulado realizado ainda</p>
              <Link href="/concursos" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, marginTop: 8, display: "inline-block", textDecoration: "none" }}>
                Fazer simulado →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {simulatedExams.map((se) => {
                const pct = se.totalQuestions > 0 ? Math.round((se.correctAnswers / se.totalQuestions) * 100) : 0;
                const color = pct >= 70 ? "#059669" : pct >= 50 ? "#D97706" : "#DC2626";
                const mins = Math.floor((se.timeSpentSeconds ?? 0) / 60);
                return (
                  <div key={se.id} className="card" style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{pct}%</span>
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{formatDate(se.createdAt)}</span>
                    </div>
                    {se.competition && (
                      <p style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600, marginBottom: 4 }}>{se.competition.name}</p>
                    )}
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280" }}>
                      <span><CheckCircle2 style={{ width: 11, height: 11, color: "#059669", display: "inline", marginRight: 3 }} />{se.correctAnswers}/{se.totalQuestions}</span>
                      {mins > 0 && <span><Clock style={{ width: 11, height: 11, display: "inline", marginRight: 3 }} />{mins}min</span>}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                        background: se.status === "COMPLETED" ? "#ECFDF5" : "#FFFBEB",
                        color: se.status === "COMPLETED" ? "#059669" : "#D97706",
                      }}>
                        {se.status === "COMPLETED" ? "Concluído" : "Em andamento"}
                      </span>
                    </div>
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
