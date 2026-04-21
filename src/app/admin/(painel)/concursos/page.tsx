"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Search, Edit2, Trash2, Trophy, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Competition {
  id: string; name: string; status: string;
  city: { name: string; state: string };
  examBoard?: { acronym: string } | null;
  examDate?: string | null;
  _count: { questions: number; students: number };
}

const STATUS_MAP: Record<string, { label: string; variant: "active" | "upcoming" | "past" | "cancelled" }> = {
  ACTIVE: { label: "Ativo", variant: "active" },
  UPCOMING: { label: "Em breve", variant: "upcoming" },
  PAST: { label: "Encerrado", variant: "past" },
  CANCELLED: { label: "Cancelado", variant: "cancelled" },
};

export default function AdminConcursosPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showEdital, setShowEdital] = useState(false);
  const [editalFile, setEditalFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<any | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  async function load(q = "") {
    setLoading(true);
    const res = await fetch(`/api/admin/competitions?search=${encodeURIComponent(q)}&limit=50`);
    const data = await res.json();
    setCompetitions(data.competitions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Concurso excluído"); load(search); }
    else toast.error("Erro ao excluir");
    setDeleting(null);
  }

  async function parseEdital() {
    if (!editalFile) return;
    setParsing(true);
    setDraft(null);
    try {
      const fd = new FormData();
      fd.append("file", editalFile);
      const res = await fetch("/api/admin/competitions/edital/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao analisar edital");

      const ab = await editalFile.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      setPdfBase64(b64);
      setDraft(data.draft ?? null);
      toast.success("Edital analisado. Revise e confirme.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao analisar edital";
      toast.error(msg);
    } finally {
      setParsing(false);
    }
  }

  async function confirmCreate() {
    if (!draft || !pdfBase64) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/competitions/edital/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, pdfBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Falha ao criar concurso");
      toast.success("Concurso criado a partir do edital!");
      setShowEdital(false);
      setEditalFile(null);
      setDraft(null);
      setPdfBase64(null);
      load(search);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar concurso";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader eyebrow="Estrutura" title="Concursos" description={`${total} concurso${total !== 1 ? "s" : ""} cadastrado${total !== 1 ? "s" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <motion.button whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.18 }}
            onClick={() => setShowEdital(true)} className="btn btn-ghost">
            <Upload style={{ width: 14, height: 14 }} /> Subir edital
          </motion.button>
          <Link href="/admin/concursos/novo" className="btn btn-primary">
            <Plus style={{ width: 14, height: 14 }} /> Novo Concurso
          </Link>
        </div>
      </PageHeader>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#9CA3AF" }} />
        <input
          className="input"
          style={{ paddingLeft: 42 }}
          placeholder="Buscar concursos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        </div>
      ) : competitions.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <Trophy style={{ width: 32, height: 32, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Nenhum concurso encontrado</p>
          <Link href="/admin/concursos/novo" className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
            <Plus style={{ width: 13, height: 13 }} /> Criar primeiro concurso
          </Link>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Concurso", "Localidade / Banca", "Status", "Questões", "Alunos", "Ações"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitions.map((c, i) => {
                const s = STATUS_MAP[c.status] ?? { label: c.status, variant: "secondary" as const };
                return (
                  <tr key={c.id} style={{ borderBottom: i < competitions.length - 1 ? "1px solid #F9FAFB" : "none", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFE")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111827" }}>{c.name}</p>
                      {c.examDate && <p style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 1 }}>{new Date(c.examDate).toLocaleDateString("pt-BR")}</p>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <p style={{ fontSize: 13, color: "#374151" }}>{c.city.name} — {c.city.state}</p>
                      {c.examBoard && <p style={{ fontSize: 11.5, color: "#7C3AED", fontWeight: 600 }}>{c.examBoard.acronym}</p>}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>{c._count.questions}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 700, color: "#374151" }}>{c._count.students}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link href={`/admin/concursos/${c.id}`}
                          style={{ width: 30, height: 30, borderRadius: 8, background: "#F3F4F6", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", textDecoration: "none" }}>
                          <Edit2 style={{ width: 12, height: 12 }} />
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deleting === c.id}
                          style={{ width: 30, height: 30, borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <AnimatePresence>
        {showEdital && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-5"
            onMouseDown={(e) => e.target === e.currentTarget && setShowEdital(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[880px] rounded-[20px] border border-black/[0.08] bg-white p-6 shadow-[0_18px_70px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#9CA3AF]">
                    IA • Cadastro por edital
                  </p>
                  <h2 className="mt-1 text-[18px] font-extrabold tracking-tight text-[#111827]">
                    Subir edital (PDF)
                  </h2>
                  <p className="mt-1 text-[13px] text-[#6B7280]">
                    Envie o edital, revise os dados extraídos e confirme para criar o concurso automaticamente.
                  </p>
                </div>
                <button className="btn btn-ghost" onClick={() => setShowEdital(false)}>Fechar</button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-[16px] border border-black/[0.08] bg-[#FBFAFF] p-4">
                  <p className="text-[12px] font-semibold text-[#111827]">1) Enviar PDF</p>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="mt-2 block w-full text-[13px]"
                    onChange={(e) => setEditalFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary" disabled={!editalFile || parsing} onClick={parseEdital}>
                      {parsing ? "Analisando..." : "Analisar edital"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setEditalFile(null); setDraft(null); setPdfBase64(null); }}>
                      Limpar
                    </button>
                  </div>
                  <p className="mt-3 text-[12px] text-[#9CA3AF]">
                    Dica: PDFs escaneados podem levar mais tempo.
                  </p>
                </div>

                <div className="rounded-[16px] border border-black/[0.08] bg-white p-4">
                  <p className="text-[12px] font-semibold text-[#111827]">2) Revisar dados</p>
                  {!draft ? (
                    <p className="mt-2 text-[13px] text-[#9CA3AF]">Depois de analisar, o rascunho aparecerá aqui.</p>
                  ) : (
                    <div className="mt-3 grid gap-3">
                      <div>
                        <label className="text-[12px] font-semibold text-[#374151]">Nome *</label>
                        <input className="input mt-1" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[12px] font-semibold text-[#374151]">Banca (sigla)</label>
                          <input className="input mt-1" value={draft.examBoard?.acronym ?? ""} onChange={(e) => setDraft({ ...draft, examBoard: { ...(draft.examBoard ?? {}), acronym: e.target.value } })} />
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold text-[#374151]">Organização</label>
                          <input className="input mt-1" value={draft.organization ?? ""} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[12px] font-semibold text-[#374151]">Cidade (principal) *</label>
                          <input className="input mt-1" value={draft.cities?.[0]?.name ?? ""} onChange={(e) => {
                            const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
                            cities[0] = { ...(cities[0] ?? { name: "", state: "" }), name: e.target.value };
                            setDraft({ ...draft, cities });
                          }} />
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold text-[#374151]">UF *</label>
                          <input className="input mt-1" value={draft.cities?.[0]?.state ?? ""} onChange={(e) => {
                            const cities = Array.isArray(draft.cities) ? [...draft.cities] : [{ name: "", state: "" }];
                            cities[0] = { ...(cities[0] ?? { name: "", state: "" }), state: e.target.value };
                            setDraft({ ...draft, cities });
                          }} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-[#374151]">Data da prova (YYYY-MM-DD)</label>
                        <input className="input mt-1" value={draft.examDate ?? ""} onChange={(e) => setDraft({ ...draft, examDate: e.target.value || null })} placeholder="2026-08-10" />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-[#374151]">Descrição / notas</label>
                        <textarea className="input mt-1" rows={3} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button className="btn btn-primary" disabled={confirming} onClick={confirmCreate}>
                          {confirming ? "Criando..." : "Confirmar e criar concurso"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
