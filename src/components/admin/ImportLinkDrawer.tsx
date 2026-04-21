"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { ImportAssetDTO, PdfLinkType } from "@/components/admin/ImportPdfMarkupPanel";

const ImportPdfMarkupPanel = dynamic(
  () => import("@/components/admin/ImportPdfMarkupPanel").then((m) => m.ImportPdfMarkupPanel),
  { ssr: false },
);

type QOpt = { id: string; label: string };

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
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[980px] overflow-hidden bg-[#F6F3FF] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold text-[#111827]">Vincular imagem ou texto</div>
            <div className="mt-0.5 text-[12px] text-[#6B7280]">
              Questão alvo:{" "}
              <span className="font-semibold text-[#7C3AED]">
                {questions.find((q) => q.id === selectedQuestionId)?.label ?? "—"}
              </span>
              <span className="ml-2 rounded-full bg-[#7C3AED18] px-2 py-0.5 text-[11px] font-extrabold text-[#7C3AED]">
                Drawer v1
              </span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost !h-[34px] !w-[34px] !p-0" onClick={onClose} title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Tipo</span>
          <select
            className="input h-[34px] max-w-[260px] text-[12.5px]"
            value={linkType}
            onChange={(e) => onLinkTypeChange(e.target.value as PdfLinkType)}
          >
            <option value="TEXT">Texto</option>
            <option value="IMAGE">Imagem</option>
            <option value="TABLE">Tabela</option>
            <option value="GRAPH">Gráfico</option>
            <option value="MIXED">Área mista</option>
          </select>
          <span className="text-[12px] font-semibold text-[#6B7280]">Desenhe um retângulo no PDF para criar o vínculo.</span>
        </div>

        <div className="h-[calc(100%-104px)] overflow-auto p-4">
          <ImportPdfMarkupPanel
            importId={importId}
            pdfAvailable={pdfAvailable}
            questions={questions}
            assets={assets}
            onChanged={onChanged}
            selectedQuestionId={selectedQuestionId}
            onSelectedQuestionIdChange={onSelectedQuestionIdChange}
            uiMode="linker"
            linkType={linkType}
          />
        </div>
      </div>
    </div>
  );
}

