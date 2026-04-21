"use client";

import { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, AlertCircle, Trash2, Copy, Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";
import { ImportLinkDrawer } from "@/components/admin/ImportLinkDrawer";
import type { PdfLinkType } from "@/components/admin/ImportPdfMarkupPanel";
import { ImportIdentifyAlternativesDrawer } from "@/components/admin/ImportIdentifyAlternativesDrawer";
import { TopBar } from "@/components/admin/review/TopBar";
import { StatsRow } from "@/components/admin/review/StatsRow";
import { PdfQuestionLinkAssets } from "@/components/admin/review/PdfQuestionLinkAssets";

// PDF viewer é encapsulado em `VisualizadorPDF` (dinâmico internamente).

interface ImportedQ {
  id: string; content: string; alternatives: { letter: string; content: string }[];
  correctAnswer?: string | null; suggestedSubjectId?: string | null;
  sourcePage?: number | null; confidence?: number | null;
  status: string; rawText?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
}

type AiMetaBlock = {
  city?: string | null;
  concurso?: string | null;
  ano?: number | string | null;
  banca?: string | null;
  cargo?: string | null;
  materia?: string | null;
  instructions?: string | null;
};

type AnswerSourceKind = "gabarito" | "llm" | "manual" | null;

function parseAnswerMeta(rawText?: string | null): {
  answerSource?: AnswerSourceKind;
  gabaritoMatchNumber?: number | null;
} {
  if (!rawText) return {};
  try {
    const p = JSON.parse(rawText) as { answerSource?: AnswerSourceKind; gabaritoMatchNumber?: unknown };
    return {
      answerSource: p.answerSource ?? null,
      gabaritoMatchNumber: typeof p.gabaritoMatchNumber === "number" ? p.gabaritoMatchNumber : null,
    };
  } catch {
    return {};
  }
}

function mergeRawTextPatch(rawText: string | null | undefined, patch: Record<string, unknown>) {
  try {
    const o = rawText?.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    return JSON.stringify({ ...o, ...patch });
  } catch {
    return JSON.stringify(patch);
  }
}

function parseAiMeta(rawText?: string | null): {
  number?: number | null;
  commentary?: string | null;
  instructions?: string | null;
  meta?: AiMetaBlock | null;
} | null {
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText) as { number?: unknown; commentary?: unknown; meta?: AiMetaBlock };
    const m = parsed.meta && typeof parsed.meta === "object" ? parsed.meta : null;
    return {
      number: typeof parsed.number === "number" ? parsed.number : null,
      commentary: typeof parsed.commentary === "string" ? parsed.commentary : null,
      instructions: typeof m?.instructions === "string" ? m.instructions : null,
      meta: m,
    };
  } catch {
    return null;
  }
}

type ImportMetaRow = {
  banca: string;
  materia: string;
  concurso: string;
  cargo: string;
  ano: string;
  cidade: string;
};

function buildImportMetaDisplay(
  imp: {
    competition?: { name: string } | null;
    year?: number | null;
    examBoard?: { name: string; acronym: string } | null;
    subject?: { name: string } | null;
    city?: { name: string; state: string } | null;
    jobRole?: { name: string } | null;
  },
  ai?: AiMetaBlock | null,
): ImportMetaRow {
  const examBoardLabel = imp.examBoard
    ? [imp.examBoard.acronym, imp.examBoard.name].filter(Boolean).join(" · ")
    : "";
  const cityLabel = imp.city ? `${imp.city.name} · ${imp.city.state}` : "";
  const yearStr = imp.year != null ? String(imp.year) : "";
  const anoAi = ai?.ano != null && ai.ano !== "" ? String(ai.ano) : "";

  return {
    banca: examBoardLabel || (typeof ai?.banca === "string" ? ai.banca.trim() : "") || "",
    materia: imp.subject?.name?.trim() || (typeof ai?.materia === "string" ? ai.materia.trim() : "") || "",
    concurso: imp.competition?.name?.trim() || (typeof ai?.concurso === "string" ? ai.concurso.trim() : "") || "",
    cargo: imp.jobRole?.name?.trim() || (typeof ai?.cargo === "string" ? ai.cargo.trim() : "") || "",
    ano: yearStr || anoAi,
    cidade: cityLabel || (typeof ai?.city === "string" ? ai.city.trim() : "") || "",
  };
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
  year?: number | null;
  competition?: { name: string } | null;
  examBoard?: { name: string; acronym: string } | null;
  subject?: { name: string } | null;
  city?: { name: string; state: string } | null;
  jobRole?: { name: string } | null;
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

  // Hooks devem rodar em toda renderização. Não colocar useMemo abaixo de early-return.
  const approved = useMemo(() => Object.values(decisions).filter((d) => d === "approve").length, [decisions]);
  const rejected = useMemo(() => Object.values(decisions).filter((d) => d === "reject").length, [decisions]);
  const pending = useMemo(() => Object.values(decisions).filter((d) => d === "pending").length, [decisions]);

  const qopts = useMemo(() => {
    const qs = imp?.importedQuestions ?? [];
    return qs.map((q, i) => ({ id: q.id, label: `Questão ${i + 1}` }));
  }, [imp?.importedQuestions]);

  const globalMetaDisplay = useMemo(() => {
    if (!imp) return null;
    let aiMeta: AiMetaBlock | null = null;
    for (const q of imp.importedQuestions) {
      const p = parseAiMeta(q.rawText)?.meta;
      if (p && (p.banca || p.materia || p.concurso || p.cargo || p.ano != null || p.city)) {
        aiMeta = p;
        break;
      }
    }
    if (!aiMeta) aiMeta = parseAiMeta(imp.importedQuestions[0]?.rawText)?.meta ?? null;
    return buildImportMetaDisplay(imp, aiMeta);
  }, [imp]);

  const filteredQuestions = useMemo(() => {
    const all = imp?.importedQuestions ?? [];
    const base = onlyNeedsReview ? all.filter((q) => computeReviewWarnings(drafts[q.id] ?? q).length > 0) : all;
    const s = search.trim().toLowerCase();
    if (!s) return base;
    const gm = globalMetaDisplay;
    const metaHay = gm
      ? `${gm.banca} ${gm.materia} ${gm.concurso} ${gm.cargo} ${gm.ano} ${gm.cidade}`.toLowerCase()
      : "";
    return base.filter((q, idx) => {
      const d = drafts[q.id] ?? q;
      const ai = parseAiMeta(d.rawText);
      const num = ai?.number != null ? String(ai.number) : "";
      const m = ai?.meta;
      const rowHay = m
        ? `${m.banca ?? ""} ${m.materia ?? ""} ${m.concurso ?? ""} ${m.cargo ?? ""} ${m.ano ?? ""} ${m.city ?? ""}`.toLowerCase()
        : "";
      const hay = `${idx + 1} ${num} ${d.content ?? ""} ${metaHay} ${rowHay}`.toLowerCase();
      return hay.includes(s);
    });
  }, [onlyNeedsReview, imp?.importedQuestions, drafts, search, globalMetaDisplay]);

  useLayoutEffect(() => {
    if (!imp || loading) return;
    const post = (hypothesisId: string, label: string, node: Element | null) => {
      if (!node || !(node instanceof HTMLElement)) return;
      const clientW = node.clientWidth;
      const scrollW = node.scrollWidth;
      const clientH = node.clientHeight;
      const scrollH = node.scrollHeight;
      // #region agent log
      fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
        body: JSON.stringify({
          sessionId: "03dbee",
          runId: "layout-probe",
          hypothesisId,
          location: "revisao/page.tsx:useLayoutEffect",
          message: `overflow probe ${label}`,
          data: { importId: imp.id, clientW, scrollW, overflowX: scrollW > clientW + 1, clientH, scrollH, overflowY: scrollH > clientH + 1 },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    };
    post("H-overflow-topbar", "topbar", document.querySelector("[data-review-topbar]"));
    post("H-overflow-card", "first-card", document.querySelector("[data-review-card]"));
  }, [imp?.id, loading, filteredQuestions.length]);

  if (loading || !imp) {
    return (
      <div className="orbit-stack mx-auto max-w-5xl py-16 text-center">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600"
          aria-hidden
        />
        <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">Carregando revisão…</p>
      </div>
    );
  }

  return (
    <div className="orbit-stack mx-auto w-full max-w-6xl pb-10">
      <TopBar
        title={`Revisão: ${imp.originalFilename}`}
        subtitle={
          [imp.competition?.name, imp.year != null ? String(imp.year) : null].filter(Boolean).join(" · ") || null
        }
        onApproveAll={() => selectAll("approve")}
        onRejectAll={() => selectAll("reject")}
        onSave={saveReview}
        saving={saving}
      />

      <StatsRow total={imp.importedQuestions.length} approved={approved} rejected={rejected} pending={pending} />

      <div className="orbit-card-premium !flex !flex-col gap-4 !py-4 sm:!flex-row sm:!items-center sm:!justify-between sm:!py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            className="input h-11 w-full min-w-0 flex-1 text-sm sm:max-w-md"
            placeholder="Buscar (texto, nº)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className={cn(
              "btn inline-flex h-11 shrink-0 items-center justify-center rounded-2xl px-4 text-sm font-bold",
              onlyNeedsReview ? "btn-primary shadow-sm" : "border border-black/[0.08] bg-white font-semibold text-[var(--text-secondary)] hover:bg-slate-50",
            )}
            onClick={() => setOnlyNeedsReview((v) => !v)}
          >
            Só revisão recomendada
          </button>
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-muted)]">{filteredQuestions.length} questões</p>
      </div>

      {globalMetaDisplay &&
        (() => {
          const rows = [
            ["Banca", globalMetaDisplay.banca],
            ["Matéria", globalMetaDisplay.materia],
            ["Concurso", globalMetaDisplay.concurso],
            ["Cargo", globalMetaDisplay.cargo],
            ["Ano", globalMetaDisplay.ano],
            ["Cidade / UF", globalMetaDisplay.cidade],
          ].filter((entry): entry is [string, string] => Boolean(entry[1] && String(entry[1]).trim()));
          if (!rows.length) return null;
          return (
            <div className="orbit-card-premium !py-5 sm:!py-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Referências do PDF</h2>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-[var(--text-muted)]">
                Preenchido pelo cadastro da importação e/ou inferido pela IA a partir do texto do PDF (quando disponível).
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map(([k, v]) => (
                  <div key={k} className="min-w-0 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-[#fafafd] px-4 py-3.5 shadow-sm">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{k}</dt>
                    <dd className="mt-1.5 break-words text-sm font-semibold leading-snug text-[var(--text-primary)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })()}

      <div className="flex flex-col gap-5">
        {filteredQuestions.slice(0, visibleCount).map((q) => {
          const d = decisions[q.id] ?? "pending";
          const isExpanded = expanded[q.id] ?? false;
          const draft = drafts[q.id] ?? q;
          const linkedAssets = (imp.importAssets ?? []).filter((a) => (a.questionLinks ?? []).some((l) => l.importedQuestionId === q.id));
          const warnings = computeReviewWarnings(draft);
          const aiMeta = parseAiMeta(draft.rawText);
          const qi = imp.importedQuestions.findIndex((x) => x.id === q.id) + 1;
          const isFirstVisible = filteredQuestions[0]?.id === q.id;
          const ansMeta = parseAnswerMeta(draft.rawText);
          const questionContext = buildImportMetaDisplay(imp, aiMeta?.meta ?? null);
          const contextRows = [
            ["Banca", questionContext.banca],
            ["Matéria", questionContext.materia],
            ["Concurso", questionContext.concurso],
            ["Cargo", questionContext.cargo],
            ["Ano", questionContext.ano],
            ["Cidade / UF", questionContext.cidade],
          ].filter((entry): entry is [string, string] => Boolean(entry[1] && String(entry[1]).trim()));

          return (
            <article
              key={q.id}
              data-review-card={isFirstVisible ? "" : undefined}
              className={cn(
                "min-w-0 rounded-[var(--r-3xl)] border border-black/[0.08] bg-gradient-to-br from-white to-[#fafafd] shadow-[var(--shadow-card)] transition-shadow",
                d === "approve" && "ring-2 ring-emerald-300/50",
                d === "reject" && "ring-2 ring-red-300/50",
                d === "pending" && warnings.length > 0 && "ring-2 ring-amber-200/70",
              )}
            >
              <div className="grid gap-4 border-b border-black/[0.06] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6 sm:p-6">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-start gap-2 sm:gap-3">
                    <span className="inline-flex h-9 min-w-[2.25rem] shrink-0 items-center justify-center rounded-xl bg-violet-600 px-2 text-sm font-black text-white shadow-md">
                      {qi}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <button
                        type="button"
                        className="w-full break-words text-left text-base font-extrabold tracking-tight text-[var(--text-primary)] underline-offset-4 hover:text-violet-700 hover:underline"
                        onClick={() => {
                          setSelectedQ(q.id);
                          setExpanded((prev) => ({ ...prev, [q.id]: !isExpanded }));
                        }}
                      >
                        Questão {qi}
                        {aiMeta?.number != null ? ` · Nº ${aiMeta.number}` : ""}
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        {warnings.length > 0 && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-amber-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-amber-900 ring-1 ring-amber-200/80 whitespace-normal">
                            Revisão recomendada
                          </span>
                        )}
                        {q.confidence != null && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-violet-100 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-violet-900 ring-1 ring-violet-200/80 whitespace-normal">
                            Confiança {Math.round(q.confidence * 100)}%
                          </span>
                        )}
                        {linkedAssets.length > 0 && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-slate-700 ring-1 ring-slate-200/90 whitespace-normal">
                            {linkedAssets.length} vínculo(s)
                          </span>
                        )}
                        {draft.correctAnswer && ansMeta.answerSource === "gabarito" && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-emerald-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-emerald-900 ring-1 ring-emerald-200/90 whitespace-normal" title={ansMeta.gabaritoMatchNumber != null ? `Chave no gabarito: questão ${ansMeta.gabaritoMatchNumber}` : undefined}>
                            Gabarito · {draft.correctAnswer}
                            {ansMeta.gabaritoMatchNumber != null ? ` (nº gab. ${ansMeta.gabaritoMatchNumber})` : ""}
                          </span>
                        )}
                        {draft.correctAnswer && ansMeta.answerSource === "llm" && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-sky-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-sky-900 ring-1 ring-sky-200/90 whitespace-normal">
                            IA · {draft.correctAnswer}
                          </span>
                        )}
                        {draft.correctAnswer && ansMeta.answerSource === "manual" && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-slate-200/90 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-slate-800 ring-1 ring-slate-300/90 whitespace-normal">
                            Manual · {draft.correctAnswer}
                          </span>
                        )}
                        {draft.correctAnswer && !ansMeta.answerSource && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-violet-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-violet-900 ring-1 ring-violet-200/90 whitespace-normal">
                            Correta · {draft.correctAnswer}
                          </span>
                        )}
                        {!draft.correctAnswer && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-rose-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-rose-900 ring-1 ring-rose-200/90 whitespace-normal">
                            Sem resposta marcada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isExpanded && (
                    <p className="line-clamp-3 min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                      {draft.content}
                    </p>
                  )}
                </div>

                <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:max-w-[min(100%,20rem)] sm:justify-end">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border-2 text-sm font-bold shadow-sm transition-colors",
                      d === "approve"
                        ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
                    )}
                    onClick={() => setDecisions((prev) => ({ ...prev, [q.id]: d === "approve" ? "pending" : "approve" }))}
                    title="Aprovar"
                    aria-pressed={d === "approve"}
                  >
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border-2 text-sm font-bold shadow-sm transition-colors",
                      d === "reject"
                        ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                        : "border-red-200 bg-white text-red-700 hover:bg-red-50",
                    )}
                    onClick={() => setDecisions((prev) => ({ ...prev, [q.id]: d === "reject" ? "pending" : "reject" }))}
                    title="Rejeitar"
                    aria-pressed={d === "reject"}
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "btn inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-sm",
                      isExpanded ? "btn-ghost border border-black/[0.1] bg-white" : "btn-primary",
                    )}
                    onClick={() => setExpanded((prev) => ({ ...prev, [q.id]: !isExpanded }))}
                    title={isExpanded ? "Recolher" : "Editar"}
                  >
                    <Pencil className="h-4 w-4" />
                    {isExpanded ? "Recolher" : "Editar"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-black/[0.06] bg-white/60 px-5 py-6 sm:px-6 sm:py-7">
                  {contextRows.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm sm:p-5">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-900/80">Contexto da questão</h3>
                      <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {contextRows.map(([k, v]) => (
                          <div key={`${q.id}-ctx-${k}`} className="min-w-0">
                            <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{k}</dt>
                            <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--text-primary)]">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {warnings.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-amber-200/90 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm sm:p-5">
                      <div className="text-sm font-extrabold tracking-tight">Pontos de atenção</div>
                      <ul className="mt-3 list-disc space-y-2 break-words pl-5 leading-relaxed">
                        {warnings.map((w, i) => (
                          <li key={`${q.id}-w-${i}`}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiMeta?.instructions ? (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-800 shadow-sm sm:p-5">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Instruções da prova (IA)</div>
                      <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{aiMeta.instructions}</p>
                    </div>
                  ) : null}

                  <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                    <div className="min-w-0 space-y-6">
                      <div className="orbit-form-stack gap-3">
                        <label className="orbit-form-label">Enunciado</label>
                        <textarea
                          className="input min-h-[200px] w-full min-w-0 resize-y break-words text-sm leading-relaxed"
                          value={draft.content}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, content: e.target.value } }))}
                        />
                      </div>

                      <div className="orbit-form-stack gap-3">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <label className="orbit-form-label mb-0">Alternativas</label>
                          {draft.correctAnswer ? (
                            <span className="text-xs font-bold text-emerald-800">
                              Correta: <span className="tabular-nums">{draft.correctAnswer}</span>
                              {ansMeta.answerSource === "gabarito" ? " · do gabarito" : ansMeta.answerSource === "llm" ? " · inferida pela IA" : ansMeta.answerSource === "manual" ? " · manual" : ""}
                            </span>
                          ) : null}
                        </div>

                        {!draft.correctAnswer && (
                          <div className="rounded-2xl border border-rose-200/90 bg-rose-50/90 px-4 py-3 text-sm font-semibold leading-snug text-rose-950 shadow-sm">
                            Nenhuma resposta foi identificada no gabarito para esta questão. Selecione a alternativa correta abaixo (será salva como resposta manual).
                          </div>
                        )}

                        <fieldset className="min-w-0 rounded-2xl border border-black/[0.06] bg-white/90 p-4 shadow-sm">
                          <legend className="float-left w-full px-0 text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                            Marcar resposta correta
                          </legend>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {draft.alternatives.map((alt) => {
                              const letter = String(alt.letter ?? "").trim().toUpperCase().slice(0, 1);
                              const sel = draft.correctAnswer?.toUpperCase() === letter;
                              return (
                                <label
                                  key={`${q.id}-corr-${letter}`}
                                  className={cn(
                                    "inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition-colors",
                                    sel
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-300/80"
                                      : "border-black/[0.08] bg-white text-[var(--text-secondary)] hover:bg-slate-50",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    className="h-4 w-4 accent-emerald-600"
                                    name={`correct-${q.id}`}
                                    checked={sel}
                                    onChange={() => {
                                      setDrafts((prev) => {
                                        const cur = prev[q.id];
                                        if (!cur) return prev;
                                        const rawText = mergeRawTextPatch(cur.rawText, {
                                          answerSource: "manual",
                                          gabaritoMatchNumber: null,
                                        });
                                        return { ...prev, [q.id]: { ...cur, correctAnswer: letter, rawText } };
                                      });
                                    }}
                                  />
                                  {letter}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>

                        <div className="space-y-4">
                          {draft.alternatives.map((alt, altIdx) => {
                            const letter = String(alt.letter ?? "").trim().toUpperCase().slice(0, 1);
                            const isCorrect = draft.correctAnswer?.toUpperCase() === letter;
                            return (
                              <div
                                key={`${q.id}:${alt.letter}:${altIdx}`}
                                className={cn(
                                  "grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-2xl sm:gap-4",
                                  isCorrect && "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-white",
                                )}
                              >
                                <input
                                  className="input w-full min-w-0 shrink-0 text-center text-sm font-bold"
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
                                  className={cn(
                                    "input min-h-[80px] w-full min-w-0 resize-y break-words text-sm leading-relaxed",
                                    isCorrect && "border-emerald-300/80 bg-emerald-50/40",
                                  )}
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
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
                      <div className="rounded-2xl border border-black/[0.06] bg-slate-50/90 p-4 shadow-sm sm:p-5">
                        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Ações principais</h3>
                        <div className="mt-4 flex flex-col gap-2.5">
                          <button
                            type="button"
                            className="btn btn-primary inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-md"
                            onClick={() => saveQuestion(q.id)}
                          >
                            <Save className="h-4 w-4 shrink-0" /> Salvar questão
                          </button>
                        </div>
                        <h4 className="mt-5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Ferramentas</h4>
                        <div className="mt-2 flex flex-col gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.08] bg-white px-3 text-sm font-semibold"
                            onClick={() => duplicateQuestion(q.id)}
                          >
                            <Copy className="h-4 w-4 shrink-0" /> Duplicar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-black/[0.08] bg-white px-3 text-sm font-semibold"
                            onClick={() => splitQuestionAuto(q.id)}
                          >
                            Dividir (auto)
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-black/[0.08] bg-white px-3 text-sm font-semibold"
                            onClick={() => mergeWithNext(q.id)}
                          >
                            Unir c/ próxima
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-black/[0.08] bg-white px-3 text-sm font-semibold"
                            onClick={() => markNeedsReview(q.id)}
                          >
                            Marcar p/ revisão
                          </button>
                          <button
                            type="button"
                            className="btn inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-800 hover:bg-red-100/80"
                            onClick={() => deleteQuestion(q.id)}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" /> Excluir
                          </button>
                        </div>
                      </div>

                      <PdfQuestionLinkAssets
                        importId={id}
                        questionId={q.id}
                        assets={linkedAssets}
                        onRefresh={refreshImport}
                        onOpenLinkText={() => {
                          setSelectedQ(q.id);
                          setDrawerLinkType("TEXT");
                          setDrawerOpen(true);
                        }}
                        onOpenLinkImage={() => {
                          setSelectedQ(q.id);
                          setDrawerLinkType("IMAGE");
                          setDrawerOpen(true);
                        }}
                      />

                      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-4 shadow-sm sm:p-5">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-800">IA</h3>
                        <p className="mt-1 text-xs leading-relaxed text-violet-900/80">Selecione no PDF o bloco das alternativas para extrair A–E automaticamente.</p>
                        <button
                          type="button"
                          className="btn btn-primary mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl text-sm font-bold shadow-md"
                          onClick={() => {
                            setSelectedQ(q.id);
                            setAltDrawerOpen(true);
                          }}
                        >
                          Identificar alternativas
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {filteredQuestions.length > visibleCount && (
        <div className="rounded-2xl border border-dashed border-black/[0.1] bg-white/80 p-4 text-center shadow-sm">
          <button
            type="button"
            className="btn btn-ghost inline-flex min-h-[44px] w-full max-w-md items-center justify-center rounded-2xl border border-black/[0.08] text-sm font-bold"
            onClick={() => setVisibleCount((n) => n + 60)}
          >
            Mostrar mais (+60)
          </button>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Listas longas carregam aos poucos para manter a página fluida.</p>
        </div>
      )}

      {imp.importedQuestions.length === 0 && (
        <div className="orbit-empty-state">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
          <p className="text-base font-medium text-[var(--text-secondary)]">Nenhuma questão extraída nesta importação</p>
        </div>
      )}

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
    </div>
  );
}
