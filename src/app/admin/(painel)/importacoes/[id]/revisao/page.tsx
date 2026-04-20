"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Save, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";

const ImportPdfMarkupPanel = dynamic(
  () => import("@/components/admin/ImportPdfMarkupPanel").then((m) => m.ImportPdfMarkupPanel),
  { ssr: false, loading: () => <p className="text-[13px] text-[#6B7280]">Carregando visualizador de PDF…</p> },
);

interface ImportedQ {
  id: string; content: string; alternatives: { letter: string; content: string }[];
  correctAnswer?: string | null; suggestedSubjectId?: string | null;
  sourcePage?: number | null; confidence?: number | null;
  status: string; rawText?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
}

function parseSuggestedSubject(rawText?: string | null): { subject: string; confidence: string; alternatives: string[] } | null {
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText);
    if (parsed.suggestedSubject) return {
      subject: parsed.suggestedSubject,
      confidence: parsed.suggestedSubjectConfidence ?? "low",
      alternatives: parsed.suggestedSubjectAlternatives ?? [],
    };
  } catch { /* não é JSON */ }
  return null;
}
interface ImportData {
  id: string;
  originalFilename: string;
  status: string;
  totalExtracted: number;
  storedPdfPath?: string | null;
  competition?: { name: string } | null;
  importedQuestions: ImportedQ[];
  importAssets?: ImportAssetDTO[];
}

type Decision = "approve" | "reject" | "pending";

export default function RevisaoImportacaoPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [imp, setImp] = useState<ImportData | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshImport = useCallback(async () => {
    const impData = await fetch(`/api/admin/imports/${id}`).then((r) => r.json());
    setImp(impData.import);
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/imports/${id}`).then((r) => r.json()),
      fetch("/api/admin/subjects").then((r) => r.json()),
    ]).then(([impData, subData]) => {
      setImp(impData.import);
      setSubjects(subData.subjects ?? []);
      const initial: Record<string, Decision> = {};
      const sm: Record<string, string> = {};
      impData.import.importedQuestions.forEach((q: ImportedQ) => {
        initial[q.id] = q.status === "PUBLISHED" ? "approve" : q.status === "REJECTED" ? "reject" : "pending";
        sm[q.id] = q.suggestedSubjectId ?? "";
      });
      setDecisions(initial);
      setSubjectMap(sm);
      setLoading(false);
    });
  }, [id]);

  function selectAll(action: "approve" | "reject") {
    const d: Record<string, Decision> = {};
    imp?.importedQuestions.forEach((q) => { d[q.id] = action; });
    setDecisions(d);
  }

  async function saveReview() {
    setSaving(true);
    const decided = Object.entries(decisions).filter(([, d]) => d !== "pending").map(([qId, action]) => ({ questionId: qId, action, subjectId: subjectMap[qId] || undefined }));
    const res = await fetch(`/api/admin/imports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions: decided }),
    });
    if (res.ok) { toast.success("Revisão salva!"); router.push("/admin/importacoes"); }
    else toast.error("Erro ao salvar revisão");
    setSaving(false);
  }

  if (loading || !imp) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const approved = Object.values(decisions).filter((d) => d === "approve").length;
  const rejected = Object.values(decisions).filter((d) => d === "reject").length;
  const pending = Object.values(decisions).filter((d) => d === "pending").length;

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/importacoes" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
          Revisão: {imp.originalFilename}
        </h1>
        {imp.competition && <p style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, marginTop: 2 }}>{imp.competition.name}</p>}
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-[14px] font-bold tracking-tight text-[#111827]">PDF e regiões (texto-base / figura)</h2>
        <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-[#6B7280]">
          Desenhe retângulos sobre o PDF para marcar <strong>texto-base</strong> ou <strong>figuras</strong> vinculadas à
          questão selecionada. Use &quot;Vincular a outra questão&quot; para reutilizar o mesmo bloco em várias questões
          (compartilhado). Na publicação, os textos marcados viram <strong>texto de apoio</strong> e as figuras
          complementam a imagem da questão.
        </p>
        <ImportPdfMarkupPanel
          importId={id}
          pdfAvailable={Boolean(imp.storedPdfPath)}
          questions={imp.importedQuestions.map((q, i) => ({ id: q.id, label: `Questão ${i + 1}` }))}
          assets={imp.importAssets ?? []}
          onChanged={refreshImport}
        />
      </section>

      {/* Stats + Actions */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{imp.importedQuestions.length}</p>
              <p style={{ fontSize: 11, color: "#9CA3AF" }}>Total</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>{approved}</p>
              <p style={{ fontSize: 11, color: "#9CA3AF" }}>Aprovadas</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#DC2626" }}>{rejected}</p>
              <p style={{ fontSize: 11, color: "#9CA3AF" }}>Rejeitadas</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#D97706" }}>{pending}</p>
              <p style={{ fontSize: 11, color: "#9CA3AF" }}>Pendentes</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => selectAll("approve")} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#ECFDF5", border: "1px solid #6EE7B7", color: "#059669", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle2 style={{ width: 13, height: 13 }} /> Aprovar todas
            </button>
            <button onClick={() => selectAll("reject")} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 5 }}>
              <XCircle style={{ width: 13, height: 13 }} /> Rejeitar todas
            </button>
            <button onClick={saveReview} disabled={saving} className="btn btn-primary" style={{ fontSize: 12, height: 34 }}>
              {saving ? "Salvando..." : <><Save style={{ width: 13, height: 13 }} /> Salvar revisão</>}
            </button>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {imp.importedQuestions.map((q, idx) => {
          const d = decisions[q.id] ?? "pending";
          const isExpanded = expanded[q.id] ?? false;
          const borderColor = d === "approve" ? "#6EE7B7" : d === "reject" ? "#FCA5A5" : "#E5E7EB";
          const bgColor = d === "approve" ? "#ECFDF5" : d === "reject" ? "#FEF2F2" : "#FFFFFF";

          return (
            <div key={q.id} style={{ border: `1.5px solid ${borderColor}`, borderRadius: 12, background: bgColor, overflow: "hidden", transition: "all 0.15s" }}>
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", flexShrink: 0, paddingTop: 2, width: 22 }}>
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>
                    {isExpanded ? q.content : (q.content.length > 150 ? q.content.slice(0, 150) + "…" : q.content)}
                  </p>
                  {q.hasImage && q.imageUrl && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#7C3AED", marginBottom: 6 }}>Figura / recorte da prova</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.imageUrl}
                        alt=""
                        style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #E5E7EB" }}
                      />
                    </div>
                  )}
                  {q.sourcePage && <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Página {q.sourcePage}</p>}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setDecisions((prev) => ({ ...prev, [q.id]: d === "approve" ? "pending" : "approve" }))}
                    style={{ height: 30, padding: "0 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.1s", fontFamily: "var(--font-sans)", background: d === "approve" ? "#059669" : "#F3F4F6", border: d === "approve" ? "1px solid #059669" : "1px solid #E5E7EB", color: d === "approve" ? "#fff" : "#374151" }}>
                    ✓
                  </button>
                  <button onClick={() => setDecisions((prev) => ({ ...prev, [q.id]: d === "reject" ? "pending" : "reject" }))}
                    style={{ height: 30, padding: "0 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.1s", fontFamily: "var(--font-sans)", background: d === "reject" ? "#DC2626" : "#F3F4F6", border: d === "reject" ? "1px solid #DC2626" : "1px solid #E5E7EB", color: d === "reject" ? "#fff" : "#374151" }}>
                    ✗
                  </button>
                  <button onClick={() => setExpanded((prev) => ({ ...prev, [q.id]: !isExpanded }))}
                    style={{ height: 30, width: 30, borderRadius: 8, cursor: "pointer", background: "#F3F4F6", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontFamily: "var(--font-sans)" }}>
                    {isExpanded ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 16px 16px 50px" }}>
                  {/* Alternatives */}
                  {q.alternatives.map((alt, altIdx) => (
                    <div key={`${q.id}:${alt.letter}:${altIdx}`} style={{
                      display: "flex", gap: 8, padding: "6px 10px", borderRadius: 8, marginBottom: 4,
                      background: alt.letter === q.correctAnswer ? "#ECFDF5" : "#F9FAFB",
                      border: `1px solid ${alt.letter === q.correctAnswer ? "#6EE7B7" : "#E5E7EB"}`,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: alt.letter === q.correctAnswer ? "#059669" : "#6B7280", flexShrink: 0 }}>{alt.letter}</span>
                      <span style={{ fontSize: 12.5, color: "#374151" }}>{alt.content}</span>
                    </div>
                  ))}

                  {/* Subject override */}
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                      Matéria
                      {(() => {
                        const suggested = parseSuggestedSubject(q.rawText);
                        if (!suggested) return null;
                        const confColor = suggested.confidence === "high" ? "#059669" : suggested.confidence === "medium" ? "#D97706" : "#9CA3AF";
                        return (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: confColor, background: confColor + "18", padding: "2px 8px", borderRadius: 20 }}>
                            IA: {suggested.subject}
                            {suggested.confidence === "high" ? " ✓" : ""}
                          </span>
                        );
                      })()}
                    </label>
                    <select className="input" style={{ fontSize: 12, height: 34 }} value={subjectMap[q.id] ?? ""} onChange={(e) => setSubjectMap((prev) => ({ ...prev, [q.id]: e.target.value }))}>
                      <option value="">Automático (sugestão da IA)</option>
                      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {imp.importedQuestions.length === 0 && (
        <div style={{ background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
          <AlertCircle style={{ width: 28, height: 28, color: "#D1D5DB", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, color: "#6B7280" }}>Nenhuma questão extraída nesta importação</p>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
