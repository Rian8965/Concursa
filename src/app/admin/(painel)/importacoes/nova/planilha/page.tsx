"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  FileText,
  X,
  Download,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Info,
} from "lucide-react";

type RowError = { row: number; field: string; message: string };

// ──────────────────────────────────────────────────────────────────────────────
// Prompt completo para a IA externa
// ──────────────────────────────────────────────────────────────────────────────

const PROMPT_IA = `Você é uma IA especialista em leitura de PDFs de questões de concursos públicos e gabaritos oficiais.

Sua tarefa é extrair as questões do PDF da prova e preencher exatamente a planilha modelo enviada.

Também pode existir um PDF separado com gabarito oficial.
Se o gabarito estiver em arquivo separado, use esse PDF para preencher a coluna gabarito.
Se o gabarito estiver no mesmo PDF da prova, identifique-o e use-o corretamente.

## IMPORTANTE — Não ignore questões com elementos visuais

Não ignore questões que tenham imagem, gráfico, tabela, fórmula, mapa, figura, charge, tirinha, esquema, relatório ou alternativas em imagem.

Nesses casos:
- extraia o enunciado textual normalmente;
- extraia as alternativas em texto, se existirem;
- preencha o gabarito se houver;
- marque nas colunas de pendência visual o que precisará ser vinculado depois pelo administrador.

## Arquivos que posso enviar

- PDF da prova/questões;
- PDF do gabarito oficial (se houver);
- modelo de planilha CSV/XLSX.

Use todos os arquivos enviados para preencher a planilha corretamente.

---

## Colunas da planilha

Preencha exatamente estas colunas, nesta ordem:

1. disciplina — matéria da questão (ex: Direito Constitucional, Matemática)
2. assunto — tópico específico (ex: Direitos Fundamentais, Frações)
3. banca — organizadora da prova (ex: CESPE, FGV, VUNESP)
4. ano — ano da prova (ex: 2024)
5. nivel — nível de escolaridade (ex: Superior, Médio) — vazio se não souber
6. cidade — município do concurso (ex: Brasília - DF) — vazio se não houver
7. cargo — cargo do concurso (ex: Analista Judiciário) — vazio se não houver
8. concurso — nome do concurso (ex: Concurso STF 2024) — vazio se não houver
9. numero_questao — número original da questão no PDF
10. enunciado — texto completo do enunciado
11. texto_vinculado — texto de apoio compartilhado; vazio se não houver
12. Alternativa A — obrigatória
13. Alternativa B — obrigatória
14. Alternativa C — opcional
15. Alternativa D — opcional
16. Alternativa E — opcional
17. gabarito — letra correta (A, B, C, D ou E); use PENDENTE se não encontrar
18. precisa de imagem — SIM ou NÃO
19. precisa de grafico — SIM ou NÃO
20. precisa de tabela — SIM ou NÃO
21. precisa de formula — SIM ou NÃO
22. precisa de mapa/figura/esquema — SIM ou NÃO
23. alternativas em imagem — SIM se as alternativas forem imagens/fórmulas visuais
24. observacao da IA — breve explicação da pendência visual, quando houver

---

## Campos obrigatórios por questão

- disciplina, assunto, banca, ano
- numero_questao, enunciado
- Alternativa A, Alternativa B
- gabarito (ou PENDENTE)

## Campos opcionais

- nivel, cidade, cargo, concurso
- texto_vinculado
- Alternativa C, D, E
- colunas de pendência visual (preencher NÃO se não houver)

---

## Regras das alternativas

- A e B são obrigatórias.
- C, D e E são opcionais. Deixe vazio se não existirem.
- O gabarito deve ser apenas a letra correta (A–E) ou PENDENTE.
- O gabarito só pode apontar para uma alternativa preenchida.

---

## Regras do gabarito

- Use o gabarito oficial fornecido.
- Se o gabarito estiver em PDF separado, use esse arquivo.
- Não adivinhe o gabarito.
- Se não encontrar o gabarito de uma questão, coloque PENDENTE.
- Confira se o número da questão bate com a letra do gabarito.

Exemplo:
  Questão 1 — B → gabarito B
  Questão 2 — D → gabarito D

---

## Regras das colunas de pendência visual

- Preencha com SIM ou NÃO.
- Se a questão depender de imagem: precisa de imagem = SIM
- Se depender de gráfico: precisa de grafico = SIM
- Se depender de tabela: precisa de tabela = SIM
- Se depender de fórmula visual: precisa de formula = SIM
- Se depender de mapa, figura, charge, tirinha, esquema: precisa de mapa/figura/esquema = SIM
- Se as alternativas forem imagens ou fórmulas: alternativas em imagem = SIM
- Use a coluna "observacao da IA" para explicar brevemente a pendência.

Exemplos de marcação:
  "Observe a figura abaixo" → precisa de imagem: SIM | obs: "A questão depende de figura."
  "Com base no gráfico" → precisa de grafico: SIM | obs: "A questão depende de gráfico."
  Alternativas com fórmulas → alternativas em imagem: SIM | obs: "Alternativas são fórmulas visuais."

---

## Texto vinculado

Se houver texto de apoio antes da questão, coloque na coluna texto_vinculado.
Se o mesmo texto servir para várias questões, repita em cada linha.
Se não houver, deixe vazio.

---

## Atenção

- Não misture enunciado com alternativas.
- Não coloque o gabarito dentro do enunciado.
- Não invente dados. Campos opcionais desconhecidos: deixe vazio.
- Não altere a ordem das colunas.
- Não crie colunas extras.
- Preserve o texto original das questões.

---

## Entrega

Devolva o resultado em tabela compatível com CSV ou XLSX, seguindo exatamente o modelo enviado.
Se possível, entregue a planilha pronta para download.`;

// ──────────────────────────────────────────────────────────────────────────────
// Colunas do modelo
// ──────────────────────────────────────────────────────────────────────────────

const COLUNAS = [
  { nome: "disciplina", obrig: true },
  { nome: "assunto", obrig: true },
  { nome: "banca", obrig: true },
  { nome: "ano", obrig: true },
  { nome: "nivel", obrig: false },
  { nome: "cidade", obrig: false },
  { nome: "cargo", obrig: false },
  { nome: "concurso", obrig: false },
  { nome: "numero_questao", obrig: true },
  { nome: "enunciado", obrig: true },
  { nome: "texto_vinculado", obrig: false },
  { nome: "Alternativa A", obrig: true },
  { nome: "Alternativa B", obrig: true },
  { nome: "Alternativa C", obrig: false },
  { nome: "Alternativa D", obrig: false },
  { nome: "Alternativa E", obrig: false },
  { nome: "gabarito", obrig: true },
  { nome: "precisa de imagem", obrig: false, flag: true },
  { nome: "precisa de grafico", obrig: false, flag: true },
  { nome: "precisa de tabela", obrig: false, flag: true },
  { nome: "precisa de formula", obrig: false, flag: true },
  { nome: "precisa de mapa/figura/esquema", obrig: false, flag: true },
  { nome: "alternativas em imagem", obrig: false, flag: true },
  { nome: "observacao da IA", obrig: false, flag: true },
];

export default function ImportarPlanilhaPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pdfApoio, setPdfApoio] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<RowError[]>([]);
  const [promptCopiado, setPromptCopiado] = useState(false);
  const [promptAberto, setPromptAberto] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) {
      toast.error("Selecione a planilha antes de continuar.");
      return;
    }
    setLoading(true);
    setValidationErrors([]);

    const fd = new FormData();
    fd.append("arquivo", arquivo);
    if (pdfApoio) fd.append("pdf_apoio", pdfApoio);

    try {
      const res = await fetch("/api/admin/imports/spreadsheet", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.validationErrors) {
          setValidationErrors(data.validationErrors as RowError[]);
          toast.error("Corrija os erros na planilha antes de continuar.");
        } else {
          toast.error(data.error ?? "Erro ao importar planilha.");
        }
        setLoading(false);
        return;
      }

      toast.success(`${data.total} questões importadas! Redirecionando para revisão...`);
      router.push(`/admin/importacoes/${data.importId}/revisao`);
    } catch {
      toast.error("Erro de conexão com o servidor.");
      setLoading(false);
    }
  }

  function copiarPrompt() {
    navigator.clipboard
      .writeText(PROMPT_IA)
      .then(() => {
        setPromptCopiado(true);
        toast.success("Prompt copiado com sucesso.");
        setTimeout(() => setPromptCopiado(false), 3000);
      })
      .catch(() => toast.error("Não foi possível copiar. Tente manualmente."));
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/admin/importacoes/nova"
          style={{
            fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none",
            display: "flex", alignItems: "center", gap: 4, marginBottom: 8,
          }}
        >
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
          Importar por Planilha
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Importe questões via CSV ou XLS/XLSX. Inclui suporte a questões com imagens e gráficos via PDF de apoio.
        </p>
      </div>

      {/* Aviso */}
      <div style={{ display: "flex", gap: 12, background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
        <AlertCircle style={{ width: 18, height: 18, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, color: "#92400E", lineHeight: 1.6, margin: 0 }}>
          <strong>Questões com imagens/gráficos:</strong> a IA extrai o texto e marca as colunas de pendência visual.
          Suba também o PDF original para vincular os elementos visuais manualmente na revisão.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Passo 1: Preparar planilha ──────────────────────────────────── */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Passo 1 — Preparar a planilha com IA
          </p>

          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
            <p style={{ fontSize: 13, color: "#14532D", lineHeight: 1.75, margin: 0 }}>
              Baixe o modelo, envie para uma IA o <strong>PDF da prova</strong>, o <strong>PDF do gabarito</strong>{" "}
              (se houver) e o <strong>modelo da planilha</strong>. Cole o prompt copiado. A IA preencherá a planilha,
              inclusive marcando pendências visuais. Depois volte aqui e importe o arquivo.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            <a
              href="/api/admin/imports/spreadsheet-template"
              download="modelo_questoes.csv"
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px",
                background: "#EDE9FE", border: "1.5px solid #C4B5FD", borderRadius: 10,
                fontSize: 13, fontWeight: 700, color: "#5B21B6", textDecoration: "none",
              }}
            >
              <Download style={{ width: 15, height: 15 }} /> Baixar modelo de planilha
            </a>

            <button
              type="button"
              onClick={copiarPrompt}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px",
                background: promptCopiado ? "#ECFDF5" : "#F0FDF4",
                border: `1.5px solid ${promptCopiado ? "#6EE7B7" : "#86EFAC"}`,
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: promptCopiado ? "#065F46" : "#14532D",
                cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all 0.2s",
              }}
            >
              {promptCopiado ? (
                <><Check style={{ width: 15, height: 15, color: "#059669" }} /> Prompt copiado!</>
              ) : (
                <><Copy style={{ width: 15, height: 15 }} /> Copiar prompt para IA</>
              )}
            </button>
          </div>

          <div style={{ borderTop: "1px solid #F3F4F6", marginBottom: 16 }} />

          {/* Tabela de colunas */}
          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Colunas do modelo:
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "#374151", borderBottom: "1px solid #E5E7EB" }}>Coluna</th>
                  <th style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: "#374151", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>Obrigatória</th>
                </tr>
              </thead>
              <tbody>
                {COLUNAS.map((col, i) => (
                  <tr key={col.nome} style={{ background: col.flag ? "#FFFBEB" : (i % 2 === 0 ? "#fff" : "#FAFAFA") }}>
                    <td style={{ padding: "5px 10px", fontFamily: "monospace", color: col.flag ? "#92400E" : "#5B21B6", borderBottom: "1px solid #F3F4F6" }}>
                      {col.flag && <span style={{ fontSize: 10, marginRight: 5 }}>🔍</span>}
                      {col.nome}
                    </td>
                    <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #F3F4F6" }}>
                      {col.obrig ? <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 13 }}>✓</span> : <span style={{ color: "#9CA3AF" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
            🔍 Colunas amarelas = flags de pendência visual (SIM / NÃO). A IA preenche automaticamente.
          </p>

          <div style={{ marginTop: 12, display: "flex", gap: 8, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px" }}>
            <Info style={{ width: 15, height: 15, color: "#3B82F6", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#1E40AF", margin: 0, lineHeight: 1.6 }}>
              <strong>Alternativas:</strong> A e B obrigatórias, C/D/E opcionais. Gabarito = letra correta ou{" "}
              <code style={{ fontFamily: "monospace" }}>PENDENTE</code> se desconhecido.
            </p>
          </div>
        </div>

        {/* ── Passo 2: Upload da planilha ────────────────────────────────── */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Passo 2 — Importar a planilha preenchida
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setValidationErrors([]); }}
          />

          {!arquivo ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%", border: "2px dashed #E5E7EB", borderRadius: 14, padding: "28px 24px",
                background: "#FAFAFA", cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#7C3AED"; (e.currentTarget as HTMLButtonElement).style.background = "#FAF5FF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLButtonElement).style.background = "#FAFAFA"; }}
            >
              <FileSpreadsheet style={{ width: 28, height: 28, color: "#D1D5DB" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Clique para selecionar a planilha</p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Formatos aceitos: .csv, .xls, .xlsx</p>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#EDE9FE", border: "1.5px solid #C4B5FD", borderRadius: 12 }}>
              <FileSpreadsheet style={{ width: 22, height: 22, color: "#7C3AED", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arquivo.name}</p>
                <p style={{ fontSize: 11, color: "#7C3AED" }}>{(arquivo.size / 1024).toFixed(1)} KB</p>
              </div>
              <button type="button" onClick={() => { setArquivo(null); setValidationErrors([]); if (fileRef.current) fileRef.current.value = ""; }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#7C3AED", padding: 4, fontFamily: "var(--font-sans)" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          )}
        </div>

        {/* ── Passo 3: PDF de apoio (opcional) ───────────────────────────── */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Passo 3 — PDF de apoio <span style={{ fontSize: 11, color: "#9CA3AF", textTransform: "none", fontWeight: 400 }}>(opcional)</span>
          </p>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14, lineHeight: 1.6 }}>
            Suba o PDF original da prova se houver questões com imagens, gráficos, tabelas ou fórmulas. O sistema{" "}
            <strong>não extrai questões do PDF</strong> — ele só ficará disponível na revisão para vincular os
            elementos visuais manualmente.
          </p>
          <input
            ref={pdfRef}
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={(e) => setPdfApoio(e.target.files?.[0] ?? null)}
          />

          {!pdfApoio ? (
            <button
              type="button"
              onClick={() => pdfRef.current?.click()}
              style={{
                width: "100%", border: "2px dashed #E5E7EB", borderRadius: 12, padding: "20px 24px",
                background: "#FAFAFA", cursor: "pointer", display: "flex", alignItems: "center",
                gap: 10, fontFamily: "var(--font-sans)", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#F59E0B"; (e.currentTarget as HTMLButtonElement).style.background = "#FFFBEB"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLButtonElement).style.background = "#FAFAFA"; }}
            >
              <FileText style={{ width: 22, height: 22, color: "#D1D5DB" }} />
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>Clique para selecionar o PDF da prova</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Será usado como apoio visual na revisão</p>
              </div>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 12 }}>
              <FileText style={{ width: 22, height: 22, color: "#D97706", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdfApoio.name}</p>
                <p style={{ fontSize: 11, color: "#B45309" }}>{(pdfApoio.size / 1024 / 1024).toFixed(2)} MB · PDF de apoio</p>
              </div>
              <button type="button" onClick={() => { setPdfApoio(null); if (pdfRef.current) pdfRef.current.value = ""; }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#D97706", padding: 4, fontFamily: "var(--font-sans)" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          )}
        </div>

        {/* Erros de validação */}
        {validationErrors.length > 0 && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 10 }}>
              {validationErrors.length} erro(s) na planilha:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {validationErrors.map((err, i) => (
                <div key={i} style={{ fontSize: 12, color: "#991B1B", background: "#FFF5F5", padding: "6px 10px", borderRadius: 6, display: "flex", gap: 6 }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Linha {err.row}:</span>
                  <span>[{err.field}] {err.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botões */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 32 }}>
          <Link href="/admin/importacoes/nova" className="btn btn-ghost">Cancelar</Link>
          <button
            type="submit"
            disabled={!arquivo || loading}
            className="btn btn-primary"
            style={{ minWidth: 180, opacity: !arquivo || loading ? 0.6 : 1 }}
          >
            {loading ? (
              <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Importando...</>
            ) : (
              <><Upload style={{ width: 14, height: 14 }} /> Importar Planilha</>
            )}
          </button>
        </div>
      </form>

      {/* ── Prompt completo (expansível) ───────────────────────────────────── */}
      <div style={{ background: "#F8F7FF", border: "1.5px solid #EDE9FE", borderRadius: 14, overflow: "hidden", marginBottom: 40 }}>
        <button
          type="button"
          onClick={() => setPromptAberto((v) => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#4C1D95", margin: 0 }}>Ver prompt completo</p>
              <p style={{ fontSize: 12, color: "#7C3AED", margin: 0 }}>Texto que será copiado para a IA externa</p>
            </div>
          </div>
          {promptAberto ? <ChevronUp style={{ width: 18, height: 18, color: "#7C3AED" }} /> : <ChevronDown style={{ width: 18, height: 18, color: "#7C3AED" }} />}
        </button>

        {promptAberto && (
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ background: "#1E1E2E", borderRadius: 10, padding: "16px 18px", position: "relative" }}>
              <button
                type="button"
                onClick={copiarPrompt}
                style={{ position: "absolute", top: 12, right: 12, background: promptCopiado ? "#059669" : "#374151", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-sans)", transition: "background 0.2s" }}
              >
                {promptCopiado ? (
                  <><Check style={{ width: 13, height: 13, color: "#fff" }} /><span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>Copiado!</span></>
                ) : (
                  <><Copy style={{ width: 13, height: 13, color: "#9CA3AF" }} /><span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Copiar</span></>
                )}
              </button>
              <pre style={{ fontSize: 12, color: "#E2E8F0", fontFamily: "monospace", lineHeight: 1.75, whiteSpace: "pre-wrap", margin: 0, paddingRight: 90 }}>
                {PROMPT_IA}
              </pre>
            </div>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
              Envie para a IA: PDF da prova + PDF do gabarito (se houver) + modelo da planilha + este prompt.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
