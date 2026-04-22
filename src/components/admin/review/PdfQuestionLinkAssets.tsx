"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  ImageIcon,
  Maximize2,
  Pencil,
  Save,
  ChevronDown,
  Trash2,
  RefreshCw,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";

type Props = {
  importId: string;
  questionId: string;
  assets: ImportAssetDTO[];
  onRefresh: () => Promise<void> | void;
  onOpenLinkText: () => void;
  onOpenLinkImage: () => void;
};

function formatAssetLabel(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const t = label.trim();
  if (t.startsWith("AI_BASETEXT:")) {
    const rest = t.slice("AI_BASETEXT:".length).trim();
    return rest ? `Texto-base · ${rest}` : "Texto-base (IA)";
  }
  return t;
}

function linkForQuestion(a: ImportAssetDTO, questionId: string) {
  return a.questionLinks?.find((l) => l.importedQuestionId === questionId) ?? null;
}

function linkRoleForQuestion(a: ImportAssetDTO, questionId: string): "SUPPORT_TEXT" | "FIGURE" | null {
  return linkForQuestion(a, questionId)?.role ?? null;
}

export function PdfQuestionLinkAssets({ importId, questionId, assets, onRefresh, onOpenLinkText, onOpenLinkImage }: Props) {
  const [detailAsset, setDetailAsset] = useState<ImportAssetDTO | null>(null);
  const [draftText, setDraftText] = useState("");
  const [editingInModal, setEditingInModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const openDetail = useCallback((a: ImportAssetDTO) => {
    setDetailAsset(a);
    setDraftText(a.extractedText ?? "");
    setEditingInModal(false);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailAsset(null);
    setDraftText("");
    setEditingInModal(false);
  }, []);

  useEffect(() => {
    if (!detailAsset || editingInModal) return;
    const fresh = assets.find((x) => x.id === detailAsset.id);
    if (!fresh) {
      closeDetail();
      return;
    }
    setDetailAsset(fresh);
    setDraftText(fresh.extractedText ?? "");
  }, [assets, detailAsset?.id, editingInModal, closeDetail]);

  useEffect(() => {
    if (!detailAsset && !lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightbox) setLightbox(null);
        else closeDetail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailAsset, lightbox, closeDetail]);

  const saveText = useCallback(async () => {
    if (!detailAsset || detailAsset.kind !== "TEXT_BLOCK") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/assets/${detailAsset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText: draftText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível salvar o texto.");
        return;
      }
      toast.success("Texto salvo.");
      setEditingInModal(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }, [detailAsset, draftText, importId, onRefresh]);

  const removeLinkOnly = useCallback(async () => {
    if (!detailAsset) return;
    const link = linkForQuestion(detailAsset, questionId);
    if (!link) {
      toast.error("Vínculo não encontrado.");
      return;
    }
    if (
      !window.confirm(
        "Remover o vínculo desta questão com este trecho do PDF? O marcador permanece na importação (outras questões podem usar o mesmo trecho).",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links/${link.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível remover o vínculo.");
        return;
      }
      toast.success("Vínculo removido.");
      closeDetail();
      await onRefresh();
    } finally {
      setRemoving(false);
    }
  }, [detailAsset, questionId, importId, onRefresh, closeDetail]);

  const replaceLink = useCallback(async () => {
    if (!detailAsset) return;
    const link = linkForQuestion(detailAsset, questionId);
    if (!link) {
      toast.error("Vínculo não encontrado.");
      return;
    }
    if (
      !window.confirm(
        "Substituir este vínculo: o vínculo atual será removido e o marcador do PDF será aberto para você desenhar um novo trecho.",
      )
    ) {
      return;
    }
    setReplacing(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links/${link.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível remover o vínculo.");
        return;
      }
      toast.info("Desenhe o novo trecho no PDF.");
      closeDetail();
      await onRefresh();
      if (detailAsset.kind === "TEXT_BLOCK") onOpenLinkText();
      else onOpenLinkImage();
    } finally {
      setReplacing(false);
    }
  }, [detailAsset, questionId, importId, onRefresh, closeDetail, onOpenLinkText, onOpenLinkImage]);

  const detail = detailAsset;
  const detailRole = detail ? linkRoleForQuestion(detail, questionId) : null;
  const detailLabel = detail ? formatAssetLabel(detail.label) : null;
  const detailIsText = detail?.kind === "TEXT_BLOCK";
  const detailIsImage = detail?.kind === "IMAGE";
  const busy = saving || removing || replacing;

  return (
    <>
      <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-white via-white to-violet-50/30 p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex flex-col gap-2 border-b border-black/[0.06] pb-5">
          <h3 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">Vínculos ao PDF</h3>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Toque em um vínculo para ver o conteúdo, editar ou remover. Textos e figuras ficam compactos na lista.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {assets.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/[0.12] bg-slate-50/80 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              Nenhum vínculo ainda. Use os botões abaixo para marcar trechos no PDF.
            </p>
          ) : (
            assets.map((a) => {
              const role = linkRoleForQuestion(a, questionId);
              const isText = a.kind === "TEXT_BLOCK";
              const isImage = a.kind === "IMAGE";
              const labelPretty = formatAssetLabel(a.label);

              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openDetail(a)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-black/[0.03] transition hover:border-violet-200/90 hover:bg-violet-50/40 hover:ring-violet-200/50"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
                      isText && "bg-violet-100 text-violet-700",
                      isImage && "bg-emerald-100 text-emerald-700",
                    )}
                  >
                    {isText ? <FileText className="h-5 w-5" strokeWidth={2} /> : <ImageIcon className="h-5 w-5" strokeWidth={2} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-extrabold text-[var(--text-primary)]">
                        {isText ? "Texto" : "Imagem"}
                      </span>
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--text-muted)] ring-1 ring-black/[0.06]">
                        p.{a.page}
                      </span>
                      {role === "FIGURE" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-900">
                          Ilustração
                        </span>
                      )}
                      {role === "SUPPORT_TEXT" && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-900">
                          Apoio
                        </span>
                      )}
                    </div>
                    {labelPretty ? (
                      <p className="mt-1 truncate text-xs font-medium text-[var(--text-muted)]" title={labelPretty}>
                        {labelPretty}
                      </p>
                    ) : null}
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                </button>
              );
            })
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-primary inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold shadow-md"
            onClick={onOpenLinkText}
          >
            <FileText className="h-4 w-4 shrink-0" /> Vincular texto no PDF
          </button>
          <button
            type="button"
            className="btn inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 px-4 text-sm font-extrabold text-violet-900 shadow-sm hover:bg-violet-100/90"
            onClick={onOpenLinkImage}
          >
            <ImageIcon className="h-4 w-4 shrink-0" /> Vincular imagem no PDF
          </button>
        </div>
      </div>

      {detail ? (
        <div
          className="orbit-modal-backdrop !z-[127]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-link-detail-title"
            className="orbit-modal-panel flex max-h-[min(92dvh,880px)] w-full max-w-[min(560px,calc(100vw-32px))] flex-col !overflow-hidden !p-0 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-black/[0.06] px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="pdf-link-detail-title" className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                    {detailIsText ? "Trecho de texto" : "Figura / imagem"}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--text-muted)] ring-1 ring-black/[0.06]">
                      p.{detail.page}
                    </span>
                    {detailRole === "FIGURE" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-900">
                        Ilustração
                      </span>
                    )}
                    {detailRole === "SUPPORT_TEXT" && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-violet-900">
                        Apoio
                      </span>
                    )}
                  </div>
                  {detailLabel ? (
                    <p className="mt-2 break-words text-xs font-medium text-[var(--text-muted)]">{detailLabel}</p>
                  ) : null}
                </div>
                <button type="button" className="orbit-modal-close shrink-0" onClick={closeDetail} aria-label="Fechar">
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {detailIsText && (
                <div className="space-y-4">
                  {editingInModal ? (
                    <textarea
                      className="input min-h-[240px] w-full resize-y break-words text-sm leading-relaxed"
                      value={draftText}
                      disabled={busy}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Texto do vínculo (OCR/editável)…"
                    />
                  ) : (
                    <div className="max-h-[min(360px,50vh)] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-black/[0.06] bg-slate-50/80 p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {(detail.extractedText ?? "").trim() ? (
                        detail.extractedText
                      ) : (
                        <span className="italic text-[var(--text-muted)]">Sem texto — use Editar para colar ou digitar.</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {detailIsImage && (
                <div className="space-y-3">
                  {detail.imageDataUrl ? (
                    <>
                      <button
                        type="button"
                        className="group relative w-full overflow-hidden rounded-xl border border-black/[0.08] bg-slate-100 shadow-inner"
                        onClick={() => setLightbox(detail.imageDataUrl)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={detail.imageDataUrl}
                          alt="Recorte vinculado"
                          className="mx-auto max-h-[min(420px,55vh)] w-full object-contain p-3 transition-transform group-hover:scale-[1.01]"
                        />
                        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
                          <Maximize2 className="h-3.5 w-3.5" /> Ampliar
                        </span>
                      </button>
                      <p className="text-xs text-[var(--text-muted)]">Clique na imagem para ver em tela cheia.</p>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/90 px-4 py-5 text-center text-sm font-medium text-amber-950">
                      Prévia indisponível. Use <strong>Substituir vínculo</strong> para marcar de novo no PDF ou ajuste o recorte no
                      marcador.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0 space-y-3 border-t border-black/[0.06] bg-gradient-to-t from-slate-50/80 to-white px-5 py-4 sm:px-6">
              {detailIsText && (
                <div className="flex flex-wrap gap-2">
                  {editingInModal ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="btn btn-primary inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold sm:flex-none"
                        onClick={() => void saveText()}
                      >
                        <Save className="h-4 w-4 shrink-0" /> Salvar alterações
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="btn btn-ghost inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-black/[0.1] bg-white px-4 text-sm font-semibold"
                        onClick={() => {
                          setDraftText(detail.extractedText ?? "");
                          setEditingInModal(false);
                        }}
                      >
                        Cancelar edição
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="btn btn-ghost inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50/90 text-sm font-bold text-violet-900 sm:w-auto"
                      onClick={() => setEditingInModal(true)}
                    >
                      <Pencil className="h-4 w-4 shrink-0" /> Editar texto
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  className="btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-extrabold text-red-900 hover:bg-red-100/90 disabled:opacity-60"
                  onClick={() => void removeLinkOnly()}
                >
                  <Trash2 className="h-4 w-4 shrink-0" /> Remover vínculo
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-extrabold text-amber-950 hover:bg-amber-100/90 disabled:opacity-60"
                  onClick={() => void replaceLink()}
                >
                  <RefreshCw className="h-4 w-4 shrink-0" /> Substituir vínculo
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-primary inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-3 text-sm font-extrabold disabled:opacity-60"
                  onClick={() => {
                    closeDetail();
                    onOpenLinkText();
                  }}
                >
                  <Link2 className="h-4 w-4 shrink-0" /> Novo texto
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border-2 border-violet-300 bg-violet-50 px-3 text-sm font-extrabold text-violet-900 disabled:opacity-60"
                  onClick={() => {
                    closeDetail();
                    onOpenLinkImage();
                  }}
                >
                  <Link2 className="h-4 w-4 shrink-0" /> Nova imagem
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[128] flex cursor-zoom-out items-center justify-center border-0 bg-black/85 p-4 backdrop-blur-[2px]"
          onClick={() => setLightbox(null)}
          aria-label="Fechar ampliação"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-[92vh] max-w-full object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </button>
      ) : null}
    </>
  );
}
