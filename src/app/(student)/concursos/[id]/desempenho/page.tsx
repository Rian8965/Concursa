import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DesempenhoConcursoPage({ params }: Props) {
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
    include: {
      competition: {
        include: {
          subjects: { include: { subject: { select: { id: true, name: true, color: true } } } },
        },
      },
    },
  });
  if (!enrollment) notFound();

  const comp = enrollment.competition;

  const [totalAnswered, correctAnswers] = await Promise.all([
    prisma.studentAnswer.count({
      where: { studentProfileId: profile.id, question: { competitionId: id } },
    }),
    prisma.studentAnswer.count({
      where: { studentProfileId: profile.id, isCorrect: true, question: { competitionId: id } },
    }),
  ]);

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

  const subjectPerf = await Promise.all(
    comp.subjects.map(async (cs) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, question: { competitionId: id, subjectId: cs.subjectId } },
        }),
        prisma.studentAnswer.count({
          where: {
            studentProfileId: profile.id,
            isCorrect: true,
            question: { competitionId: id, subjectId: cs.subjectId },
          },
        }),
      ]);
      return {
        name: cs.subject.name,
        color: cs.subject.color,
        total,
        correct,
        acc: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    })
  );

  return (
    <div style={{ maxWidth: 720 }}>
      <Link
        href={`/concursos/${id}`}
        style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar ao concurso
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <TrendingUp style={{ width: 26, height: 26, color: "#7C3AED" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Desempenho</h1>
          <p style={{ fontSize: 13, color: "#6B7280" }}>{comp.name}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 8 }}>Geral neste concurso</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: "#7C3AED" }}>{accuracy}%</span>
          <span style={{ fontSize: 14, color: "#6B7280" }}>
            {correctAnswers} acertos · {totalAnswered} respondidas
          </span>
        </div>
        <Progress value={accuracy} className="h-2 mt-3" />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Por matéria</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {subjectPerf.map((s) => (
          <div key={s.name} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>{s.acc}%</span>
            </div>
            <Progress value={s.acc} className="h-1.5" />
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
              {s.correct} / {s.total} questões
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
