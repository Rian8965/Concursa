"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";

const ImportPdfMarkupPanel = dynamic(
  () => import("@/components/admin/ImportPdfMarkupPanel").then((m) => m.ImportPdfMarkupPanel),
  { ssr: false },
);

type QOpt = { id: string; label: string };
type Alt = { letter: string; content: string };

type Props = {
  open: boolean;
  onClose: () => void;
  importId: string;
  pdfAvailable: boolean;
  questions: QOpt[];
  assets: ImportAssetDTO[];
  selectedQuestionId: string;
  onSelectedQuestionIdChange: (id: string) => void;
  existingAlternatives: Alt[];
  onApply: (mode: "replace" | "merge", alternatives: Alt[]) => Promise<void> | void;
};

function mergeAlternatives(existing: Alt[], incoming: Alt[]) {
  const out: Alt[] = [];
  const seen = new Set<string>();
  const push = (a: Alt) => {
    const l = a.letter.trim().toUpperCase().slice(0, 1);
    const c = a.content.trim();
    if (!l || !c) return;
    const key = `${l}:${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ letter: l, content: c });
  };
  existing.forEach(push);
  incoming.forEach(push);
  out.sort((a, b) => a.letter.localeCompare(b.letter));
  return out;
}

export function ImportIdentifyAlternativesDrawer({
  open,
  onClose,
  importId,
  pdfAvailable,
  questions,
  assets,
  selectedQuestionId,
  onSelectedQuestionIdChange,
  existingAlternatives,
  onApply,
}: Props) {
  const [stage, setStage] = useState<"select" | "preview">("select");
  const [busy, setBusy] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [alts, setAlts] = useState<Alt[]>([]);
  const [applyMode, setApplyMode] = useState<"replace" | "merge">("replace");

  useEffect(() => {
    if (!open) return;
    setStage("select");
    setExtractedText("");
    setAlts([]);
    setBusy(false);
  }, [open]);

  const hasExisting = existingAlternatives.length > 0;
  const effectivePreview = useMemo(() => {
    if (applyMode === "merge") return mergeAlternatives(existingAlternatives, alts);
    return alts;
  }, [applyMode, existingAlternatives, alts]);

  if (!open) return null;

  return (
    <div
      className="orbit-modal-backdrop !z-[126]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-alt-drawer-title"
        className="orbit-modal-panel orbit-modal-panel--lg flex !max-h-[min(92dvh,920px)] w-full max-w-[min(1120px,calc(100vw-32px))] !overflow-hidden !p-0 shadow-2xl flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="orbit-modal-panel__head shrink-0 border-b border-black/[0.06]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="import-alt-drawer-title" className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                Identificar alternativas
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span>
                  Questão alvo:{" "}
                  <span className="font-semibold text-violet-700">
                    {questions.find((q) => q.id === selectedQuestionId)?.label ?? "—"}
                  </span>
                </span>
                {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" aria-hidden /> : null}
              </p>
            </div>
            <button type="button" className="orbit-modal-close shrink-0" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        <div className="shrink-0 border-b border-black/[0.06] bg-gradient-to-b from-slate-50/80 to-white px-5 py-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {stage === "select"
                ? "Selecione no PDF a área onde estão as alternativas (A–E)."
                : "Revise a prévia abaixo e aplique na questão quando estiver correto."}
            </p>
            {hasExisting && stage === "preview" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Se já existir</span>
                <select
                  className="input h-10 min-w-[160px] text-sm"
                  value={applyMode}
                  onChange={(e) => setApplyMode(e.target.value as "replace" | "merge")}
                >
                  <option value="replace">Substituir</option>
                  <option value="merge">Mesclar</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-[#f4f2fb] p-4 sm:p-5 lg:flex-row lg:gap-5">
          <div className="min-h-[280px] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-3 shadow-sm sm:min-h-[320px] sm:p-4">
            <ImportPdfMarkupPanel
              importId={importId}
              pdfAvailable={pdfAvailable}
              questions={questions}
              assets={assets}
              onChanged={() => {}}
              selectedQuestionId={selectedQuestionId}
              onSelectedQuestionIdChange={onSelectedQuestionIdChange}
              layout="pdfOnly"
              uiMode="selector"
              onBoxSelected={async ({ page, bbox }) => {
                setBusy(true);
                try {
                  const res = await fetch(`/api/admin/imports/${importId}/identify-alternatives`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ importedQuestionId: selectedQuestionId, page, bbox }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error ?? "Erro ao identificar alternativas");
                  setExtractedText(data.extractedText ?? "");
                  setAlts(Array.isArray(data.alternatives) ? data.alternatives : []);
                  setStage("preview");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Erro");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>

          <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-black/[0.06] bg-white p-4 shadow-md sm:p-5 lg:w-[380px] lg:overflow-y-auto">
            {stage === "select" ? (
              <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">Como usar</p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>No PDF à esquerda, desenhe um retângulo cobrindo todas as alternativas.</li>
                  <li>A IA lê o trecho e separa automaticamente as opções A–E.</li>
                  <li>Confira na prévia e use <strong className="text-violet-800">Aplicar na questão</strong>.</li>
                </ol>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div>
                  <div className="orbit-form-label">Trecho OCR (referência)</div>
                  <pre className="mt-2 max-h-[160px] overflow-auto rounded-xl border border-black/[0.08] bg-slate-50 p-3 text-xs leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                    {extractedText || "(vazio)"}
                  </pre>
                </div>

                <div className="min-h-0 flex-1">
                  <div className="orbit-form-label">Alternativas</div>
                  <div className="mt-2 space-y-3">
                    {effectivePreview.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">Nenhuma alternativa detectada.</p>
                    ) : (
                      effectivePreview.map((a, i) => (
                        <div key={`${a.letter}-${i}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
                          <input
                            className="input text-center text-sm font-bold"
                            value={a.letter}
                            onChange={(e) => {
                              const v = e.target.value.toUpperCase().slice(0, 1);
                              setAlts((prev) => prev.map((x, idx) => (idx === i ? { ...x, letter: v } : x)));
                            }}
                          />
                          <textarea
                            className="input min-h-[56px] resize-y text-sm"
                            value={a.content}
                            onChange={(e) => {
                              const v = e.target.value;
                              setAlts((prev) => prev.map((x, idx) => (idx === i ? { ...x, content: v } : x)));
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-2 border-t border-black/[0.06] pt-4 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    className="btn btn-primary order-1 min-h-[44px] flex-1 rounded-2xl px-4 text-sm font-bold shadow-sm sm:order-none sm:flex-none"
                    disabled={busy || effectivePreview.length === 0}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await onApply(applyMode, effectivePreview);
                        setStage("select");
                        setExtractedText("");
                        setAlts([]);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Aplicar na questão
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost order-2 min-h-[44px] rounded-2xl border border-black/[0.08] px-4 text-sm font-semibold sm:order-none"
                    onClick={() => setStage("select")}
                    disabled={busy}
                  >
                    Voltar ao PDF
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
