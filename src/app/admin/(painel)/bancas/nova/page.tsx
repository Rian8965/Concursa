"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";

export default function NovaBancaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", acronym: "", website: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.acronym.trim()) {
      toast.error("Nome e sigla são obrigatórios");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/exam-boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        acronym: form.acronym.trim().toUpperCase().slice(0, 12),
        website: form.website.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      const msg = (data as { error?: string }).error ?? "Erro ao salvar";
      if (res.status === 401) toast.error("Sem permissão");
      else toast.error(msg);
      return;
    }
    toast.success("Banca cadastrada!");
    router.push("/admin/bancas");
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <Link href="/admin/bancas" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Nova banca</h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>Cadastre uma banca examinadora (CESPE, FCC, etc.).</p>

      <form onSubmit={submit} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome completo *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Sigla *</label>
          <input className="input" value={form.acronym} onChange={(e) => setForm({ ...form, acronym: e.target.value.toUpperCase() })} placeholder="FCC" required />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Site</label>
          <input className="input" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Save style={{ width: 14, height: 14 }} /> {saving ? "Salvando..." : "Salvar banca"}
        </button>
      </form>
    </div>
  );
}
