import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, BookOpen, Filter } from "lucide-react";
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
    <div style={{ maxWidth: 860 }}>
      <PageHeader
        title="Questões"
        description="Histórico de todas as questões respondidas"
      />

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Respondidas", value: answers.length, color: "#7C3AED" },
          { label: "Acertos", value: totalCorrect, color: "#059669" },
          { label: "Taxa de acerto", value: `${accuracy}%`, color: accuracy >= 70 ? "#059669" : accuracy >= 50 ? "#D97706" : "#DC2626" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 4 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {answers.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <BookOpen style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Nenhuma questão respondida ainda</p>
          <Link href="/concursos" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, marginTop: 8, display: "inline-block", textDecoration: "none" }}>
            Ir para treino →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {answers.map((ans) => (
            <div key={ans.id} className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  {ans.isCorrect
                    ? <CheckCircle2 style={{ width: 18, height: 18, color: "#059669" }} />
                    : <XCircle style={{ width: 18, height: 18, color: "#DC2626" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    {ans.question.subject && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 12 }}>
                        {ans.question.subject.name}
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
                      background: ans.isCorrect ? "#ECFDF5" : "#FEF2F2",
                      color: ans.isCorrect ? "#059669" : "#DC2626",
                    }}>
                      {ans.isCorrect ? "Correta" : "Incorreta"}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>
                    {ans.question.content.length > 180
                      ? ans.question.content.slice(0, 180) + "…"
                      : ans.question.content}
                  </p>
                  <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "#9CA3AF" }}>
                    <span>Sua resposta: <strong style={{ color: ans.isCorrect ? "#059669" : "#DC2626" }}>{ans.selectedAnswer}</strong></span>
                    {!ans.isCorrect && (
                      <span>Correta: <strong style={{ color: "#059669" }}>{ans.question.correctAnswer}</strong></span>
                    )}
                    <span style={{ marginLeft: "auto" }}>{formatDate(ans.answeredAt)}</span>
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
