"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteImportButton({ importId, filename }: { importId: string; filename: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const ok = confirm(
      `Excluir a importação "${filename}"?\n\n` +
        "Rascunhos e itens pendentes de revisão serão removidos. Questões já publicadas no banco permanecem; apenas o vínculo com esta importação é removido.",
    );
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}`, { method: "DELETE" });
      let msg = "Erro ao excluir";
      try {
        const text = await res.text();
        if (text.trim()) {
          const d = JSON.parse(text) as { error?: string };
          if (d.error) msg = d.error;
        }
      } catch {
        if (!res.ok) msg = `Erro ${res.status}`;
      }
      if (!res.ok) {
        toast.error(msg);
        return;
      }
      toast.success("Importação excluída");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      title="Excluir importação"
      disabled={loading}
      onClick={handleDelete}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
        borderRadius: 8,
        border: "1px solid #FECACA",
        background: "#FEF2F2",
        color: "#DC2626",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      <Trash2 style={{ width: 14, height: 14 }} />
    </button>
  );
}
