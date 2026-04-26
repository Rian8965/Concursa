import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import BancaAnalyticsClient from "./BancaAnalyticsClient";

function pctLabel(v: number | null) {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function diffLabelFromAcc(acc: number | null) {
  if (acc == null) return "—";
  if (acc > 0.7) return "Fácil";
  if (acc >= 0.5) return "Média";
  return "Difícil";
}

export default async function AdminBancaDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ subjectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  const { id } = await params;
  const { subjectId } = await searchParams;

  const board = await prisma.examBoard.findUnique({ where: { id } });
  if (!board) redirect("/admin/bancas");

  // Server-side fetch via prisma para KPIs básicos (as estatísticas detalhadas vêm do endpoint analytics no client)
  // Mantém a página rápida e evita excessos de serialização.
  const totalQuestions = await prisma.question.count({
    where: { examBoardId: id, status: "ACTIVE", alternatives: { some: {} } },
  });

  return (
    <div className="orbit-stack mx-auto w-full max-w-6xl animate-fade-up">
      <Link href="/admin/bancas" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para bancas
      </Link>

      <div className="orbit-panel">
        <div className="orbit-panel-header">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Banca examinadora</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">{board.acronym}</h1>
              <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{board.name}</span>
              <span className="rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[12px] font-bold text-slate-700">
                {board.isActive ? "Ativa" : "Inativa"}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">
              Questões ativas cadastradas: <strong className="text-[var(--text-primary)]">{totalQuestions.toLocaleString("pt-BR")}</strong>
            </p>
          </div>

          {board.website ? (
            <a href={board.website} target="_blank" rel="noopener" className="btn btn-ghost inline-flex items-center gap-2 rounded-2xl">
              <ExternalLink className="h-4 w-4" />
              Site
            </a>
          ) : null}
        </div>
      </div>

  <BancaAnalyticsClient boardId={id} subjectId={subjectId ?? null} />
    </div>
  );
}
