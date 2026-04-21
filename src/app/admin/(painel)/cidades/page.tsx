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

      {cities.length === 0 ? (
        <div className="orbit-panel overflow-hidden p-0">
          <div className="orbit-empty-state py-14">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhuma cidade cadastrada</p>
            <Link href="/admin/cidades/nova" className="btn btn-primary mt-4 inline-flex items-center gap-2 rounded-2xl text-[13px]">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar cidade
            </Link>
          </div>
        </div>
      ) : (
        <div className="orbit-data-table-scroll">
          <div className="orbit-table-wrap">
            <table className="orbit-admin-table">
              <colgroup>
                <col className="min-w-[180px] w-[36%]" />
                <col className="min-w-[88px] w-[14%]" />
                <col className="min-w-[120px] w-[24%]" />
                <col className="min-w-[110px] w-[26%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Cidade", "Estado", "Código IBGE", "Status"].map((h) => (
                    <th
                      key={h}
                      className={h === "Código IBGE" ? "text-right" : h === "Status" ? "text-left" : "text-left"}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-semibold leading-snug text-[var(--text-primary)]">{c.name}</p>
                    </td>
                    <td>
                      <span className="inline-flex min-w-[2.5rem] justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)] ring-1 ring-black/[0.06]">
                        {c.state}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-[var(--text-secondary)]">{c.ibgeCode ?? "—"}</td>
                    <td>
                      <span
                        className={
                          c.isActive
                            ? "orbit-status-badge orbit-status-badge--success"
                            : "orbit-status-badge orbit-status-badge--muted"
                        }
                      >
                        {c.isActive ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
