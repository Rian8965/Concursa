/**
 * Texto de questões/alternativas com marcadores estilo markdown (imports / admin).
 * Gera HTML seguro para exibição ao aluno: escapa primeiro, depois aplica formatação.
 *
 * Suporta: **negrito**, *itálico*, __sublinhado__, ~~tachado~~, ==grifado (destaque)==
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converte texto com marcadores leves em HTML inline seguro.
 * Quebras de linha viram <br>.
 */
export function importedTextToSafeHtml(text: string): string {
  if (!text) return "";
  let s = escapeHtml(text);

  // Ordem: destaque e tachado antes de negrito/itálico para não quebrar marcadores internos
  s = s.replace(/==([^=]+)==/g, '<mark class="question-text-mark">$1</mark>');
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<u>$1</u>");
  // Itálico: *trecho* (não deve restar ** após o passo anterior)
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  s = s.replace(/\n/g, "<br />");
  return s;
}

/**
 * Serializa o HTML gerado pelo editor WYSIWYG (contenteditable) de volta aos
 * mesmos marcadores usados por `importedTextToSafeHtml` (armazenamento / aluno).
 */
function serializeDomNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u00a0/g, " ");
  }
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    let s = "";
    node.childNodes.forEach((c) => {
      s += serializeDomNode(c);
    });
    return s;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") return "\n";

  let inner = "";
  el.childNodes.forEach((c) => {
    inner += serializeDomNode(c);
  });

  switch (tag) {
    case "strong":
    case "b":
      return inner ? `**${inner}**` : "";
    case "em":
    case "i":
      return inner ? `*${inner}*` : "";
    case "u":
      return inner ? `__${inner}__` : "";
    case "s":
    case "del":
    case "strike":
      return inner ? `~~${inner}~~` : "";
    case "mark":
      return inner ? `==${inner}==` : "";
    case "div":
    case "p":
    case "header":
    case "footer":
    case "section":
    case "article":
    case "main":
    case "li":
      return inner + "\n";
    case "span":
    case "font":
    default:
      return inner;
  }
}

export function editorHtmlToRichMarkdown(html: string): string {
  const t = html.trim();
  if (!t) return "";
  if (/^<br\s*\/?>$/i.test(t)) return "";

  const doc = new DOMParser().parseFromString(html, "text/html");
  let out = "";
  doc.body.childNodes.forEach((child) => {
    out += serializeDomNode(child);
  });
  out = out.replace(/\u00a0/g, " ").replace(/\n+$/, "");
  return out;
}
