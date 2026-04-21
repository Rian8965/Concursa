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
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <Link
          href="/admin/importacoes"
          className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#7C3AED]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-[20px] font-extrabold tracking-tight text-[#111827]">{title}</h1>
          <span className="rounded-full bg-[#7C3AED18] px-2 py-0.5 text-[11px] font-extrabold text-[#7C3AED]">UI v3</span>
        </div>
        {subtitle ? <p className="mt-1 text-[13px] font-semibold text-[#7C3AED]">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onApproveAll}
          className="btn !h-[34px] !px-3 !text-[12px]"
          style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", color: "#059669" }}
        >
          <CheckCircle2 className="h-4 w-4" /> Aprovar todas
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRejectAll}
          className="btn !h-[34px] !px-3 !text-[12px]"
          style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#DC2626" }}
        >
          <XCircle className="h-4 w-4" /> Rejeitar todas
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: saving ? 1 : 1.02 }}
          whileTap={{ scale: saving ? 1 : 0.98 }}
          onClick={onSave}
          disabled={!!saving}
          className="btn btn-primary !h-[34px] !text-[12px]"
        >
          {saving ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar revisão</>}
        </motion.button>
      </div>
    </div>
  );
}

