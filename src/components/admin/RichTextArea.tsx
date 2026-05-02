"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  /** Rótulo acessível para a área de texto */
  ariaLabel?: string;
};

type FormatToken = {
  title: string;
  label: string;
  open: string;
  close: string;
  /** Símbolo exibido no botão */
  symbol?: React.ReactNode;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

const FORMAT_TOKENS: FormatToken[] = [
  { title: "Negrito (Ctrl+B)", label: "N", open: "**", close: "**", bold: true },
  { title: "Itálico (Ctrl+I)", label: "I", open: "*", close: "*", italic: true },
  { title: "Sublinhado (Ctrl+U)", label: "S̲", open: "__", close: "__", underline: true },
  { title: "Tachado", label: "T̶", open: "~~", close: "~~" },
  { title: "Grifado / Destaque", label: "H", open: "==", close: "==" },
];

/** Renderiza markdown simples como HTML inline para pré-visualização */
export function renderMarkdownInline(text: string): string {
  return text
    .replace(/==(.*?)==/g, '<mark style="background:#FEF08A;border-radius:2px;padding:0 2px">$1</mark>')
    .replace(/~~(.*?)~~/g, "<s>$1</s>")
    .replace(/__(.*?)__/g, "<u>$1</u>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

/**
 * Textarea com barra de ferramentas para aplicar formatação markdown.
 * O conteúdo é armazenado em markdown e renderizado como HTML na pré-visualização.
 */
export function RichTextArea({
  value,
  onChange,
  placeholder,
  className,
  minHeight = "120px",
  disabled,
  ariaLabel,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = useCallback(
    (open: string, close: string) => {
      const el = textareaRef.current;
      if (!el || disabled) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);

      // Toggle: se o texto já está entre os marcadores, remove; senão, adiciona
      const before = value.slice(0, start);
      const after = value.slice(end);

      let nextValue: string;
      let nextStart: number;
      let nextEnd: number;

      if (
        before.endsWith(open) &&
        after.startsWith(close)
      ) {
        // Remove marcadores existentes
        nextValue =
          value.slice(0, start - open.length) +
          selected +
          value.slice(end + close.length);
        nextStart = start - open.length;
        nextEnd = end - open.length;
      } else if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
        // Remove marcadores dentro da seleção
        const inner = selected.slice(open.length, selected.length - close.length);
        nextValue = before + inner + after;
        nextStart = start;
        nextEnd = start + inner.length;
      } else {
        // Adiciona marcadores
        nextValue = before + open + selected + close + after;
        nextStart = start + open.length;
        nextEnd = end + open.length;
      }

      onChange(nextValue);

      // Restaura a seleção após setState
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextStart, nextEnd);
      });
    },
    [value, onChange, disabled],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        applyFormat("**", "**");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        applyFormat("*", "*");
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        applyFormat("__", "__");
      }
    },
    [applyFormat],
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-black/[0.1] bg-slate-50/90 px-2 py-1.5",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label="Formatação de texto"
      >
        {FORMAT_TOKENS.map((tok) => (
          <button
            key={tok.open}
            type="button"
            title={tok.title}
            tabIndex={-1}
            disabled={disabled}
            onClick={() => applyFormat(tok.open, tok.close)}
            className={cn(
              "inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-black/[0.08] bg-white px-1.5 text-[12px] text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-800 active:scale-95",
              tok.bold && "font-black",
              tok.italic && "italic",
              tok.underline && "underline underline-offset-2",
            )}
          >
            {tok.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-medium text-slate-400 select-none">
          Ctrl+B · I · U
        </span>
      </div>

      {/* Área de texto */}
      <textarea
        ref={textareaRef}
        className={cn(
          "input w-full min-w-0 resize-y break-words rounded-t-none text-sm leading-relaxed",
          className,
        )}
        style={{ minHeight }}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
