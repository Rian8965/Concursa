"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Trash2, Unlink } from "lucide-react";
import type { ImportAssetDTO } from "@/components/admin/ImportPdfMarkupPanel";

type QOpt = { id: string; label: string };

type Props = {
  importId: string;
  questions: QOpt[];
  assets: ImportAssetDTO[];
  selectedQuestionId: string;
  onChanged: () => Promise<void> | void;
};

export function PainelDireito({ importId, questions, assets, selectedQuestionId, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [editingText, setEditingText] = useState<Record<string, string>>({});
  const [linkExtra, setLinkExtra] = useState({
    assetId: "",
    qid: selectedQuestionId,
    role: "SUPPORT_TEXT" as "SUPPORT_TEXT" | "FIGURE",
  });

  useEffect(() => {
    setLinkExtra((s) => ({ ...s, qid: selectedQuestionId }));
  }, [selectedQuestionId]);

  const linkedAssets = useMemo(() => {
    return assets
      .filter((a) => (a.questionLinks ?? []).some((l) => l.importedQuestionId === selectedQuestionId))
      .slice()
      .sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
  }, [assets, selectedQuestionId]);

  const patchAssetText = async (assetId: string, extractedText: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedText }),
      });
      if (!res.ok) throw new Error("Erro ao salvar texto");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (assetId: string) => {
    if (!confirm("Remover esta região e todos os vínculos?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/assets/${assetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const removeLink = async (linkId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links/${linkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desvincular");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const addExtraLink = async () => {
    if (!linkExtra.assetId || !linkExtra.qid) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/imports/${importId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importedQuestionId: linkExtra.qid,
          importAssetId: linkExtra.assetId,
          role: linkExtra.role,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao vincular");
      }
      await onChanged();
      setLinkExtra((s) => ({ ...s, assetId: "" }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] flex-col gap-3 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] font-extrabold text-[#111827]">Contexto da questão</div>
          <div className="mt-0.5 text-[12px] text-[#6B7280]">
            {questions.find((q) => q.id === selectedQuestionId)?.label ?? "Questão"}
          </div>
        </div>
        {busy && <div className="text-[11px] font-semibold text-[#7C3AED]">Salvando…</div>}
      </div>

      <div className="rounded-[14px] border border-[#E5E7EB] bg-[#FAFAFC] p-3">
        <div className="mb-2 text-[12px] font-extrabold text-[#111827]">Vínculos da questão</div>
        <div className="max-h-[320px] space-y-2 overflow-auto">
          {linkedAssets.length === 0 ? (
            <div className="text-[12px] text-[#6B7280]">Nenhum vínculo ainda.</div>
          ) : (
            linkedAssets.map((a) => (
              <div key={a.id} className="rounded-[12px] border border-[#E5E7EB] bg-white p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] font-semibold text-[#374151]">
                    {a.kind === "IMAGE" ? "Figura" : "Texto-base"} <span className="text-[#9CA3AF]">· p.{a.page}</span>
                  </div>
                  <button type="button" className="text-red-600" title="Excluir região" onClick={() => removeAsset(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {a.kind === "TEXT_BLOCK" && (
                  <textarea
                    className="input mt-2 min-h-[56px] text-[12px]"
                    placeholder="Texto-base…"
                    value={editingText[a.id] ?? a.extractedText ?? ""}
                    onChange={(e) => setEditingText((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    onBlur={() => {
                      const v = editingText[a.id];
                      if (v !== undefined && v !== (a.extractedText ?? "")) patchAssetText(a.id, v);
                    }}
                  />
                )}

                <div className="mt-2 space-y-1 border-t border-[#E5E7EB] pt-2">
                  {(a.questionLinks ?? [])
                    .filter((l) => l.importedQuestionId === selectedQuestionId)
                    .map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-[11px] text-[#6B7280]">
                        <span>{l.role === "FIGURE" ? "Figura" : "Texto-base"} (link)</span>
                        <button type="button" className="text-[#9CA3AF] hover:text-red-600" onClick={() => removeLink(l.id)}>
                          <Unlink className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-3">
        <div className="mb-2 flex items-center gap-1 text-[12px] font-extrabold text-[#111827]">
          <Link2 className="h-4 w-4" /> Adicionar vínculo
        </div>
        <select
          className="input mb-2 text-[12px]"
          value={linkExtra.assetId}
          onChange={(e) => setLinkExtra((s) => ({ ...s, assetId: e.target.value }))}
        >
          <option value="">Selecione a região…</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.kind} · p.{a.page} · {a.id.slice(0, 6)}…
            </option>
          ))}
        </select>
        <select
          className="input mb-2 text-[12px]"
          value={linkExtra.qid}
          onChange={(e) => setLinkExtra((s) => ({ ...s, qid: e.target.value }))}
        >
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
        <select
          className="input mb-2 text-[12px]"
          value={linkExtra.role}
          onChange={(e) => setLinkExtra((s) => ({ ...s, role: e.target.value as any }))}
        >
          <option value="SUPPORT_TEXT">Texto-base</option>
          <option value="FIGURE">Figura</option>
        </select>
        <button type="button" className="btn btn-purple w-full !text-[12px]" onClick={addExtraLink} disabled={busy}>
          Vincular
        </button>
      </div>
    </div>
  );
}

