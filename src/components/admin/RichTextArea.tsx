"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { editorHtmlToRichMarkdown, importedTextToSafeHtml } from "@/lib/format/question-rich-text";

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

/** Mesmas classes visuais que `FormattedQuestionText` (aluno), + realce de negrito/sublinhado/tachado no modo edição. */
const WYSIWYG_MARKDOWN_CLASSES = cn(
  "question-formatted-text",
  "[&_.question-text-mark]:rounded-sm [&_.question-text-mark]:bg-amber-200/90 [&_.question-text-mark]:px-0.5 [&_.question-text-mark]:text-inherit",
  "dark:[&_.question-text-mark]:bg-amber-400/35",
  "[&_strong]:font-semibold [&_strong]:text-[#111827] dark:[&_strong]:text-[var(--text-primary)]",
  "[&_b]:font-semibold [&_b]:text-[#111827] dark:[&_b]:text-[var(--text-primary)]",
  "[&_u]:underline [&_u]:decoration-solid [&_u]:decoration-auto [&_u]:underline-offset-2",
  "[&_em]:italic",
  "[&_i]:italic",
  "[&_del]:line-through [&_s]:line-through [&_strike]:line-through",
);

function selectionInsideEditor(sel: Selection | null, editor: HTMLElement): boolean {
  if (!sel?.rangeCount) return false;
  const r = sel.getRangeAt(0);
  return editor.contains(r.commonAncestorContainer);
}

function insertPlainText(editor: HTMLElement, text: string) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !selectionInsideEditor(sel, editor)) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  const s2 = window.getSelection();
  if (!s2?.rangeCount) return;
  const r = s2.getRangeAt(0);
  r.deleteContents();
  const tn = document.createTextNode(text.replace(/\r\n/g, "\n"));
  r.insertNode(tn);
  r.setStartAfter(tn);
  r.collapse(true);
  s2.removeAllRanges();
  s2.addRange(r);
}

function toggleHighlightMark(editor: HTMLElement) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !selectionInsideEditor(sel, editor)) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  let anchorEl = range.commonAncestorContainer;
  if (anchorEl.nodeType === Node.TEXT_NODE) anchorEl = anchorEl.parentElement!;
  const existing = anchorEl instanceof Element ? anchorEl.closest("mark.question-text-mark") : null;

  if (existing && editor.contains(existing)) {
    const parent = existing.parentNode;
    if (!parent) return;
    while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
    parent.removeChild(existing);
    parent.normalize();
    return;
  }

  try {
    const mark = document.createElement("mark");
    mark.className = "question-text-mark";
    range.surroundContents(mark);
  } catch {
    try {
      const contents = range.extractContents();
      const mark = document.createElement("mark");
      mark.className = "question-text-mark";
      mark.appendChild(contents);
      range.insertNode(mark);
    } catch {
      /* seleção inválida */
    }
  }
}

function execInEditor(editor: HTMLElement, command: string) {
  editor.focus();
  try {
    document.execCommand(command, false);
  } catch {
    /* ignore */
  }
}

/**
 * Editor WYSIWYG: mesma aparência que o aluno vê (`importedTextToSafeHtml`),
 * armazena o mesmo texto com marcadores leves (sem exibir ** ou __ na tela).
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
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const displayHtml = importedTextToSafeHtml(value);

  const syncFromValue = useCallback(() => {
    const el = editorRef.current;
    if (!el || focused) return;
    if (el.innerHTML !== displayHtml) {
      el.innerHTML = displayHtml;
    }
  }, [displayHtml, focused]);

  useLayoutEffect(() => {
    syncFromValue();
  }, [syncFromValue]);

  const emitMarkdown = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const md = editorHtmlToRichMarkdown(el.innerHTML);
    onChange(md);
  }, [onChange]);

  const onToolbar = useCallback(
    (fn: () => void) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      const el = editorRef.current;
      if (!el) return;
      fn();
      requestAnimationFrame(() => emitMarkdown());
    },
    [disabled, emitMarkdown],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const ed = editorRef.current;
      if (!ed) return;
      insertPlainText(ed, text);
      emitMarkdown();
    },
    [disabled, emitMarkdown],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || (!e.ctrlKey && !e.metaKey)) return;
      const ed = editorRef.current;
      if (!ed) return;
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        execInEditor(ed, "bold");
        requestAnimationFrame(() => emitMarkdown());
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        execInEditor(ed, "italic");
        requestAnimationFrame(() => emitMarkdown());
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        execInEditor(ed, "underline");
        requestAnimationFrame(() => emitMarkdown());
      }
    },
    [disabled, emitMarkdown],
  );

  const showPlaceholder = Boolean(placeholder?.trim()) && !value.trim();

  return (
    <div className="flex flex-col gap-0">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-black/[0.1] bg-slate-50/90 px-2 py-1.5",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label="Formatação de texto"
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          title="Negrito (Ctrl+B)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToolbar(() => {
            const ed = editorRef.current;
            if (ed) execInEditor(ed, "bold");
          })}
          className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-black/[0.08] bg-white px-1.5 text-[12px] font-black text-slate-800 shadow-sm hover:bg-violet-50 hover:text-violet-800 active:scale-95"
        >
          N
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          title="Itálico (Ctrl+I)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToolbar(() => {
            const ed = editorRef.current;
            if (ed) execInEditor(ed, "italic");
          })}
          className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-black/[0.08] bg-white px-1.5 text-[12px] italic text-slate-700 shadow-sm hover:bg-violet-50 hover:text-violet-800 active:scale-95"
        >
          I
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          title="Sublinhado (Ctrl+U)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToolbar(() => {
            const ed = editorRef.current;
            if (ed) execInEditor(ed, "underline");
          })}
          className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-black/[0.08] bg-white px-1.5 text-[12px] text-slate-700 underline underline-offset-2 shadow-sm hover:bg-violet-50 hover:text-violet-800 active:scale-95"
        >
          S̲
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          title="Tachado"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToolbar(() => {
            const ed = editorRef.current;
            if (ed) execInEditor(ed, "strikeThrough");
          })}
          className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-black/[0.08] bg-white px-1.5 text-[12px] text-slate-600 shadow-sm line-through decoration-slate-600 hover:bg-violet-50 hover:text-violet-800 active:scale-95"
        >
          T̶
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          title="Grifado / destaque"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToolbar(() => {
            const ed = editorRef.current;
            if (ed) toggleHighlightMark(ed);
          })}
          className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border border-black/[0.08] bg-amber-100/90 px-1.5 text-[11px] font-extrabold text-amber-950 shadow-sm hover:bg-amber-200/90 active:scale-95"
        >
          H
        </button>
        <span className="ml-auto text-[10px] font-medium text-slate-400 select-none">Ctrl+B · I · U</span>
      </div>

      <div className="relative">
        {showPlaceholder && !focused ? (
          <span className="pointer-events-none absolute left-3 top-2.5 z-10 max-w-[calc(100%-1.5rem)] truncate text-sm text-slate-400 select-none">
            {placeholder}
          </span>
        ) : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onFocus={() => setFocused(true)}
          onBlur={() => {
            emitMarkdown();
            setFocused(false);
          }}
          onInput={emitMarkdown}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          className={cn(
            WYSIWYG_MARKDOWN_CLASSES,
            "relative z-0 w-full min-w-0 rounded-t-none border border-black/[0.1] bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:z-[1] focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20",
            disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
            className,
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
