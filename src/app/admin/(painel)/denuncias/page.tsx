"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, XCircle, Eye, Bot, ShieldAlert } from "lucide-react";

type ReportStatus = "PENDING" | "AI_REVIEWED" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
type ReportCategory =
  | "INCOMPLETE_STATEMENT" | "MISSING_TEXT" | "MISSING_IMAGE" | "MISSING_ALTERNATIVE"
  | "FORMAT_ERROR" | "WRONG_ANSWER" | "AMBIGUOUS_ANSWER" | "INCONSISTENT_CONTENT" | "OTHER";

interface AiReview {
  verdict: string;
  analysis: string;
  confidence: number;
}

interface Report {
  id: string;
  category: ReportCategory;
  description: string | null;
  phase: string;
  status: ReportStatus;
  adminNote: string | null;
  createdAt: string;
  question: {
    id: string;
    content: string;
    correctAnswer: string;
    isMarkedSuspect: boolean;
    subject: { name: string } | null;
  };
  studentProfile: {
    user: { name: string; email: string };
  };
  aiReview: AiReview | null;
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  INCOMPLETE_STATEMENT: "Enunciado incompleto",
  MISSING_TEXT: "Texto faltando",
  MISSING_IMAGE: "Imagem faltando",
  MISSING_ALTERNATIVE: "Alternativa faltando",
  FORMAT_ERROR: "Erro de formatação",
  WRONG_ANSWER: "Resposta possivelmente errada",
  AMBIGUOUS_ANSWER: "Resposta ambígua",
  INCONSISTENT_CONTENT: "Conteúdo inconsistente",
  OTHER: "Outro problema",
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pendente", color: "#D97706", bg: "#FFFBEB", icon: <Clock style={{ width: 12, height: 12 }} /> },
  AI_REVIEWED: { label: "Revisado por IA", color: "#7C3AED", bg: "#EDE9FE", icon: <Bot style={{ width: 12, height: 12 }} /> },
  UNDER_REVIEW: { label: "Em revisão", color: "#2563EB", bg: "#EFF6FF", icon: <Eye style={{ width: 12, height: 12 }} /> },
  RESOLVED: { label: "Resolvido", color: "#059669", bg: "#ECFDF5", icon: <CheckCircle2 style={{ width: 12, height: 12 }} /> },
  DISMISSED: { label: "Descartado", color: "#6B7280", bg: "#F9FAFB", icon: <XCircle style={{ width: 12, height: 12 }} /> },
};

const VERDICT_CONFIG: Record<string, { label: string; color: string }> = {
  ANSWER_IS_CORRECT: { label: "Gabarito correto", color: "#059669" },
  ANSWER_MAY_BE_WRONG: { label: "Pode estar errado", color: "#D97706" },
  ANSWER_IS_WRONG: { label: "Gabarito errado", color: "#DC2626" },
  AMBIGUOUS: { label: "Ambíguo", color: "#7C3AED" },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendentes" },
  { value: "AI_REVIEWED", label: "Revisados por IA" },
  { value: "UNDER_REVIEW", label: "Em revisão" },
  { value: "RESOLVED", label: "Resolvidos" },
  { value: "DISMISSED", label: "Descartados" },
];

export default function DenunciasAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/question-reports?${params}`);
      const data = await res.json() as { reports: Report[]; total: number };
      setReports(data.reports ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Erro ao carregar denúncias");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  async function updateReport(id: string, payload: { status?: string; adminNote?: string; markQuestionSuspect?: boolean }) {
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/admin/question-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro");
      toast.success("Denúncia atualizada");
      await fetchReports();
    } catch {
      toast.error("Erro ao atualizar denúncia");
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  }

  const pendingCount = reports.filter((r) => r.status === "PENDING" || r.status === "AI_REVIEWED").length;

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <AlertTriangle style={{ width: 22, height: 22, color: "#D97706" }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Denúncias de Questões
          </h1>
          {pendingCount > 0 && (
            <span style={{
              background: "#DC2626", color: "#fff", fontSize: 11, fontWeight: 700,
              padding: "2px 8px", borderRadius: 20,
            }}>
              {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: "#6B7280" }}>
          {total} denúncia{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filtros de status */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: statusFilter === f.value ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
              background: statusFilter === f.value ? "#EDE9FE" : "#F9FAFB",
              color: statusFilter === f.value ? "#7C3AED" : "#374151",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>Carregando...</div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <CheckCircle2 style={{ width: 36, height: 36, color: "#D1D5DB", margin: "0 auto 12px" }} />
          <p style={{ color: "#9CA3AF", fontSize: 14 }}>Nenhuma denúncia encontrada</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reports.map((report) => {
            const statusCfg = STATUS_CONFIG[report.status];
            const isExpanded = expandedId === report.id;

            return (
              <div key={report.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Header */}
                <div
                  style={{
                    padding: "14px 18px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                    background: isExpanded ? "#FAFAF9" : "#fff",
                    borderBottom: isExpanded ? "1px solid #F3F4F6" : "none",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  {/* Status badge */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    color: statusCfg.color, background: statusCfg.bg, flexShrink: 0,
                  }}>
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>

                  {/* Category */}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                    {CATEGORY_LABELS[report.category]}
                  </span>

                  {/* Suspect badge */}
                  {report.question.isMarkedSuspect && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 12,
                      background: "#FEF2F2", color: "#DC2626",
                    }}>
                      <ShieldAlert style={{ width: 10, height: 10 }} />
                      Suspeita
                    </span>
                  )}

                  {/* AI verdict badge if any */}
                  {report.aiReview && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
                      color: VERDICT_CONFIG[report.aiReview.verdict]?.color ?? "#374151",
                      background: "#F3F4F6",
                    }}>
                      IA: {VERDICT_CONFIG[report.aiReview.verdict]?.label ?? report.aiReview.verdict}
                    </span>
                  )}

                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {report.studentProfile.user.name}
                    </span>
                    <span style={{ fontSize: 11, color: "#D1D5DB" }}>•</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      {new Date(report.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <span style={{ fontSize: 16, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: "18px 18px" }}>
                    {/* Question content */}
                    <div style={{ marginBottom: 14 }}>
                      {report.question.subject && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 12, marginBottom: 6, display: "inline-block" }}>
                          {report.question.subject.name}
                        </span>
                      )}
                      <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginTop: 6 }}>
                        {report.question.content.length > 300
                          ? report.question.content.slice(0, 300) + "…"
                          : report.question.content}
                      </p>
                      <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                        Gabarito oficial: <strong>{report.question.correctAnswer.toUpperCase()}</strong>
                        {" · "}
                        Reportado {report.phase === "during" ? "durante a prova" : "após a prova"}
                      </p>
                    </div>

                    {/* Student description */}
                    {report.description && (
                      <div style={{ marginBottom: 14, padding: 12, background: "#F9FAFB", borderRadius: 10, border: "1px solid #F3F4F6" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 4 }}>
                          DESCRIÇÃO DO ALUNO
                        </p>
                        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{report.description}</p>
                      </div>
                    )}

                    {/* AI review */}
                    {report.aiReview && (
                      <div style={{
                        marginBottom: 14, padding: 14,
                        background: report.aiReview.verdict === "ANSWER_IS_WRONG" ? "#FEF2F2"
                          : report.aiReview.verdict === "AMBIGUOUS" ? "#EDE9FE"
                          : report.aiReview.verdict === "ANSWER_MAY_BE_WRONG" ? "#FFFBEB"
                          : "#ECFDF5",
                        borderRadius: 10, border: "1px solid",
                        borderColor: report.aiReview.verdict === "ANSWER_IS_WRONG" ? "#FECACA"
                          : report.aiReview.verdict === "AMBIGUOUS" ? "#DDD6FE"
                          : report.aiReview.verdict === "ANSWER_MAY_BE_WRONG" ? "#FDE68A"
                          : "#A7F3D0",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <Bot style={{ width: 14, height: 14, color: "#7C3AED" }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>ANÁLISE DA IA</span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, marginLeft: "auto",
                            color: VERDICT_CONFIG[report.aiReview.verdict]?.color,
                          }}>
                            {VERDICT_CONFIG[report.aiReview.verdict]?.label}
                            {" "}({Math.round((report.aiReview.confidence ?? 0) * 100)}% confiança)
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{report.aiReview.analysis}</p>
                      </div>
                    )}

                    {/* Admin actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <textarea
                        placeholder="Nota interna do admin (opcional)..."
                        value={adminNotes[report.id] ?? (report.adminNote ?? "")}
                        onChange={(e) => setAdminNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                        rows={2}
                        style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                          border: "1.5px solid #E5E7EB", resize: "vertical", fontFamily: "var(--font-sans)",
                          outline: "none",
                        }}
                      />

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {report.status !== "UNDER_REVIEW" && (
                          <button
                            onClick={() => updateReport(report.id, { status: "UNDER_REVIEW", adminNote: adminNotes[report.id] })}
                            disabled={saving[report.id]}
                            style={{
                              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: "1.5px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", cursor: "pointer",
                            }}
                          >
                            Marcar em revisão
                          </button>
                        )}

                        {!report.question.isMarkedSuspect && (
                          <button
                            onClick={() => updateReport(report.id, { markQuestionSuspect: true, status: "UNDER_REVIEW" })}
                            disabled={saving[report.id]}
                            style={{
                              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer",
                            }}
                          >
                            <ShieldAlert style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
                            Marcar questão suspeita
                          </button>
                        )}

                        {report.question.isMarkedSuspect && (
                          <button
                            onClick={() => updateReport(report.id, { markQuestionSuspect: false })}
                            disabled={saving[report.id]}
                            style={{
                              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: "1.5px solid #A7F3D0", background: "#ECFDF5", color: "#059669", cursor: "pointer",
                            }}
                          >
                            Remover suspeita
                          </button>
                        )}

                        <button
                          onClick={() => updateReport(report.id, { status: "RESOLVED", adminNote: adminNotes[report.id] })}
                          disabled={saving[report.id]}
                          style={{
                            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: "1.5px solid #A7F3D0", background: "#ECFDF5", color: "#059669", cursor: "pointer",
                          }}
                        >
                          Resolver
                        </button>

                        <button
                          onClick={() => updateReport(report.id, { status: "DISMISSED", adminNote: adminNotes[report.id] })}
                          disabled={saving[report.id]}
                          style={{
                            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: "1.5px solid #E5E7EB", background: "#F9FAFB", color: "#6B7280", cursor: "pointer",
                          }}
                        >
                          Descartar
                        </button>

                        {(adminNotes[report.id] !== undefined && adminNotes[report.id] !== report.adminNote) && (
                          <button
                            onClick={() => updateReport(report.id, { adminNote: adminNotes[report.id] })}
                            disabled={saving[report.id]}
                            style={{
                              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: "1.5px solid #DDD6FE", background: "#EDE9FE", color: "#7C3AED", cursor: "pointer",
                            }}
                          >
                            Salvar nota
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
