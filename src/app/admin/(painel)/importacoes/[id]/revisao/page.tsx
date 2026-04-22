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
import {
  analyzeEnunciadoHeuristic,
  isQuestionVinculoComplete,
  mergeDependencyOr,
} from "@/lib/import/enunciado-dependency-core";

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
  meta?: AiMetaBlock | null;
  /** Matéria da seção no PDF (anunciada antes do bloco de questões). */
  materia?: string | null;
} | null {
  if (!rawText) return null;
  try {
    const parsed = JSON.parse(rawText) as { number?: unknown; commentary?: unknown; meta?: AiMetaBlock; materia?: unknown };
    const m = parsed.meta && typeof parsed.meta === "object" ? parsed.meta : null;
    return {
      number: typeof parsed.number === "number" ? parsed.number : null,
      commentary: typeof parsed.commentary === "string" ? parsed.commentary : null,
      meta: m,
      materia: typeof parsed.materia === "string" ? parsed.materia.trim() : null,
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
  /** Matéria inferida para esta questão (seção no PDF antes do bloco). Tem prioridade sobre cadastro/meta global. */
  materiaDaQuestao?: string | null,
): ImportMetaRow {
  const examBoardLabel = imp.examBoard
    ? [imp.examBoard.acronym, imp.examBoard.name].filter(Boolean).join(" · ")
    : "";
  const cityLabel = imp.city ? `${imp.city.name} · ${imp.city.state}` : "";
  const yearStr = imp.year != null ? String(imp.year) : "";
  const anoAi = ai?.ano != null && ai.ano !== "" ? String(ai.ano) : "";
  const sec = materiaDaQuestao?.trim();
  const materiaLinha =
    sec ||
    imp.subject?.name?.trim() ||
    (typeof ai?.materia === "string" ? ai.materia.trim() : "") ||
    "";

  return {
    banca: examBoardLabel || (typeof ai?.banca === "string" ? ai.banca.trim() : "") || "",
    materia: materiaLinha,
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

/** Página 1-based no PDF para abrir direto na questão (vínculos / identificar alternativas) */
function resolvePdfStartPageForQuestion(q: ImportedQ, assets: ImportAssetDTO[] | undefined): number {
  const sp = q.sourcePage;
  if (typeof sp === "number" && sp >= 1 && Number.isFinite(sp)) return Math.floor(sp);
  const pages = (assets ?? [])
    .filter((a) => (a.questionLinks ?? []).some((l) => l.importedQuestionId === q.id))
    .map((a) => a.page);
  if (pages.length) return Math.min(...pages);
  return 1;
}

function linkFlagsForQuestion(assets: ImportAssetDTO[] | undefined, qid: string) {
  const linked = (assets ?? []).filter((a) => (a.questionLinks ?? []).some((l) => l.importedQuestionId === qid));
  return {
    hasTextBlockLink: linked.some((a) => a.kind === "TEXT_BLOCK"),
    hasFigureImageLink: linked.some((a) => a.kind === "IMAGE"),
  };
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
  const [linkDrawerStartPage, setLinkDrawerStartPage] = useState(1);
  const [altDrawerOpen, setAltDrawerOpen] = useState(false);
  const [altDrawerStartPage, setAltDrawerStartPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(60);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [llmById, setLlmById] = useState<Record<string, { needsTextSupport: boolean; needsFigure: boolean }> | null>(null);
  const [llmAnalyzed, setLlmAnalyzed] = useState(false);
  const textDrawerAutoOpened = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    if (!imp?.id) return;
    if (!imp.importedQuestions.length) {
      setLlmById({});
      setLlmAnalyzed(true);
      return;
    }
    setLlmAnalyzed(false);
    const items = imp.importedQuestions.map((q) => ({ id: q.id, content: q.content ?? "" }));
    let cancelled = false;
    fetch("/api/admin/imports/analyze-enunciado-dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.llm && typeof d.llm === "object") setLlmById(d.llm);
        else setLlmById({});
        setLlmAnalyzed(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLlmById({});
          setLlmAnalyzed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imp?.id, imp?.importedQuestions.length]);

  const mergedDepByQuestion = useMemo(() => {
    if (!imp) return {} as Record<string, ReturnType<typeof mergeDependencyOr>>;
    const o: Record<string, ReturnType<typeof mergeDependencyOr>> = {};
    for (const q of imp.importedQuestions) {
      const c = drafts[q.id]?.content ?? q.content;
      o[q.id] = mergeDependencyOr(analyzeEnunciadoHeuristic(c), llmById?.[q.id] ?? null);
    }
    return o;
  }, [imp, drafts, llmById]);

  const reviewSaveBlock = useMemo(() => {
    if (!imp) return { blocked: false, hint: "" as string };
    const assets = imp.importAssets ?? [];
    for (const [qid, dec] of Object.entries(decisions)) {
      if (dec !== "approve") continue;
      const c = drafts[qid]?.content ?? imp.importedQuestions.find((q) => q.id === qid)?.content ?? "";
      const dep = mergeDependencyOr(analyzeEnunciadoHeuristic(c), llmById?.[qid] ?? null);
      const { hasTextBlockLink, hasFigureImageLink } = linkFlagsForQuestion(assets, qid);
      if (!isQuestionVinculoComplete(dep, hasTextBlockLink, hasFigureImageLink).ok) {
        return {
          blocked: true,
          hint: "Há questões aprovadas sem vínculo obrigatório no PDF. Corrija ou mude a decisão antes de salvar.",
        };
      }
    }
    return { blocked: false, hint: "" };
  }, [imp, decisions, drafts, llmById]);

  function selectAll(action: "approve" | "reject") {
    if (!imp) return;
    if (action === "reject") {
      const d: Record<string, Decision> = {};
      imp.importedQuestions.forEach((q) => { d[q.id] = "reject"; });
      setDecisions(d);
      return;
    }
    const assets = imp.importAssets ?? [];
    let skipped = 0;
    const next: Record<string, Decision> = { ...decisions };
    for (const q of imp.importedQuestions) {
      const c = drafts[q.id]?.content ?? q.content;
      const dep = mergeDependencyOr(analyzeEnunciadoHeuristic(c), llmById?.[q.id] ?? null);
      const { hasTextBlockLink, hasFigureImageLink } = linkFlagsForQuestion(assets, q.id);
      if (isQuestionVinculoComplete(dep, hasTextBlockLink, hasFigureImageLink).ok) {
        next[q.id] = "approve";
      } else {
        skipped += 1;
      }
    }
    setDecisions(next);
    if (skipped) {
      toast.info(`${skipped} questão(ões) exigem vínculo (texto/imagem no PDF) e não foram aprovadas automaticamente.`);
    }
  }

  function setQuestionDecision(qid: string, next: Decision) {
    if (next === "pending" || next === "reject" || !imp) {
      setDecisions((p) => ({ ...p, [qid]: next }));
      return;
    }
    const c = drafts[qid]?.content ?? imp.importedQuestions.find((q) => q.id === qid)?.content ?? "";
    const dep = mergeDependencyOr(analyzeEnunciadoHeuristic(c), llmById?.[qid] ?? null);
    const { hasTextBlockLink, hasFigureImageLink } = linkFlagsForQuestion(imp.importAssets, qid);
    const g = isQuestionVinculoComplete(dep, hasTextBlockLink, hasFigureImageLink);
    if (!g.ok) {
      const msgs: string[] = [];
      if (g.missing.includes("image")) msgs.push("Precisa vincular imagem");
      if (g.missing.includes("text")) msgs.push("Precisa vincular texto de apoio no PDF");
      toast.error(msgs.join(" · "));
      return;
    }
    setDecisions((p) => ({ ...p, [qid]: "approve" }));
  }

  async function saveReview() {
    if (!imp) return;
    if (reviewSaveBlock.blocked) {
      toast.error(reviewSaveBlock.hint);
      return;
    }
    const decided = Object.entries(decisions)
      .filter(([, d]) => d !== "pending")
      .map(([qId, action]) => ({ questionId: qId, action, subjectId: subjectMap[qId] || undefined }));
    if (decided.length === 0) {
      toast.info("Nada para integrar: marque questões como aprovar ou rejeitar (pendentes permanecem na revisão).");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/imports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisions: decided }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      importStatus?: "REVIEW_PENDING" | "COMPLETED";
      stillInReview?: number;
    };
    if (res.ok) {
      await refreshImport();
      if (data.importStatus === "REVIEW_PENDING" || (data.stillInReview != null && data.stillInReview > 0)) {
        toast.success("Questões aprovadas enviadas ao banco. Continue a revisão ou salve de novo depois.");
      } else {
        toast.success("Revisão concluída para esta importação.");
        router.push("/admin/importacoes");
      }
    } else {
      toast.error(data.error?.trim() || "Erro ao salvar revisão");
    }
    setSaving(false);
  }

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
    let materiaSec: string | null = null;
    for (const q of imp.importedQuestions) {
      const m = parseAiMeta(q.rawText)?.materia;
      if (m) {
        materiaSec = m;
        break;
      }
    }
    return buildImportMetaDisplay(imp, aiMeta, materiaSec);
  }, [imp]);

  const filteredQuestions = useMemo(() => {
    const all = imp?.importedQuestions ?? [];
    const base = onlyNeedsReview
      ? all.filter((q) => {
          if (computeReviewWarnings(drafts[q.id] ?? q).length > 0) return true;
          const dep = mergedDepByQuestion[q.id];
          if (!dep) return false;
          const f = linkFlagsForQuestion(imp?.importAssets, q.id);
          return !isQuestionVinculoComplete(dep, f.hasTextBlockLink, f.hasFigureImageLink).ok;
        })
      : all;
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
      const rowHay = [
        ai?.materia ?? "",
        m?.banca ?? "",
        m?.materia ?? "",
        m?.concurso ?? "",
        m?.cargo ?? "",
        m?.ano ?? "",
        m?.city ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const hay = `${idx + 1} ${num} ${d.content ?? ""} ${metaHay} ${rowHay}`.toLowerCase();
      return hay.includes(s);
    });
  }, [onlyNeedsReview, imp?.importedQuestions, imp?.importAssets, drafts, search, globalMetaDisplay, mergedDepByQuestion]);

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
    post("H-page-gutter", "page-shell", document.querySelector("[data-review-page-shell]"));
  }, [imp?.id, loading, filteredQuestions.length]);

  if (loading || !imp) {
    return (
      <div
        className="orbit-stack mx-auto w-full max-w-[min(1200px,100%)] px-4 py-16 text-center sm:px-6 lg:px-8"
        data-review-page-shell
      >
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-violet-200 border-t-violet-600"
          aria-hidden
        />
        <p className="mt-4 text-sm font-medium text-[var(--text-muted)]">Carregando revisão…</p>
      </div>
    );
  }

  return (
    <div
      className="orbit-stack mx-auto w-full max-w-[min(1200px,100%)] px-4 pb-10 sm:px-6 lg:px-8"
      data-review-page-shell
    >
      <TopBar
        title={`Revisão: ${imp.originalFilename}`}
        subtitle={
          [imp.competition?.name, imp.year != null ? String(imp.year) : null].filter(Boolean).join(" · ") || null
        }
        onApproveAll={() => selectAll("approve")}
        onRejectAll={() => selectAll("reject")}
        onSave={saveReview}
        saving={saving}
        saveDisabled={reviewSaveBlock.blocked}
        saveHint={reviewSaveBlock.blocked ? reviewSaveBlock.hint : undefined}
      />

      <StatsRow total={imp.importedQuestions.length} approved={approved} rejected={rejected} pending={pending} />

      {!llmAnalyzed && (
        <p className="text-center text-xs font-semibold text-violet-700">Refinando análise dos enunciados com IA…</p>
      )}

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
          const questionContext = buildImportMetaDisplay(imp, aiMeta?.meta ?? null, aiMeta?.materia ?? null);
          const metaFields = [
            { key: "Banca", value: questionContext.banca },
            { key: "Concurso", value: questionContext.concurso },
            { key: "Ano", value: questionContext.ano },
            { key: "Matéria", value: questionContext.materia },
            { key: "Cargo", value: questionContext.cargo },
          ];
          const dep = mergedDepByQuestion[q.id];
          const { hasTextBlockLink, hasFigureImageLink } = linkFlagsForQuestion(imp.importAssets, q.id);
          const vComplete = dep
            ? isQuestionVinculoComplete(dep, hasTextBlockLink, hasFigureImageLink)
            : { ok: true, missing: [] as Array<"text" | "image"> };
          const depNeedsImage = Boolean(dep?.needsFigure && !hasFigureImageLink);
          const depNeedsText = Boolean(dep?.needsTextSupport && !hasTextBlockLink);
          const vinculoIncomplete = Boolean(dep && !vComplete.ok);

          const openExpand = (fromAutoText: boolean) => {
            setSelectedQ(q.id);
            const willExpand = !isExpanded;
            setExpanded((prev) => ({ ...prev, [q.id]: willExpand }));
            if (fromAutoText && willExpand) {
              const depM = mergedDepByQuestion[q.id];
              const f = linkFlagsForQuestion(imp.importAssets, q.id);
              if (depM?.needsTextSupport && !f.hasTextBlockLink && !textDrawerAutoOpened.current.has(q.id)) {
                textDrawerAutoOpened.current.add(q.id);
                setLinkDrawerStartPage(resolvePdfStartPageForQuestion(drafts[q.id] ?? q, imp.importAssets));
                setDrawerLinkType("TEXT");
                setDrawerOpen(true);
              }
            }
          };

          return (
            <article
              key={q.id}
              data-review-card={isFirstVisible ? "" : undefined}
              className={cn(
                "min-w-0 rounded-[var(--r-3xl)] border border-black/[0.08] bg-gradient-to-br from-white to-[#fafafd] shadow-[var(--shadow-card)] transition-shadow",
                vinculoIncomplete && "ring-2 ring-rose-400/85",
                !vinculoIncomplete && d === "approve" && "ring-2 ring-emerald-300/50",
                !vinculoIncomplete && d === "reject" && "ring-2 ring-red-300/50",
                !vinculoIncomplete && d === "pending" && warnings.length > 0 && "ring-2 ring-amber-200/70",
              )}
            >
              <div className="border-b border-black/[0.06] bg-gradient-to-b from-slate-50/40 to-transparent p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="inline-flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center rounded-2xl bg-violet-600 px-3 text-base font-black text-white shadow-md">
                        {qi}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <button
                          type="button"
                          className="w-full break-words text-left text-lg font-extrabold tracking-tight text-[var(--text-primary)] underline-offset-4 hover:text-violet-700 hover:underline sm:text-xl"
                          onClick={() => openExpand(true)}
                        >
                          Questão {qi}
                          {aiMeta?.number != null ? ` · Nº ${aiMeta.number}` : ""}
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1",
                            d === "approve" && "bg-emerald-100 text-emerald-900 ring-emerald-200/90",
                            d === "reject" && "bg-red-100 text-red-900 ring-red-200/90",
                            d === "pending" && "bg-slate-100 text-slate-800 ring-slate-200/90",
                          )}
                        >
                          {d === "approve" ? "Aprovada na revisão" : d === "reject" ? "Rejeitada" : "Pendente de decisão"}
                        </span>
                        {warnings.length > 0 && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-amber-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-amber-900 ring-1 ring-amber-200/80 whitespace-normal">
                            Revisão recomendada
                          </span>
                        )}
                        {depNeedsImage && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-rose-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-rose-900 ring-1 ring-rose-300/90 whitespace-normal">
                            Precisa vincular imagem
                          </span>
                        )}
                        {depNeedsText && (
                          <span className="inline-flex max-w-full items-center rounded-full bg-orange-100 px-2.5 py-1.5 text-[11px] font-extrabold leading-snug text-orange-950 ring-1 ring-orange-200/90 whitespace-normal">
                            Precisa vincular texto de apoio
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
                      vinculoIncomplete && d !== "approve" && "opacity-55",
                    )}
                    onClick={() => {
                      if (d === "approve") setDecisions((prev) => ({ ...prev, [q.id]: "pending" }));
                      else setQuestionDecision(q.id, "approve");
                    }}
                    title={vinculoIncomplete ? "Vincule no PDF o texto/imagem exigidos pelo enunciado" : "Aprovar"}
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
                    onClick={() => openExpand(true)}
                    title={isExpanded ? "Recolher" : "Editar"}
                  >
                    <Pencil className="h-4 w-4" />
                    {isExpanded ? "Recolher" : "Editar"}
                  </button>
                </div>
              </div>
              </div>

              {isExpanded && (
                <div className="border-t border-black/[0.06] bg-white/60 px-5 py-8 sm:px-8 sm:py-10">
                  {vinculoIncomplete && (
                    <div className="mb-8 rounded-2xl border border-rose-300/90 bg-rose-50 p-5 text-sm text-rose-950 shadow-sm sm:p-6">
                      <div className="text-base font-extrabold tracking-tight">Vínculos obrigatórios (enunciado)</div>
                      <p className="mt-2 space-y-1.5 font-semibold leading-relaxed">
                        {depNeedsImage ? <span className="block">Precisa vincular imagem (figura, gráfico, tabela, mapa, charge, etc.) no painel à direita.</span> : null}
                        {depNeedsText ? <span className="block">Precisa vincular texto de apoio no PDF.</span> : null}
                      </p>
                    </div>
                  )}
                  <div className="mb-8 rounded-2xl border border-violet-100/90 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-sm sm:p-6">
                    <h3 className="text-sm font-extrabold tracking-tight text-violet-950">Metadados da questão</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Cadastro + inferência da IA. Matéria: título de seção no PDF (costuma vir antes do bloco de questões da disciplina). Campos vazios: “—”.
                    </p>
                    <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      {metaFields.map(({ key, value }) => {
                        const show = value?.trim();
                        return (
                          <div
                            key={`${q.id}-meta-${key}`}
                            className="flex min-h-[4.25rem] min-w-0 flex-col justify-center rounded-xl border border-black/[0.06] bg-white/90 px-4 py-3 shadow-sm"
                          >
                            <dt className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">{key}</dt>
                            <dd
                              className={cn(
                                "mt-1.5 break-words text-sm font-semibold leading-snug",
                                show ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]",
                              )}
                            >
                              {show || "—"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>

                  {warnings.length > 0 && (
                    <div className="mb-8 rounded-2xl border border-amber-200/90 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm sm:p-6">
                      <div className="text-base font-extrabold tracking-tight">Pontos de atenção</div>
                      <ul className="mt-4 list-disc space-y-2.5 break-words pl-5 leading-relaxed">
                        {warnings.map((w, i) => (
                          <li key={`${q.id}-w-${i}`}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-12">
                    <div className="min-w-0 flex-1 space-y-10">
                      <section className="space-y-4">
                        <label className="orbit-form-label text-base">Enunciado</label>
                        <textarea
                          className="input min-h-[220px] w-full min-w-0 resize-y break-words text-sm leading-relaxed"
                          value={draft.content}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, content: e.target.value } }))}
                        />
                      </section>

                      <section className="space-y-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <h3 className="text-base font-extrabold tracking-tight text-[var(--text-primary)]">Alternativas</h3>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">Marque a opção correta ao lado de cada letra. O cartão da alternativa correta fica destacado.</p>
                          </div>
                          {draft.correctAnswer ? (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200/80">
                              Resposta: <span className="tabular-nums">{draft.correctAnswer}</span>
                              {ansMeta.answerSource === "gabarito"
                                ? " · gabarito"
                                : ansMeta.answerSource === "llm"
                                  ? " · IA"
                                  : ansMeta.answerSource === "manual"
                                    ? " · manual"
                                    : ""}
                            </span>
                          ) : null}
                        </div>

                        {!draft.correctAnswer && (
                          <div className="rounded-2xl border border-rose-200/90 bg-rose-50/90 px-4 py-3.5 text-sm font-medium leading-snug text-rose-950 shadow-sm">
                            Nenhuma resposta automática para esta questão. Marque a alternativa correta nos cartões abaixo (fica registrado como manual).
                          </div>
                        )}

                        <div className="space-y-5">
                          {draft.alternatives.map((alt, altIdx) => {
                            const letter = String(alt.letter ?? "").trim().toUpperCase().slice(0, 1);
                            const isCorrect = draft.correctAnswer?.toUpperCase() === letter;
                            return (
                              <div
                                key={`${q.id}:${alt.letter}:${altIdx}`}
                                className={cn(
                                  "rounded-2xl border bg-white p-4 shadow-sm transition-shadow sm:p-5",
                                  isCorrect
                                    ? "border-emerald-300/90 ring-1 ring-emerald-200/70"
                                    : "border-black/[0.07]",
                                )}
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
                                  <div className="flex shrink-0 flex-row items-center gap-4 lg:w-44 lg:flex-col lg:items-stretch lg:justify-center lg:gap-3">
                                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-black/[0.06] bg-slate-50/80 px-3 py-2.5 lg:w-full lg:justify-center">
                                      <input
                                        type="radio"
                                        className="h-4 w-4 shrink-0 accent-emerald-600"
                                        name={`correct-${q.id}`}
                                        checked={isCorrect}
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
                                      <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--text-muted)]">Correta</span>
                                    </label>
                                    <div className="flex flex-1 flex-col gap-1 lg:flex-initial">
                                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Letra</span>
                                      <input
                                        className="input h-11 w-14 text-center text-base font-black"
                                        value={alt.letter}
                                        onChange={(e) => {
                                          const v = e.target.value.toUpperCase();
                                          setDrafts((prev) => {
                                            const nextAlts = draft.alternatives.map((a, i) => (i === altIdx ? { ...a, letter: v } : a));
                                            return { ...prev, [q.id]: { ...draft, alternatives: nextAlts } };
                                          });
                                        }}
                                      />
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Texto da alternativa</span>
                                    <textarea
                                      className="input min-h-[100px] w-full min-w-0 resize-y break-words text-sm leading-relaxed"
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      <section className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-md sm:p-6">
                        <h3 className="text-sm font-extrabold tracking-tight text-violet-900">Extrair alternativas com IA</h3>
                        <p className="mt-2 max-w-prose text-sm leading-relaxed text-violet-900/85">
                          Selecione no PDF o bloco onde estão as alternativas (A–E) para preencher ou corrigir os textos automaticamente.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl px-5 text-sm font-extrabold shadow-md sm:w-auto"
                          onClick={() => {
                            setSelectedQ(q.id);
                            setAltDrawerStartPage(
                              resolvePdfStartPageForQuestion(drafts[q.id] ?? q, imp?.importAssets),
                            );
                            setAltDrawerOpen(true);
                          }}
                        >
                          Identificar alternativas no PDF
                        </button>
                      </section>
                    </div>

                    <aside className="w-full shrink-0 space-y-8 xl:sticky xl:top-6 xl:w-[400px] xl:max-w-[400px] xl:self-start">
                      <div className="rounded-2xl border border-black/[0.08] bg-slate-50/95 p-5 shadow-sm sm:p-6">
                        <h3 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">Ações da questão</h3>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Salve antes de sair. Ferramentas alteram esta importação.</p>
                        <div className="mt-5 flex flex-col gap-3">
                          <button
                            type="button"
                            className="btn btn-primary inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold shadow-md"
                            onClick={() => saveQuestion(q.id)}
                          >
                            <Save className="h-4 w-4 shrink-0" /> Salvar questão
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.1] bg-white px-4 text-sm font-semibold shadow-sm"
                            onClick={() => duplicateQuestion(q.id)}
                          >
                            <Copy className="h-4 w-4 shrink-0" /> Duplicar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-black/[0.1] bg-white px-4 text-sm font-semibold shadow-sm"
                            onClick={() => splitQuestionAuto(q.id)}
                          >
                            Dividir (auto)
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-black/[0.1] bg-white px-4 text-sm font-semibold shadow-sm"
                            onClick={() => mergeWithNext(q.id)}
                          >
                            Unir com a próxima
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-black/[0.1] bg-white px-4 text-sm font-semibold shadow-sm"
                            onClick={() => markNeedsReview(q.id)}
                          >
                            Marcar para revisão
                          </button>
                          <button
                            type="button"
                            className="btn inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-extrabold text-red-800 hover:bg-red-100/80"
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
                          setLinkDrawerStartPage(
                            resolvePdfStartPageForQuestion(drafts[q.id] ?? q, imp?.importAssets),
                          );
                          setDrawerLinkType("TEXT");
                          setDrawerOpen(true);
                        }}
                        onOpenLinkImage={() => {
                          setSelectedQ(q.id);
                          setLinkDrawerStartPage(
                            resolvePdfStartPageForQuestion(drafts[q.id] ?? q, imp?.importAssets),
                          );
                          setDrawerLinkType("IMAGE");
                          setDrawerOpen(true);
                        }}
                      />
                    </aside>
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
        initialPage={linkDrawerStartPage}
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
        initialPage={altDrawerStartPage}
      />
    </div>
  );
}
