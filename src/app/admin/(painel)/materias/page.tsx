"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Edit2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Subject {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
  _count?: { questions: number; topics: number };
}

export default function AdminMateriasPage() {
  const router = useRouter();
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
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
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
        <button
          type="button"
          onClick={() => setEditing({ name: "", description: "", color: "#7C3AED" })}
          className="btn btn-primary inline-flex items-center gap-2 rounded-2xl"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Matéria
        </button>
      </PageHeader>

      {items.length === 0 ? (
        <div className="orbit-panel overflow-hidden p-0">
          <div className="orbit-empty-state py-14">
            <p className="text-[15px] text-[var(--text-muted)]">Nenhuma matéria cadastrada</p>
          </div>
        </div>
      ) : (
        <div className="orbit-panel overflow-hidden p-0">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {items.map((s) => {
              const color = s.color ?? "#7C3AED";
              const colorBg = `${color}18`;
              const qCount = s._count?.questions ?? 0;
              const tCount = s._count?.topics ?? 0;

              return (
                <li key={s.id}>
                  <div className="group flex items-center gap-4 px-5 py-4">
                    {/* Color chip */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.06]"
                      style={{ background: colorBg }}
                    >
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ background: color }}
                      />
                    </div>

                    {/* Name + counters — clickable */}
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/materias/${s.id}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-semibold leading-snug text-[var(--text-primary)] group-hover:text-violet-700 transition-colors">
                        {s.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {qCount === 0 && tCount === 0
                          ? s.description?.trim() || "Sem questões ainda"
                          : [
                              qCount > 0 ? `${qCount} ${qCount === 1 ? "questão" : "questões"}` : null,
                              tCount > 0 ? `${tCount} ${tCount === 1 ? "conteúdo" : "conteúdos"}` : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                      </p>
                    </button>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(s);
                        }}
                        className="orbit-icon-btn"
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/admin/materias/${s.id}`)}
                        className="orbit-icon-btn text-violet-500"
                        title="Ver detalhes"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Edit / Create modal */}
      {editing && (
        <div
          className="orbit-modal-backdrop z-[100]"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
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
                <button
                  type="button"
                  className="orbit-modal-close shrink-0"
                  onClick={() => setEditing(null)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="orbit-modal-panel__body">
              <div className="orbit-form-stack">
                <div>
                  <label className="orbit-form-label">Nome *</label>
                  <input
                    className="input"
                    value={(editing as Subject).name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
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
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className={cn("btn btn-primary min-w-[110px] rounded-2xl", saving && "opacity-70")}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
