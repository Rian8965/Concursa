"use client";

import dynamic from "next/dynamic";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";

const ImportPdfMarkupPanel = dynamic(
  () => import("@/components/admin/ImportPdfMarkupPanel").then((m) => m.ImportPdfMarkupPanel),
  { ssr: false },
);

type QOpt = { id: string; label: string };

type Props = {
  importId: string;
  pdfAvailable: boolean;
  questions: QOpt[];
  assets: ImportAssetDTO[];
  selectedQuestionId: string;
  onSelectedQuestionIdChange: (id: string) => void;
  onChanged: () => Promise<void> | void;
};

export function VisualizadorPDF({
  importId,
  pdfAvailable,
  questions,
  assets,
  selectedQuestionId,
  onSelectedQuestionIdChange,
  onChanged,
}: Props) {
  return (
    <div className="min-w-0">
      <ImportPdfMarkupPanel
        importId={importId}
        pdfAvailable={pdfAvailable}
        questions={questions}
        assets={assets}
        onChanged={onChanged}
        selectedQuestionId={selectedQuestionId}
        onSelectedQuestionIdChange={onSelectedQuestionIdChange}
        layout="pdfOnly"
        uiMode="review"
      />
    </div>
  );
}

