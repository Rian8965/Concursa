"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { X, Loader2 } from "lucide-react";
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

  const hasExisting = existingAlternatives.length > 0;
  const effectivePreview = useMemo(() => {
    if (applyMode === "merge") return mergeAlternatives(existingAlternatives, alts);
    return alts;
  }, [applyMode, existingAlternatives, alts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85]">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[980px] overflow-hidden bg-[#F6F3FF] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-[#111827]">Identificar alternativas</div>
            <div className="mt-0.5 text-[12px] text-[#6B7280]">
              Questão alvo:{" "}
              <span className="font-semibold text-[#7C3AED]">
                {questions.find((q) => q.id === selectedQuestionId)?.label ?? "—"}
              </span>
              {busy && <Loader2 className="ml-2 inline-block h-4 w-4 animate-spin text-[#7C3AED]" />}
            </div>
          </div>
          <button type="button" className="btn btn-ghost !h-[34px] !w-[34px] !p-0" onClick={onClose} title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 bg-white px-4 py-3">
          <div className="text-[12px] font-semibold text-[#6B7280]">
            {stage === "select"
              ? "Selecione no PDF a área onde estão as alternativas."
              : "Prévia: revise/edite e aplique na questão."}
          </div>
          {hasExisting && stage === "preview" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Se já existe</span>
              <select className="input h-[34px] text-[12.5px]" value={applyMode} onChange={(e) => setApplyMode(e.target.value as any)}>
                <option value="replace">Substituir</option>
                <option value="merge">Mesclar</option>
              </select>
            </div>
          )}
        </div>

        <div className="h-[calc(100%-104px)] overflow-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <ImportPdfMarkupPanel
                importId={importId}
                pdfAvailable={pdfAvailable}
                questions={questions}
                assets={assets}
                onChanged={() => {}}
                selectedQuestionId={selectedQuestionId}
                onSelectedQuestionIdChange={onSelectedQuestionIdChange}
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

            <div className="rounded-[var(--r-panel)] border border-[rgba(17,24,39,0.08)] bg-white p-4 shadow-sm">
              {stage === "select" ? (
                <div className="text-[12.5px] text-[#6B7280]">
                  - Ative a seleção e desenhe um retângulo sobre as alternativas.<br />
                  - A IA vai ler o trecho e separar A–E automaticamente.
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] font-extrabold text-[#111827]">Trecho OCR (referência)</div>
                    <pre className="mt-1 max-h-[140px] overflow-auto rounded-lg border border-[#E5E7EB] bg-[#FAFAFC] p-2 text-[11px] text-[#374151] whitespace-pre-wrap">
                      {extractedText || "(vazio)"}
                    </pre>
                  </div>

                  <div>
                    <div className="text-[12px] font-extrabold text-[#111827]">Alternativas</div>
                    <div className="mt-2 space-y-2">
                      {effectivePreview.length === 0 ? (
                        <div className="text-[12px] text-[#6B7280]">Nenhuma alternativa detectada.</div>
                      ) : (
                        effectivePreview.map((a, i) => (
                          <div key={`${a.letter}-${i}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2">
                            <input
                              className="input text-center text-[12px] font-bold"
                              value={a.letter}
                              onChange={(e) => {
                                const v = e.target.value.toUpperCase().slice(0, 1);
                                setAlts((prev) => prev.map((x, idx) => (idx === i ? { ...x, letter: v } : x)));
                              }}
                            />
                            <textarea
                              className="input min-h-[52px] text-[12.5px]"
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

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      className="btn btn-purple !h-[36px] !text-[12px]"
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
                      className="btn btn-ghost !h-[36px] !text-[12px]"
                      onClick={() => setStage("select")}
                      disabled={busy}
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

