"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Search, Users, UserPlus, ShieldCheck, ShieldX, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

interface Student {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  studentProfile?: {
    plan?: { name: string } | null;
    accessExpiresAt?: string | null;
    _count?: { studentAnswers: number; trainingSessions: number };
  } | null;
}

interface Competition {
  id: string;
  name: string;
}

interface JobRole {
  id: string;
  name: string;
}

export default function AdminAlunosPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    const res = await fetch(`/api/admin/students?search=${encodeURIComponent(q)}&limit=50`);
    const data = await res.json();
    setStudents(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    Promise.all([
      fetch("/api/admin/competitions?limit=100").then((r) => r.json()),
      fetch("/api/admin/plans").then((r) => r.json()),
    ]).then(([cd, pd]) => {
      setCompetitions(cd.competitions ?? []);
      setPlans(pd.plans ?? []);
    });
  }, [load]);

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      toast.success(isActive ? "Aluno desativado" : "Aluno ativado");
      load(search);
    } else toast.error("Erro ao atualizar");
  }

  return (
    <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
      <PageHeader
        eyebrow="Alunos"
        title="Alunos"
        description={`${total} aluno${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}
      >
        <button
          type="button"
          onClick={() => setSelected({ id: "__new__", name: "", email: "", isActive: true, createdAt: "" })}
          className="btn btn-primary inline-flex items-center gap-2 rounded-xl"
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Novo aluno
        </button>
      </PageHeader>

      <div className="orbit-search-wrap">
        <Search className="orbit-search-icon" aria-hidden />
        <input
          className="input"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
        />
      </div>

      {loading ? (
        <div className="py-14 text-center"><div className="orbit-spinner" /></div>
      ) : students.length === 0 ? (
        <div className="orbit-empty-state">
          <Users className="mx-auto mb-4 h-9 w-9 text-[var(--text-muted)]" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="orbit-data-table-scroll orbit-data-table-scroll--lg">
          <div className="orbit-table-wrap">
            <table className="orbit-admin-table">
              <colgroup>
                <col className="min-w-[200px] w-[30%]" />
                <col className="min-w-[140px] w-[22%]" />
                <col className="min-w-[88px] w-[10%]" />
                <col className="min-w-[120px] w-[14%]" />
                <col className="min-w-[100px] w-[10%]" />
                <col className="min-w-[140px] w-[14%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Aluno", "Plano", "Questões", "Cadastro", "Status", "Ações"].map((h) => (
                    <th
                      key={h}
                      className={h === "Questões" || h === "Cadastro" || h === "Ações" ? "text-right" : "text-left"}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)]">{s.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{s.email}</p>
                    </td>
                    <td className="min-w-0">
                      <p className="truncate text-[var(--text-secondary)]">
                        {s.studentProfile?.plan?.name ?? <span className="text-[var(--text-muted)]">—</span>}
                      </p>
                    </td>
                    <td className="text-right tabular-nums font-semibold text-[var(--text-secondary)]">
                      {s.studentProfile?._count?.studentAnswers ?? 0}
                    </td>
                    <td className="text-right text-sm tabular-nums text-[var(--text-secondary)]">
                      {s.createdAt ? formatDate(new Date(s.createdAt)) : "—"}
                    </td>
                    <td>
                      <span className={s.isActive ? "orbit-status-badge orbit-status-badge--success" : "orbit-status-badge orbit-status-badge--danger"}>
                        {s.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelected(s)}
                          className="btn btn-ghost inline-flex min-h-[38px] min-w-[6rem] items-center justify-center rounded-lg px-3 text-xs font-semibold"
                        >
                          Gerenciar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(s.id, s.isActive)}
                          className={cn(
                            "orbit-icon-btn",
                            s.isActive
                              ? "orbit-icon-btn--danger"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                          )}
                          title={s.isActive ? "Desativar" : "Ativar"}
                        >
                          {s.isActive ? <ShieldX className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <StudentModal
          student={selected}
          competitions={competitions}
          plans={plans}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(search); }}
        />
      )}
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface CompetitionEntry {
  competitionId: string;
  jobRoleId: string;
  /** job roles carregados para este concurso */
  jobRoles: JobRole[];
  loadingRoles: boolean;
}

interface ModalProps {
  student: Student;
  competitions: Competition[];
  plans: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function StudentModal({ student, competitions, plans, onClose, onSaved }: ModalProps) {
  const isNew = student.id === "__new__";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: student.name,
    email: student.email,
    password: "",
    planId: (student.studentProfile as { planId?: string } | undefined)?.planId ?? "",
    accessExpiresAt: student.studentProfile?.accessExpiresAt
      ? new Date(student.studentProfile.accessExpiresAt).toISOString().slice(0, 10)
      : "",
  });
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);

  // Carrega dados existentes ao editar
  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/students/${student.id}`)
        .then((r) => r.json())
        .then(async ({ user }) => {
          setForm((f) => ({
            ...f,
            planId: user.studentProfile?.planId ?? "",
            accessExpiresAt: user.studentProfile?.accessExpiresAt
              ? new Date(user.studentProfile.accessExpiresAt).toISOString().slice(0, 10)
              : "",
          }));
          const scs: { competition: { id: string; name: string }; jobRole?: { id: string; name: string } | null }[] =
            user.studentProfile?.studentCompetitions ?? [];
          const loaded: CompetitionEntry[] = await Promise.all(
            scs.map(async (sc) => {
              const roles = await fetchJobRoles(sc.competition.id);
              return {
                competitionId: sc.competition.id,
                jobRoleId: sc.jobRole?.id ?? "",
                jobRoles: roles,
                loadingRoles: false,
              };
            }),
          );
          setEntries(loaded);
        });
    }
  }, [student.id, isNew]);

  async function fetchJobRoles(competitionId: string): Promise<JobRole[]> {
    try {
      const res = await fetch(`/api/admin/competitions/${competitionId}`);
      const data = await res.json();
      return (data.competition?.jobRolesWithSubjects ?? []).map((jr: { jobRoleId: string; name: string }) => ({
        id: jr.jobRoleId,
        name: jr.name,
      }));
    } catch {
      return [];
    }
  }

  async function addEntry() {
    setEntries((prev) => [...prev, { competitionId: "", jobRoleId: "", jobRoles: [], loadingRoles: false }]);
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCompetitionChange(idx: number, competitionId: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, competitionId, jobRoleId: "", jobRoles: [], loadingRoles: true } : e)),
    );
    if (!competitionId) {
      setEntries((prev) =>
        prev.map((e, i) => (i === idx ? { ...e, loadingRoles: false, jobRoles: [] } : e)),
      );
      return;
    }
    const roles = await fetchJobRoles(competitionId);
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, jobRoles: roles, loadingRoles: false } : e)),
    );
  }

  function handleJobRoleChange(idx: number, jobRoleId: string) {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, jobRoleId } : e)));
  }

  async function save() {
    setSaving(true);
    const validEntries = entries.filter((e) => e.competitionId);
    const competitionsPayload = validEntries.map((e) => ({
      competitionId: e.competitionId,
      jobRoleId: e.jobRoleId || null,
    }));

    if (isNew) {
      if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
        toast.error("Preencha nome, e-mail e senha");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, competitions: competitionsPayload }),
      });
      if (res.ok) {
        toast.success("Aluno criado com sucesso!");
        onSaved();
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Erro ao criar aluno");
      }
    } else {
      const res = await fetch(`/api/admin/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password || null,
          planId: form.planId,
          accessExpiresAt: form.accessExpiresAt || null,
          competitions: competitionsPayload,
        }),
      });
      if (res.ok) {
        toast.success("Aluno atualizado!");
        onSaved();
      } else toast.error("Erro ao atualizar");
    }
    setSaving(false);
  }

  return (
    <div
      className="orbit-modal-backdrop z-[100]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
        className="orbit-modal-panel orbit-modal-panel--sm orbit-modal-panel--flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="orbit-modal-panel__head">
          <div className="flex items-center justify-between gap-3">
            <h2 id="student-modal-title" className="min-w-0 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
              {isNew ? "Novo aluno" : `Gerenciar: ${student.name}`}
            </h2>
            <button type="button" className="orbit-modal-close shrink-0" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        {/* Corpo */}
        <div className="orbit-modal-panel__body">
          <div className="orbit-form-stack">
            {/* Dados pessoais */}
            <fieldset className="space-y-3">
              <legend className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]">
                Dados pessoais
              </legend>
              <div>
                <label className="orbit-form-label">Nome *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="orbit-form-label">E-mail *</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="orbit-form-label">{isNew ? "Senha *" : "Nova senha (deixe em branco para manter)"}</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={isNew ? "Mínimo 6 caracteres" : "Deixe em branco para manter"}
                />
              </div>
            </fieldset>

            {/* Plano e acesso */}
            <fieldset className="space-y-3">
              <legend className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]">
                Plano e acesso
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="orbit-form-label">Plano</label>
                  <select
                    className="input"
                    value={form.planId}
                    onChange={(e) => setForm({ ...form, planId: e.target.value })}
                  >
                    <option value="">Sem plano</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="orbit-form-label">Acesso até</label>
                  <input
                    type="date"
                    className="input"
                    value={form.accessExpiresAt}
                    onChange={(e) => setForm({ ...form, accessExpiresAt: e.target.value })}
                  />
                </div>
              </div>
            </fieldset>

            {/* Concurso e cargo */}
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]">
                  Concurso e cargo
                </legend>
                <button
                  type="button"
                  onClick={addEntry}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar
                </button>
              </div>

              {entries.length === 0 ? (
                <p className="rounded-lg border border-dashed border-black/[0.08] bg-[var(--bg-muted)] px-4 py-3 text-center text-[12px] text-[var(--text-muted)]">
                  Nenhum concurso vinculado. Clique em &quot;Adicionar&quot; para vincular.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {entries.map((entry, idx) => (
                    <div key={idx} className="rounded-lg border border-black/[0.08] bg-[var(--bg-muted)] p-3">
                      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Concurso</label>
                          <select
                            className="input text-sm"
                            value={entry.competitionId}
                            onChange={(e) => handleCompetitionChange(idx, e.target.value)}
                          >
                            <option value="">Selecione…</option>
                            {competitions.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">Cargo</label>
                          <select
                            className="input text-sm"
                            value={entry.jobRoleId}
                            onChange={(e) => handleJobRoleChange(idx, e.target.value)}
                            disabled={!entry.competitionId || entry.loadingRoles}
                          >
                            <option value="">
                              {entry.loadingRoles ? "Carregando…" : entry.jobRoles.length === 0 && entry.competitionId ? "Sem cargos" : "Selecione…"}
                            </option>
                            {entry.jobRoles.map((jr) => (
                              <option key={jr.id} value={jr.id}>{jr.name}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntry(idx)}
                          className="mb-[1px] flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>
          </div>
        </div>

        {/* Rodapé */}
        <div className="orbit-modal-panel__foot">
          <button type="button" onClick={onClose} className="btn btn-ghost rounded-xl">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary min-w-[110px] rounded-xl">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
