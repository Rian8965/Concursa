import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, Target, BarChart3, History, Download,
  Clock, MapPin, Building2, Calendar, Briefcase,
  ArrowRight, Play, Trophy, FileText, Database,
} from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { CompetitionTabs } from "@/components/student/CompetitionTabs";

interface CompetitionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) redirect("/dashboard");

  const enrollment = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId: id } },
    include: {
      competition: { include: { city: true, examBoard: true } },
      jobRole: { select: { id: true, name: true } },
    },
  });
  if (!enrollment) notFound();

  const comp = enrollment.competition;

  // Busca subjects pelo cargo (prioritário) ou todos do concurso (fallback)
  let displaySubjects: { id: string; name: string; color?: string | null }[] = [];

  if (enrollment.jobRoleId) {
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId: id, jobRoleId: enrollment.jobRoleId },
      include: { subject: { select: { id: true, name: true, color: true } } },
      orderBy: { subject: { name: "asc" } },
    });
    displaySubjects = links.map((l) => l.subject);
  } else {
    const links = await prisma.competitionSubject.findMany({
      where: { competitionId: id },
      include: { subject: { select: { id: true, name: true, color: true } } },
      orderBy: { subject: { name: "asc" } },
    });
    displaySubjects = links.map((l) => l.subject);
  }

  // Desempenho por matéria (sem filtro de competitionId nas questões)
  const subjectStats = await Promise.all(
    displaySubjects.slice(0, 6).map(async (subject) => {
      const [total, correct] = await Promise.all([
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, question: { subjectId: subject.id } },
        }),
        prisma.studentAnswer.count({
          where: { studentProfileId: profile.id, isCorrect: true, question: { subjectId: subject.id } },
        }),
      ]);
      return { subject, total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
    }),
  );

  const totalAnswered = subjectStats.reduce((acc, s) => acc + s.total, 0);
  const totalCorrect = subjectStats.reduce((acc, s) => acc + s.correct, 0);
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  // Conta questões disponíveis para o aluno (com filtro de banca se definida)
  const subjectIds = displaySubjects.map((s) => s.id);
  const hasBanca = comp.examBoardDefined && comp.examBoardId;
  const questionsAvailable = subjectIds.length > 0
    ? await prisma.question.count({
        where: {
          status: "ACTIVE",
          alternatives: { some: {} },
          subjectId: { in: subjectIds },
          ...(hasBanca && { examBoardId: comp.examBoardId! }),
        },
      })
    : 0;

  // Dias restantes para a prova
  let daysLeft: number | null = null;
  if (comp.examDate) {
    try {
      const d = new Date(comp.examDate);
      if (!isNaN(d.getTime())) {
        daysLeft = Math.max(0, Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      }
    } catch { /* ignorado */ }
  }

  return (
    <div className="animate-fade-in space-y-5 pb-8">
      {/* Hero do concurso */}
      <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-sm">
        <div className="h-[3px] bg-gradient-to-r from-violet-600 to-fuchsia-500" />
        <div className="p-5">
          <div className="flex items-start justify-start gap-4 p-2.5 m-2.5">
            <div className="min-w-0 flex-1">
              {/* Badges */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge variant={comp.status === "ACTIVE" ? "active" : "upcoming"}>
                  {comp.status === "ACTIVE" ? "Ativo" : "Em breve"}
                </Badge>
                {comp.examBoard && (
                  <Badge variant="secondary">
                    {comp.examBoard.acronym}
                  </Badge>
                )}
                {!comp.examBoardDefined && <Badge variant="warning">Banca não definida</Badge>}
              </div>

              <h1 className="text-xl font-extrabold tracking-tight text-[#111827] sm:text-[22px]">
                {comp.name}
              </h1>
              {comp.organization && (
                <p className="mt-1 text-[13px] text-[#6B7280]">{comp.organization}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[#6B7280]">
                {comp.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#D1D5DB]" />
                    {comp.city.name}{comp.city.state ? `, ${comp.city.state}` : ""}
                  </span>
                )}
                {enrollment.jobRole && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-[#D1D5DB]" />
                    {enrollment.jobRole.name}
                  </span>
                )}
                {comp.examBoard && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-[#D1D5DB]" />
                    {comp.examBoard.name}
                  </span>
                )}
                {comp.examDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#D1D5DB]" />
                    {formatDate(comp.examDate)}
                  </span>
                )}
              </div>

              {/* Stats rápidos */}
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-[12px] font-semibold text-violet-700">
                  {displaySubjects.length} matéria{displaySubjects.length !== 1 ? "s" : ""}
                </span>
                <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
                  {questionsAvailable.toLocaleString("pt-BR")} questão{questionsAvailable !== 1 ? "ões" : ""} disponível{questionsAvailable !== 1 ? "is" : ""}
                  {hasBanca && comp.examBoard && (
                    <span className="ml-1 opacity-70">· {comp.examBoard.acronym}</span>
                  )}
                </span>
              </div>
            </div>

            {daysLeft !== null && (
              <div className="hidden shrink-0 flex-col items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4 text-white shadow-md md:flex">
                <Clock className="mb-1.5 h-4 w-4 opacity-60" />
                <p className="text-[36px] font-extrabold leading-none tracking-tight">{daysLeft}</p>
                <p className="mt-1 text-[10px] font-medium opacity-70">
                  {daysLeft === 1 ? "dia restante" : "dias restantes"}
                </p>
              </div>
            )}
          </div>

          {totalAnswered > 0 && (
            <div className="m-2.5 rounded-lg border border-violet-100 bg-violet-50/60 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[13px] leading-normal">
                <span className="font-semibold text-[#374151]">Desempenho geral</span>
                <span className="font-extrabold text-violet-700">{overallAccuracy}%</span>
              </div>
              <Progress value={overallAccuracy} className="h-1.5" />
              <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
                {totalAnswered} questões respondidas · {totalCorrect} acertos
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edital */}
      {comp.editalUrl && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-black/[0.06] bg-white px-5 py-4">
          <div>
            <p className="text-[13px] font-semibold text-[#111827]">Edital oficial</p>
            <p className="mt-1 text-[12px] text-[#6B7280]">Acesse o PDF do edital deste concurso</p>
          </div>
          <a
            href={comp.editalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 p-2.5 m-2.5 text-[12px] font-semibold text-white hover:bg-violet-700"
          >
            <Download className="h-3.5 w-3.5" />
            Abrir
          </a>
        </div>
      )}

      {/* Abas */}
      <CompetitionTabs competitionId={id} />

      {/* Grade: ações + matérias */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Ações */}
        <div className="lg:col-span-1">
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-[#9CA3AF]">Estudar agora</p>
          <div className="flex flex-col gap-3">
            {[
              { icon: Play, label: "Iniciar Treino", desc: "Questões das suas matérias", href: `/concursos/${id}/treino`, primary: true },
              { icon: Target, label: "Novo Simulado", desc: "Teste cronometrado", href: `/concursos/${id}/simulado`, primary: false },
              { icon: Download, label: "Baixar Apostila", desc: "PDF para estudar offline", href: `/concursos/${id}/apostilas`, primary: false },
              { icon: History, label: "Histórico", desc: "Simulados realizados", href: `/concursos/${id}/historico`, primary: false },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-2.5 m-2.5 text-[13px] font-medium transition-shadow",
                  action.primary
                    ? "bg-violet-600 text-white shadow-md hover:bg-violet-700"
                    : "border border-black/[0.07] bg-white text-[#374151] hover:shadow-sm",
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  action.primary ? "bg-white/15" : "bg-violet-50",
                )}>
                  <action.icon className={cn("h-3.5 w-3.5", action.primary ? "text-white" : "text-violet-600")} />
                </div>
                <div>
                  <p className="font-semibold leading-none">{action.label}</p>
                  <p className={cn("mt-0.5 text-[11.5px]", action.primary ? "opacity-70" : "text-[#9CA3AF]")}>
                    {action.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Matérias */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#9CA3AF]">
              Matérias {enrollment.jobRole ? `— ${enrollment.jobRole.name}` : ""}
            </p>
            {displaySubjects.length > 0 && (
              <Link href={`/concursos/${id}/materias`} className="text-[12px] font-semibold text-violet-600 hover:text-violet-800">
                Ver todas →
              </Link>
            )}
          </div>

          {displaySubjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.08] bg-white px-6 py-10 text-center">
              <BookOpen className="mx-auto mb-2 h-7 w-7 text-[#D1D5DB]" strokeWidth={1.5} />
              <p className="text-[13.5px] font-semibold text-[#374151]">Nenhuma matéria disponível</p>
              <p className="mt-1 text-[12px] text-[#9CA3AF]">
                {enrollment.jobRole
                  ? "O administrador ainda não vinculou matérias ao seu cargo."
                  : "O administrador ainda não adicionou matérias a este concurso."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {subjectStats.map(({ subject, total, accuracy }) => (
                <Link
                  key={subject.id}
                  href={`/concursos/${id}/treino?subject=${subject.id}`}
                  className="flex items-center gap-3.5 rounded-xl border border-black/[0.06] bg-white px-5 py-4 transition-shadow hover:shadow-sm"
                >
                  <div
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: subject.color ?? "linear-gradient(180deg, #7C3AED, #A855F7)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[#111827]">{subject.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={accuracy} className="h-[4px] flex-1" />
                      <span className="w-8 text-right text-[11.5px] font-bold text-[#374151]">{accuracy}%</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{total} respondida{total !== 1 ? "s" : ""}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB]" />
                </Link>
              ))}

              {displaySubjects.length > 6 && (
                <Link
                  href={`/concursos/${id}/materias`}
                  className="rounded-xl border border-dashed border-violet-200 py-3 text-center text-[13px] font-semibold text-violet-600 hover:bg-violet-50"
                >
                  Ver todas as {displaySubjects.length} matérias →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
