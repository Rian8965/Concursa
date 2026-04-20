"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Edit2 } from "lucide-react";

interface Plan { id: string; name: string; description?: string | null; durationDays?: number | null; isActive: boolean }

export default function AdminPlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/admin/plans").then((r) => r.json());
    setPlans(data.plans ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!(editing as Plan)?.name?.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    if (res.ok) { toast.success("Plano criado!"); load(); setEditing(null); }
    else toast.error("Erro ao salvar");
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader eyebrow="Alunos" title="Planos de Acesso" description={`${plans.length} planos cadastrados`}>
        <button onClick={() => setEditing({ name: "", description: "", durationDays: 30 })} className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Novo Plano
        </button>
      </PageHeader>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {plans.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9CA3AF" }}>Nenhum plano cadastrado</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #F3F4F6" }}>
              {["Plano", "Descrição", "Duração", "Status"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {plans.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < plans.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#6B7280" }}>{p.description ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#374151" }}>
                    {p.durationDays ? `${p.durationDays} dias` : "Ilimitado"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: p.isActive ? "#ECFDF5" : "#F3F4F6", color: p.isActive ? "#059669" : "#9CA3AF" }}>
                      {p.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>Novo Plano</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF", fontFamily: "var(--font-sans)" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome *</label>
                <input className="input" value={(editing as Plan).name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Plano Anual" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Descrição</label>
                <input className="input" value={(editing as Plan).description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Duração (dias)</label>
                <input type="number" className="input" value={(editing as Plan).durationDays ?? ""} onChange={(e) => setEditing({ ...editing, durationDays: parseInt(e.target.value) || null })} placeholder="Deixe vazio para ilimitado" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
