import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function AdminBancasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  const boards = await prisma.examBoard.findMany({ orderBy: { acronym: "asc" }, take: 200 });

  const counts = await prisma.question.groupBy({
    by: ["examBoardId"],
    where: {
      status: "ACTIVE",
      examBoardId: { not: null },
      alternatives: { some: {} },
    },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.examBoardId as string, c._count._all]));

  const rows = boards
    .map((b) => ({ board: b, questions: countMap.get(b.id) ?? 0 }))
    .sort((a, b) => (b.questions - a.questions) || a.board.acronym.localeCompare(b.board.acronym));

  return (
    <div className="orbit-stack mx-auto w-full max-w-4xl animate-fade-up">
      <PageHeader eyebrow="Estrutura" title="Bancas Examinadoras" description={`${boards.length} banca${boards.length !== 1 ? "s" : ""} cadastrada${boards.length !== 1 ? "s" : ""}`}>
        <Link href="/admin/bancas/nova" className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Nova Banca
        </Link>
      </PageHeader>

      {rows.length === 0 ? (
        <div className="orbit-empty-state">
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma banca cadastrada</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Cadastre bancas para vincular questões e concursos.</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid gap-3 sm:hidden">
            {rows.map(({ board: b, questions }) => (
              <div key={b.id} className="orbit-card-premium p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-extrabold tracking-[0.12em] text-violet-700">{b.acronym}</p>
                    <p className="mt-1 line-clamp-2 text-[14px] font-extrabold text-[var(--text-primary)]">{b.name}</p>
                    <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                      Questões: <span className="tabular-nums font-extrabold text-[var(--text-primary)]">{questions.toLocaleString("pt-BR")}</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={b.isActive ? "active" : "secondary"}>{b.isActive ? "Ativa" : "Inativa"}</Badge>
                    {b.website ? (
                      <a
                        href={b.website}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Site
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet: tabela */}
          <div className="hidden sm:block">
            <div className="orbit-data-table-scroll">
              <div className="orbit-table-wrap">
                <table className="orbit-admin-table">
                  <colgroup>
                    <col className="min-w-[90px] w-[12%]" />
                    <col className="min-w-[260px] w-[46%]" />
                    <col className="min-w-[140px] w-[16%]" />
                    <col className="min-w-[120px] w-[14%]" />
                    <col className="min-w-[120px] w-[12%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      {["Sigla", "Nome da banca", "Número de questões", "Status", "Ações"].map((h) => (
                        <th key={h} className={h === "Número de questões" || h === "Ações" ? "text-right" : "text-left"}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ board: b, questions }, i) => (
                      <tr key={b.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(17,24,39,0.06)" : "none" }}>
                        <td className="text-[13px] font-extrabold text-violet-700">{b.acronym}</td>
                        <td className="min-w-0">
                          <p className="truncate font-semibold text-[var(--text-primary)]">{b.name}</p>
                        </td>
                        <td className="text-right">
                          <span className="inline-flex items-center rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-violet-800">
                            {questions.toLocaleString("pt-BR")}
                          </span>
                        </td>
                        <td className="text-right">
                          <Badge variant={b.isActive ? "active" : "secondary"}>{b.isActive ? "Ativa" : "Inativa"}</Badge>
                        </td>
                        <td className="text-right">
                          {b.website ? (
                            <a href={b.website} target="_blank" rel="noopener" className="orbit-icon-btn" title="Abrir site">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
