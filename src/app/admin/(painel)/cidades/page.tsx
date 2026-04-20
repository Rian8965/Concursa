import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus, Edit2 } from "lucide-react";

export default async function AdminCidadesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cities = await prisma.city.findMany({ orderBy: { name: "asc" }, take: 100 });

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader eyebrow="Estrutura" title="Cidades" description={`${cities.length} cidades cadastradas`}>
        <Link href="/admin/cidades/nova" className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Nova Cidade
        </Link>
      </PageHeader>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {cities.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9CA3AF" }}>Nenhuma cidade cadastrada</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #F3F4F6" }}>
              {["Cidade", "Estado", "Código IBGE", "Status"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {cities.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: i < cities.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{c.state}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#9CA3AF" }}>{c.ibgeCode ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: c.isActive ? "#ECFDF5" : "#F3F4F6", color: c.isActive ? "#059669" : "#9CA3AF" }}>
                      {c.isActive ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
