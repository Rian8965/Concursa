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
  getDependencyBlockUserMessage,
  mergeDependencyOr,
} from "@/lib/import/enunciado-dependency-core";
import {
  alternativasVisuaisAtivas,
  detectLikelyVisualAlternatives,
  getExtendedLinkFlags,
  isVinculoSatisfiedForReview,
  mergeReviewIntoRawText,
  missingAlternativeImageLinks,
  parseImportRawText,
} from "@/lib/import/review-flags";
import {
  isImportedQuestionMetaComplete,
  metaMissingLabels,
} from "@/lib/import/imported-question-meta";
import type { ImportContextMeta } from "@/lib/import/imported-question-meta";
import {
  coerceMetaYear,
  matchExamBoardBancaToId,
  matchSubjectNameToId,
} from "@/lib/import/import-meta-match";

// PDF viewer é encapsulado em `VisualizadorPDF` (dinâmico internamente).

type DifficultyChoice = "EASY" | "MEDIUM" | "HARD";

interface ImportedQ {
  id: string;
  content: string;
  alternatives: { letter: string; content: string }[];
  correctAnswer?: string | null;
  suggestedSubjectId?: string | null;
  suggestedTopicId?: string | null;
  year?: number | null;
  examBoardId?: string | null;
  competitionId?: string | null;
  cityId?: string | null;
  jobRoleId?: string | null;
  difficulty?: DifficultyChoice;
  tags?: string[];
  sourcePage?: number | null;
  confidence?: number | null;
  status: string;
  rawText?: string | null;
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

type SubjectOption = { id: string; name: string; slug: string };
type ExamBoardOption = { id: string; name: string; acronym: string };

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
  examBoardId?: string | null;
  competitionId?: string | null;
  cityId?: string | null;
  jobRoleId?: string | null;
  subjectId?: string | null;
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

function canApproveImportQuestion(
  imp: ImportData,
  drafts: Record<string, ImportedQ>,
  llmById: Record<string, { needsTextSupport: boolean; needsFigure: boolean }> | null,
  qid: string,
): { ok: true } | { ok: false; message: string } {
  const draft = drafts[qid];
  if (!draft) return { ok: false, message: "Rascunho indisponível" };
  const c = draft.content ?? "";
  const dep = mergeDependencyOr(analyzeEnunciadoHeuristic(c), llmById?.[qid] ?? null);
  const { review } = parseImportRawText(draft.rawText);
  const ext = getExtendedLinkFlags(imp.importAssets, qid);
  const vg = isVinculoSatisfiedForReview(
    dep.needsTextSupport,
    dep.needsFigure,
    ext.hasTextBlockLink,
    ext.hasMainImageLink,
    review,
  );
  if (!vg.ok) {
    return { ok: false, message: getDependencyBlockUserMessage(vg.missing) };
  }
  const alts = draft.alternatives ?? [];
  const heurVis = detectLikelyVisualAlternatives(alts);
  if (alternativasVisuaisAtivas(review, heurVis)) {
    const letters = alts.map((a) => a.letter.trim().toUpperCase().slice(0, 1));
    const hasBy: Record<string, boolean> = {};
    for (const L of letters) {
      if (L) hasBy[L] = Boolean(ext.altImageByLetter[L]);
    }
    const miss = missingAlternativeImageLinks(letters, hasBy);
    if (miss.length) {
      return { ok: false, message: `Faltam recortes nas alternativas: ${miss.join(", ")}` };
    }
  }
  const importCtx: ImportContextMeta = {
    year: imp.year ?? null,
    examBoardId: imp.examBoardId ?? null,
    competitionId: imp.competitionId ?? null,
    cityId: imp.cityId ?? null,
    jobRoleId: imp.jobRoleId ?? null,
    subjectId: imp.subjectId ?? null,
  };
  const diff = (draft.difficulty === "EASY" || draft.difficulty === "MEDIUM" || draft.difficulty === "HARD"
    ? draft.difficulty
    : "MEDIUM") as "EASY" | "MEDIUM" | "HARD";
  const metaOk = isImportedQuestionMetaComplete(
    {
      suggestedSubjectId: draft.suggestedSubjectId ?? null,
      suggestedTopicId: draft.suggestedTopicId ?? null,
      year: draft.year ?? null,
      examBoardId: draft.examBoardId ?? null,
      competitionId: draft.competitionId ?? null,
      cityId: draft.cityId ?? null,
      jobRoleId: draft.jobRoleId ?? null,
      difficulty: diff,
      tags: draft.tags ?? [],
    },
    importCtx,
  );
  if (!metaOk.ok) {
    return {
      ok: false,
      message: `Metadados incompletos: ${metaMissingLabels(metaOk.missing).join(", ")}. Preencha e guarde a questão.`,
    };
  }
  return { ok: true };
}

export default function RevisaoImportacaoPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [imp, setImp] = useState<ImportData | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [examBoards, setExamBoards] = useState<ExamBoardOption[]>([]);
  const [competitions, setCompetitions] = useState<{ id: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string; state: string }[]>([]);
  const [jobRoles, setJobRoles] = useState<{ id: string; name: string }[]>([]);
  const [topicBySubject, setTopicBySubject] = useState<Record<string, { id: string; name: string }[]>>({});
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
  const [applyAlternativesMode, setApplyAlternativesMode] = useState(false);
  const [activeAltLetter, setActiveAltLetter] = useState("A");

  const refreshImport = useCallback(async () => {
    const impData = await fetch(`/api/admin/imports/${id}`).then((r) => r.json());
    setImp(impData.import);
  }, [id]);

  const patchImportedReview = useCallback(
    async (questionId: string, patch: Parameters<typeof mergeReviewIntoRawText>[1]) => {
      const d = drafts[questionId];
      if (!d) return;
      const nextRaw = mergeReviewIntoRawText(d.rawText, patch);
      const res = await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: nextRaw }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error?.trim() || "Erro ao guardar definição de revisão");
        return;
      }
      setDrafts((prev) => {
        const cur = prev[questionId];
        if (!cur) return prev;
        return { ...prev, [questionId]: { ...cur, rawText: nextRaw } };
      });
      await refreshImport();
    },
    [id, drafts, refreshImport],
  );

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/imports/${id}`).then((r) => r.json()),
      fetch("/api/admin/subjects").then((r) => r.json()),
      fetch("/api/admin/exam-boards").then((r) => r.json()),
      fetch("/api/admin/competitions?limit=500&page=1").then((r) => r.json()),
      fetch("/api/admin/cities").then((r) => r.json()),
      fetch("/api/admin/job-roles").then((r) => r.json()),
    ]).then(async ([impData, subData, eb, comp, cty, jr]) => {
      setImp(impData.import);
      const subList: SubjectOption[] = (subData.subjects ?? []).map((s: { id: string; name: string; slug: string }) => s);
      setSubjects(subList);
      const ebList: ExamBoardOption[] = eb.examBoards ?? [];
      setExamBoards(ebList);
      setCompetitions(comp.competitions ?? []);
      setCities(cty.cities ?? []);
      setJobRoles(jr.jobRoles ?? []);
      const imp = impData.import as ImportData;
      const initial: Record<string, Decision> = {};
      impData.import.importedQuestions.forEach((q: ImportedQ) => {
        initial[q.id] = q.status === "PUBLISHED" ? "approve" : q.status === "REJECTED" ? "reject" : "pending";
      });
      setDecisions(initial);
      setSelectedQ((prev) => prev || impData.import.importedQuestions?.[0]?.id || "");
      const ds: Record<string, ImportedQ> = {};
      impData.import.importedQuestions.forEach((q: ImportedQ) => {
        const d0 = (q.difficulty as DifficultyChoice) || "MEDIUM";
        ds[q.id] = {
          ...q,
          year: q.year ?? imp.year ?? null,
          examBoardId: q.examBoardId ?? imp.examBoardId ?? null,
          competitionId: q.competitionId ?? imp.competitionId ?? null,
          cityId: q.cityId ?? imp.cityId ?? null,
          jobRoleId: q.jobRoleId ?? imp.jobRoleId ?? null,
          difficulty: d0,
          tags: Array.isArray(q.tags) ? q.tags : [],
          alternatives: q.alternatives?.map((a) => ({ ...a })) ?? [],
        };
      });
      // #region agent log H-D
      fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'debug',hypothesisId:'H-D',location:'revisao/page.tsx:meta-loop-start',message:'before meta loop',data:{subListCount:subList.length,ebListCount:ebList.length,subListSample:subList.slice(0,3).map((s:{id:string;name:string;slug:string})=>({id:s.id,name:s.name,slug:s.slug})),questionsCount:(impData.import.importedQuestions??[]).length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      for (const q of impData.import.importedQuestions as ImportedQ[]) {
        const d = ds[q.id];
        if (!d) continue;
        const pm = parseAiMeta(d.rawText);
        const mStr = pm?.materia ?? (typeof pm?.meta?.materia === "string" ? pm.meta.materia : null);
        // #region agent log H-A H-B H-C
        if (q === (impData.import.importedQuestions as ImportedQ[])[0]) {
          const sug0 = parseSuggestedSubject(d.rawText);
          fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'debug',hypothesisId:'H-A',location:'revisao/page.tsx:q0-rawtext',message:'first question rawText analysis',data:{rawTextSnippet:(d.rawText??'').slice(0,400),pm_materia:pm?.materia,pm_meta_materia:pm?.meta?.materia,pm_meta_banca:pm?.meta?.banca,pm_meta_ano:pm?.meta?.ano,mStr,suggestedSubjectIdFromDB:d.suggestedSubjectId,examBoardIdFromDB:d.examBoardId,yearFromDB:d.year,suggestSubjectText:sug0?.subject,subListFirstNames:subList.slice(0,5).map((s:{name:string})=>s.name)},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion
        if (!d.suggestedSubjectId && mStr) {
          const sid = matchSubjectNameToId(mStr, subList);
          // #region agent log H-C
          if (q === (impData.import.importedQuestions as ImportedQ[])[0]) {
            fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'debug',hypothesisId:'H-C',location:'revisao/page.tsx:q0-match-materia',message:'matchSubjectNameToId result for materia',data:{mStr,matchedId:sid},timestamp:Date.now()})}).catch(()=>{});
          }
          // #endregion
          if (sid) d.suggestedSubjectId = sid;
        }
        if (!d.suggestedSubjectId) {
          const sug = parseSuggestedSubject(d.rawText);
          if (sug?.subject) {
            const sid = matchSubjectNameToId(sug.subject, subList);
            // #region agent log H-E
            if (q === (impData.import.importedQuestions as ImportedQ[])[0]) {
              fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'debug',hypothesisId:'H-E',location:'revisao/page.tsx:q0-match-suggestedsubject',message:'matchSubjectNameToId result for suggestedSubject',data:{sugText:sug.subject,matchedId:sid},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
            if (sid) d.suggestedSubjectId = sid;
          }
        }
        if (d.year == null && pm?.meta?.ano != null) {
          const y = coerceMetaYear(pm.meta.ano, imp.year ?? null);
          if (y != null) d.year = y;
        }
        if (!d.examBoardId) {
          const bancaTxt = typeof pm?.meta?.banca === "string" ? pm.meta.banca : null;
          if (bancaTxt) {
            const eid = matchExamBoardBancaToId(bancaTxt, ebList, imp.examBoardId ?? null);
            // #region agent log H-BANCA
            if (q === (impData.import.importedQuestions as ImportedQ[])[0]) {
              fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'post-fix',hypothesisId:'H-BANCA',location:'revisao/page.tsx:banca-match',message:'banca match',data:{bancaTxt,matchedEid:eid,ebListCount:ebList.length},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
            if (eid) d.examBoardId = eid;
          }
        }
      }
      setDrafts(ds);
      // #region agent log H-FINAL-DRAFT
      const firstQId = (impData.import.importedQuestions as ImportedQ[])[0]?.id;
      if (firstQId && ds[firstQId]) {
        const fd = ds[firstQId]!;
        fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'post-fix',hypothesisId:'H-FINAL-DRAFT',location:'revisao/page.tsx:final-draft',message:'first question final draft state',data:{suggestedSubjectId:fd.suggestedSubjectId,suggestedTopicId:fd.suggestedTopicId,examBoardId:fd.examBoardId,year:fd.year,competitionId:fd.competitionId,cityId:fd.cityId,jobRoleId:fd.jobRoleId,difficulty:fd.difficulty},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      const sids = new Set<string>();
      for (const q of impData.import.importedQuestions) {
        const sid = ds[q.id]?.suggestedSubjectId;
        if (sid) sids.add(sid);
      }
      if (sids.size > 0) {
        const topicEntries = await Promise.all(
          [...sids].map(async (subjectId) => {
            const r = await fetch(`/api/admin/topics?subjectId=${encodeURIComponent(subjectId)}`);
            const data = (await r.json()) as { topics?: { id: string; name: string }[] };
            return { subjectId, topics: r.ok && Array.isArray(data.topics) ? data.topics : [] };
          }),
        );
        setTopicBySubject((prev) => {
          const n = { ...prev };
          for (const t of topicEntries) n[t.subjectId] = t.topics;
          return n;
        });
      }
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
    for (const [qid, dec] of Object.entries(decisions)) {
      if (dec !== "approve") continue;
      const c = canApproveImportQuestion(imp, drafts, llmById, qid);
      if (!c.ok) {
        return {
          blocked: true,
          hint: "Há aprovações pendentes (vínculo no PDF, alternativas em imagem ou isenção). Ajuste antes de salvar.",
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
    let skipped = 0;
    const next: Record<string, Decision> = { ...decisions };
    for (const q of imp.importedQuestions) {
      if (canApproveImportQuestion(imp, drafts, llmById, q.id).ok) {
        next[q.id] = "approve";
      } else {
        skipped += 1;
      }
    }
    setDecisions(next);
    if (skipped) {
      toast.info(`${skipped} questão(ões) com pendências de revisão não foram aprovadas automaticamente.`);
    }
  }

  function setQuestionDecision(qid: string, next: Decision) {
    if (next === "pending" || next === "reject" || !imp) {
      setDecisions((p) => ({ ...p, [qid]: next }));
      return;
    }
    const c = canApproveImportQuestion(imp, drafts, llmById, qid);
    if (!c.ok) {
      toast.error(c.message);
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
      .map(([qId, action]) => {
        if (action === "reject") {
          return { questionId: qId, action: "reject" as const };
        }
        const dr = drafts[qId];
        if (!dr) {
          return { questionId: qId, action: "approve" as const };
        }
        const diff: DifficultyChoice =
          dr.difficulty === "EASY" || dr.difficulty === "MEDIUM" || dr.difficulty === "HARD" ? dr.difficulty : "MEDIUM";
        return {
          questionId: qId,
          action: "approve" as const,
          suggestedSubjectId: dr.suggestedSubjectId ?? null,
          suggestedTopicId: dr.suggestedTopicId ?? null,
          year: dr.year ?? null,
          examBoardId: dr.examBoardId ?? null,
          competitionId: dr.competitionId ?? null,
          cityId: dr.cityId ?? null,
          jobRoleId: dr.jobRoleId ?? null,
          difficulty: diff,
          tags: dr.tags ?? [],
        };
      });
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
    const { review: rSave } = parseImportRawText(d.rawText);
    const heurV = detectLikelyVisualAlternatives(d.alternatives ?? []);
    const visSave = alternativasVisuaisAtivas(rSave, heurV);
    // #region agent log
    fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-save-question',location:'revisao/page.tsx:saveQuestion',message:'saving imported question edits',data:{importId:id,questionId,contentLen:d.content?.length ?? 0,alts:d.alternatives?.length ?? 0,correctAnswer:d.correctAnswer ?? null,subjectId:d.suggestedSubjectId ?? ''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const res = await fetch(`/api/admin/imports/${id}/imported-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: d.content,
        alternatives: d.alternatives,
        correctAnswer: d.correctAnswer ?? null,
        suggestedSubjectId: d.suggestedSubjectId ?? null,
        suggestedTopicId: d.suggestedTopicId ?? null,
        year: d.year ?? null,
        examBoardId: d.examBoardId ?? null,
        competitionId: d.competitionId ?? null,
        cityId: d.cityId ?? null,
        jobRoleId: d.jobRoleId ?? null,
        difficulty: d.difficulty ?? "MEDIUM",
        tags: d.tags ?? [],
        sourcePage: d.sourcePage ?? null,
        confidence: d.confidence ?? null,
        rawText: d.rawText ?? null,
        allowEmptyAlternativeText: visSave,
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
        suggestedSubjectId: d.suggestedSubjectId || null,
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
        suggestedSubjectId: d.suggestedSubjectId || null,
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

  async function ensureTopics(subjectId: string) {
    if (!subjectId || topicBySubject[subjectId]) return;
    const r = await fetch(`/api/admin/topics?subjectId=${encodeURIComponent(subjectId)}`);
    const data = (await r.json()) as { topics?: { id: string; name: string }[] };
    if (r.ok && Array.isArray(data.topics)) {
      setTopicBySubject((prev) => ({ ...prev, [subjectId]: data.topics! }));
    }
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
          if (!imp) return false;
          return !canApproveImportQuestion(imp, drafts, llmById, q.id).ok;
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
  }, [onlyNeedsReview, imp, drafts, search, globalMetaDisplay, llmById]);

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
          const dep = mergedDepByQuestion[q.id];
          const { review: reviewFromDraft } = parseImportRawText(draft.rawText);
          const ext = getExtendedLinkFlags(imp.importAssets, q.id);
          const vg = isVinculoSatisfiedForReview(
            dep?.needsTextSupport ?? false,
            dep?.needsFigure ?? false,
            ext.hasTextBlockLink,
            ext.hasMainImageLink,
            reviewFromDraft,
          );
          const depNeedsImage = Boolean(
            dep?.needsFigure && !ext.hasMainImageLink && !reviewFromDraft.vinculoExcecao?.semImagem,
          );
          const depNeedsText = Boolean(
            dep?.needsTextSupport && !ext.hasTextBlockLink && !reviewFromDraft.vinculoExcecao?.semTexto,
          );
          const vinculoIncomplete = dep ? !vg.ok : false;
          const heurVis = detectLikelyVisualAlternatives(draft.alternatives ?? []);
          const visOn = alternativasVisuaisAtivas(reviewFromDraft, heurVis);
          const altLetters = (draft.alternatives ?? []).map((a) => a.letter.trim().toUpperCase().slice(0, 1));
          const hasByLetter: Record<string, boolean> = {};
          for (const L of altLetters) {
            if (L) hasByLetter[L] = Boolean(ext.altImageByLetter[L]);
          }
          const missAlts = visOn ? missingAlternativeImageLinks(altLetters, hasByLetter) : [];
          const altsPend = missAlts.length > 0;
          const cap = canApproveImportQuestion(imp, drafts, llmById, q.id);
          const anyPend = !cap.ok;
          const vExAtiva = Boolean(
            reviewFromDraft.vinculoExcecao?.semTexto && reviewFromDraft.vinculoExcecao?.semImagem,
          );

          const openExpand = (fromAutoText: boolean) => {
            setSelectedQ(q.id);
            setApplyAlternativesMode(false);
            const willExpand = !isExpanded;
            setExpanded((prev) => ({ ...prev, [q.id]: willExpand }));
            if (willExpand) {
              const sid = drafts[q.id]?.suggestedSubjectId;
              if (sid) void ensureTopics(sid);
            }
            if (fromAutoText && willExpand) {
              const depM = mergedDepByQuestion[q.id];
              const ex = getExtendedLinkFlags(imp.importAssets, q.id);
              if (depM?.needsTextSupport && !ex.hasTextBlockLink && !textDrawerAutoOpened.current.has(q.id)) {
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
                anyPend && "ring-2 ring-rose-400/85",
                !anyPend && d === "approve" && "ring-2 ring-emerald-300/50",
                !anyPend && d === "reject" && "ring-2 ring-red-300/50",
                !anyPend && d === "pending" && warnings.length > 0 && "ring-2 ring-amber-200/70",
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
                        {visOn && altsPend && (
                          <span className="inline-flex max-w-full items-center rounded-full border border-amber-200/90 bg-amber-50/90 px-2.5 py-1 text-[10px] font-bold leading-snug text-amber-950">
                            Alternativas em imagem: faltam {missAlts.join(", ")}
                          </span>
                        )}
                        {visOn && !altsPend && (draft.alternatives?.length ?? 0) > 0 && (
                          <span className="inline-flex max-w-full items-center rounded-full border border-slate-200/90 bg-slate-50/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                            Alts. visuais
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
                      anyPend && d !== "approve" && "opacity-55",
                    )}
                    onClick={() => {
                      if (d === "approve") setDecisions((prev) => ({ ...prev, [q.id]: "pending" }));
                      else setQuestionDecision(q.id, "approve");
                    }}
                    title={!cap.ok ? cap.message : "Aprovar"}
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
                  {(vinculoIncomplete || (visOn && altsPend)) && (
                    <div className="mb-6 space-y-3">
                      {vinculoIncomplete && (
                        <div className="rounded-2xl border border-rose-300/90 bg-rose-50/95 p-4 text-sm text-rose-950 shadow-sm sm:p-5">
                          <div className="text-sm font-extrabold tracking-tight">Vínculos obrigatórios (enunciado)</div>
                          <p className="mt-2 space-y-1.5 text-[13px] font-semibold leading-relaxed">
                            {depNeedsImage ? <span className="block">Ligue uma imagem (figura, gráfico, tabela, mapa, etc.) no painel à direita, ou use a isenção abaixo se não houver o que vincular.</span> : null}
                            {depNeedsText ? <span className="block">Ligue o texto de apoio no PDF, ou a isenção de vínculo abaixo se não fizer sentido.</span> : null}
                          </p>
                        </div>
                      )}
                      {visOn && altsPend && (
                        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs font-semibold text-amber-950 shadow-sm">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800/90">Alternativas visuais</span>
                          <p className="mt-1.5 leading-relaxed">Falta(m) recorte(s) de imagem para: {missAlts.join(", ")}. Use “Aplicar alternativas” ou o vínculo por letra no painel do PDF.</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-600">
                    <span className="w-full text-[9px] font-extrabold uppercase tracking-wider text-slate-400 sm:w-auto sm:pe-1">Revisão</span>
                    <button
                      type="button"
                      className="rounded-md px-1 py-0.5 text-[10px] font-semibold text-slate-500 underline decoration-slate-300/90 underline-offset-[3px] transition hover:text-violet-800"
                      title="Confirma manualmente que não é necessário vincular texto ou imagem do enunciado. Fica registrado com data."
                      onClick={() =>
                        void patchImportedReview(
                          q.id,
                          (vExAtiva
                            ? { vinculoExcecao: null }
                            : {
                                vinculoExcecao: { at: new Date().toISOString(), semTexto: true, semImagem: true },
                              }) as Parameters<typeof mergeReviewIntoRawText>[1],
                        )
                      }
                    >
                      {vExAtiva ? "Reativar exigência de vínculo" : "Não há texto/imagem a vincular"}
                    </button>
                    <span className="hidden sm:inline" aria-hidden>
                      ·
                    </span>
                    <button
                      type="button"
                      className="rounded-md px-1 py-0.5 text-[10px] font-semibold text-slate-500 underline decoration-slate-300/90 underline-offset-[3px] transition hover:text-violet-800"
                      title="Marca a questão como de alternativas em imagem (fórmulas, gráficos, etc.)"
                      onClick={() => {
                        const m = reviewFromDraft.alternativasVisuais?.revisorMarcou === true;
                        void patchImportedReview(q.id, { alternativasVisuais: { revisorMarcou: !m } });
                      }}
                    >
                      {reviewFromDraft.alternativasVisuais?.revisorMarcou ? "Desmarcar alternativas em imagem" : "Alternativas em imagem (manual)"}
                    </button>
                    {heurVis && !reviewFromDraft.alternativasVisuais?.revisorMarcou && (
                      <span className="text-[9px] font-medium text-amber-700/90">(heurística ativa)</span>
                    )}
                    <span className="hidden sm:inline" aria-hidden>
                      ·
                    </span>
                    <button
                      type="button"
                      className="rounded-md px-1 py-0.5 text-[10px] font-semibold text-slate-500 underline decoration-slate-300/90 underline-offset-[3px] transition hover:text-violet-800"
                      title="Abre o PDF: recorte uma imagem para cada letra (A…E)."
                      onClick={() => {
                        if ((draft.alternatives?.length ?? 0) < 1) {
                          toast.info("Defina pelo menos uma alternativa antes (ou use “Identificar alternativas no PDF”).");
                          return;
                        }
                        setSelectedQ(q.id);
                        setLinkDrawerStartPage(
                          resolvePdfStartPageForQuestion(drafts[q.id] ?? q, imp.importAssets),
                        );
                        setDrawerLinkType("IMAGE");
                        const Ls = (draft.alternatives ?? []).map((a) => a.letter.trim().toUpperCase().slice(0, 1));
                        const order = ["A", "B", "C", "D", "E"] as const;
                        const ex = getExtendedLinkFlags(imp.importAssets, q.id);
                        const hasBy: Record<string, boolean> = {};
                        for (const L of Ls) {
                          if (L) hasBy[L] = Boolean(ex.altImageByLetter[L]);
                        }
                        const firstMiss = order.find((L) => Ls.includes(L) && !hasBy[L]);
                        setActiveAltLetter(firstMiss ?? Ls[0] ?? "A");
                        setApplyAlternativesMode(true);
                        setDrawerOpen(true);
                      }}
                    >
                      Aplicar alternativas
                    </button>
                  </div>
                  <div className="mb-8 rounded-2xl border border-violet-100/90 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-sm sm:p-6">
                    <h3 className="text-sm font-extrabold tracking-tight text-violet-950">Metadados (por questão)</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Integração exige disciplina, assunto, ano, banca, concurso e nível. Campos vazios podem herdar o cadastro da importação. Guarde a questão após editar.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Disciplina</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.suggestedSubjectId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            if (v) void ensureTopics(v);
                            setDrafts((prev) => ({
                              ...prev,
                              [q.id]: { ...draft, suggestedSubjectId: v, suggestedTopicId: null },
                            }));
                          }}
                        >
                          <option value="">Selecione…</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Assunto</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.suggestedTopicId ?? ""}
                          disabled={!draft.suggestedSubjectId}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, suggestedTopicId: v } }));
                          }}
                        >
                          <option value="">{draft.suggestedSubjectId ? "Selecione…" : "—"}</option>
                          {(draft.suggestedSubjectId ? topicBySubject[draft.suggestedSubjectId] : [])?.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Banca</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.examBoardId ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, examBoardId: e.target.value || null } }))
                          }
                        >
                          <option value="">(herdar da importação)</option>
                          {examBoards.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.acronym} — {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Concurso</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.competitionId ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, competitionId: e.target.value || null } }))
                          }
                        >
                          <option value="">(herdar da importação)</option>
                          {competitions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Ano</label>
                        <input
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          type="number"
                          inputMode="numeric"
                          placeholder="Ex: 2025"
                          value={draft.year ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDrafts((prev) => ({
                              ...prev,
                              [q.id]: {
                                ...draft,
                                year: raw === "" ? null : parseInt(raw, 10) || null,
                              },
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Cidade (opcional)</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.cityId ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, cityId: e.target.value || null } }))
                          }
                        >
                          <option value="">(herdar / vazio)</option>
                          {cities.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — {c.state}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Cargo (opcional)</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.jobRoleId ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, jobRoleId: e.target.value || null } }))
                          }
                        >
                          <option value="">(herdar / vazio)</option>
                          {jobRoles.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="orbit-form-label text-[10px] uppercase">Nível</label>
                        <select
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          value={draft.difficulty ?? "MEDIUM"}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [q.id]: {
                                ...draft,
                                difficulty: e.target.value as DifficultyChoice,
                              },
                            }))
                          }
                        >
                          <option value="EASY">Fácil</option>
                          <option value="MEDIUM">Médio</option>
                          <option value="HARD">Difícil</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="orbit-form-label text-[10px] uppercase">Tags (opcional)</label>
                        <input
                          className="input mt-1 h-10 w-full min-w-0 text-sm"
                          placeholder="separar por vírgula"
                          value={(draft.tags ?? []).join(", ")}
                          onChange={(e) => {
                            const tags = e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean);
                            setDrafts((prev) => ({ ...prev, [q.id]: { ...draft, tags } }));
                          }}
                        />
                      </div>
                    </div>
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
                                      placeholder={visOn ? "Texto opcional — deixe vazio se a alternativa for só imagem no PDF" : undefined}
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
                          setApplyAlternativesMode(false);
                          setSelectedQ(q.id);
                          setLinkDrawerStartPage(
                            resolvePdfStartPageForQuestion(drafts[q.id] ?? q, imp?.importAssets),
                          );
                          setDrawerLinkType("TEXT");
                          setDrawerOpen(true);
                        }}
                        onOpenLinkImage={() => {
                          setApplyAlternativesMode(false);
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
        onClose={() => {
          setDrawerOpen(false);
          setApplyAlternativesMode(false);
        }}
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
        applyAlternativesMode={applyAlternativesMode}
        activeAlternativeLetter={activeAltLetter}
        onActiveAlternativeLetterChange={setActiveAltLetter}
        onAlternativeLinked={(info) => {
          const d = drafts[selectedQ];
          if (!d) return;
          const letters = (d.alternatives ?? [])
            .map((a) => a.letter.trim().toUpperCase().slice(0, 1))
            .filter(Boolean);
          const order = ["A", "B", "C", "D", "E"];
          const linked = (info?.alternativeLetter ?? activeAltLetter).toString().trim().toUpperCase().slice(0, 1);
          const start = order.indexOf(linked);
          const next =
            (start === -1 ? order : order.slice(start + 1)).find((L) => letters.includes(L)) ?? null;
          if (next) setActiveAltLetter(next);
          toast.success(
            `Recorte vinculado (${linked})${next ? ` · selecionada: ${next}` : ""}.`,
          );
        }}
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
