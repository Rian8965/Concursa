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

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const enrollment = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
    include: { competition: { select: { id: true, name: true } } },
  });
  if (!enrollment) notFound();

  // Conta questões disponíveis para o aluno (por matéria do cargo, ou competição)
  let qCount = 0;

  if (enrollment.jobRoleId) {
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId: id, jobRoleId: enrollment.jobRoleId },
      select: { subjectId: true },
    });
    const subjectIds = links.map((l) => l.subjectId);
    if (subjectIds.length > 0) {
      qCount = await prisma.question.count({
        where: { status: "ACTIVE", alternatives: { some: {} }, subjectId: { in: subjectIds } },
      });
    }
  } else {
    // Fallback: todas as questões do concurso (por competitionId) + por matérias do concurso
    const byComp = await prisma.question.count({
      where: { competitionId: id, status: "ACTIVE", alternatives: { some: {} } },
    });
    const links = await prisma.competitionSubject.findMany({
      where: { competitionId: id },
      select: { subjectId: true },
    });
    if (links.length > 0) {
      const bySubject = await prisma.question.count({
        where: { status: "ACTIVE", alternatives: { some: {} }, subjectId: { in: links.map((l) => l.subjectId) } },
      });
      qCount = Math.max(byComp, bySubject);
    } else {
      qCount = byComp;
    }
  }

  return (
    <div className="orbit-stack max-w-xl animate-fade-up">
      <Link
        href={`/concursos/${id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao concurso
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 ring-1 ring-violet-200/60">
          <FileText className="h-5 w-5 text-violet-700" />
        </div>
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)]">Apostila em PDF</h1>
          <p className="text-[12px] text-[var(--text-secondary)]">{enrollment.competition.name}</p>
        </div>
      </div>

      <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
        Gere um PDF com questões objetivas para imprimir ou estudar offline. O sistema prioriza questões que você ainda não usou em apostilas anteriores.
      </p>

      {qCount === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13.5px] leading-relaxed text-amber-900">
          Ainda não há questões disponíveis para o seu cargo neste concurso. Quando o administrador importar questões nas matérias do seu cargo, a geração ficará disponível.
        </div>
      ) : (
        <>
          <p className="text-[12px] text-[var(--text-muted)]">{qCount} questão{qCount !== 1 ? "ões" : ""} disponível{qCount !== 1 ? "is" : ""} no banco</p>
          <ApostilasActions competitionId={id} competitionName={enrollment.competition.name} />
        </>
      )}
    </div>
  );
}
