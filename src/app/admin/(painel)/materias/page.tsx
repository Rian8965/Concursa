"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Edit2, Trash2 } from "lucide-react";

interface Subject { id: string; name: string; description?: string | null; color?: string | null; isActive: boolean }

export default function AdminMateriasPage() {
  const [items, setItems] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<Subject | Partial<Subject> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/admin/subjects").then((r) => r.json());
    setItems(data.subjects ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing || !(editing as Subject).name?.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const isNew = !(editing as Subject).id;
    const url = isNew ? "/api/admin/subjects" : `/api/admin/subjects/${(editing as Subject).id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    if (res.ok) { toast.success(isNew ? "Matéria criada!" : "Atualizada!"); load(); setEditing(null); }
    else toast.error("Erro ao salvar");
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <PageHeader eyebrow="Conteúdo" title="Matérias" description={`${items.length} matérias cadastradas`}>
        <button onClick={() => setEditing({ name: "", description: "", color: "#7C3AED" })} className="btn btn-primary">
          <Plus style={{ width: 14, height: 14 }} /> Nova Matéria
        </button>
      </PageHeader>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        {items.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#9CA3AF" }}>Nenhuma matéria cadastrada</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #F3F4F6" }}>
              {["Matéria", "Descrição", "Cor", "Ações"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < items.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.name}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#6B7280" }}>{s.description ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: s.color ?? "#E5E7EB" }} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => setEditing(s)} style={{ width: 30, height: 30, borderRadius: 8, background: "#F3F4F6", border: "1px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontFamily: "var(--font-sans)" }}>
                      <Edit2 style={{ width: 12, height: 12 }} />
                    </button>
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
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{(editing as Subject).id ? "Editar" : "Nova"} Matéria</h2>
              <button onClick={() => setEditing(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF", fontFamily: "var(--font-sans)" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome *</label>
                <input className="input" value={(editing as Subject).name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Descrição</label>
                <input className="input" value={(editing as Subject).description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Cor</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="color" value={(editing as Subject).color ?? "#7C3AED"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} style={{ width: 40, height: 34, borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer" }} />
                  <input className="input" value={(editing as Subject).color ?? "#7C3AED"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} style={{ flex: 1 }} />
                </div>
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
