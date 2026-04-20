import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { ApostilasActions } from "./apostilas-actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ApostilasConcursoPage({ params }: Props) {
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
    include: { competition: true },
  });
  if (!enrollment) notFound();

  const qCount = await prisma.question.count({
    where: { competitionId: id, status: "ACTIVE", alternatives: { some: {} } },
  });

  return (
    <div style={{ maxWidth: 640 }}>
      <Link
        href={`/concursos/${id}`}
        style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar ao concurso
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #EDE9FE, #F3E8FF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FileText style={{ width: 22, height: 22, color: "#7C3AED" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Apostila em PDF</h1>
          <p style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{enrollment.competition.name}</p>
        </div>
      </div>

      <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.65, marginBottom: 20 }}>
        Gere um PDF com questões objetivas deste concurso para imprimir ou estudar offline. O sistema prioriza questões que você ainda não usou em apostilas
        anteriores; se não houver quantidade suficiente, complementa com sorteio entre o banco completo.
      </p>

      {qCount === 0 ? (
        <div
          className="card"
          style={{ padding: 20, background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", fontSize: 14 }}
        >
          Ainda não há questões publicadas para este concurso. Quando o administrador importar e aprovar questões, a geração ficará disponível.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>
            {qCount} questão(ões) disponível(is) no banco
          </p>
          <ApostilasActions competitionId={id} competitionName={enrollment.competition.name} />
        </>
      )}
    </div>
  );
}
