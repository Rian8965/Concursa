"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ImageIcon, Maximize2, Pencil, Save, X } from "lucide-react";
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

function linkRoleForQuestion(a: ImportAssetDTO, questionId: string): "SUPPORT_TEXT" | "FIGURE" | null {
  const link = a.questionLinks?.find((l) => l.importedQuestionId === questionId);
  return link?.role ?? null;
}

export function PdfQuestionLinkAssets({ importId, questionId, assets, onRefresh, onOpenLinkText, onOpenLinkImage }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const startEdit = useCallback((a: ImportAssetDTO) => {
    if (a.kind !== "TEXT_BLOCK") return;
    setEditingId(a.id);
    setDraftById((prev) => ({ ...prev, [a.id]: a.extractedText ?? "" }));
  }, []);

  const cancelEdit = useCallback((assetId: string) => {
    setEditingId(null);
    setDraftById((prev) => {
      const next = { ...prev };
      delete next[assetId];
      return next;
    });
  }, []);

  const saveText = useCallback(
    async (assetId: string) => {
      const text = draftById[assetId] ?? "";
      setSavingId(assetId);
      try {
        const res = await fetch(`/api/admin/imports/${importId}/assets/${assetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extractedText: text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error ?? "Não foi possível salvar o texto do vínculo.");
          return;
        }
        toast.success("Texto do vínculo salvo.");
        setEditingId(null);
        setDraftById((prev) => {
          const next = { ...prev };
          delete next[assetId];
          return next;
        });
        await onRefresh();
      } finally {
        setSavingId(null);
      }
    },
    [draftById, importId, onRefresh],
  );

  return (
    <>
      <div className="rounded-2xl border border-violet-100/90 bg-gradient-to-b from-white via-white to-violet-50/30 p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex flex-col gap-2 border-b border-black/[0.06] pb-5">
          <h3 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">Vínculos ao PDF</h3>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Textos e figuras desta questão. Editar o texto não remove o vínculo.
          </p>
        </div>

        <div className="mt-5 space-y-5">
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
              const isEditing = editingId === a.id;
              const busy = savingId === a.id;

              return (
                <div
                  key={a.id}
                  className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm ring-1 ring-black/[0.03]"
                >
                  <div className="flex flex-wrap items-start gap-3 border-b border-black/[0.05] bg-slate-50/80 px-4 py-3 sm:px-4 sm:py-3.5">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-[var(--text-primary)]">
                          {isText ? "Trecho de texto" : "Figura / imagem"}
                        </span>
                        <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-[var(--text-muted)] ring-1 ring-black/[0.06]">
                          p. {a.page}
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
                        <p className="mt-1 break-words text-xs font-medium leading-snug text-[var(--text-muted)]" title={a.label ?? undefined}>
                          {labelPretty}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4 sm:p-4">
                    {isText && (
                      <>
                        {isEditing ? (
                          <div className="space-y-3">
                            <textarea
                              className="input min-h-[200px] w-full min-w-0 resize-y break-words text-sm leading-relaxed"
                              value={draftById[a.id] ?? ""}
                              disabled={busy}
                              onChange={(e) => setDraftById((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              placeholder="Texto extraído do PDF (edite para corrigir o OCR)…"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                className="btn btn-primary inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-md disabled:opacity-60"
                                onClick={() => saveText(a.id)}
                              >
                                <Save className="h-4 w-4 shrink-0" /> Salvar texto
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                className="btn btn-ghost inline-flex min-h-[42px] items-center gap-2 rounded-2xl border border-black/[0.1] bg-white px-4 text-sm font-semibold disabled:opacity-60"
                                onClick={() => cancelEdit(a.id)}
                              >
                                <X className="h-4 w-4 shrink-0" /> Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="max-h-[min(320px,50vh)] min-h-[4rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-black/[0.06] bg-slate-50/50 p-3.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                              {(a.extractedText ?? "").trim() ? (
                                a.extractedText
                              ) : (
                                <span className="italic text-[var(--text-muted)]">Sem texto extraído — use Editar para colar ou digitar.</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50/80 text-sm font-bold text-violet-900 hover:bg-violet-100/90 sm:w-auto"
                              onClick={() => startEdit(a)}
                            >
                              <Pencil className="h-4 w-4 shrink-0" /> Editar texto do vínculo
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {isImage && (
                      <div className="space-y-3">
                        {a.imageDataUrl ? (
                          <>
                            <button
                              type="button"
                              className="group relative w-full overflow-hidden rounded-xl border border-black/[0.08] bg-slate-100 shadow-inner"
                              onClick={() => setLightbox(a.imageDataUrl)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.imageDataUrl}
                                alt="Recorte vinculado à questão"
                                className="mx-auto max-h-48 w-full object-contain p-2 transition-transform group-hover:scale-[1.02]"
                              />
                              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                                <Maximize2 className="h-3.5 w-3.5" /> Ampliar
                              </span>
                            </button>
                            <p className="text-xs text-[var(--text-muted)]">Clique na miniatura para ver em tamanho maior.</p>
                          </>
                        ) : (
                          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 px-3 py-4 text-center text-sm font-medium text-amber-950">
                            Prévia indisponível. Abra o marcador no PDF e ajuste o recorte da imagem, se necessário.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center border-0 bg-black/85 p-4 backdrop-blur-[2px]"
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
