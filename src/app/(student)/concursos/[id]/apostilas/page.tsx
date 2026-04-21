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
    <div className="orbit-stack max-w-xl animate-fade-up">
      <Link
        href={`/concursos/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao concurso
      </Link>

      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 ring-1 ring-violet-200/60">
          <FileText className="h-5 w-5 text-violet-700" />
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--text-primary)]">Apostila em PDF</h1>
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{enrollment.competition.name}</p>
        </div>
      </div>

      <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
        Gere um PDF com questões objetivas deste concurso para imprimir ou estudar offline. O sistema prioriza questões que você ainda não usou em apostilas
        anteriores; se não houver quantidade suficiente, complementa com sorteio entre o banco completo.
      </p>

      {qCount === 0 ? (
        <div className="orbit-card-premium border-amber-200/80 bg-amber-50/90 text-[14px] leading-relaxed text-amber-950 ring-1 ring-amber-200/60">
          Ainda não há questões publicadas para este concurso. Quando o administrador importar e aprovar questões, a geração ficará disponível.
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">{qCount} questão(ões) disponível(is) no banco</p>
          <ApostilasActions competitionId={id} competitionName={enrollment.competition.name} />
        </>
      )}
    </div>
  );
}
