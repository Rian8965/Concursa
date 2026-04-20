import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Play, Target } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

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
        prisma.studentAnswer.count({ where: { studentProfileId: profile.id, isCorrect: true, question: { competitionId: id, subjectId: cs.subjectId } } }),
      ]);
      return { ...cs, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
    })
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href={`/concursos/${id}`} style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
          ← {sc.competition.name}
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Matérias</h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>{subjectStats.length} matérias cadastradas para este concurso</p>
      </div>

      {subjectStats.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <BookOpen style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Nenhuma matéria cadastrada</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {subjectStats.map((cs) => (
            <div key={cs.subjectId} className="card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 6, height: 36, borderRadius: 4, background: cs.subject.color ?? "linear-gradient(180deg,#7C3AED,#A855F7)", flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{cs.subject.name}</p>
                      <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>{cs.subject.topics.length} assuntos</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                        <span>{cs.total} questões respondidas</span>
                        <span style={{ fontWeight: 700, color: cs.accuracy >= 70 ? "#059669" : cs.accuracy >= 50 ? "#D97706" : cs.total > 0 ? "#DC2626" : "#9CA3AF" }}>
                          {cs.total > 0 ? `${cs.accuracy}%` : "Não iniciado"}
                        </span>
                      </div>
                      <Progress value={cs.accuracy} className="h-[5px]" />
                    </div>
                  </div>

                  {cs.subject.topics.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, marginLeft: 16 }}>
                      {cs.subject.topics.slice(0, 5).map((t) => (
                        <span key={t.id} style={{ fontSize: 11, background: "#F3F4F6", color: "#6B7280", padding: "2px 8px", borderRadius: 10 }}>
                          {t.name}
                        </span>
                      ))}
                      {cs.subject.topics.length > 5 && (
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>+{cs.subject.topics.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <Link
                    href={`/concursos/${id}/treino?subject=${cs.subjectId}`}
                    className="btn btn-purple"
                    style={{ fontSize: 12, padding: "7px 14px", gap: 5, height: "auto" }}
                  >
                    <Play style={{ width: 11, height: 11 }} /> Treinar
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
