"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/cn";
import type { ImportAssetDTO, PdfLinkType } from "@/components/admin/ImportPdfMarkupPanel";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Search } from "lucide-react";

const ImportPdfMarkupPanel = dynamic(
  () => import("@/components/admin/ImportPdfMarkupPanel").then((m) => m.ImportPdfMarkupPanel),
  { ssr: false },
);

type QOpt = { id: string; label: string };

const ALT_LETTERS = ["A", "B", "C", "D", "E"] as const;

type LinkCreatedInfo = { assetId: string; role: "SUPPORT_TEXT" | "FIGURE"; page: number; alternativeLetter?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  importId: string;
  pdfAvailable: boolean;
  questions: QOpt[];
  assets: ImportAssetDTO[];
  selectedQuestionId: string;
  onSelectedQuestionIdChange: (id: string) => void;
  linkType: PdfLinkType;
  onLinkTypeChange: (t: PdfLinkType) => void;
  onChanged: () => Promise<void> | void;
  initialPage?: number;
  /** Modo “Aplicar alternativas”: uma letra ativa, só imagem, desenha por letra. */
  applyAlternativesMode?: boolean;
  activeAlternativeLetter?: string;
  onActiveAlternativeLetterChange?: (letter: string) => void;
  /** Após vincular uma alternativa (não fecha o modal). */
  onAlternativeLinked?: (info: LinkCreatedInfo) => void;
};

export function ImportLinkDrawer({
  open,
  onClose,
  importId,
  pdfAvailable,
  questions,
  assets,
  selectedQuestionId,
  onSelectedQuestionIdChange,
  linkType,
  onLinkTypeChange,
  onChanged,
  initialPage = 1,
  applyAlternativesMode = false,
  activeAlternativeLetter = "A",
  onActiveAlternativeLetterChange,
  onAlternativeLinked,
}: Props) {
  if (!open) return null;

  const title = applyAlternativesMode ? "Aplicar alternativas" : "Vincular imagem ou texto";
  const altL = applyAlternativesMode
    ? activeAlternativeLetter.trim().toUpperCase().slice(0, 1) || "A"
    : null;
  const safeAlt = ALT_LETTERS.includes(altL as (typeof ALT_LETTERS)[number]) ? altL : "A";

  // ── Multi-apply modal state (linker only) ──────────────────────────────────
  const [pending, setPending] = useState<{
    assetId: string;
    role: "SUPPORT_TEXT" | "FIGURE";
    page: number;
    alternativeLetter: string | null;
    baseQuestionId: string;
  } | null>(null);
  const [applyAlso, setApplyAlso] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qSearch, setQSearch] = useState("");
  const [submittingMulti, setSubmittingMulti] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    if (!open) return;
    // reset modal state whenever drawer opens
    setPending(null);
    setApplyAlso(false);
    setSelectedIds(new Set());
    setQSearch("");
    setSubmittingMulti(false);
    setConfirmReplace(false);
  }, [open]);

  const baseIndex = useMemo(() => questions.findIndex((q) => q.id === selectedQuestionId), [questions, selectedQuestionId]);
  const suggested = useMemo(() => {
    if (baseIndex < 0) return [];
    return questions.slice(baseIndex + 1, baseIndex + 9); // próximas 8
  }, [questions, baseIndex]);

  const filteredQuestions = useMemo(() => {
    const t = qSearch.trim().toLowerCase();
    if (!t) return suggested.length ? suggested : questions.slice(0, 12);
    return questions.filter((q) => q.label.toLowerCase().includes(t));
  }, [qSearch, questions, suggested]);

  async function cancelPending() {
    if (!pending) return;
    // se o admin cancelar, remove o asset recém-criado para não deixar “lixo” sem vínculo
    try {
      await fetch(`/api/admin/imports/${importId}/assets/${pending.assetId}`, { method: "DELETE" });
    } catch {
      // ignore
    } finally {
      setPending(null);
      setApplyAlso(false);
      setSelectedIds(new Set());
      setQSearch("");
      setConfirmReplace(false);
    }
  }

  async function applyPending() {
    if (!pending) return;
    const targets = new Set<string>();
    targets.add(pending.baseQuestionId);
    if (applyAlso) {
      for (const id of selectedIds) targets.add(id);
    }
    const ids = [...targets];
    if (!ids.length) return;
    setSubmittingMulti(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importAssetId: pending.assetId,
          importedQuestionIds: ids,
          role: pending.role,
          alternativeLetter: pending.alternativeLetter,
          confirmReplace,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Algumas questões já possuem vínculo nessa alternativa. Marque “Confirmar substituição” para continuar.");
          return;
        }
        toast.error(data?.error ?? "Erro ao aplicar vínculo em lote");
        return;
      }
      toast.success(`Vínculo aplicado em ${ids.length} questão(ões).`);
      setPending(null);
      setApplyAlso(false);
      setSelectedIds(new Set());
      setQSearch("");
      setConfirmReplace(false);
      await onChanged();
      onClose();
    } finally {
      setSubmittingMulti(false);
    }
  }

  return (
    <>
      <div
        className="orbit-modal-backdrop !z-[125]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-link-drawer-title"
          className="orbit-modal-panel orbit-modal-panel--lg flex !max-h-[min(92dvh,920px)] w-full max-w-[min(1024px,calc(100vw-32px))] !overflow-hidden !p-0 shadow-2xl flex-col"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <div className="orbit-modal-panel__head shrink-0 border-b border-black/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="import-link-drawer-title" className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Questão:{" "}
                <span className="font-semibold text-violet-700">
                  {questions.find((q) => q.id === selectedQuestionId)?.label ?? "—"}
                </span>
                {applyAlternativesMode ? (
                  <span className="ml-2 text-xs text-[var(--text-muted)]">Recorte a imagem de cada alternativa no PDF.</span>
                ) : null}
              </p>
            </div>
            <button type="button" className="orbit-modal-close shrink-0" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        {applyAlternativesMode && onActiveAlternativeLetterChange ? (
          <div className="shrink-0 border-b border-black/[0.05] bg-slate-50/90 px-4 py-2 sm:px-6">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Letra ativa</p>
            <div className="flex flex-wrap gap-1">
              {ALT_LETTERS.map((L) => (
                <button
                  key={L}
                  type="button"
                  onClick={() => onActiveAlternativeLetterChange(L)}
                  className={cn(
                    "h-8 min-w-[2rem] rounded-lg px-2 text-xs font-extrabold",
                    safeAlt === L
                      ? "bg-violet-600 text-white shadow"
                      : "border border-black/[0.1] bg-white text-[var(--text-secondary)] hover:bg-slate-100",
                  )}
                >
                  {L}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!applyAlternativesMode ? (
          <div className="shrink-0 space-y-4 border-b border-black/[0.06] bg-gradient-to-b from-slate-50/80 to-white px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
              <div className="min-w-[200px] flex-1">
                <label className="orbit-form-label text-xs uppercase tracking-wide text-[var(--text-muted)]">Tipo de vínculo</label>
                <select
                  className="input mt-1.5 h-11 w-full max-w-md text-sm"
                  value={linkType}
                  onChange={(e) => onLinkTypeChange(e.target.value as PdfLinkType)}
                >
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="TABLE">Tabela</option>
                  <option value="GRAPH">Gráfico</option>
                  <option value="MIXED">Área mista</option>
                </select>
              </div>
              <p className="text-sm font-medium leading-relaxed text-violet-800 sm:max-w-md sm:pb-1">
                Desenhe um retângulo no PDF abaixo para criar o vínculo com a questão selecionada.
              </p>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4f2fb] px-4 py-4 sm:px-5 sm:py-5">
          <ImportPdfMarkupPanel
            importId={importId}
            pdfAvailable={pdfAvailable}
            questions={questions}
            assets={assets}
            onChanged={onChanged}
            selectedQuestionId={selectedQuestionId}
            onSelectedQuestionIdChange={onSelectedQuestionIdChange}
            uiMode="linker"
            linkType={applyAlternativesMode ? "IMAGE" : linkType}
            layout="pdfOnly"
            targetAlternativeLetter={applyAlternativesMode ? safeAlt : null}
            deferLinkCreation={!applyAlternativesMode}
            onLinkCreated={(info) => {
              void onChanged();
              if (applyAlternativesMode) {
                onAlternativeLinked?.(info);
              } else {
                // novo fluxo: perguntar se aplica para outras questões antes de salvar vínculos
                const baseQ = (info as any).targetQuestionId || selectedQuestionId;
                if (!baseQ) {
                  toast.error("Questão alvo não identificada.");
                  return;
                }
                setPending({
                  assetId: info.assetId,
                  role: info.role,
                  page: info.page,
                  alternativeLetter: info.alternativeLetter?.trim().toUpperCase() ?? null,
                  baseQuestionId: baseQ,
                });
              }
            }}
            initialPage={initialPage}
          />
        </div>
        </div>
      </div>

      {/* ── Modal: aplicar vínculo em múltiplas questões ── */}
      {pending && (
        <div
          className="orbit-modal-backdrop !z-[126]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) void cancelPending();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Aplicar vínculo em outras questões"
            className="orbit-modal-panel orbit-modal-panel--md w-full max-w-[min(720px,calc(100vw-32px))] !p-0 !overflow-hidden shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black/[0.06] px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-violet-600">
                    Vincular texto/imagem
                  </p>
                  <h3 className="mt-1 text-[18px] font-extrabold tracking-tight text-[var(--text-primary)]">
                    Este vínculo também serve para outras questões?
                  </h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Seleção atual: <span className="font-semibold text-violet-700">{questions.find((q) => q.id === pending.baseQuestionId)?.label ?? "Questão atual"}</span>{" "}
                    · p.{pending.page}
                  </p>
                </div>
                <button type="button" className="orbit-modal-close" onClick={() => void cancelPending()} aria-label="Fechar">
                  ×
                </button>
              </div>
            </div>

            <div className="px-5 py-4 sm:px-6">
              <label className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={applyAlso}
                  onChange={(e) => setApplyAlso(e.target.checked)}
                  className="h-[18px] w-[18px]"
                />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Aplicar também em outras questões</span>
              </label>

              {applyAlso && (
                <div className="mt-4 rounded-2xl border border-black/[0.06] bg-[var(--bg-surface)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        className="input !pl-9"
                        placeholder="Buscar por número/label (ex: 6, questão 6...)"
                        value={qSearch}
                        onChange={(e) => setQSearch(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost rounded-xl"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Limpar
                    </button>
                  </div>

                  <div className="mt-3 max-h-[280px] overflow-y-auto rounded-xl border border-black/[0.06] bg-white">
                    {filteredQuestions.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">Nenhuma questão encontrada.</p>
                    ) : (
                      <ul className="divide-y divide-black/[0.05]">
                        {filteredQuestions
                          .filter((q) => q.id !== pending.baseQuestionId)
                          .map((q) => {
                            const checked = selectedIds.has(q.id);
                            return (
                              <li key={q.id} className="flex items-center gap-3 px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="h-[18px] w-[18px]"
                                  checked={checked}
                                  onChange={(e) => {
                                    setSelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(q.id);
                                      else next.delete(q.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-sm font-semibold text-[var(--text-primary)]">{q.label}</span>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>

                  {pending.alternativeLetter && (
                    <label className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={confirmReplace}
                        onChange={(e) => setConfirmReplace(e.target.checked)}
                        className="mt-0.5 h-[18px] w-[18px]"
                      />
                      <span className="text-[13px] text-amber-950">
                        <span className="font-extrabold">Confirmar substituição</span>{" "}
                        (se alguma questão selecionada já tiver vínculo na alternativa {pending.alternativeLetter}).
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-black/[0.06] bg-gradient-to-t from-slate-50/80 to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              <button
                type="button"
                className="btn btn-ghost rounded-2xl"
                disabled={submittingMulti}
                onClick={() => void cancelPending()}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary inline-flex items-center justify-center gap-2 rounded-2xl"
                disabled={submittingMulti}
                onClick={() => void applyPending()}
              >
                <CheckCircle2 className="h-4 w-4" />
                {submittingMulti
                  ? "Aplicando…"
                  : applyAlso
                    ? `Aplicar nesta + ${selectedIds.size} selecionada(s)`
                    : "Aplicar somente nesta questão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
