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
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={() => generatePdf(28)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44 }}
      >
        {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <Download style={{ width: 16, height: 16 }} />}
        Gerar PDF (28 questões)
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={loading}
        onClick={() => generatePdf(12)}
        style={{ minHeight: 44 }}
      >
        Versão curta (12 questões)
      </button>
    </div>
  );
}
