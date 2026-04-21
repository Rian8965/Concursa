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
    <div className="orbit-stack max-w-lg animate-fade-up">
      <Link href="/admin/bancas" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">Nova banca</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">Cadastre uma banca examinadora (CESPE, FCC, etc.).</p>
      </div>

      <form onSubmit={submit} className="orbit-card-premium orbit-form-stack">
        <div>
          <label className="orbit-form-label">Nome completo *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="orbit-form-label">Sigla *</label>
          <input className="input" value={form.acronym} onChange={(e) => setForm({ ...form, acronym: e.target.value.toUpperCase() })} placeholder="FCC" required />
        </div>
        <div>
          <label className="orbit-form-label">Site</label>
          <input className="input" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
        </div>
        <button type="submit" className="btn btn-primary mt-1 inline-flex w-fit items-center gap-2 self-start rounded-2xl" disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar banca"}
        </button>
      </form>
    </div>
  );
}
