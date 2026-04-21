"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Save, AlertCircle, ChevronDown, ChevronUp, Trash2, Copy, Link2 } from "lucide-react";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";
import { ImportLinkDrawer } from "@/components/admin/ImportLinkDrawer";
import type { PdfLinkType } from "@/components/admin/ImportPdfMarkupPanel";

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

function parseAiMeta(rawText?: string | null): { number?: number | null; commentary?: string | null; instructions?: string | null } | null {
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText);
    return {
      number: typeof parsed.number === "number" ? parsed.number : null,
      commentary: typeof parsed.commentary === "string" ? parsed.commentary : null,
      instructions: typeof parsed.meta?.instructions === "string" ? parsed.meta.instructions : null,
    };
  } catch {
    return null;
  }
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

function computeReviewWarnings(q: ImportedQ) {
  const warnings: string[] = [];
  const content = (q.content ?? "").trim();
  if (content.length < 30) warnings.push("Enunciado muito curto (possível quebra/colagem).");

  const alts = Array.isArray(q.alternatives) ? q.alternatives : [];
  if (alts.length < 4) warnings.push("Poucas alternativas (esperado 4–5).");
  const letters = alts.map((a) => String(a.letter ?? "").trim().toUpperCase()).filter(Boolean);
  const uniq = new Set(letters);
  if (letters.length && uniq.size !== letters.length) warnings.push("Letras de alternativas duplicadas.");
  if (q.correctAnswer && !uniq.has(String(q.correctAnswer).trim().toUpperCase())) warnings.push("Resposta correta não bate com as alternativas.");
  if (!q.correctAnswer) warnings.push("Sem resposta correta (precisa revisar).");
  if (q.confidence != null && q.confidence < 0.55) warnings.push("Baixa confiança da IA.");
  return warnings;
}

export default function RevisaoImportacaoPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [imp, setImp] = useState<ImportData | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedQ, setSelectedQ] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, ImportedQ>>({});
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLinkType, setDrawerLinkType] = useState<PdfLinkType>("TEXT");
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
      setSelectedQ((prev) => prev || impData.import.importedQuestions?.[0]?.id || "");
      const ds: Record<string, ImportedQ> = {};
      impData.import.importedQuestions.forEach((q: ImportedQ) => {
        ds[q.id] = { ...q, alternatives: q.alternatives?.map((a) => ({ ...a })) ?? [] };
      });
      setDrafts(ds);
      setLoading(false);
      // #region agent log
      fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-review-ui',location:'revisao/page.tsx:loaded',message:'review page loaded import data',data:{importId:id,questionsCount:impData.import.importedQuestions?.length ?? 0,assetsCount:impData.import.importAssets?.length ?? 0,pdfAvailable:Boolean(impData.import.storedPdfPath)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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

  const linkedAssetsByQuestion = useMemo(() => {
    const map: Record<string, ImportAssetDTO[]> = {};
    const assets = imp?.importAssets ?? [];
    for (const a of assets) {
      for (const l of a.questionLinks ?? []) {
        map[l.importedQuestionId] ??= [];
        map[l.importedQuestionId].push(a);
      }
    }
    for (const k of Object.keys(map)) {
      map[k] = map[k].slice().sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
    }
    return map;
  }, [imp?.importAssets]);

  async function saveQuestion(questionId: string) {
    const d = drafts[questionId];
    if (!d) return;
    // #region agent log
    fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-save-question',location:'revisao/page.tsx:saveQuestion',message:'saving imported question edits',data:{importId:id,questionId,contentLen:d.content?.length ?? 0,alts:d.alternatives?.length ?? 0,correctAnswer:d.correctAnswer ?? null,subjectId:subjectMap[questionId] ?? ''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const res = await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: d.content,
        alternatives: d.alternatives,
        correctAnswer: d.correctAnswer ?? null,
        suggestedSubjectId: subjectMap[questionId] || null,
        sourcePage: d.sourcePage ?? null,
        confidence: d.confidence ?? null,
        rawText: d.rawText ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao salvar questão");
      return;
    }
    toast.success("Questão salva");
    await refreshImport();
  }

  async function markNeedsReview(questionId: string) {
    const res = await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING_REVIEW" }),
    });
    if (res.ok) toast.success("Marcada para revisão");
    else toast.error("Erro ao marcar para revisão");
    await refreshImport();
  }

  async function duplicateQuestion(questionId: string) {
    const res = await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao duplicar");
      return;
    }
    toast.success("Questão duplicada");
    await refreshImport();
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm("Excluir esta questão importada?")) return;
    const res = await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao excluir");
      return;
    }
    toast.success("Questão excluída");
    await refreshImport();
  }

  async function splitQuestion(questionId: string) {
    const d = drafts[questionId];
    if (!d) return;
    const delimiter = prompt("Dividir enunciado a partir de qual texto? (ex: \"Questão\" ou um trecho exato)");
    if (!delimiter) return;
    const idx = d.content.indexOf(delimiter);
    if (idx <= 0 || idx >= d.content.length - 5) {
      toast.error("Não encontrei um ponto bom para dividir com esse texto.");
      return;
    }
    const first = d.content.slice(0, idx).trim();
    const second = d.content.slice(idx).trim();
    if (!first || !second) {
      toast.error("Divisão inválida.");
      return;
    }

    // Atualiza a questão atual com a primeira parte (mantém alternativas)
    await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: first }),
    });

    // Cria nova questão com a segunda parte (alternativas vazias para o admin preencher)
    const cr = await fetch(`/api/admin/imports/${id}/imported-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: second,
        alternatives: [],
        correctAnswer: null,
        suggestedSubjectId: subjectMap[questionId] || null,
        sourcePage: d.sourcePage ?? null,
      }),
    });
    if (!cr.ok) {
      const err = await cr.json().catch(() => ({}));
      toast.error(err.error ?? "Erro ao criar questão dividida");
      return;
    }
    toast.success("Questão dividida (nova questão criada)");
    await refreshImport();
  }

  async function mergeWithNext(questionId: string) {
    if (!imp) return;
    const idx = imp.importedQuestions.findIndex((q) => q.id === questionId);
    if (idx === -1 || idx >= imp.importedQuestions.length - 1) {
      toast.error("Não há próxima questão para unir.");
      return;
    }
    const nextQ = imp.importedQuestions[idx + 1];
    if (!confirm("Unir com a próxima questão? Isso vai mover o enunciado da próxima para esta e excluir a próxima.")) return;

    const cur = drafts[questionId] ?? imp.importedQuestions[idx];
    const nxt = drafts[nextQ.id] ?? nextQ;
    const merged = `${(cur.content ?? "").trim()}\n\n${(nxt.content ?? "").trim()}`.trim();

    await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: merged }),
    });
    await fetch(`/api/admin/imports/${id}/imported-questions/${nextQ.id}`, { method: "DELETE" });
    toast.success("Questões unidas");
    await refreshImport();
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
    <div className="w-full max-w-none">
      <div className="mb-6">
        <Link href="/admin/importacoes" className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#7C3AED]">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[22px] font-extrabold tracking-tight text-[#111827]">Revisão: {imp.originalFilename}</h1>
              <span className="rounded-full bg-[#7C3AED18] px-2 py-0.5 text-[11px] font-extrabold text-[#7C3AED]">
                UI v2
              </span>
            </div>
            {imp.competition && <p className="mt-1 text-[13px] font-semibold text-[#7C3AED]">{imp.competition.name}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => selectAll("approve")} className="btn !h-[34px] !px-3 !text-[12px]" style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", color: "#059669" }}>
              <CheckCircle2 className="h-4 w-4" /> Aprovar todas
            </button>
            <button onClick={() => selectAll("reject")} className="btn !h-[34px] !px-3 !text-[12px]" style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626" }}>
              <XCircle className="h-4 w-4" /> Rejeitar todas
            </button>
            <button onClick={saveReview} disabled={saving} className="btn btn-primary !h-[34px] !text-[12px]">
              {saving ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar revisão</>}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="stat-widget">
          <div className="stat-label">Total</div>
          <div className="stat-value">{imp.importedQuestions.length}</div>
        </div>
        <div className="stat-widget">
          <div className="stat-label">Aprovadas</div>
          <div className="stat-value" style={{ color: "#059669" }}>{approved}</div>
        </div>
        <div className="stat-widget">
          <div className="stat-label">Rejeitadas</div>
          <div className="stat-value" style={{ color: "#DC2626" }}>{rejected}</div>
        </div>
        <div className="stat-widget">
          <div className="stat-label">Pendentes</div>
          <div className="stat-value" style={{ color: "#D97706" }}>{pending}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
        {/* Left: questions */}
        <div className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-bold tracking-tight text-[#111827]">Questões extraídas</h2>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">Edite tudo aqui. Para vincular trechos do PDF, selecione a questão e desenhe um retângulo à direita.</p>
            </div>
            {imp.importedQuestions.length > 0 && (
              <span className="text-[12px] font-semibold text-[#6B7280]">{imp.importedQuestions.length} itens</span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {imp.importedQuestions.map((q, idx) => {
          const d = decisions[q.id] ?? "pending";
          const isExpanded = expanded[q.id] ?? false;
          const isSelected = selectedQ === q.id;
          const borderColor = isSelected ? "#7C3AED" : d === "approve" ? "#6EE7B7" : d === "reject" ? "#FCA5A5" : "#E5E7EB";
          const bgColor = d === "approve" ? "#ECFDF5" : d === "reject" ? "#FEF2F2" : "#FFFFFF";
          const draft = drafts[q.id] ?? q;
          const linked = linkedAssetsByQuestion[q.id] ?? [];
          const warnings = computeReviewWarnings(draft);
          const aiMeta = parseAiMeta(draft.rawText);

          return (
            <div
              key={q.id}
              className="rounded-[14px] border bg-white shadow-sm transition"
              style={{ borderWidth: 1.5, borderColor, background: bgColor }}
              onMouseDown={() => {
                setSelectedQ(q.id);
                // #region agent log
                fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-sync-selection',location:'revisao/page.tsx:selectQuestion',message:'selected question in review list',data:{importId:id,questionId:q.id,index:idx+1},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              }}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="w-[26px] shrink-0 pt-0.5 text-[11px] font-bold text-[#9CA3AF]">{idx + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[#111827]">Questão</span>
                      {aiMeta?.number != null && (
                        <span className="rounded-full bg-[#1118270D] px-2 py-0.5 text-[11px] font-extrabold text-[#111827]">
                          Nº {aiMeta.number}
                        </span>
                      )}
                      {q.confidence != null && (
                        <span className="rounded-full bg-[#7C3AED18] px-2 py-0.5 text-[11px] font-semibold text-[#7C3AED]">
                          Confiança {Math.round(q.confidence * 100)}%
                        </span>
                      )}
                      {linked.length > 0 && (
                        <span className="rounded-full bg-[#1118270D] px-2 py-0.5 text-[11px] font-semibold text-[#374151]">
                          {linked.length} vínculo(s)
                        </span>
                      )}
                      {warnings.length > 0 && (
                        <span className="rounded-full bg-[#DC262618] px-2 py-0.5 text-[11px] font-extrabold text-[#DC2626]">
                          Revisão recomendada
                        </span>
                      )}
                      {q.sourcePage != null && (
                        <span className="text-[11px] font-semibold text-[#9CA3AF]">p.{q.sourcePage}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn !h-[30px] !px-2.5 !text-[12px]"
                        style={{ background: d === "approve" ? "#059669" : "#F3F4F6", border: d === "approve" ? "1px solid #059669" : "1px solid #E5E7EB", color: d === "approve" ? "#fff" : "#374151" }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setDecisions((prev) => ({ ...prev, [q.id]: d === "approve" ? "pending" : "approve" }))}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="btn !h-[30px] !px-2.5 !text-[12px]"
                        style={{ background: d === "reject" ? "#DC2626" : "#F3F4F6", border: d === "reject" ? "1px solid #DC2626" : "1px solid #E5E7EB", color: d === "reject" ? "#fff" : "#374151" }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setDecisions((prev) => ({ ...prev, [q.id]: d === "reject" ? "pending" : "reject" }))}
                      >
                        ✗
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !h-[30px] !w-[30px] !p-0"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => setExpanded((prev) => ({ ...prev, [q.id]: !isExpanded }))}
                        title={isExpanded ? "Recolher" : "Expandir"}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-[13px] leading-relaxed text-[#374151]">
                    {isExpanded ? draft.content : (draft.content.length > 160 ? draft.content.slice(0, 160) + "…" : draft.content)}
                  </p>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {warnings.length > 0 && (
                        <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[12px] text-[#7F1D1D]">
                          <div className="font-extrabold">Pontos de atenção</div>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {warnings.map((w, i) => (
                              <li key={`${q.id}-w-${i}`}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-[#374151]">Enunciado</label>
                        <textarea
                          className="input min-h-[100px] text-[12.5px]"
                          value={draft.content}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, content: e.target.value } }))
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-[#374151]">Alternativas</label>
                        <div className="space-y-2">
                          {draft.alternatives.map((alt, altIdx) => (
                            <div key={`${q.id}:${alt.letter}:${altIdx}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2">
                              <input
                                className="input text-center text-[12px] font-bold"
                                value={alt.letter}
                                onChange={(e) => {
                                  const v = e.target.value.toUpperCase();
                                  setDrafts((prev) => {
                                    const nextAlts = draft.alternatives.map((a, i) => (i === altIdx ? { ...a, letter: v } : a));
                                    return { ...prev, [q.id]: { ...draft, alternatives: nextAlts } };
                                  });
                                }}
                              />
                              <textarea
                                className="input min-h-[56px] text-[12.5px]"
                                value={alt.content}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDrafts((prev) => {
                                    const nextAlts = draft.alternatives.map((a, i) => (i === altIdx ? { ...a, content: v } : a));
                                    return { ...prev, [q.id]: { ...draft, alternatives: nextAlts } };
                                  });
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-[#374151]">Resposta correta</label>
                          <select
                            className="input h-[36px] text-[12.5px]"
                            value={draft.correctAnswer ?? ""}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, correctAnswer: e.target.value || null } }))}
                          >
                            <option value="">(vazio)</option>
                            {draft.alternatives.map((a, i) => (
                              <option key={`${q.id}-ca-${i}`} value={a.letter}>
                                {a.letter}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[12px] font-semibold text-[#374151]">Página (opcional)</label>
                          <input
                            className="input h-[36px] text-[12.5px]"
                            inputMode="numeric"
                            value={draft.sourcePage ?? ""}
                            onChange={(e) => {
                              const n = e.target.value ? Number(e.target.value) : null;
                              setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, sourcePage: Number.isFinite(n as any) ? (n as any) : null } }));
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-[#374151]">
                          Matéria
                          {(() => {
                            const suggested = parseSuggestedSubject(q.rawText);
                            if (!suggested) return null;
                            const confColor = suggested.confidence === "high" ? "#059669" : suggested.confidence === "medium" ? "#D97706" : "#9CA3AF";
                            return (
                              <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: confColor, background: confColor + "18" }}>
                                IA: {suggested.subject}{suggested.confidence === "high" ? " ✓" : ""}
                              </span>
                            );
                          })()}
                        </label>
                        <select className="input h-[36px] text-[12.5px]" value={subjectMap[q.id] ?? ""} onChange={(e) => setSubjectMap((prev) => ({ ...prev, [q.id]: e.target.value }))}>
                          <option value="">Automático (sugestão da IA)</option>
                          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button type="button" className="btn btn-purple !h-[34px] !text-[12px]" onClick={() => saveQuestion(q.id)}>
                          <Save className="h-4 w-4" /> Salvar questão
                        </button>
                        <button type="button" className="btn btn-ghost !h-[34px] !text-[12px]" onClick={() => duplicateQuestion(q.id)}>
                          <Copy className="h-4 w-4" /> Duplicar
                        </button>
                        <button type="button" className="btn btn-ghost !h-[34px] !text-[12px]" onClick={() => splitQuestion(q.id)}>
                          Dividir
                        </button>
                        <button type="button" className="btn btn-ghost !h-[34px] !text-[12px]" onClick={() => mergeWithNext(q.id)}>
                          Unir com próxima
                        </button>
                        <button type="button" className="btn btn-ghost !h-[34px] !text-[12px]" onClick={() => markNeedsReview(q.id)}>
                          Marcar p/ revisão
                        </button>
                        <button type="button" className="btn btn-ghost !h-[34px] !text-[12px]" onClick={() => deleteQuestion(q.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" /> Excluir
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !h-[34px] !text-[12px]"
                          onClick={() => {
                            setSelectedQ(q.id);
                            setDrawerLinkType("TEXT");
                            setDrawerOpen(true);
                          }}
                        >
                          <Link2 className="h-4 w-4" /> Vincular imagem/texto
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !h-[34px] !text-[12px]"
                          onClick={() => {
                            setSelectedQ(q.id);
                            setDrawerLinkType("TEXT");
                            setDrawerOpen(true);
                          }}
                        >
                          Vincular texto
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !h-[34px] !text-[12px]"
                          onClick={() => {
                            setSelectedQ(q.id);
                            setDrawerLinkType("IMAGE");
                            setDrawerOpen(true);
                          }}
                        >
                          Vincular imagem
                        </button>
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-[#374151]">Comentário/explicação (opcional)</label>
                        <textarea
                          className="input min-h-[80px] text-[12.5px]"
                          value={aiMeta?.commentary ?? ""}
                          onChange={(e) => {
                            const next = e.target.value;
                            setDrafts((prev) => {
                              const cur = prev[q.id] ?? draft;
                              let rawObj: any = {};
                              try { rawObj = cur.rawText ? JSON.parse(cur.rawText) : {}; } catch { rawObj = {}; }
                              rawObj.commentary = next;
                              return { ...prev, [q.id]: { ...cur, rawText: JSON.stringify(rawObj) } };
                            });
                          }}
                          placeholder="Ex: justificativa do gabarito, observações..."
                        />
                        <p className="mt-1 text-[11px] text-[#9CA3AF]">
                          (O salvamento do comentário será persistido junto ao JSON `rawText` por enquanto.)
                        </p>
                      </div>

                      {linked.length > 0 && (
                        <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFC] p-3">
                          <div className="text-[12px] font-extrabold text-[#111827]">Vínculos desta questão</div>
                          <div className="mt-2 space-y-2">
                            {linked.slice(0, 4).map((a) => (
                              <div key={`${q.id}-lk-${a.id}`} className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[12px]">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-semibold text-[#374151]">
                                    {a.kind === "IMAGE" ? "Figura" : "Texto-base"} <span className="text-[#9CA3AF]">· p.{a.page}</span>
                                  </div>
                                  <div className="text-[11px] font-semibold text-[#9CA3AF]">{a.label ?? ""}</div>
                                </div>
                                {a.kind === "TEXT_BLOCK" && a.extractedText && (
                                  <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11.5px] text-[#4B5563]">
                                    {a.extractedText}
                                  </div>
                                )}
                              </div>
                            ))}
                            {linked.length > 4 && (
                              <div className="text-[11px] font-semibold text-[#6B7280]">
                                +{linked.length - 4} vínculo(s) (veja todos na coluna do PDF)
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })}

            {imp.importedQuestions.length === 0 && (
              <div className="rounded-[16px] border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center">
                <AlertCircle className="mx-auto mb-2 h-7 w-7 text-[#D1D5DB]" />
                <p className="text-[14px] text-[#6B7280]">Nenhuma questão extraída nesta importação</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: PDF */}
        <div ref={rightRef} className="min-w-0">
          <div className="sticky top-[18px] space-y-3">
            <div className="rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-sm">
              <h2 className="text-[14px] font-bold tracking-tight text-[#111827]">PDF e regiões (texto-base / figura)</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B7280]">
                Questão selecionada: <strong>{imp.importedQuestions.findIndex((q) => q.id === selectedQ) >= 0 ? `Questão ${imp.importedQuestions.findIndex((q) => q.id === selectedQ) + 1}` : "—"}</strong>.
                Desenhe retângulos para marcar texto-base/figura e vincular à questão alvo.
              </p>
            </div>
            <ImportPdfMarkupPanel
              importId={id}
              pdfAvailable={Boolean(imp.storedPdfPath)}
              questions={imp.importedQuestions.map((q, i) => ({ id: q.id, label: `Questão ${i + 1}` }))}
              assets={imp.importAssets ?? []}
              onChanged={refreshImport}
              selectedQuestionId={selectedQ}
              onSelectedQuestionIdChange={(qid) => setSelectedQ(qid)}
            />
          </div>
        </div>
      </div>

      <ImportLinkDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        importId={id}
        pdfAvailable={Boolean(imp.storedPdfPath)}
        questions={imp.importedQuestions.map((q, i) => ({ id: q.id, label: `Questão ${i + 1}` }))}
        assets={imp.importAssets ?? []}
        selectedQuestionId={selectedQ}
        onSelectedQuestionIdChange={(qid) => setSelectedQ(qid)}
        linkType={drawerLinkType}
        onLinkTypeChange={setDrawerLinkType}
        onChanged={refreshImport}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
