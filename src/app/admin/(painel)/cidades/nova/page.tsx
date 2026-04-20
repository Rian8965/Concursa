"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function NovaCidadePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", state: "", ibgeCode: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.state.trim()) {
      toast.error("Nome e estado são obrigatórios");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        ibgeCode: form.ibgeCode.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error((data as { error?: string }).error ?? "Erro ao salvar");
      return;
    }
    toast.success("Cidade cadastrada!");
    router.push("/admin/cidades");
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <Link href="/admin/cidades" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Nova cidade</h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Cadastre uma cidade para vincular a concursos.</p>

      <form onSubmit={submit} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome da cidade *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>UF *</label>
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} placeholder="SP" required />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Código IBGE</label>
          <input className="input" value={form.ibgeCode} onChange={(e) => setForm({ ...form, ibgeCode: e.target.value })} placeholder="Opcional" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Save style={{ width: 14, height: 14 }} /> {saving ? "Salvando..." : "Salvar cidade"}
        </button>
      </form>
    </div>
  );
}
