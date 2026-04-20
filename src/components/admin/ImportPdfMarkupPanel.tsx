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

type Props = {
  importId: string;
  pdfAvailable: boolean;
  questions: QOpt[];
  assets: ImportAssetDTO[];
  onChanged: () => Promise<void> | void;
};

function normRect(ax: number, ay: number, bx: number, by: number) {
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const h = Math.abs(by - ay);
  return { x, y, w, h };
}

export function ImportPdfMarkupPanel({ importId, pdfAvailable, questions, assets, onChanged }: Props) {
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [mode, setMode] = useState<DrawMode>(null);
  const [targetQ, setTargetQ] = useState<string>(() => questions[0]?.id ?? "");
  const [drawing, setDrawing] = useState<{ ax: number; ay: number } | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingText, setEditingText] = useState<Record<string, string>>({});

  const pdfUrl = `/api/admin/imports/${importId}/pdf`;

  const [pageWidth, setPageWidth] = useState(720);
  useEffect(() => {
    const r = () => setPageWidth(Math.min(720, Math.max(280, window.innerWidth - 100)));
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  const pageAssets = useMemo(() => assets.filter((a) => a.page === page), [assets, page]);

  const startDraw = useCallback(
    (e: React.MouseEvent) => {
      if (!mode || !overlayRef.current) return;
      const r = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      setDrawing({ ax: x, ay: y });
      setPreview(null);
    },
    [mode],
  );

  const moveDraw = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing || !overlayRef.current) return;
      const r = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      setPreview(normRect(drawing.ax, drawing.ay, x, y));
    },
    [drawing],
  );

  const endDraw = useCallback(
    async (e: React.MouseEvent) => {
      if (!drawing || !overlayRef.current || !mode) return;
      const r = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const box = normRect(drawing.ax, drawing.ay, x, y);
      setDrawing(null);
      setPreview(null);
      if (box.w < 0.008 || box.h < 0.008) return;
      if (!targetQ) return;

      setBusy(true);
      try {
        const res = await fetch(`/api/admin/imports/${importId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: mode,
            page,
            bboxX: box.x,
            bboxY: box.y,
            bboxW: box.w,
            bboxH: box.h,
            scope: "EXCLUSIVE",
            extractedText: null,
            imageDataUrl: null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao criar região");
        const assetId = data.asset?.id as string;
        const role = mode === "TEXT_BLOCK" ? "SUPPORT_TEXT" : "FIGURE";
        const lr = await fetch(`/api/admin/imports/${importId}/links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            importedQuestionId: targetQ,
            importAssetId: assetId,
            role,
          }),
        });
        if (!lr.ok) {
          const err = await lr.json().catch(() => ({}));
          throw new Error(err.error ?? "Erro ao vincular");
        }
        await onChanged();
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Erro");
      } finally {
        setBusy(false);
      }
    },
    [drawing, mode, page, importId, targetQ, onChanged],
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

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Questão alvo</span>
          <select
            className="input max-w-[220px] py-1.5 text-[13px]"
            value={targetQ}
            onChange={(e) => setTargetQ(e.target.value)}
          >
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`btn ${mode === "TEXT_BLOCK" ? "btn-primary" : "btn-ghost"} !py-1.5 !text-[12px]`}
            onClick={() => setMode((m) => (m === "TEXT_BLOCK" ? null : "TEXT_BLOCK"))}
          >
            <Type className="h-3.5 w-3.5" /> Texto-base
          </button>
          <button
            type="button"
            className={`btn ${mode === "IMAGE" ? "btn-primary" : "btn-ghost"} !py-1.5 !text-[12px]`}
            onClick={() => setMode((m) => (m === "IMAGE" ? null : "IMAGE"))}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Figura
          </button>
          {mode && <span className="text-[12px] font-semibold text-[#7C3AED]">Desenhe um retângulo na página</span>}
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost !py-1 !text-[12px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ←
            </button>
            <span className="text-[12px] text-[#6B7280]">
              Página {page} {numPages ? `/ ${numPages}` : ""}
            </span>
            <button
              type="button"
              className="btn btn-ghost !py-1 !text-[12px]"
              disabled={numPages > 0 && page >= numPages}
              onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
            >
              →
            </button>
          </div>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" />}
        </div>

        <div className="relative overflow-auto rounded-[12px] border border-[#E5E7EB] bg-[#F3F4F6]">
          <Document
            file={pdfUrl}
            loading={<div className="flex justify-center p-12 text-[13px] text-[#6B7280]">Carregando PDF…</div>}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => {}}
          >
            <div className="relative inline-block">
              <Page pageNumber={page} width={pageWidth} renderTextLayer renderAnnotationLayer />
              <div
                ref={overlayRef}
                className="absolute inset-0 z-20 cursor-crosshair"
                style={{ pointerEvents: mode ? "auto" : "none" }}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={() => {
                  setDrawing(null);
                  setPreview(null);
                }}
              >
                {pageAssets.map((a) => (
                  <div
                    key={a.id}
                    title={a.kind}
                    className="pointer-events-none absolute border-2"
                    style={{
                      left: `${a.bboxX * 100}%`,
                      top: `${a.bboxY * 100}%`,
                      width: `${a.bboxW * 100}%`,
                      height: `${a.bboxH * 100}%`,
                      borderColor: a.kind === "IMAGE" ? "#D97706" : "#7C3AED",
                      background: a.kind === "IMAGE" ? "rgba(217,119,6,0.12)" : "rgba(124,58,237,0.10)",
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
              </div>
            </div>
          </Document>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-[13px] font-bold text-[#111827]">Regiões marcadas</h3>
          <p className="mb-3 text-[11px] leading-relaxed text-[#6B7280]">
            Cada região pode ser <strong>exclusiva</strong> ou <strong>compartilhada</strong> (escopo). Para o mesmo
            bloco servir a várias questões, marque como compartilhado e adicione vínculos extras abaixo.
          </p>
          <div className="max-h-[280px] space-y-2 overflow-y-auto">
            {assets.length === 0 ? (
              <p className="text-[12px] text-[#9CA3AF]">Nenhuma região ainda.</p>
            ) : (
              assets.map((a) => (
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
                      <div key={l.id} className="flex items-center justify-between gap-1 text-[11px]">
                        <span>
                          {l.role === "FIGURE" ? "Figura" : "Texto-base"} →{" "}
                          {questions.find((q) => q.id === l.importedQuestionId)?.label ?? l.importedQuestionId.slice(0, 8)}
                        </span>
                        <button type="button" className="text-[#9CA3AF] hover:text-red-600" onClick={() => removeLink(l.id)}>
                          <Unlink className="h-3 w-3" />
                        </button>
                      </div>
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
    </div>
  );
}
