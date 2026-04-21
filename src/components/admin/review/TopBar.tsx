"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Save, XCircle } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  title: string;
  subtitle?: string | null;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onSave: () => void;
  saving?: boolean;
};

export function TopBar({ title, subtitle, onApproveAll, onRejectAll, onSave, saving }: Props) {
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
            className="btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 shadow-sm hover:bg-emerald-100/90"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Aprovar todas
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRejectAll}
            className="btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-800 shadow-sm hover:bg-red-100/90"
          >
            <XCircle className="h-4 w-4 shrink-0" /> Rejeitar todas
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
            onClick={onSave}
            disabled={!!saving}
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

