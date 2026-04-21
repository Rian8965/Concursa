import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { DeleteImportButton } from "./delete-import-button";

const STATUS_MAP: Record<string, { label: string; badgeClass: string; icon: typeof Clock }> = {
  PENDING: { label: "Aguardando", badgeClass: "bg-amber-50 text-amber-900 ring-amber-200/80", icon: Clock },
  PROCESSING: { label: "Processando", badgeClass: "bg-blue-50 text-blue-800 ring-blue-200/80", icon: Clock },
  REVIEW_PENDING: { label: "Revisar", badgeClass: "bg-violet-50 text-violet-800 ring-violet-200/80", icon: AlertCircle },
  COMPLETED: { label: "Concluído", badgeClass: "bg-emerald-50 text-emerald-800 ring-emerald-200/80", icon: CheckCircle2 },
  FAILED: { label: "Falhou", badgeClass: "bg-red-50 text-red-800 ring-red-200/80", icon: XCircle },
};

export default async function AdminImportacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const imports = await prisma.pDFImport.findMany({
    include: { competition: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const pending = imports.filter((i) => i.status === "REVIEW_PENDING").length;

  return (
    <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
      <PageHeader eyebrow="Conteúdo" title="Importações de PDF" description="Gerencie as importações de questões via PDF">
        <Link href="/admin/importacoes/nova" className="btn btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 text-[13px]">
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2} /> Nova importação
        </Link>
      </PageHeader>

      {pending > 0 && (
        <div className="orbit-alert flex items-center gap-3 py-3.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[13px] font-semibold text-amber-950">
            {pending} importação{pending > 1 ? "ões" : ""} aguardando revisão
          </p>
        </div>
      )}

      {imports.length === 0 ? (
        <div className="orbit-panel overflow-hidden p-0">
          <div className="orbit-empty-state py-14">
            <FileText className="mx-auto mb-3 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma importação realizada</p>
            <Link href="/admin/importacoes/nova" className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-2xl text-[13px]">
              <Plus className="h-3.5 w-3.5" /> Nova importação
            </Link>
          </div>
        </div>
      ) : (
        <div className="orbit-data-table-scroll orbit-data-table-scroll--lg">
          <div className="orbit-table-wrap">
            <table className="orbit-admin-table">
              <colgroup>
                <col className="min-w-[200px] w-[24%]" />
                <col className="min-w-[140px] w-[22%]" />
                <col className="min-w-[120px] w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="min-w-[100px] w-[11%]" />
                <col className="min-w-[140px] w-[10%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Arquivo", "Concurso", "Status", "Extraídas", "Aprovadas", "Data", "Ações"].map((h) => (
                    <th
                      key={h}
                      className={
                        h === "Extraídas" || h === "Aprovadas" || h === "Data" || h === "Ações" ? "text-right" : "text-left"
                      }
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => {
                  const s = STATUS_MAP[imp.status] ?? STATUS_MAP.PENDING;
                  const Icon = s.icon;
                  return (
                    <tr key={imp.id}>
                      <td className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FileText className="h-4 w-4 shrink-0 text-violet-600" />
                          <p className="truncate font-semibold text-[var(--text-primary)]" title={imp.originalFilename}>
                            {imp.originalFilename}
                          </p>
                        </div>
                      </td>
                      <td className="min-w-0">
                        <p className="truncate text-[var(--text-secondary)]" title={imp.competition?.name ?? undefined}>
                          {imp.competition?.name ?? <span className="text-[var(--text-muted)]">—</span>}
                        </p>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${s.badgeClass}`}>
                          <Icon className="h-3.5 w-3.5 shrink-0" /> {s.label}
                        </span>
                      </td>
                      <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">{imp.totalExtracted}</td>
                      <td className="text-right tabular-nums font-semibold text-emerald-700">{imp.totalApproved}</td>
                      <td className="text-right text-sm tabular-nums text-[var(--text-muted)]">{formatDate(imp.createdAt)}</td>
                      <td className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {imp.status === "REVIEW_PENDING" ? (
                            <Link
                              href={`/admin/importacoes/${imp.id}/revisao`}
                              className="btn btn-primary inline-flex min-h-[40px] items-center rounded-xl px-4 text-xs font-bold"
                            >
                              Revisar
                            </Link>
                          ) : (
                            <Link
                              href={`/admin/importacoes/${imp.id}/revisao`}
                              className="btn btn-ghost inline-flex min-h-[40px] items-center rounded-xl px-4 text-xs font-semibold"
                            >
                              Ver
                            </Link>
                          )}
                          <DeleteImportButton importId={imp.id} filename={imp.originalFilename} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
