"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

type Decision = "approve" | "reject" | "pending";

export type SidebarQuestion = {
  id: string;
  title: string;
  preview: string;
  badge?: { text: string; tone: "warn" | "danger" | "neutral" | "success" };
  confidencePct?: number | null;
  decision: Decision;
};

type Props = {
  items: SidebarQuestion[];
  activeId: string;
  onActiveChange: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onlyNeedsReview: boolean;
  onOnlyNeedsReviewChange: (v: boolean) => void;
  onDecisionChange: (id: string, next: Decision) => void;
};

function badgeClass(tone: NonNullable<SidebarQuestion["badge"]>["tone"]) {
  if (tone === "warn") return "bg-[#D9770618] text-[#D97706]";
  if (tone === "danger") return "bg-[#DC262618] text-[#DC2626]";
  if (tone === "success") return "bg-[#05966918] text-[#059669]";
  return "bg-[#1118270D] text-[#374151]";
}

export function SidebarQuestoes({
  items,
  activeId,
  onActiveChange,
  search,
  onSearchChange,
  onlyNeedsReview,
  onOnlyNeedsReviewChange,
  onDecisionChange,
}: Props) {
  return (
    <div className="flex h-[calc(100vh-220px)] flex-col overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#E5E7EB] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] font-extrabold text-[#111827]">Questões</div>
          <button
            type="button"
            className={`btn !h-[30px] !text-[12px] ${onlyNeedsReview ? "btn-primary" : "btn-ghost"}`}
            onClick={() => onOnlyNeedsReviewChange(!onlyNeedsReview)}
            title="Filtrar só revisão"
          >
            Só revisão
          </button>
        </div>
        <input
          className="input mt-2 h-[34px] text-[12.5px]"
          placeholder="Buscar (texto, nº, etc.)…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-auto p-2">
        <div className="space-y-2">
          {items.map((q) => {
            const active = q.id === activeId;
            return (
              <motion.button
                key={q.id}
                type="button"
                onClick={() => onActiveChange(q.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full rounded-[14px] border px-3 py-2 text-left transition"
                style={{
                  borderColor: active ? "#7C3AED" : "#E5E7EB",
                  background: active ? "rgba(124,58,237,0.08)" : "#fff",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[12px] font-extrabold text-[#111827]">{q.title}</div>
                      {q.badge ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${badgeClass(q.badge.tone)}`}>
                          {q.badge.text}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#6B7280]">{q.preview}</div>
                    {q.confidencePct != null ? (
                      <div className="mt-1 text-[11px] font-semibold text-[#9CA3AF]">Confiança: {q.confidencePct}%</div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn !h-[28px] !w-[28px] !p-0"
                      style={{
                        background: q.decision === "approve" ? "#059669" : "#F3F4F6",
                        border: q.decision === "approve" ? "1px solid #059669" : "1px solid #E5E7EB",
                        color: q.decision === "approve" ? "#fff" : "#374151",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDecisionChange(q.id, q.decision === "approve" ? "pending" : "approve");
                      }}
                      title="Aprovar"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn !h-[28px] !w-[28px] !p-0"
                      style={{
                        background: q.decision === "reject" ? "#DC2626" : "#F3F4F6",
                        border: q.decision === "reject" ? "1px solid #DC2626" : "1px solid #E5E7EB",
                        color: q.decision === "reject" ? "#fff" : "#374151",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDecisionChange(q.id, q.decision === "reject" ? "pending" : "reject");
                      }}
                      title="Rejeitar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.button>
            );
          })}

          {items.length === 0 && (
            <div className="rounded-[14px] border border-dashed border-[#E5E7EB] bg-[#FAFAFC] p-6 text-center text-[12px] text-[#6B7280]">
              Nenhuma questão encontrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

