"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils/cn";
import type { ImportAssetDTO, PdfLinkType } from "@/components/admin/ImportPdfMarkupPanel";

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

  return (
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
            onLinkCreated={(info) => {
              void onChanged();
              if (applyAlternativesMode) {
                onAlternativeLinked?.(info);
              } else {
                onClose();
              }
            }}
            initialPage={initialPage}
          />
        </div>
      </div>
    </div>
  );
}
