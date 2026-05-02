"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { importedTextToSafeHtml } from "@/lib/format/question-rich-text";

type Props = {
  text: string | null | undefined;
  className?: string;
  /** Elemento wrapper: span (inline) ou div (bloco) */
  as?: "span" | "div";
};

/**
 * Exibe enunciado ou alternativa com negrito/itálico/sublinhado/tachado/grifo
 * quando o texto usa os marcadores do pipeline de importação.
 */
export function FormattedQuestionText({ text, className, as = "span" }: Props) {
  const html = useMemo(() => importedTextToSafeHtml(String(text ?? "")), [text]);
  const Tag = as;
  return (
    <Tag
      className={cn("question-formatted-text [&_.question-text-mark]:rounded-sm [&_.question-text-mark]:bg-amber-200/90 [&_.question-text-mark]:px-0.5 [&_.question-text-mark]:text-inherit dark:[&_.question-text-mark]:bg-amber-400/35", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
