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
    <div className="orbit-stack w-full max-w-none animate-fade-up">
      <PageHeader
        eyebrow="Conteúdo"
        title="Importações de PDF"
        description="Gerencie as importações de questões via PDF"
      >
        <Link href="/admin/importacoes/nova" className="btn btn-primary inline-flex min-h-[48px] items-center gap-2 px-7 text-[15px]">
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.25} /> Nova importação
        </Link>
      </PageHeader>

      {pending > 0 && (
        <div className="orbit-alert mb-7 items-center py-3.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-700" />
          <p className="text-[13px] font-semibold text-amber-950">
            {pending} importação{pending > 1 ? "ões" : ""} aguardando revisão
          </p>
        </div>
      )}

      {imports.length === 0 ? (
        <div className="rounded-[var(--r-panel)] border-2 border-dashed border-[rgba(124,58,237,0.18)] bg-gradient-to-br from-white to-[#FAF8FF] px-6 py-14 text-center shadow-[0_8px_32px_rgba(91,33,182,0.06)]">
          <FileText className="mx-auto mb-3 h-9 w-9 text-[#D1D5DB]" />
          <p className="text-[15px] font-semibold text-[#374151]">Nenhuma importação realizada</p>
          <Link href="/admin/importacoes/nova" className="btn btn-primary mt-4 text-[13px]">
            <Plus className="h-[13px] w-[13px]" /> Nova importação
          </Link>
        </div>
      ) : (
        <div className="orbit-table-wrap">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[rgba(17,24,39,0.06)]">
                {["Arquivo", "Concurso", "Status", "Extraídas", "Aprovadas", "Data", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">
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
                  <tr
                    key={imp.id}
                    className="hover-row border-b border-[#F4F4F8] last:border-b-0"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#7C3AED]" />
                        <p className="max-w-[180px] truncate text-[13px] font-semibold text-[#111827]">
                          {imp.originalFilename}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-[#374151]">
                      {imp.competition?.name ?? <span className="text-[#D1D5DB]">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ${s.badgeClass}`}
                      >
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] font-bold text-[#374151]">{imp.totalExtracted}</td>
                    <td className="px-4 py-3.5 text-[13px] font-bold text-emerald-700">{imp.totalApproved}</td>
                    <td className="px-4 py-3.5 text-[12px] text-[#6B7280]">{formatDate(imp.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {imp.status === "REVIEW_PENDING" ? (
                          <Link
                            href={`/admin/importacoes/${imp.id}/revisao`}
                            className="rounded-[10px] bg-[#EDE9FE] px-3 py-1.5 text-[12px] font-bold text-[#7C3AED] no-underline shadow-sm ring-1 ring-[rgba(124,58,237,0.15)] transition hover:bg-[#E4D9FD]"
                          >
                            Revisar →
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/importacoes/${imp.id}/revisao`}
                            className="rounded-[10px] bg-[#F3F4F6] px-3 py-1.5 text-[12px] font-semibold text-[#6B7280] no-underline transition hover:bg-[#ECEEF2]"
                          >
                            Ver detalhes
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
      )}
    </div>
  );
}
