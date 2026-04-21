"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, AlertCircle, ChevronDown, ChevronUp, Trash2, Copy } from "lucide-react";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";
import { ImportLinkDrawer } from "@/components/admin/ImportLinkDrawer";
import type { PdfLinkType } from "@/components/admin/ImportPdfMarkupPanel";
import { ImportIdentifyAlternativesDrawer } from "@/components/admin/ImportIdentifyAlternativesDrawer";
import { TopBar } from "@/components/admin/review/TopBar";
import { StatsRow } from "@/components/admin/review/StatsRow";
import { SidebarQuestoes } from "@/components/admin/review/SidebarQuestoes";
import { VisualizadorPDF } from "@/components/admin/review/VisualizadorPDF";
import { PainelDireito } from "@/components/admin/review/PainelDireito";

// PDF viewer é encapsulado em `VisualizadorPDF` (dinâmico internamente).

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

function computeReviewSuggestions(cur: ImportedQ, next?: ImportedQ) {
  const suggestions: Array<{ kind: "split" | "merge"; reason: string }> = [];
  const text = (cur.content ?? "").trim();
  const matches = Array.from(text.matchAll(/\b(quest[aã]o|q\.)\s*(\d{1,3})\b/gi));
  if (matches.length >= 2) suggestions.push({ kind: "split", reason: "Parece haver mais de uma questão no mesmo enunciado." });
  // Heurística simples: enunciado termina “aberto” e próximo começa minúsculo ou conectivo.
  if (next) {
    const t = text;
    const nt = (next.content ?? "").trim();
    const endsOpen = t.length > 0 && !/[.!?]$/.test(t);
    const nextLooksContinuation = /^[a-zà-ú]|^(e|ou|pois|logo|assim|portanto)\b/i.test(nt);
    if (endsOpen && nextLooksContinuation) suggestions.push({ kind: "merge", reason: "A próxima parece continuação do enunciado." });
  }
  return suggestions;
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
  const [altDrawerOpen, setAltDrawerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [search, setSearch] = useState("");
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
    }).catch((e) => {
      console.error("[review] failed to load initial data", e);
      toast.error("Falha ao carregar dados da revisão (ver logs).");
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

  async function applyAlternativesFromAi(questionId: string, mode: "replace" | "merge", alternatives: { letter: string; content: string }[]) {
    const cur = drafts[questionId];
    if (!cur) return;
    let nextAlts = alternatives;
    if (mode === "merge") {
      const seen = new Set<string>();
      const merged: { letter: string; content: string }[] = [];
      for (const a of [...(cur.alternatives ?? []), ...(alternatives ?? [])]) {
        const l = String(a.letter ?? "").trim().toUpperCase().slice(0, 1);
        const c = String(a.content ?? "").trim();
        if (!l || !c) continue;
        const key = `${l}:${c}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ letter: l, content: c });
      }
      merged.sort((a, b) => a.letter.localeCompare(b.letter));
      nextAlts = merged;
    }

    setDrafts((prev) => ({ ...prev, [questionId]: { ...cur, alternatives: nextAlts } }));
    await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alternatives: nextAlts }),
    });
    toast.success("Alternativas aplicadas");
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

  async function splitQuestionAuto(questionId: string) {
    const d = drafts[questionId];
    if (!d) return;
    const text = d.content ?? "";
    const m = text.match(/\b(quest[aã]o|q\.)\s*\d{1,3}\b/gi);
    if (!m || m.length < 2) {
      toast.error("Não encontrei um marcador claro de 2ª questão para dividir automaticamente.");
      return;
    }
    const marker = m[1];
    const idx = text.toLowerCase().indexOf(marker.toLowerCase());
    if (idx <= 0) {
      toast.error("Não encontrei um ponto bom para dividir.");
      return;
    }
    const first = text.slice(0, idx).trim();
    const second = text.slice(idx).trim();
    if (!first || !second) return;

    await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: first }),
    });

    const cr = await fetch(`/api/admin/imports/${id}/imported-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: second,
        alternatives: [],
        correctAnswer: null,
        suggestedSubjectId: subjectMap[questionId] || null,
        sourcePage: d.sourcePage ?? null,
        rawText: d.rawText ?? null,
      }),
    });
    if (!cr.ok) {
      const err = await cr.json().catch(() => ({}));
      toast.error(err.error ?? "Erro ao criar questão dividida");
      return;
    }
    toast.success("Dividido automaticamente (nova questão criada)");
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

  const qopts = imp.importedQuestions.map((q, i) => ({ id: q.id, label: `Questão ${i + 1}` }));
  const filteredQuestions = useMemo(() => {
    const base = onlyNeedsReview
      ? imp.importedQuestions.filter((q) => computeReviewWarnings(drafts[q.id] ?? q).length > 0)
      : imp.importedQuestions;
    const s = search.trim().toLowerCase();
    if (!s) return base;
    return base.filter((q, idx) => {
      const d = drafts[q.id] ?? q;
      const ai = parseAiMeta(d.rawText);
      const num = ai?.number != null ? String(ai.number) : "";
      const hay = `${idx + 1} ${num} ${d.content ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [onlyNeedsReview, imp.importedQuestions, drafts, search]);

  return (
    <div className="w-full max-w-none">
      <div className="mb-4">
        <TopBar
          title={`Revisão: ${imp.originalFilename}`}
          subtitle={imp.competition?.name ?? null}
          onApproveAll={() => selectAll("approve")}
          onRejectAll={() => selectAll("reject")}
          onSave={saveReview}
          saving={saving}
        />
      </div>

      <div className="mb-4">
        <StatsRow total={imp.importedQuestions.length} approved={approved} rejected={rejected} pending={pending} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <SidebarQuestoes
            items={filteredQuestions.slice(0, visibleCount).map((q) => {
              const draft = drafts[q.id] ?? q;
              const warnings = computeReviewWarnings(draft);
              const ai = parseAiMeta(draft.rawText);
              return {
                id: q.id,
                title: `Questão ${imp.importedQuestions.findIndex((x) => x.id === q.id) + 1}${ai?.number != null ? ` · Nº ${ai.number}` : ""}`,
                preview: String(draft.content ?? "").slice(0, 140) + (String(draft.content ?? "").length > 140 ? "…" : ""),
                badge: warnings.length ? { text: "Revisão recomendada", tone: "danger" } : undefined,
                confidencePct: q.confidence != null ? Math.round(q.confidence * 100) : null,
                decision: decisions[q.id] ?? "pending",
              };
            })}
            activeId={selectedQ}
            onActiveChange={setSelectedQ}
            search={search}
            onSearchChange={setSearch}
            onlyNeedsReview={onlyNeedsReview}
            onOnlyNeedsReviewChange={setOnlyNeedsReview}
            onDecisionChange={(qid, next) => setDecisions((prev) => ({ ...prev, [qid]: next }))}
          />

          {filteredQuestions.length > visibleCount && (
            <div className="mt-3">
              <button type="button" className="btn btn-ghost w-full !h-[38px] !text-[12px]" onClick={() => setVisibleCount((n) => n + 60)}>
                Mostrar mais (+60)
              </button>
              <p className="mt-1 text-center text-[11px] text-[#9CA3AF]">Renderização incremental para listas longas.</p>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <VisualizadorPDF
            importId={id}
            pdfAvailable={Boolean(imp.storedPdfPath)}
            questions={qopts}
            assets={imp.importAssets ?? []}
            selectedQuestionId={selectedQ}
            onSelectedQuestionIdChange={setSelectedQ}
            onChanged={refreshImport}
          />
        </div>

        <div className="min-w-0">
          <PainelDireito
            importId={id}
            questions={qopts}
            assets={imp.importAssets ?? []}
            selectedQuestionId={selectedQ}
            onChanged={refreshImport}
          />
        </div>
      </div>

      {/* Mantém o editor detalhado atual abaixo (por enquanto), para não perder funcionalidade durante a reestruturação.
          Na próxima iteração, ele vira painel de edição no lado direito (aba "Conteúdo"). */}
      <div className="mt-6 rounded-[16px] border border-[#E5E7EB] bg-white p-4">
        <div className="mb-2 text-[12px] font-extrabold text-[#111827]">Editor detalhado (temporário)</div>
        <div className="text-[12px] text-[#6B7280]">
          Este bloco será migrado para o painel direito em abas (Conteúdo / Vínculos) na próxima etapa.
        </div>
      </div>

      <div className="hidden">
        {imp.importedQuestions.slice(0, 1).map(() => null)}
      </div>

      {imp.importedQuestions.length === 0 && (
        <div className="mt-6 rounded-[16px] border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center">
          <AlertCircle className="mx-auto mb-2 h-7 w-7 text-[#D1D5DB]" />
          <p className="text-[14px] text-[#6B7280]">Nenhuma questão extraída nesta importação</p>
        </div>
      )}

      {/* drawers continuam abaixo */}
      <div className="mt-0">{/* espaço reservado */}</div>

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

      <ImportIdentifyAlternativesDrawer
        open={altDrawerOpen}
        onClose={() => setAltDrawerOpen(false)}
        importId={id}
        pdfAvailable={Boolean(imp.storedPdfPath)}
        questions={imp.importedQuestions.map((q, i) => ({ id: q.id, label: `Questão ${i + 1}` }))}
        assets={imp.importAssets ?? []}
        selectedQuestionId={selectedQ}
        onSelectedQuestionIdChange={(qid) => setSelectedQ(qid)}
        existingAlternatives={(drafts[selectedQ]?.alternatives ?? []) as any}
        onApply={async (mode, alternatives) => applyAlternativesFromAi(selectedQ, mode, alternatives)}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
