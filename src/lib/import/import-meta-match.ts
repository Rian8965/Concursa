/**
 * Mapear texto vindo da IA (matéria, banca) para IDs reais, sem I/O.
 * Reutilizável no servidor (pós-Document AI) e no browser (revisão).
 */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Tenta achar a disciplina mais provável: igualdade exata, contém, ou inversão.
 */
export function matchSubjectNameToId(
  materia: string | null | undefined,
  rows: { id: string; name: string; slug: string }[],
): string | null {
  const t = (materia ?? "").trim();
  if (t.length < 2) return null;
  const n = norm(t);
  for (const s of rows) {
    const nName = norm(s.name);
    if (nName === n || s.slug && norm(s.slug) === n.replace(/\s/g, "-")) {
      return s.id;
    }
  }
  for (const s of rows) {
    const nName = norm(s.name);
    if (n.includes(nName) && nName.length > 2) return s.id;
  }
  for (const s of rows) {
    if (n.length > 2 && norm(s.name).includes(n)) return s.id;
  }
  return null;
}

export function matchExamBoardBancaToId(
  banca: string | null | undefined,
  rows: { id: string; name: string; acronym: string }[],
  fallback: string | null,
): string | null {
  const t = (banca ?? "").trim();
  if (!t) return fallback;
  const head = t.split(/[·|/,\-—(]/)[0]!.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (head.length >= 2) {
    const b = rows.find((x) => x.acronym.toUpperCase() === head);
    if (b) return b.id;
  }
  const n = norm(t);
  for (const b of rows) {
    if (norm(b.acronym) === n) return b.id;
    if (norm(b.name) === n) return b.id;
  }
  for (const b of rows) {
    if (n.includes(norm(b.acronym)) && norm(b.acronym).length > 1) return b.id;
  }
  for (const b of rows) {
    if (n.includes(norm(b.name)) && norm(b.name).length > 2) return b.id;
  }
  return fallback;
}

export function coerceMetaYear(ano: unknown, fallback: number | null): number | null {
  if (typeof ano === "number" && Number.isFinite(ano)) {
    const y = Math.floor(ano);
    if (y >= 1980 && y <= 2100) return y;
  }
  if (typeof ano === "string") {
    const t = ano.trim();
    if (/^\d{4}$/.test(t)) {
      const y = parseInt(t, 10);
      if (y >= 1980 && y <= 2100) return y;
    }
  }
  return fallback;
}
