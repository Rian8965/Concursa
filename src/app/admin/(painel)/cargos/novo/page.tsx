"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function NovoCargoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    area: "",
    level: "",
    description: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome do cargo é obrigatório");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/job-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        area: form.area.trim() || null,
        level: form.level.trim() || null,
        description: form.description.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error((data as { error?: string }).error ?? "Erro ao salvar");
      return;
    }
    toast.success("Cargo cadastrado!");
    router.push("/admin/cargos");
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <Link href="/admin/cargos" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Novo cargo</h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Cargos podem ser associados a concursos e matérias.</p>

      <form onSubmit={submit} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome do cargo *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Área</label>
          <input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Ex.: Administrativa" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nível</label>
          <input className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Ex.: Superior" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Descrição</label>
          <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ resize: "vertical" }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Save style={{ width: 14, height: 14 }} /> {saving ? "Salvando..." : "Salvar cargo"}
        </button>
      </form>
    </div>
  );
}
