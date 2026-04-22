"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, ImageIcon, Type, Trash2, Link2, Unlink } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type ImportAssetDTO = {
  id: string;
  kind: "TEXT_BLOCK" | "IMAGE";
  page: number;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  scope: "EXCLUSIVE" | "SHARED";
  extractedText: string | null;
  imageDataUrl: string | null;
  label: string | null;
  questionLinks: { id: string; importedQuestionId: string; role: "SUPPORT_TEXT" | "FIGURE" }[];
};

type QOpt = { id: string; label: string };

type DrawMode = "TEXT_BLOCK" | "IMAGE" | null;

export type PdfLinkType = "TEXT" | "IMAGE" | "TABLE" | "GRAPH" | "MIXED";

type Props = {
  importId: string;
  pdfAvailable: boolean;
  questions: QOpt[];
  assets: ImportAssetDTO[];
  onChanged: () => Promise<void> | void;
  selectedQuestionId?: string;
  onSelectedQuestionIdChange?: (id: string) => void;
  /** Página 1-based para abrir o PDF (ex.: página da questão ao vincular texto/imagem) */
  initialPage?: number | null;
  uiMode?: "review" | "linker" | "selector";
  linkType?: PdfLinkType;
  onBoxSelected?: (sel: { page: number; bbox: { x: number; y: number; w: number; h: number } }) => Promise<void> | void;
  layout?: "workspace" | "pdfOnly";
  onLinkCreated?: (info: { assetId: string; role: "SUPPORT_TEXT" | "FIGURE"; page: number }) => void;
};

function normRect(ax: number, ay: number, bx: number, by: number) {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const h = Math.abs(by - ay);
  return { x, y, w, h };
}

export function ImportPdfMarkupPanel({
  importId,
  pdfAvailable,
  questions,
  assets,
  onChanged,
  selectedQuestionId,
  onSelectedQuestionIdChange,
  initialPage,
  uiMode = "review",
  linkType = "TEXT",
  onBoxSelected,
  layout = "workspace",
  onLinkCreated,
}: Props) {
  const [page, setPage] = useState(() => {
    const p = initialPage;
    if (p != null && p >= 1 && Number.isFinite(p)) return Math.max(1, Math.floor(p));
    return 1;
  });
  const [numPages, setNumPages] = useState(0);
  const [mode, setMode] = useState<DrawMode>(null);
  const [targetQ, setTargetQ] = useState<string>(() => questions[0]?.id ?? "");
  const [drawing, setDrawing] = useState<{ ax: number; ay: number } | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingText, setEditingText] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [draggingAsset, setDraggingAsset] = useState<{ id: string; startX: number; startY: number; base: { x: number; y: number; w: number; h: number } } | null>(null);
  const [resizingAsset, setResizingAsset] = useState<{
    id: string;
    handle: "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    base: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const pdfUrl = `/api/admin/imports/${importId}/pdf`;

  const [wrapWidth, setWrapWidth] = useState(720);
  const [zoom, setZoom] = useState(1);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string>("");
  useEffect(() => {
    const el = pageWrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (Number.isFinite(w) && w > 0) setWrapWidth(Math.max(280, Math.min(1200, Math.floor(w))));
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-pdf-panel-mounted',location:'ImportPdfMarkupPanel.tsx:mounted',message:'pdf markup panel mounted',data:{importId,pdfAvailable,questionsCount:questions.length,assetsCount:assets.length,selectedQuestionId:selectedQuestionId ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [importId, pdfAvailable, questions.length, assets.length, selectedQuestionId]);

  const pageWidth = Math.max(280, Math.min(1400, Math.floor(wrapWidth * zoom)));

  const effectiveTargetQ = selectedQuestionId ?? targetQ;
  const effectiveLinkType = linkType;
  const computedKind: DrawMode = effectiveLinkType === "TEXT" ? "TEXT_BLOCK" : "IMAGE";
  const computedRole = computedKind === "TEXT_BLOCK" ? "SUPPORT_TEXT" : "FIGURE";
  const computedLabel =
    effectiveLinkType === "TEXT"
      ? "TEXT"
      : effectiveLinkType === "IMAGE"
        ? "IMAGE"
        : effectiveLinkType === "TABLE"
          ? "TABLE"
          : effectiveLinkType === "GRAPH"
            ? "GRAPH"
            : "MIXED";

  const pageAssets = useMemo(() => assets.filter((a) => a.page === page), [assets, page]);
  const selectedAsset = useMemo(() => assets.find((a) => a.id === selectedAssetId) ?? null, [assets, selectedAssetId]);
  const selectedQuestionAssetIds = useMemo(() => {
    const ids = new Set<string>();
    if (!effectiveTargetQ) return ids;
    for (const a of assets) {
      if ((a.questionLinks ?? []).some((l) => l.importedQuestionId === effectiveTargetQ)) ids.add(a.id);
    }
    return ids;
  }, [assets, effectiveTargetQ]);

  const displayedPageAssets = useMemo(() => {
    if (uiMode === "linker" || uiMode === "selector") {
      // Durante vínculo/seleção, NÃO poluir o PDF com regiões de outras questões.
      return pageAssets.filter((a) => selectedQuestionAssetIds.has(a.id));
    }
    if (showAllRegions) return pageAssets;
    // Por padrão no review: mostrar apenas regiões da questão atual (isola highlights por questão).
    return pageAssets.filter((a) => selectedQuestionAssetIds.has(a.id));
  }, [pageAssets, selectedQuestionAssetIds, showAllRegions, uiMode]);

  const startDraw = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current) return;
      if (uiMode !== "linker" && uiMode !== "selector" && !mode) return;
      const r = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      setDrawing({ ax: x, ay: y });
      setPreview(null);
    },
    [mode, uiMode],
  );

  const moveDraw = useCallback(
    (e: React.MouseEvent) => {
      if (resizingAsset && overlayRef.current) {
        const r = overlayRef.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const dx = x - resizingAsset.startX;
        const dy = y - resizingAsset.startY;
        const minSize = 0.01;
        let nx = resizingAsset.base.x;
        let ny = resizingAsset.base.y;
        let nw = resizingAsset.base.w;
        let nh = resizingAsset.base.h;

        if (resizingAsset.handle === "se") {
          nw = Math.max(minSize, resizingAsset.base.w + dx);
          nh = Math.max(minSize, resizingAsset.base.h + dy);
        } else if (resizingAsset.handle === "sw") {
          nx = Math.min(resizingAsset.base.x + dx, resizingAsset.base.x + resizingAsset.base.w - minSize);
          nw = Math.max(minSize, resizingAsset.base.w - dx);
          nh = Math.max(minSize, resizingAsset.base.h + dy);
        } else if (resizingAsset.handle === "ne") {
          ny = Math.min(resizingAsset.base.y + dy, resizingAsset.base.y + resizingAsset.base.h - minSize);
          nw = Math.max(minSize, resizingAsset.base.w + dx);
          nh = Math.max(minSize, resizingAsset.base.h - dy);
        } else if (resizingAsset.handle === "nw") {
          nx = Math.min(resizingAsset.base.x + dx, resizingAsset.base.x + resizingAsset.base.w - minSize);
          ny = Math.min(resizingAsset.base.y + dy, resizingAsset.base.y + resizingAsset.base.h - minSize);
          nw = Math.max(minSize, resizingAsset.base.w - dx);
          nh = Math.max(minSize, resizingAsset.base.h - dy);
        }

        nx = Math.max(0, Math.min(1 - minSize, nx));
        ny = Math.max(0, Math.min(1 - minSize, ny));
        nw = Math.max(minSize, Math.min(1 - nx, nw));
        nh = Math.max(minSize, Math.min(1 - ny, nh));

        setPreview({ x: nx, y: ny, w: nw, h: nh });
        return;
      }
      if (draggingAsset && overlayRef.current) {
        const r = overlayRef.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const dx = x - draggingAsset.startX;
        const dy = y - draggingAsset.startY;
        const next = {
          x: Math.max(0, Math.min(1 - draggingAsset.base.w, draggingAsset.base.x + dx)),
          y: Math.max(0, Math.min(1 - draggingAsset.base.h, draggingAsset.base.y + dy)),
          w: draggingAsset.base.w,
          h: draggingAsset.base.h,
        };
        setPreview(next);
        return;
      }
      if (!drawing || !overlayRef.current) return;
      const r = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      setPreview(normRect(drawing.ax, drawing.ay, x, y));
    },
    [drawing, draggingAsset, resizingAsset],
  );

  // (moved up to avoid TS "used before declaration")

  const endDraw = useCallback(
    async (e: React.MouseEvent) => {
      if (resizingAsset && preview) {
        setBusy(true);
        try {
          // #region agent log
          fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-canvas-resize',location:'ImportPdfMarkupPanel.tsx:resizeEnd',message:'updating bbox after resize',data:{importId,assetId:resizingAsset.id,page,bbox:preview,handle:resizingAsset.handle},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const res = await fetch(`/api/admin/imports/${importId}/assets/${resizingAsset.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page, bboxX: preview.x, bboxY: preview.y, bboxW: preview.w, bboxH: preview.h }),
          });
          if (!res.ok) throw new Error("Erro ao atualizar região");
          await onChanged();
        } catch (err) {
          console.error(err);
          alert(err instanceof Error ? err.message : "Erro");
        } finally {
          setBusy(false);
          setResizingAsset(null);
          setPreview(null);
        }
        return;
      }
      if (draggingAsset && preview && overlayRef.current) {
        setBusy(true);
        try {
          // #region agent log
          fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-canvas-move',location:'ImportPdfMarkupPanel.tsx:dragEnd',message:'updating bbox after drag',data:{importId,assetId:draggingAsset.id,page,bbox:preview},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const res = await fetch(`/api/admin/imports/${importId}/assets/${draggingAsset.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page, bboxX: preview.x, bboxY: preview.y, bboxW: preview.w, bboxH: preview.h }),
          });
          if (!res.ok) throw new Error("Erro ao atualizar região");
          await onChanged();
        } catch (err) {
          console.error(err);
          alert(err instanceof Error ? err.message : "Erro");
        } finally {
          setBusy(false);
          setDraggingAsset(null);
          setPreview(null);
        }
        return;
      }

      const effectiveMode = uiMode === "linker" ? computedKind : mode;
      if (!drawing || !overlayRef.current) return;
      if (uiMode !== "selector" && !effectiveMode) return;
      const r = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const box = normRect(drawing.ax, drawing.ay, x, y);
      setDrawing(null);
      setPreview(null);
      if (box.w < 0.008 || box.h < 0.008) return;
      if (!effectiveTargetQ) return;

      setBusy(true);
      try {
        if (uiMode === "selector" && onBoxSelected) {
          // #region agent log
          fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-alt-identify',location:'ImportPdfMarkupPanel.tsx:endDraw',message:'selector mode box selected',data:{importId,page,bbox:box,targetQuestionId:effectiveTargetQ},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          await onBoxSelected({ page, bbox: box });
          return;
        }
        // #region agent log
        fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-link-flow',location:'ImportPdfMarkupPanel.tsx:endDraw',message:'creating asset+link from selection',data:{importId,page,mode,targetQuestionId:effectiveTargetQ,bbox:{x:box.x,y:box.y,w:box.w,h:box.h}},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const res = await fetch(`/api/admin/imports/${importId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: effectiveMode,
            page,
            bboxX: box.x,
            bboxY: box.y,
            bboxW: box.w,
            bboxH: box.h,
            scope: "EXCLUSIVE",
            extractedText: null,
            imageDataUrl: null,
            label: uiMode === "linker" ? computedLabel : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao criar região");
        const assetId = data.asset?.id as string;
        const role = uiMode === "linker" ? computedRole : (effectiveMode === "TEXT_BLOCK" ? "SUPPORT_TEXT" : "FIGURE");
        const lr = await fetch(`/api/admin/imports/${importId}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            importedQuestionId: effectiveTargetQ,
            importAssetId: assetId,
            role,
          }),
        });
        if (!lr.ok) {
          const err = await lr.json().catch(() => ({}));
          throw new Error(err.error ?? "Erro ao vincular");
        }
        await onChanged();
        onLinkCreated?.({ assetId, role, page });
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Erro");
      } finally {
        setBusy(false);
      }
    },
    [resizingAsset, draggingAsset, preview, drawing, uiMode, computedKind, computedLabel, computedRole, mode, page, importId, effectiveTargetQ, onChanged, onBoxSelected, onLinkCreated],
  );

  const patchAssetText = async (assetId: string, extractedText: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText }),
      });
      if (!res.ok) throw new Error("Erro ao salvar texto");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    if (!confirm("Remover esta região e todos os vínculos?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/assets/${assetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const removeLink = async (linkId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links/${linkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desvincular");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const toggleScope = async (asset: ImportAssetDTO) => {
    setBusy(true);
    try {
      const next = asset.scope === "SHARED" ? "EXCLUSIVE" : "SHARED";
      const res = await fetch(`/api/admin/imports/${importId}/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: next }),
      });
      if (!res.ok) throw new Error("Erro");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const [linkExtra, setLinkExtra] = useState({ assetId: "", qid: "", role: "SUPPORT_TEXT" as "SUPPORT_TEXT" | "FIGURE" });

  useEffect(() => {
    if (!questions.length) return;
    setTargetQ((prev) => (prev && questions.some((q) => q.id === prev) ? prev : questions[0].id));
  }, [questions]);

  useEffect(() => {
    if (!selectedQuestionId) return;
    if (!questions.some((q) => q.id === selectedQuestionId)) return;
    setTargetQ(selectedQuestionId);
  }, [selectedQuestionId, questions]);

  const addExtraLink = async () => {
    if (!linkExtra.assetId || !linkExtra.qid) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importedQuestionId: linkExtra.qid,
          importAssetId: linkExtra.assetId,
          role: linkExtra.role,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao vincular");
      }
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  if (!pdfAvailable) {
    return (
      <div className="rounded-[var(--r-panel)] border border-dashed border-[rgba(124,58,237,0.25)] bg-[#FAF8FF] p-6 text-center text-[13px] text-[#6B7280]">
        O PDF desta importação não está armazenado no servidor (importações antigas). Faça uma{' '}
        <strong>nova importação</strong> para usar o visualizador e marcação por regiões.
      </div>
    );
  }

  const pdfCard = (
    <div className="min-w-0 rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-md sm:p-5">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Questão alvo</span>
              <select
                className="input mt-1.5 h-11 w-full max-w-md text-sm"
                value={effectiveTargetQ}
                onChange={(e) => {
                  const v = e.target.value;
                  setTargetQ(v);
                  onSelectedQuestionIdChange?.(v);
                  // #region agent log
                  fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-sync-selection',location:'ImportPdfMarkupPanel.tsx:selectTarget',message:'changed target question in PDF panel',data:{importId,targetQuestionId:v},timestamp:Date.now()})}).catch(()=>{});
                  // #endregion
                }}
              >
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
            {uiMode === "review" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`btn inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold ${mode === "TEXT_BLOCK" ? "btn-primary" : "btn-ghost border border-black/[0.08] bg-white"}`}
                  onClick={() => setMode((m) => (m === "TEXT_BLOCK" ? null : "TEXT_BLOCK"))}
                >
                  <Type className="h-4 w-4 shrink-0" /> Texto-base
                </button>
                <button
                  type="button"
                  className={`btn inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold ${mode === "IMAGE" ? "btn-primary" : "btn-ghost border border-black/[0.08] bg-white"}`}
                  onClick={() => setMode((m) => (m === "IMAGE" ? null : "IMAGE"))}
                >
                  <ImageIcon className="h-4 w-4 shrink-0" /> Figura
                </button>
                <button
                  type="button"
                  className={`btn inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold ${showAllRegions ? "btn-purple" : "btn-ghost border border-black/[0.08] bg-white"}`}
                  onClick={() => setShowAllRegions((v) => !v)}
                  title="Mostrar regiões de todas as questões"
                >
                  {showAllRegions ? "Todas as questões" : "Só esta questão"}
                </button>
              </div>
            ) : null}
          </div>
          {uiMode === "review" && mode ? (
            <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900">Desenhe um retângulo na página para marcar a região.</p>
          ) : uiMode !== "review" ? (
            <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900">
              {uiMode === "selector" ? "Selecione a área no PDF com o retângulo." : `Selecione a área no PDF (${computedLabel.toLowerCase()}).`}
            </p>
          ) : null}
        </div>

        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-black/[0.06] bg-slate-50/90 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="btn btn-ghost inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl px-3 text-sm font-bold"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Página anterior"
            >
              ←
            </button>
            <span className="px-1 text-sm font-medium text-[var(--text-secondary)]">
              Página {page}
              {numPages ? ` / ${numPages}` : ""}
            </span>
            <button
              type="button"
              className="btn btn-ghost inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl px-3 text-sm font-bold"
              disabled={numPages > 0 && page >= numPages}
              onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
              aria-label="Próxima página"
            >
              →
            </button>
            <span className="mx-1 hidden h-6 w-px bg-black/[0.08] sm:inline-block" aria-hidden />
            <button
              type="button"
              className="btn btn-ghost inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 text-sm font-bold"
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))}
              title="Diminuir zoom"
            >
              −
            </button>
            <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-[var(--text-secondary)]">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="btn btn-ghost inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 text-sm font-bold"
              onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
              title="Aumentar zoom"
            >
              +
            </button>
            <button
              type="button"
              className="btn btn-ghost inline-flex min-h-[40px] items-center justify-center rounded-xl px-3 text-sm font-semibold"
              onClick={() => setZoom(1)}
              title="Redefinir zoom (100%)"
            >
              Ajustar
            </button>
          </div>
          {busy ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin self-end text-violet-600 sm:self-auto" aria-label="Processando" />
          ) : null}
        </div>

        <div ref={pageWrapRef} className="relative overflow-auto rounded-2xl border border-black/[0.08] bg-slate-100 shadow-inner">
          {pdfLoadError ? (
            <div className="rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-[12.5px] text-[#7F1D1D]">
              <div className="font-extrabold">Falha ao carregar o PDF</div>
              <div className="mt-1 break-words">{pdfLoadError}</div>
              <div className="mt-2">
                <button type="button" className="btn btn-ghost !h-[34px] !text-[12px]" onClick={() => setPdfLoadError("")}>
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : (
            <Document
              file={pdfUrl}
              loading={
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-[var(--text-muted)]">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-600" aria-hidden />
                  <span className="text-sm font-semibold">Carregando PDF…</span>
                </div>
              }
              onLoadSuccess={({ numPages: n }) => {
                setNumPages(n);
                setPage((cur) => {
                  if (initialPage != null && initialPage >= 1 && Number.isFinite(initialPage)) {
                    return Math.min(Math.max(1, Math.floor(initialPage)), n);
                  }
                  return Math.min(cur, n);
                });
                // #region agent log
                requestAnimationFrame(() => {
                  const wrap = pageWrapRef.current;
                  const strip = wrap?.querySelector("[data-pdf-strip]");
                  const w = wrap?.getBoundingClientRect().width ?? 0;
                  const sw = strip?.getBoundingClientRect().width ?? 0;
                  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
                    body: JSON.stringify({
                      sessionId: "03dbee",
                      runId: "post-fix",
                      hypothesisId: "H-center",
                      location: "ImportPdfMarkupPanel.tsx:Document:onLoadSuccess",
                      message: "pdf viewport vs page strip width (centering check)",
                      data: { importId, viewportClientW: w, pdfPageElW: sw, slack: Math.max(0, w - sw) },
                      timestamp: Date.now(),
                    }),
                  }).catch(() => {});
                });
                // #endregion
              }}
              onLoadError={(e) => {
                const msg = e instanceof Error ? e.message : String(e);
                setPdfLoadError(msg || "Erro desconhecido");
                // #region agent log
                fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-pdf-load',location:'ImportPdfMarkupPanel.tsx:Document:onLoadError',message:'react-pdf failed to load',data:{importId,error:msg},timestamp:Date.now()})}).catch(()=>{});
                // #endregion
              }}
            >
            <div className="flex w-full min-w-0 justify-center px-2 py-2" data-pdf-page-wrap>
              <div className="relative inline-block shrink-0" data-pdf-strip>
              <Page pageNumber={page} width={pageWidth} renderTextLayer renderAnnotationLayer />
              <div
                ref={overlayRef}
                className="absolute inset-0 z-20 cursor-crosshair"
                style={{ pointerEvents: (uiMode === "linker" || uiMode === "selector" ? true : Boolean(mode)) ? "auto" : "none" }}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={() => {
                  setDrawing(null);
                  setPreview(null);
                  setDraggingAsset(null);
                  setResizingAsset(null);
                }}
              >
                {displayedPageAssets.map((a) => (
                  <div
                    key={a.id}
                    title={a.kind}
                    className="absolute border-2"
                    style={{
                      left: `${a.bboxX * 100}%`,
                      top: `${a.bboxY * 100}%`,
                      width: `${a.bboxW * 100}%`,
                      height: `${a.bboxH * 100}%`,
                      borderColor: selectedAssetId === a.id ? "#111827" : (a.kind === "IMAGE" ? "#B45309" : "#6D28D9"),
                      background: "rgba(109,40,217,0.06)",
                    }}
                    onMouseDown={(e) => {
                      if (!overlayRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedAssetId(a.id);
                      if (uiMode === "linker") return;
                      const r = overlayRef.current.getBoundingClientRect();
                      const x = (e.clientX - r.left) / r.width;
                      const y = (e.clientY - r.top) / r.height;
                      setDraggingAsset({ id: a.id, startX: x, startY: y, base: { x: a.bboxX, y: a.bboxY, w: a.bboxW, h: a.bboxH } });
                      setPreview({ x: a.bboxX, y: a.bboxY, w: a.bboxW, h: a.bboxH });
                    }}
                  />
                ))}
                {preview && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-[#111827] bg-black/5"
                    style={{
                      left: `${preview.x * 100}%`,
                      top: `${preview.y * 100}%`,
                      width: `${preview.w * 100}%`,
                      height: `${preview.h * 100}%`,
                    }}
                  />
                )}

                {/* Resize handles for selected asset (review mode only) */}
                {uiMode === "review" && selectedAsset && selectedAsset.page === page && (
                  <>
                    {(
                      [
                        { h: "nw", x: selectedAsset.bboxX, y: selectedAsset.bboxY },
                        { h: "ne", x: selectedAsset.bboxX + selectedAsset.bboxW, y: selectedAsset.bboxY },
                        { h: "sw", x: selectedAsset.bboxX, y: selectedAsset.bboxY + selectedAsset.bboxH },
                        { h: "se", x: selectedAsset.bboxX + selectedAsset.bboxW, y: selectedAsset.bboxY + selectedAsset.bboxH },
                      ] as const
                    ).map((p) => (
                      <div
                        key={p.h}
                        className="absolute z-30 h-3 w-3 rounded-full border border-[#111827] bg-white shadow"
                        style={{
                          left: `calc(${p.x * 100}% - 6px)`,
                          top: `calc(${p.y * 100}% - 6px)`,
                          cursor: p.h === "nw" || p.h === "se" ? "nwse-resize" : "nesw-resize",
                        }}
                        onMouseDown={(e) => {
                          if (!overlayRef.current) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const r = overlayRef.current.getBoundingClientRect();
                          const x = (e.clientX - r.left) / r.width;
                          const y = (e.clientY - r.top) / r.height;
                          setResizingAsset({
                            id: selectedAsset.id,
                            handle: p.h,
                            startX: x,
                            startY: y,
                            base: { x: selectedAsset.bboxX, y: selectedAsset.bboxY, w: selectedAsset.bboxW, h: selectedAsset.bboxH },
                          });
                          setPreview({ x: selectedAsset.bboxX, y: selectedAsset.bboxY, w: selectedAsset.bboxW, h: selectedAsset.bboxH });
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
              </div>
            </div>
            </Document>
          )}
        </div>
      </div>
  );

  if (layout === "pdfOnly") return pdfCard;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {pdfCard}

      {uiMode === "review" && (
      <div className="flex flex-col gap-4">
        <div className="rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-[13px] font-bold text-[#111827]">Vínculos da questão atual</h3>
          <p className="mb-3 text-[11px] leading-relaxed text-[#6B7280]">
            Aqui aparecem apenas regiões vinculadas à questão selecionada. Use &quot;Todas as regiões&quot; para
            gerenciar regiões compartilhadas.
          </p>
          <div className="max-h-[280px] space-y-2 overflow-y-auto">
            {assets.filter((a) => (a.questionLinks ?? []).some((l) => l.importedQuestionId === effectiveTargetQ)).length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF]">Nenhuma região ainda.</p>
            ) : (
              assets
                .filter((a) => (a.questionLinks ?? []).some((l) => l.importedQuestionId === effectiveTargetQ))
                .map((a) => (
                <div key={a.id} className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFC] p-2.5 text-[12px]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#374151]">{a.kind === "IMAGE" ? "Figura" : "Texto"}</span>
                      <span className="text-[#9CA3AF]"> · p.{a.page}</span>
                      <button
                        type="button"
                        className="ml-2 text-[11px] font-semibold text-[#7C3AED] underline"
                        onClick={() => toggleScope(a)}
                      >
                        {a.scope === "SHARED" ? "Compartilhado" : "Exclusivo"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-red-600"
                      title="Excluir região"
                      onClick={() => removeAsset(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {a.kind === "TEXT_BLOCK" && (
                    <textarea
                      className="input mt-2 min-h-[56px] text-[12px]"
                      placeholder="Texto-base (trecho comum)…"
                      value={editingText[a.id] ?? a.extractedText ?? ""}
                      onChange={(e) => setEditingText((prev) => ({ ...prev, [a.id]: e.target.value }))}
                      onBlur={() => {
                        const v = editingText[a.id];
                        if (v !== undefined && v !== (a.extractedText ?? "")) patchAssetText(a.id, v);
                      }}
                    />
                  )}
                  {a.kind === "IMAGE" && (
                    <textarea
                      className="input mt-2 min-h-[48px] font-mono text-[11px]"
                      placeholder="Opcional: data URL da imagem recortada (ou deixe vazio e use a figura extraída pela importação)"
                      value={editingText[`img-${a.id}`] ?? a.imageDataUrl ?? ""}
                      onChange={(e) => setEditingText((prev) => ({ ...prev, [`img-${a.id}`]: e.target.value }))}
                      onBlur={async () => {
                        const v = editingText[`img-${a.id}`];
                        if (v === undefined || v === (a.imageDataUrl ?? "")) return;
                        setBusy(true);
                        try {
                          await fetch(`/api/admin/imports/${importId}/assets/${a.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ imageDataUrl: v || null }),
                          });
                          await onChanged();
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  )}
                  <div className="mt-2 space-y-1 border-t border-[#E5E7EB] pt-2">
                    {a.questionLinks.map((l) => (
                      l.importedQuestionId === effectiveTargetQ ? (
                      <div key={l.id} className="flex items-center justify-between gap-1 text-[11px]">
                        <span>
                          {l.role === "FIGURE" ? "Figura" : "Texto-base"} →{" "}
                          {questions.find((q) => q.id === l.importedQuestionId)?.label ?? l.importedQuestionId.slice(0, 8)}
                        </span>
                        <button type="button" className="text-[#9CA3AF] hover:text-red-600" onClick={() => removeLink(l.id)}>
                          <Unlink className="h-3 w-3" />
                        </button>
                      </div>
                      ) : null
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-1 text-[13px] font-bold text-[#111827]">
            <Link2 className="h-4 w-4" /> Vincular a outra questão
          </h3>
          <p className="mb-2 text-[11px] text-[#6B7280]">Reutiliza um ativo já desenhado (texto-base ou figura compartilhada).</p>
          <select
            className="input mb-2 text-[12px]"
            value={linkExtra.assetId}
            onChange={(e) => setLinkExtra((s) => ({ ...s, assetId: e.target.value }))}
          >
            <option value="">Selecione a região…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind} · p.{a.page} · {a.id.slice(0, 6)}…
              </option>
            ))}
          </select>
          <select
            className="input mb-2 text-[12px]"
            value={linkExtra.qid}
            onChange={(e) => setLinkExtra((s) => ({ ...s, qid: e.target.value }))}
          >
            <option value="">Questão…</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
          <select
            className="input mb-2 text-[12px]"
            value={linkExtra.role}
            onChange={(e) =>
              setLinkExtra((s) => ({ ...s, role: e.target.value as "SUPPORT_TEXT" | "FIGURE" }))
            }
          >
            <option value="SUPPORT_TEXT">Texto-base (support)</option>
            <option value="FIGURE">Figura</option>
          </select>
          <button type="button" className="btn btn-purple w-full !text-[12px]" onClick={addExtraLink} disabled={busy}>
            Adicionar vínculo
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
