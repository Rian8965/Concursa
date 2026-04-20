import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function AdminCargosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = await prisma.jobRole.findMany({ orderBy: { name: "asc" }, take: 100 });

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader eyebrow="Estrutura" title="Cargos" description={`${roles.length} cargos cadastrados`}>
        <Link href="/admin/cargos/novo" className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Novo Cargo
        </Link>
      </PageHeader>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {roles.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9CA3AF" }}>Nenhum cargo cadastrado</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #F3F4F6" }}>
              {["Cargo", "Área", "Nível", "Status"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {roles.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < roles.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{r.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>{r.area ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7280" }}>{r.level ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: r.isActive ? "#ECFDF5" : "#F3F4F6", color: r.isActive ? "#059669" : "#9CA3AF" }}>
                      {r.isActive ? "Ativo" : "Inativo"}
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
