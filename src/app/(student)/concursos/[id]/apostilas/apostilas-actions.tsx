"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

export function ApostilasActions({ competitionId, competitionName }: { competitionId: string; competitionName: string }) {
  const [loading, setLoading] = useState(false);

  async function generatePdf(questionCount: number) {
    setLoading(true);
    try {
      const res = await fetch("/api/student/apostilas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId, questionCount }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Não foi possível gerar a apostila");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apostila-${competitionName.replace(/[^\w\-]+/g, "-").slice(0, 48)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Apostila baixada com sucesso!");
    } catch {
      toast.error("Erro ao baixar apostila");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <button
        type="button"
        className="btn btn-primary inline-flex h-11 min-h-[44px] items-center gap-2 rounded-2xl px-4"
        disabled={loading}
        onClick={() => generatePdf(28)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Gerar PDF (28 questões)
      </button>
      <button type="button" className="btn btn-ghost h-11 min-h-[44px] rounded-2xl px-4" disabled={loading} onClick={() => generatePdf(12)}>
        Versão curta (12 questões)
      </button>
    </div>
  );
}
