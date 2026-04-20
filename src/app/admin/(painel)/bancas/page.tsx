import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function AdminBancasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const boards = await prisma.examBoard.findMany({ orderBy: { acronym: "asc" }, take: 100 });

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader eyebrow="Estrutura" title="Bancas Examinadoras" description={`${boards.length} bancas cadastradas`}>
        <Link href="/admin/bancas/nova" className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Nova Banca
        </Link>
      </PageHeader>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {boards.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9CA3AF" }}>Nenhuma banca cadastrada</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #F3F4F6" }}>
              {["Sigla", "Nome", "Site", "Status"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {boards.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: i < boards.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>{b.acronym}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "#111827" }}>{b.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6B7280" }}>
                    {b.website ? <a href={b.website} target="_blank" rel="noopener" style={{ color: "#7C3AED", textDecoration: "none" }}>{b.website}</a> : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: b.isActive ? "#ECFDF5" : "#F3F4F6", color: b.isActive ? "#059669" : "#9CA3AF" }}>
                      {b.isActive ? "Ativa" : "Inativa"}
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
