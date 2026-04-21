"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Search, Edit2, Trash2, BookOpen, Filter } from "lucide-react";

interface Question {
  id: string; content: string; difficulty: string; status: string; year?: number | null;
  subject?: { name: string } | null;
  competition?: { name: string } | null;
  examBoard?: { acronym: string } | null;
  city?: { name: string; state: string } | null;
  jobRole?: { name: string } | null;
  aiMeta?: {
    confidence?: number | null;
    suggestedYear?: number | null;
    subject?: { name: string } | null;
    topic?: { name: string } | null;
    examBoard?: { acronym: string } | null;
    city?: { name: string; state: string } | null;
    jobRole?: { name: string } | null;
  } | null;
}

const DIFF_LABELS: Record<string, string> = { EASY: "Fácil", MEDIUM: "Médio", HARD: "Difícil" };
const DIFF_COLORS: Record<string, string> = { EASY: "#059669", MEDIUM: "#D97706", HARD: "#DC2626" };

export default function AdminQuestoesPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    examBoardId: "",
    year: "",
    cityId: "",
    jobRoleId: "",
    subjectId: "",
  });
  const [filterData, setFilterData] = useState({
    examBoards: [] as { id: string; acronym: string; name: string }[],
    cities: [] as { id: string; name: string; state: string }[],
    jobRoles: [] as { id: string; name: string }[],
    subjects: [] as { id: string; name: string }[],
  });

  const load = useCallback(async (q = "", f = filters) => {
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("search", q);
    sp.set("limit", "50");
    if (f.examBoardId) sp.set("examBoardId", f.examBoardId);
    if (f.year) sp.set("year", f.year);
    if (f.cityId) sp.set("cityId", f.cityId);
    if (f.jobRoleId) sp.set("jobRoleId", f.jobRoleId);
    if (f.subjectId) sp.set("subjectId", f.subjectId);
    const res = await fetch(`/api/admin/questions?${sp.toString()}`);
    const data = await res.json();
    setQuestions(data.questions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    Promise.all([
      fetch("/api/admin/exam-boards").then((r) => r.json()),
      fetch("/api/admin/cities").then((r) => r.json()),
      fetch("/api/admin/job-roles").then((r) => r.json()),
      fetch("/api/admin/subjects").then((r) => r.json()),
    ]).then(([bd, cd, jd, sd]) => {
      setFilterData({
        examBoards: bd.examBoards ?? [],
        cities: cd.cities ?? [],
        jobRoles: jd.jobRoles ?? [],
        subjects: sd.subjects ?? [],
      });
    });
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta questão?")) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Questão excluída"); load(search); }
    else toast.error("Erro ao excluir");
    setDeleting(null);
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader eyebrow="Conteúdo" title="Questões" description={`${total} questão${total !== 1 ? "ões" : ""} cadastrada${total !== 1 ? "s" : ""}`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setFilterOpen((v) => !v)} className="btn btn-ghost">
            <Filter style={{ width: 14, height: 14 }} /> Filtros
          </button>
          <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn btn-primary">
            <Plus style={{ width: 14, height: 14 }} /> Nova Questão
          </button>
        </div>
      </PageHeader>

      {filterOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Banca</label>
              <select className="input" value={filters.examBoardId} onChange={(e) => setFilters((p) => ({ ...p, examBoardId: e.target.value }))}>
                <option value="">Todas</option>
                {filterData.examBoards.map((b) => <option key={b.id} value={b.id}>{b.acronym}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Ano</label>
              <input className="input" value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))} placeholder="Ex: 2024" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Cidade</label>
              <select className="input" value={filters.cityId} onChange={(e) => setFilters((p) => ({ ...p, cityId: e.target.value }))}>
                <option value="">Todas</option>
                {filterData.cities.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.state}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Cargo</label>
              <select className="input" value={filters.jobRoleId} onChange={(e) => setFilters((p) => ({ ...p, jobRoleId: e.target.value }))}>
                <option value="">Todos</option>
                {filterData.jobRoles.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6B7280" }}>Matéria</label>
              <select className="input" value={filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}>
                <option value="">Todas</option>
                {filterData.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => { setFilters({ examBoardId: "", year: "", cityId: "", jobRoleId: "", subjectId: "" }); load(search, { examBoardId: "", year: "", cityId: "", jobRoleId: "", subjectId: "" }); }}>
              Limpar
            </button>
            <button className="btn btn-primary" onClick={() => load(search, filters)}>Aplicar</button>
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9CA3AF" }} />
        <input className="input" style={{ paddingLeft: 42 }} placeholder="Buscar questões..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search, filters)} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        </div>
      ) : questions.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <BookOpen style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Nenhuma questão encontrada</p>
          <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
            <Plus style={{ width: 13, height: 13 }} /> Cadastrar questão
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {questions.map((q) => (
            <div key={q.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    {q.subject && <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 12 }}>{q.subject.name}</span>}
                    <span style={{ fontSize: 11, fontWeight: 600, color: DIFF_COLORS[q.difficulty] ?? "#374151", background: "#F3F4F6", padding: "2px 8px", borderRadius: 12 }}>
                      {DIFF_LABELS[q.difficulty] ?? q.difficulty}
                    </span>
                    {q.year && <span style={{ fontSize: 11, color: "#9CA3AF", background: "#F3F4F6", padding: "2px 8px", borderRadius: 12 }}>{q.year}</span>}
                      {!q.year && q.aiMeta?.suggestedYear && (
                        <span style={{ fontSize: 11, color: "#92400E", background: "rgba(217,119,6,0.12)", padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
                          Sugere {q.aiMeta.suggestedYear}
                        </span>
                      )}
                      {q.aiMeta?.confidence != null && (
                        <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                          IA {Math.round(q.aiMeta.confidence * 100)}%
                        </span>
                      )}
                    {q.status === "ACTIVE"
                      ? <span style={{ fontSize: 11, color: "#059669", background: "#ECFDF5", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>Ativa</span>
                      : <span style={{ fontSize: 11, color: "#9CA3AF", background: "#F3F4F6", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>{q.status}</span>}
                  </div>
                  <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>
                    {q.content.length > 200 ? q.content.slice(0, 200) + "…" : q.content}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4, fontSize: 11.5, color: "#9CA3AF" }}>
                    {q.competition && <span>{q.competition.name}</span>}
                    {q.examBoard?.acronym && <span>· {q.examBoard.acronym}</span>}
                    {q.city && <span>· {q.city.name}/{q.city.state}</span>}
                    {q.jobRole?.name && <span>· {q.jobRole.name}</span>}
                      {!q.examBoard?.acronym && q.aiMeta?.examBoard?.acronym && <span>· Sugere {q.aiMeta.examBoard.acronym}</span>}
                      {!q.city && q.aiMeta?.city && <span>· Sugere {q.aiMeta.city.name}/{q.aiMeta.city.state}</span>}
                      {!q.jobRole?.name && q.aiMeta?.jobRole?.name && <span>· Sugere {q.aiMeta.jobRole.name}</span>}
                      {!q.subject && q.aiMeta?.subject?.name && <span>· Sugere {q.aiMeta.subject.name}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setEditingId(q.id); setShowForm(true); }}
                    style={{ width: 30, height: 30, borderRadius: 8, background: "#F3F4F6", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    <Edit2 style={{ width: 12, height: 12 }} />
                  </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/admin/questions/${q.id}/classify`, { method: "POST" });
                          const d = await res.json();
                          if (!res.ok) throw new Error(d?.error ?? "Erro ao classificar");
                          toast.success("IA sugeriu metadados");
                          load(search, filters);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro ao classificar");
                        }
                      }}
                      title="IA: sugerir metadados"
                      style={{ width: 30, height: 30, borderRadius: 8, background: "#FFFBEB", border: "1px solid rgba(217,119,6,0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#92400E", cursor: "pointer", fontFamily: "var(--font-sans)" }}
                    >
                      IA
                    </button>
                    {q.aiMeta && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/admin/questions/${q.id}/apply-ai`, { method: "POST" });
                            const d = await res.json();
                            if (!res.ok) throw new Error(d?.error ?? "Erro ao aplicar sugestões");
                            toast.success("Sugestões aplicadas");
                            load(search, filters);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro ao aplicar sugestões");
                          }
                        }}
                        title="Aplicar sugestões da IA (preenche campos vazios)"
                        style={{ height: 30, padding: "0 10px", borderRadius: 8, background: "#EDE9FE", border: "1px solid rgba(124,58,237,0.30)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6D28D9", cursor: "pointer", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 12 }}
                      >
                        Aplicar
                      </button>
                    )}
                  <button onClick={() => handleDelete(q.id)} disabled={deleting === q.id}
                    style={{ width: 30, height: 30, borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <QuestionModal
          id={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSaved={() => { setShowForm(false); setEditingId(null); load(search); }}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface ModalProps { id: string | null; onClose: () => void; onSaved: () => void }

const emptyAlternatives = () => [
  { letter: "A", content: "" }, { letter: "B", content: "" },
  { letter: "C", content: "" }, { letter: "D", content: "" },
  { letter: "E", content: "" },
];

function QuestionModal({ id, onClose, onSaved }: ModalProps) {
  const [competitions, setCompetitions] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [related, setRelated] = useState<{ id: string; content: string; competition: { name: string } | null }[]>([]);
  const [checkingRelated, setCheckingRelated] = useState(false);
  const [form, setForm] = useState({
    content: "", supportText: "", competitionId: "", subjectId: "", difficulty: "MEDIUM",
    year: "", correctAnswer: "A",
    imageUrl: "",
    hasImage: false,
    alternatives: emptyAlternatives(),
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/competitions?limit=100").then((r) => r.json()),
      fetch("/api/admin/subjects").then((r) => r.json()),
    ]).then(([cd, sd]) => {
      setCompetitions(cd.competitions ?? []);
      setSubjects(sd.subjects ?? []);
    });
  }, []);

  useEffect(() => {
    if (!id) {
      setForm({
        content: "",
        supportText: "",
        competitionId: "",
        subjectId: "",
        difficulty: "MEDIUM",
        year: "",
        correctAnswer: "A",
        imageUrl: "",
        hasImage: false,
        alternatives: emptyAlternatives(),
      });
      setRelated([]);
      return;
    }
    fetch(`/api/admin/questions/${id}`)
      .then((r) => r.json())
      .then(({ question }) => {
        if (!question) return;
        const letters = ["A", "B", "C", "D", "E"] as const;
        const rawAlts = question.alternatives ?? [];
        setForm({
          content: question.content,
          supportText: question.supportText ?? "",
          competitionId: question.competitionId ?? "",
          subjectId: question.subjectId ?? "",
          difficulty: question.difficulty,
          year: question.year?.toString() ?? "",
          correctAnswer: question.correctAnswer,
          imageUrl: question.imageUrl ?? "",
          hasImage: Boolean(question.hasImage && question.imageUrl),
          alternatives: letters.map((letter, i) => ({
            letter,
            content: rawAlts[i]?.content ?? "",
          })),
        });
      });
  }, [id]);

  async function save() {
    setSaving(true);
    const alts = form.alternatives.filter((a) => a.content.trim());
    if (!form.content.trim() || alts.length < 2) {
      toast.error("Preencha o enunciado e ao menos 2 alternativas");
      setSaving(false);
      return;
    }
    let correctAnswer = form.correctAnswer;
    if (!alts.some((a) => a.letter === correctAnswer)) {
      correctAnswer = alts[0].letter;
    }
    const url = id ? `/api/admin/questions/${id}` : "/api/admin/questions";
    const method = id ? "PUT" : "POST";
    const payload = {
      ...form,
      correctAnswer,
      alternatives: alts,
      status: "ACTIVE" as const,
      supportText: form.supportText.trim() || null,
      hasImage: Boolean(form.imageUrl),
      imageUrl: form.imageUrl || null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      toast.success(id ? "Questão atualizada!" : "Questão criada!");
      onSaved();
    } else {
      let msg = "Erro ao salvar";
      try {
        const text = await res.text();
        if (text.trim()) {
          const d = JSON.parse(text) as { error?: string };
          if (d.error) msg = d.error;
        } else if (res.status === 413) {
          msg = "Payload muito grande (imagem?). Reduza o tamanho ou use imagem menor.";
        } else {
          msg = `Erro ${res.status}${res.statusText ? ` (${res.statusText})` : ""}`;
        }
      } catch {
        msg = `Erro ${res.status}`;
      }
      toast.error(msg);
    }
    setSaving(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{id ? "Editar Questão" : "Nova Questão"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF", lineHeight: 1, fontFamily: "var(--font-sans)" }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Enunciado *</label>
            <textarea className="input" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Digite o enunciado da questão..." style={{ resize: "vertical" }} />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
              Texto de apoio (opcional)
            </label>
            <textarea
              className="input"
              rows={3}
              value={form.supportText}
              onChange={(e) => setForm({ ...form, supportText: e.target.value })}
              onBlur={async (e) => {
                const st = e.target.value.trim();
                if (st.length < 10) {
                  setRelated([]);
                  return;
                }
                setCheckingRelated(true);
                try {
                  const params = new URLSearchParams({ supportText: st });
                  if (form.competitionId) params.set("competitionId", form.competitionId);
                  if (id) params.set("excludeId", id);
                  const r = await fetch(`/api/admin/questions/related?${params}`);
                  const data = await r.json();
                  setRelated(data.questions ?? []);
                } catch {
                  setRelated([]);
                } finally {
                  setCheckingRelated(false);
                }
              }}
              placeholder="Artigo, trecho ou comando comum a várias questões (mesmo texto = vínculo para busca)"
              style={{ resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
              Ao sair do campo, o sistema verifica outras questões com o mesmo texto de apoio neste concurso (se selecionado).
            </p>
            {checkingRelated && <p style={{ fontSize: 12, color: "#7C3AED" }}>Verificando questões relacionadas…</p>}
            {related.length > 0 && (
              <div style={{ marginTop: 8, padding: 12, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, fontSize: 12, color: "#92400E" }}>
                <strong>{related.length}</strong> questão(ões) já usam exatamente este texto de apoio.
                Cadastre normalmente: todas ficam com o mesmo bloco; na listagem, edite cada uma pelo lápis.
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {related.slice(0, 5).map((q) => (
                    <li key={q.id} style={{ marginBottom: 4 }}>
                      <span style={{ color: "#6B7280" }}>{q.competition?.name ?? "Geral"}</span> — {q.content.slice(0, 80)}
                      {q.content.length > 80 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Imagem da questão (opcional)</label>
            <input
              type="file"
              accept="image/*"
              className="input"
              style={{ padding: 8 }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setForm((prev) => ({
                    ...prev,
                    imageUrl: reader.result as string,
                    hasImage: true,
                  }));
                };
                reader.readAsDataURL(f);
              }}
            />
            {form.imageUrl ? (
              <div style={{ marginTop: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 10, border: "1px solid #E5E7EB" }} />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 8, fontSize: 12 }}
                  onClick={() => setForm((prev) => ({ ...prev, imageUrl: "", hasImage: false }))}
                >
                  Remover imagem
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Concurso</label>
              <select className="input" value={form.competitionId} onChange={(e) => setForm({ ...form, competitionId: e.target.value })}>
                <option value="">Geral</option>
                {competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Matéria</label>
              <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Nenhuma</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Dificuldade</label>
              <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="EASY">Fácil</option>
                <option value="MEDIUM">Médio</option>
                <option value="HARD">Difícil</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Alternativas *</label>
            {form.alternatives.map((alt, i) => (
              <div key={alt.letter} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="radio" name="correct" value={alt.letter} checked={form.correctAnswer === alt.letter}
                    onChange={() => setForm({ ...form, correctAnswer: alt.letter })}
                    style={{ accentColor: "#7C3AED" }} />
                  <span style={{ width: 28, height: 28, borderRadius: 7, background: form.correctAnswer === alt.letter ? "#7C3AED" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: form.correctAnswer === alt.letter ? "#fff" : "#6B7280", flexShrink: 0 }}>
                    {alt.letter}
                  </span>
                </div>
                <input className="input" value={alt.content}
                  onChange={(e) => {
                    const alts = [...form.alternatives];
                    alts[i] = { ...alts[i], content: e.target.value };
                    setForm({ ...form, alternatives: alts });
                  }}
                  placeholder={`Alternativa ${alt.letter}`}
                  style={{ flex: 1 }} />
              </div>
            ))}
            <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Selecione o botão da alternativa correta</p>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Ano</label>
            <input className="input" type="number" placeholder="Ex: 2023" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} style={{ width: 140 }} />
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
