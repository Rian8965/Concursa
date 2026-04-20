"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Search, Edit2, Trash2, Trophy, Eye } from "lucide-react";

interface Competition {
  id: string; name: string; status: string;
  city: { name: string; state: string };
  examBoard?: { acronym: string } | null;
  examDate?: string | null;
  _count: { questions: number; students: number };
}

const STATUS_MAP: Record<string, { label: string; variant: "active" | "upcoming" | "past" | "cancelled" }> = {
  ACTIVE: { label: "Ativo", variant: "active" },
  UPCOMING: { label: "Em breve", variant: "upcoming" },
  PAST: { label: "Encerrado", variant: "past" },
  CANCELLED: { label: "Cancelado", variant: "cancelled" },
};

export default function AdminConcursosPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load(q = "") {
    setLoading(true);
    const res = await fetch(`/api/admin/competitions?search=${encodeURIComponent(q)}&limit=50`);
    const data = await res.json();
    setCompetitions(data.competitions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Concurso excluído"); load(search); }
    else toast.error("Erro ao excluir");
    setDeleting(null);
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader eyebrow="Estrutura" title="Concursos" description={`${total} concurso${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}>
        <Link href="/admin/concursos/novo" className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Novo Concurso
        </Link>
      </PageHeader>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9CA3AF" }} />
        <input
          className="input"
          style={{ paddingLeft: 42 }}
          placeholder="Buscar concursos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        </div>
      ) : competitions.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <Trophy style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Nenhum concurso encontrado</p>
          <Link href="/admin/concursos/novo" className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
            <Plus style={{ width: 13, height: 13 }} /> Criar primeiro concurso
          </Link>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Concurso", "Localidade / Banca", "Status", "Questões", "Alunos", "Ações"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitions.map((c, i) => {
                const s = STATUS_MAP[c.status] ?? { label: c.status, variant: "secondary" as const };
                return (
                  <tr key={c.id} style={{ borderBottom: i < competitions.length - 1 ? "1px solid #F9FAFB" : "none", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFE")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{c.name}</p>
                      {c.examDate && <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 1 }}>{new Date(c.examDate).toLocaleDateString("pt-BR")}</p>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontSize: 13, color: "#374151" }}>{c.city.name} — {c.city.state}</p>
                      {c.examBoard && <p style={{ fontSize: 11.5, color: "#7C3AED", fontWeight: 600 }}>{c.examBoard.acronym}</p>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>{c._count.questions}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>{c._count.students}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link href={`/admin/concursos/${c.id}`}
                          style={{ width: 30, height: 30, borderRadius: 8, background: "#F3F4F6", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", textDecoration: "none" }}>
                          <Edit2 style={{ width: 12, height: 12 }} />
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deleting === c.id}
                          style={{ width: 30, height: 30, borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
