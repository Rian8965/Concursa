"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Search, Users, UserPlus, ShieldCheck, ShieldX } from "lucide-react";
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

export default function AdminAlunosPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [competitions, setCompetitions] = useState<{ id: string; name: string }[]>([]);
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
    Promise.all([fetch("/api/admin/competitions?limit=100").then((r) => r.json()), fetch("/api/admin/plans").then((r) => r.json())]).then(
      ([cd, pd]) => {
        setCompetitions(cd.competitions ?? []);
        setPlans(pd.plans ?? []);
      },
    );
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
      <PageHeader eyebrow="Alunos" title="Alunos" description={`${total} aluno${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}>
        <button
          type="button"
          onClick={() => setSelected({ id: "__new__", name: "", email: "", isActive: true, createdAt: "" })}
          className="btn btn-primary inline-flex items-center gap-2 rounded-2xl"
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
        <div className="py-14 text-center">
          <div className="orbit-spinner" />
        </div>
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
                <col className="min-w-[200px] w-[28%]" />
                <col className="min-w-[140px] w-[22%]" />
                <col className="min-w-[88px] w-[10%]" />
                <col className="min-w-[120px] w-[14%]" />
                <col className="min-w-[100px] w-[12%]" />
                <col className="min-w-[140px] w-[14%]" />
              </colgroup>
              <thead>
                <tr>
                  {["Aluno", "Plano", "Questões", "Cadastro", "Status", "Ações"].map((h) => (
                    <th
                      key={h}
                      className={
                        h === "Questões" || h === "Cadastro" || h === "Ações"
                          ? "text-right"
                          : "text-left"
                      }
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
                      <span
                        className={
                          s.isActive ? "orbit-status-badge orbit-status-badge--success" : "orbit-status-badge orbit-status-badge--danger"
                        }
                      >
                        {s.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelected(s)}
                          className="btn btn-ghost inline-flex min-h-[40px] min-w-[6.5rem] items-center justify-center rounded-xl px-4 text-xs font-semibold"
                        >
                          Gerenciar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(s.id, s.isActive)}
                          className={cn(
                            "orbit-icon-btn",
                            s.isActive ? "orbit-icon-btn--danger" : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
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
          onSaved={() => {
            setSelected(null);
            load(search);
          }}
        />
      )}
    </div>
  );
}

interface ModalProps {
  student: Student;
  competitions: { id: string; name: string }[];
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
    competitionIds: [] as string[],
  });
  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/students/${student.id}`)
        .then((r) => r.json())
        .then(({ user }) => {
          setForm((f) => ({
            ...f,
            planId: user.studentProfile?.planId ?? "",
            competitionIds: user.studentProfile?.studentCompetitions?.map((sc: { competitionId: string }) => sc.competitionId) ?? [],
          }));
        });
    }
  }, [student.id, isNew]);

  async function save() {
    setSaving(true);
    if (isNew) {
      if (!form.name || !form.email || !form.password) {
        toast.error("Preencha nome, email e senha");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Aluno criado!");
        onSaved();
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Erro");
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
          competitionIds: form.competitionIds,
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
    <div className="orbit-modal-backdrop z-[100]" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
        className="orbit-modal-panel orbit-modal-panel--sm orbit-modal-panel--flex"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="orbit-modal-panel__body">
          <div className="orbit-form-stack">
          <div>
            <label className="orbit-form-label">Nome *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <label className="orbit-form-label">Email *</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="orbit-form-label">{isNew ? "Senha *" : "Nova senha (opcional)"}</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isNew ? "Mínimo 8 caracteres" : "Deixe em branco para manter"}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="orbit-form-label">Plano</label>
              <select className="input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                <option value="">Sem plano</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="orbit-form-label">Acesso até</label>
              <input type="date" className="input" value={form.accessExpiresAt} onChange={(e) => setForm({ ...form, accessExpiresAt: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="orbit-form-label">Concursos vinculados</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {competitions.map((c) => {
                const on = form.competitionIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        competitionIds: f.competitionIds.includes(c.id) ? f.competitionIds.filter((x) => x !== c.id) : [...f.competitionIds, c.id],
                      }))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition-colors",
                      on
                        ? "border-violet-500 bg-violet-50 text-violet-800 ring-2 ring-violet-200"
                        : "border-black/[0.08] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:border-violet-300",
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
              {competitions.length === 0 && <p className="text-xs text-[var(--text-muted)]">Nenhum concurso disponível</p>}
            </div>
          </div>
          </div>
        </div>

        <div className="orbit-modal-panel__foot">
          <button type="button" onClick={onClose} className="btn btn-ghost rounded-2xl">
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary min-w-[110px] rounded-2xl">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
