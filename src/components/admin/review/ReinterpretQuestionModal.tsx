"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Loader2, X, ScanText, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { RichTextArea } from "@/components/admin/RichTextArea";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function normRect(ax: number, ay: number, bx: number, by: number) {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const h = Math.abs(by - ay);
  return { x, y, w, h };
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

type Region = { page: number; bbox: { x: number; y: number; w: number; h: number }; text: string };

type Props = {
  open: boolean;
  onClose: () => void;
  importId: string;
  questionId: string;
  initialPage?: number;
  onApplied: () => Promise<void> | void;
};

export function ReinterpretQuestionModal({ open, onClose, importId, questionId, initialPage = 1, onApplied }: Props) {
  const pdfUrl = `/api/admin/imports/${importId}/pdf`;
  const pdfDocRef = useRef<{ getPage: (n: number) => Promise<any> } | null>(null);

  const [step, setStep] = useState<"count" | "draw" | "preview">("count");
  const [areaCount, setAreaCount] = useState(1);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [numPages, setNumPages] = useState(0);
  const [drawing, setDrawing] = useState<{ ax: number; ay: number } | null>(null);
  const [previewRect, setPreviewRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [collected, setCollected] = useState<Region[]>([]);
  const [drawRound, setDrawRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [wrapWidth, setWrapWidth] = useState(720);

  const [previewPayload, setPreviewPayload] = useState<{
    content: string;
    alternatives: { letter: string; content: string }[];
    correctAnswer: string | null;
    rawTextPatch: Record<string, unknown>;
  } | null>(null);
  const [draftPreview, setDraftPreview] = useState<typeof previewPayload | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("count");
    setAreaCount(1);
    setPage(Math.max(1, initialPage));
    setCollected([]);
    setDrawRound(0);
    setDrawing(null);
    setPreviewRect(null);
    setPreviewPayload(null);
    setDraftPreview(null);
    pdfDocRef.current = null;
  }, [open, initialPage, questionId]);

  useEffect(() => {
    const el = overlayRef.current?.parentElement?.parentElement;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (Number.isFinite(w) && w > 0) setWrapWidth(Math.max(280, Math.min(900, Math.floor(w - 32))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const extractPdfTextFromRegion = useCallback(
    async (input: { page: number; bbox: { x: number; y: number; w: number; h: number }; canvas: HTMLCanvasElement }) => {
      const selPx = {
        x: input.bbox.x * input.canvas.width,
        y: input.bbox.y * input.canvas.height,
        w: input.bbox.w * input.canvas.width,
        h: input.bbox.h * input.canvas.height,
      };

      let doc = pdfDocRef.current;
      if (!doc) {
        const loaded = (await (pdfjs as any).getDocument(pdfUrl).promise) as { getPage: (n: number) => Promise<any> } | null;
        if (!loaded) return "";
        pdfDocRef.current = loaded;
        doc = loaded;
      }
      if (!doc) return "";
      const pg = await doc.getPage(input.page);
      const viewport1 = pg.getViewport({ scale: 1 });
      const scale = input.canvas.width / viewport1.width;
      const viewport = pg.getViewport({ scale });

      const textContent = await pg.getTextContent();
      const items: any[] = Array.isArray(textContent.items) ? textContent.items : [];
      const parts: string[] = [];

      for (const it of items) {
        const str = String(it?.str ?? "");
        if (!str.trim()) continue;
        const t = it.transform as number[] | undefined;
        if (!t || t.length < 6) continue;
        const m = (pdfjs as any).Util.transform(viewport.transform, t) as number[];
        const x = m[4];
        const y = m[5];
        const fontH = Math.max(1, Math.hypot(m[2], m[3]));
        const w = Math.max(1, (Number(it.width) || 0) * scale);
        const itemRect = { x, y: y - fontH, w, h: fontH };
        if (rectsIntersect(itemRect, selPx)) parts.push(str);
      }

      return parts
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    },
    [pdfUrl],
  );

  const getCanvas = (): HTMLCanvasElement | null => {
    const container = overlayRef.current?.parentElement;
    const canvas = container?.querySelector("canvas");
    return canvas instanceof HTMLCanvasElement ? canvas : null;
  };

  const currentRound = useMemo(() => drawRound + 1, [drawRound]);

  const startDraw = (e: React.MouseEvent) => {
    if (!overlayRef.current || step !== "draw") return;
    const r = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setDrawing({ ax: x, ay: y });
    setPreviewRect(null);
  };

  const moveDraw = (e: React.MouseEvent) => {
    if (!drawing || !overlayRef.current) return;
    const r = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setPreviewRect(normRect(drawing.ax, drawing.ay, x, y));
  };

  const endDraw = async (e: React.MouseEvent) => {
    if (!drawing || !overlayRef.current || step !== "draw") return;
    const r = overlayRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const box = normRect(drawing.ax, drawing.ay, x, y);
    setDrawing(null);
    setPreviewRect(null);
    if (box.w < 0.008 || box.h < 0.008) return;

    const canvas = getCanvas();
    let text = "";
    if (canvas) {
      try {
        const t = await extractPdfTextFromRegion({ page, bbox: box, canvas });
        text = t || "";
      } catch {
        text = "";
      }
    }
    if (!text.trim()) {
      toast.warning("Pouco ou nenhum texto na área (PDF só com imagem?). Tente uma área maior ou outra página.");
    }

    setCollected((prev) => [...prev, { page, bbox: box, text: text.trim() }]);
    setDrawRound((n) => n + 1);
  };

  useEffect(() => {
    if (step !== "draw" || areaCount < 1 || drawRound !== areaCount) return;

    const combined = collected
      .map((c) => c.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();
    if (collected.length < areaCount) return;
    if (combined.length < 15) {
      toast.error("Texto extraído insuficiente. Desenhe novamente áreas que cubram a questão.");
      setCollected([]);
      setDrawRound(0);
      return;
    }

    let cancelled = false;
    setBusy(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/imports/${importId}/imported-questions/${questionId}/reinterpret`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ extractedText: combined }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          toast.error(data.error ?? "Falha na prévia");
          setCollected([]);
          setDrawRound(0);
          return;
        }
        const prev = data.preview;
        setPreviewPayload(prev);
        setDraftPreview(prev);
        setStep("preview");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- executa ao fechar ciclo de áreas
  }, [step, drawRound, areaCount, collected, importId, questionId]);

  async function applyPreview() {
    if (!draftPreview) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/imports/${importId}/imported-questions/${questionId}/reinterpret`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: draftPreview.content,
            alternatives: draftPreview.alternatives,
            correctAnswer: draftPreview.correctAnswer,
            rawTextPatch: draftPreview.rawTextPatch,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao salvar");
        return;
      }
      toast.success("Questão atualizada com a nova interpretação.");
      await onApplied();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[95dvh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <ScanText className="h-5 w-5 shrink-0 text-violet-600" />
            <h2 className="truncate text-base font-extrabold text-[var(--text-primary)]">Reinterpretar questão</h2>
          </div>
          <button type="button" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {step === "count" && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                Indique quantas áreas retangulares serão necessárias (por exemplo, enunciado numa página e alternativas em outra).
                Depois desenhe cada retângulo sobre o PDF na ordem.
              </p>
              <label className="block text-sm font-bold text-[var(--text-primary)]">Número de áreas (1 a 5)</label>
              <select
                className="input h-11 max-w-xs text-sm"
                value={areaCount}
                onChange={(e) => setAreaCount(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary rounded-xl px-5"
                onClick={() => {
                  setCollected([]);
                  setDrawRound(0);
                  setStep("draw");
                }}
              >
                Continuar
              </button>
            </div>
          )}

          {step === "draw" && drawRound < areaCount && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-violet-900">
                Área {currentRound} de {areaCount} — arraste no PDF para selecionar o trecho.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Página</span>
                <button
                  type="button"
                  className="btn btn-ghost h-9 rounded-lg border px-2 text-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                <span className="text-sm tabular-nums">
                  {page} / {numPages || "…"}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost h-9 rounded-lg border px-2 text-sm"
                  disabled={!numPages || page >= numPages}
                  onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p))}
                >
                  ›
                </button>
              </div>

              <div className="relative mx-auto w-full max-w-[880px] rounded-xl border border-black/[0.08] bg-slate-100 p-2">
                <div className="relative inline-block" ref={(el) => { /* pageWrap for observer parent - overlay sibling */ void el; }}>
                  <Document
                    file={pdfUrl}
                    loading={
                      <div className="flex items-center gap-2 p-8 text-sm text-slate-600">
                        <Loader2 className="h-5 w-5 animate-spin" /> Carregando PDF…
                      </div>
                    }
                    onLoadSuccess={(d) => {
                      setNumPages(d.numPages);
                      pdfDocRef.current = null;
                    }}
                  >
                    <Page
                      pageNumber={page}
                      width={wrapWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer
                    />
                  </Document>
                  <div
                    ref={overlayRef}
                    className="absolute inset-0 cursor-crosshair"
                    style={{ touchAction: "none" }}
                    onMouseDown={startDraw}
                    onMouseMove={moveDraw}
                    onMouseUp={endDraw}
                    onMouseLeave={() => {
                      setDrawing(null);
                      setPreviewRect(null);
                    }}
                  >
                    {previewRect && (
                      <div
                        className="pointer-events-none absolute border-2 border-violet-500 bg-violet-500/15"
                        style={{
                          left: `${previewRect.x * 100}%`,
                          top: `${previewRect.y * 100}%`,
                          width: `${previewRect.w * 100}%`,
                          height: `${previewRect.h * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
              {busy && (
                <p className="flex items-center gap-2 text-sm text-violet-700">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando prévia com IA…
                </p>
              )}
            </div>
          )}

          {step === "preview" && draftPreview && (
            <div className="space-y-5">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 hover:underline"
                onClick={() => {
                  setStep("count");
                  setCollected([]);
                  setDrawRound(0);
                  setPreviewPayload(null);
                  setDraftPreview(null);
                }}
              >
                <ChevronLeft className="h-4 w-4" /> Recomeçar seleção
              </button>
              <p className="text-sm font-extrabold text-[var(--text-primary)]">Pré-visualização — ajuste se quiser e confirme</p>
              <div>
                <label className="text-xs font-bold uppercase text-slate-500">Enunciado</label>
                <RichTextArea
                  value={draftPreview.content}
                  minHeight="160px"
                  onChange={(v) => setDraftPreview((p) => (p ? { ...p, content: v } : p))}
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-slate-500">Alternativas</label>
                {draftPreview.alternatives.map((alt, i) => (
                  <div key={`${alt.letter}-${i}`} className="flex gap-2">
                    <span className="w-8 pt-2 text-center font-black text-violet-700">{alt.letter}</span>
                    <RichTextArea
                      className="flex-1"
                      value={alt.content}
                      minHeight="72px"
                      onChange={(v) =>
                        setDraftPreview((p) => {
                          if (!p) return p;
                          const alts = p.alternatives.map((a, j) => (j === i ? { ...a, content: v } : a));
                          return { ...p, alternatives: alts };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-bold text-slate-600">Gabarito sugerido:</span>
                <select
                  className="input h-10 w-24 text-sm"
                  value={draftPreview.correctAnswer ?? ""}
                  onChange={(e) =>
                    setDraftPreview((p) =>
                      p ? { ...p, correctAnswer: e.target.value ? e.target.value.toUpperCase().slice(0, 1) : null } : p,
                    )
                  }
                >
                  <option value="">—</option>
                  {draftPreview.alternatives.map((a) => (
                    <option key={a.letter} value={a.letter}>
                      {a.letter}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {step === "preview" && draftPreview && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-black/[0.06] bg-slate-50/80 px-4 py-3 sm:px-5">
            <button type="button" className="btn btn-ghost rounded-xl border px-4" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary inline-flex items-center gap-2 rounded-xl px-5"
              disabled={busy}
              onClick={() => void applyPreview()}
            >
              <Check className="h-4 w-4" /> Substituir questão
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
