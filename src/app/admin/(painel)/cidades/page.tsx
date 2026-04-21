import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function AdminCidadesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cities = await prisma.city.findMany({ orderBy: { name: "asc" }, take: 100 });

  return (
    <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
      <PageHeader eyebrow="Estrutura" title="Cidades" description={`${cities.length} cidades cadastradas`}>
        <Link href="/admin/cidades/nova" className="btn btn-primary inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-[13px]">
          <Plus className="h-4 w-4" strokeWidth={2} />
          Nova cidade
        </Link>
      </PageHeader>

      <div className="orbit-panel overflow-hidden p-0">
        {cities.length === 0 ? (
          <div className="orbit-empty-state py-14">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma cidade cadastrada</p>
            <Link href="/admin/cidades/nova" className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-2xl text-[13px]">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar cidade
            </Link>
          </div>
        ) : (
          <div className="orbit-table-wrap border-0 shadow-none">
            <table className="orbit-admin-table">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[12%]" />
                <col className="w-[28%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Cidade", "Estado", "Código IBGE", "Status"].map((h) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-4 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] ${
                        h === "Código IBGE" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.id} className="border-t border-black/[0.04] transition-colors hover:bg-[var(--bg-muted)]/80">
                    <td className="px-4 py-3">
                      <p className="text-[13.5px] font-semibold leading-snug text-[var(--text-primary)]">{c.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex min-w-[2.25rem] justify-center rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-bold text-[var(--text-secondary)] ring-1 ring-black/[0.06]">
                        {c.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[13px] text-[var(--text-secondary)]">{c.ibgeCode ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                          c.isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80" : "bg-gray-100 text-gray-600 ring-gray-200/80"
                        }`}
                      >
                        {c.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
