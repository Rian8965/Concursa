"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Search, Users, UserPlus, ShieldCheck, ShieldX, Trophy } from "lucide-react";
import { formatDate } from "@/lib/utils/date";

interface Student {
  id: string; name: string; email: string; isActive: boolean; createdAt: string;
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
    Promise.all([
      fetch("/api/admin/competitions?limit=100").then((r) => r.json()),
      fetch("/api/admin/plans").then((r) => r.json()),
    ]).then(([cd, pd]) => {
      setCompetitions(cd.competitions ?? []);
      setPlans(pd.plans ?? []);
    });
  }, [load]);

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/admin/students/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
    if (res.ok) { toast.success(isActive ? "Aluno desativado" : "Aluno ativado"); load(search); }
    else toast.error("Erro ao atualizar");
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader eyebrow="Alunos" title="Alunos" description={`${total} aluno${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}>
        <button onClick={() => setSelected({ id: "__new__", name: "", email: "", isActive: true, createdAt: "" })} className="btn btn-primary">
          <UserPlus style={{ width: 14, height: 14 }} /> Novo Aluno
        </button>
      </PageHeader>

      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9CA3AF" }} />
        <input className="input" style={{ paddingLeft: 42 }} placeholder="Buscar por nome ou e-mail..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        </div>
      ) : students.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <Users style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Aluno", "Plano", "Questões", "Cadastro", "Status", "Ações"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: i < students.length - 1 ? "1px solid #F9FAFB" : "none", transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFE")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "13px 16px" }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{s.name}</p>
                    <p style={{ fontSize: 12, color: "#9CA3AF" }}>{s.email}</p>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#374151" }}>
                    {s.studentProfile?.plan?.name ?? <span style={{ color: "#D1D5DB" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>
                    {s.studentProfile?._count?.studentAnswers ?? 0}
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "#6B7280" }}>
                    {s.createdAt ? formatDate(new Date(s.createdAt)) : "—"}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: s.isActive ? "#ECFDF5" : "#FEF2F2", color: s.isActive ? "#059669" : "#DC2626" }}>
                      {s.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setSelected(s)}
                        style={{ height: 30, padding: "0 10px", borderRadius: 8, background: "#F3F4F6", border: "1px solid #E5E7EB", fontSize: 12, cursor: "pointer", color: "#374151", fontFamily: "var(--font-sans)", fontWeight: 600 }}>
                        Gerenciar
                      </button>
                      <button onClick={() => toggleActive(s.id, s.isActive)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: s.isActive ? "#FEF2F2" : "#ECFDF5", border: `1px solid ${s.isActive ? "#FCA5A5" : "#6EE7B7"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                        {s.isActive ? <ShieldX style={{ width: 13, height: 13, color: "#DC2626" }} /> : <ShieldCheck style={{ width: 13, height: 13, color: "#059669" }} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    name: student.name, email: student.email, password: "",
    planId: (student.studentProfile as any)?.planId ?? "",
    accessExpiresAt: student.studentProfile?.accessExpiresAt ? new Date(student.studentProfile.accessExpiresAt).toISOString().slice(0, 10) : "",
    competitionIds: [] as string[],
  });
  const [fullData, setFullData] = useState<{
    studentProfile?: { planId?: string | null; studentCompetitions?: { competitionId: string }[] }
  } | null>(null);

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/admin/students/${student.id}`).then((r) => r.json()).then(({ user }) => {
        setFullData(user);
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
      if (!form.name || !form.email || !form.password) { toast.error("Preencha nome, email e senha"); setSaving(false); return; }
      const res = await fetch("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { toast.success("Aluno criado!"); onSaved(); }
      else { const d = await res.json(); toast.error(d.error ?? "Erro"); }
    } else {
      const res = await fetch(`/api/admin/students/${student.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, password: form.password || null, planId: form.planId, accessExpiresAt: form.accessExpiresAt || null, competitionIds: form.competitionIds }) });
      if (res.ok) { toast.success("Aluno atualizado!"); onSaved(); }
      else toast.error("Erro ao atualizar");
    }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{isNew ? "Novo Aluno" : `Gerenciar: ${student.name}`}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF", lineHeight: 1, fontFamily: "var(--font-sans)" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Email *</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              {isNew ? "Senha *" : "Nova senha (opcional)"}
            </label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isNew ? "Mínimo 8 caracteres" : "Deixe em branco para manter"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Plano</label>
              <select className="input" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                <option value="">Sem plano</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Acesso até</label>
              <input type="date" className="input" value={form.accessExpiresAt} onChange={(e) => setForm({ ...form, accessExpiresAt: e.target.value })} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Concursos vinculados</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {competitions.map((c) => (
                <button key={c.id} type="button"
                  onClick={() => setForm((f) => ({ ...f, competitionIds: f.competitionIds.includes(c.id) ? f.competitionIds.filter((x) => x !== c.id) : [...f.competitionIds, c.id] }))}
                  style={{
                    padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-sans)",
                    border: form.competitionIds.includes(c.id) ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: form.competitionIds.includes(c.id) ? "#EDE9FE" : "#F9FAFB",
                    color: form.competitionIds.includes(c.id) ? "#7C3AED" : "#374151",
                  }}
                >{c.name}</button>
              ))}
              {competitions.length === 0 && <p style={{ fontSize: 12, color: "#9CA3AF" }}>Nenhum concurso disponível</p>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
          <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn btn-primary" style={{ minWidth: 110 }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
