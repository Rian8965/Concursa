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
    <div className="orbit-stack max-w-4xl animate-fade-up">
      <PageHeader eyebrow="Estrutura" title="Cidades" description={`${cities.length} cidades cadastradas`}>
        <Link href="/admin/cidades/nova" className="btn btn-primary inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-[13px]">
          <Plus className="h-4 w-4" strokeWidth={2} />
          Nova cidade
        </Link>
      </PageHeader>

      <div className="orbit-panel overflow-hidden">
        {cities.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-[var(--text-muted)]">Nenhuma cidade cadastrada</p>
          </div>
        ) : (
          <div className="orbit-table-wrap">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Cidade", "Estado", "Código IBGE", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-black/[0.04] transition-colors hover:bg-[var(--bg-muted)]/80"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-[var(--text-primary)]">{c.name}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[var(--text-secondary)]">{c.state}</td>
                    <td className="px-5 py-3.5 text-[13px] text-[var(--text-muted)]">{c.ibgeCode ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                          c.isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80" : "bg-gray-100 text-gray-500 ring-1 ring-gray-200/80"
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
