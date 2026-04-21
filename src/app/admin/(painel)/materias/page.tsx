"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Subject {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
}

export default function AdminMateriasPage() {
  const [items, setItems] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<Subject | Partial<Subject> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/admin/subjects").then((r) => r.json());
    setItems(data.subjects ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing || !(editing as Subject).name?.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    setSaving(true);
    const isNew = !(editing as Subject).id;
    const url = isNew ? "/api/admin/subjects" : `/api/admin/subjects/${(editing as Subject).id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    if (res.ok) {
      toast.success(isNew ? "Matéria criada!" : "Atualizada!");
      load();
      setEditing(null);
    } else toast.error("Erro ao salvar");
    setSaving(false);
  }

  return (
    <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
      <PageHeader eyebrow="Conteúdo" title="Matérias" description={`${items.length} matérias cadastradas`}>
        <button type="button" onClick={() => setEditing({ name: "", description: "", color: "#7C3AED" })} className="btn btn-primary inline-flex items-center gap-2 rounded-2xl">
          <Plus className="h-3.5 w-3.5" />
          Nova Matéria
        </button>
      </PageHeader>

      <div className="orbit-panel overflow-hidden p-0">
        {items.length === 0 ? (
          <div className="orbit-empty-state py-14">
            <p className="text-[15px] text-[var(--text-muted)]">Nenhuma matéria cadastrada</p>
          </div>
        ) : (
          <div className="orbit-table-wrap border-0 shadow-none">
            <table className="orbit-admin-table">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[46%]" />
                <col className="w-[10%]" />
                <col className="w-[18%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Matéria", "Descrição", "Cor", "Ações"].map((h) => (
                    <th
                      key={h}
                      className={`whitespace-nowrap px-4 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)] ${
                        h === "Cor" ? "text-center" : h === "Ações" ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-black/[0.04] transition-colors hover:bg-[var(--bg-muted)]/80">
                    <td className="px-4 py-3">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--text-primary)]">{s.name}</p>
                    </td>
                    <td className="min-w-0 px-4 py-3">
                      <p className="truncate text-[13px] text-[var(--text-secondary)]" title={s.description?.trim() ? s.description : undefined}>
                        {s.description?.trim() ? s.description : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex h-8 w-8 items-center justify-center">
                        <div
                          className="h-6 w-6 rounded-md border border-black/[0.08] shadow-sm"
                          style={{ background: s.color ?? "#E5E7EB" }}
                          title={s.color ?? undefined}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => setEditing(s)} className="orbit-icon-btn" title="Editar">
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="orbit-modal-backdrop z-[100]" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subject-modal-title"
            className="orbit-modal-panel orbit-modal-panel--sm orbit-modal-panel--flex"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orbit-modal-panel__head">
              <div className="flex items-center justify-between gap-3">
                <h2 id="subject-modal-title" className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                  {(editing as Subject).id ? "Editar" : "Nova"} Matéria
                </h2>
                <button type="button" className="orbit-modal-close shrink-0" onClick={() => setEditing(null)} aria-label="Fechar">
                  ×
                </button>
              </div>
            </div>
            <div className="orbit-modal-panel__body">
              <div className="orbit-form-stack">
                <div>
                  <label className="orbit-form-label">Nome *</label>
                  <input className="input" value={(editing as Subject).name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <label className="orbit-form-label">Descrição</label>
                  <input
                    className="input"
                    value={(editing as Subject).description ?? ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="orbit-form-label">Cor</label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={(editing as Subject).color ?? "#7C3AED"}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-black/[0.08] bg-transparent p-0.5"
                    />
                    <input
                      className="input min-w-0 flex-1 font-mono text-[13px]"
                      value={(editing as Subject).color ?? "#7C3AED"}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="orbit-modal-panel__foot">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost rounded-2xl">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={saving} className={cn("btn btn-primary min-w-[110px] rounded-2xl", saving && "opacity-70")}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
