"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Layers, Save, XCircle } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  title: string;
  subtitle?: string | null;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onSave: () => void;
  onSaveChunk?: () => void;
  saving?: boolean;
  savingChunk?: boolean;
  chunkProgress?: { saved: number; total: number } | null;
  saveDisabled?: boolean;
  saveHint?: string;
};

export function TopBar({
  title,
  subtitle,
  onApproveAll,
  onRejectAll,
  onSave,
  onSaveChunk,
  saving,
  savingChunk,
  chunkProgress,
  saveDisabled,
  saveHint,
}: Props) {
  const anyBusy = saving || savingChunk;

  return (
    <div className="orbit-card-premium !p-0" data-review-topbar>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0 max-w-full">
          <Link
            href="/admin/importacoes"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-800"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" /> Voltar
          </Link>
          <h1 className="break-words text-balance text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-2 break-words text-sm font-semibold text-violet-700">{subtitle}</p> : null}
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:justify-end">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onApproveAll}
            disabled={!!anyBusy}
            className="btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 shadow-sm hover:bg-emerald-100/90 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Aprovar todas
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRejectAll}
            disabled={!!anyBusy}
            className="btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-800 shadow-sm hover:bg-red-100/90 disabled:opacity-60"
          >
            <XCircle className="h-4 w-4 shrink-0" /> Rejeitar todas
          </motion.button>

          {saveHint ? (
            <p className="w-full text-right text-xs font-bold leading-snug text-rose-700 sm:order-last sm:max-w-sm sm:text-right">{saveHint}</p>
          ) : null}

          {/* Botão salvar em partes — aparece sempre que onSaveChunk for fornecido */}
          {onSaveChunk && (
            <div className="flex flex-col items-end gap-1">
              <motion.button
                type="button"
                whileHover={{ scale: anyBusy || saveDisabled ? 1 : 1.02 }}
                whileTap={{ scale: anyBusy || saveDisabled ? 1 : 0.98 }}
                onClick={onSaveChunk}
                disabled={!!anyBusy || !!saveDisabled}
                title="Salva as próximas 25 questões aprovadas para não sobrecarregar o servidor"
                className="btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-violet-300 bg-violet-50 px-4 text-sm font-bold text-violet-800 shadow-sm hover:bg-violet-100/90 disabled:opacity-60"
              >
                {savingChunk ? (
                  "Salvando lote…"
                ) : (
                  <>
                    <Layers className="h-4 w-4 shrink-0" /> Salvar em partes
                  </>
                )}
              </motion.button>
              {chunkProgress && (
                <span className="text-xs font-semibold text-violet-700">
                  {chunkProgress.saved} / {chunkProgress.total} salvas
                </span>
              )}
            </div>
          )}

          <motion.button
            type="button"
            whileHover={{ scale: anyBusy || saveDisabled ? 1 : 1.02 }}
            whileTap={{ scale: anyBusy || saveDisabled ? 1 : 0.98 }}
            onClick={onSave}
            disabled={!!anyBusy || !!saveDisabled}
            className="btn btn-primary inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold shadow-md disabled:opacity-60"
          >
            {saving ? "Salvando…" : (
              <>
                <Save className="h-4 w-4 shrink-0" /> Salvar revisão
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

