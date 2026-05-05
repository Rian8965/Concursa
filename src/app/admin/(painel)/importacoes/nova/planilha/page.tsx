"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
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

const PROMPT_IA = `Você é uma IA especialista em leitura de PDFs de questões de concursos públicos e gabaritos oficiais.

Sua tarefa é extrair as questões do PDF da prova e preencher exatamente a planilha modelo enviada.

Também pode existir um PDF separado com o gabarito oficial.
Se o gabarito estiver em arquivo separado, use esse PDF para preencher a coluna gabarito.
Se o gabarito estiver no mesmo PDF da prova, identifique-o e use-o corretamente.

## Arquivos que posso enviar

Posso enviar:
- PDF da prova/questões;
- PDF do gabarito oficial;
- modelo de planilha CSV/XLSX.

Use todos os arquivos enviados para preencher a planilha corretamente.

---

## Regras principais

- Preencha uma linha por questão.
- Cada questão deve ter seus próprios metadados.
- A planilha pode conter matérias diferentes.
- Não invente informações.
- Se não encontrar algum dado opcional, deixe vazio.
- Preserve o texto original da questão sempre que possível.
- Não inclua questões que dependam de imagem, gráfico, figura, tabela visual ou alternativa em imagem.
- Inclua apenas questões que possam ser representadas em texto.
- Use o gabarito oficial quando ele for enviado.

---

## Colunas da planilha

Preencha exatamente estas colunas, nesta ordem:

1. disciplina — matéria da questão (ex: Direito Constitucional, Língua Portuguesa)
2. assunto — tópico específico dentro da disciplina (ex: Direitos Fundamentais, Interpretação de Texto)
3. banca — organizadora da prova (ex: CESPE, FGV, VUNESP)
4. ano — ano de realização da prova (ex: 2024)
5. nivel — nível de escolaridade exigido (ex: Superior, Médio) — deixe vazio se não souber
6. cidade — município do concurso (ex: Brasília - DF) — deixe vazio se não houver
7. cargo — cargo do concurso (ex: Analista Judiciário) — deixe vazio se não houver
8. concurso — nome do concurso (ex: Concurso TRF 2024) — deixe vazio se não houver
9. numero_questao — número original da questão no PDF
10. enunciado — texto completo do enunciado
11. texto_vinculado — texto de apoio antes da questão; se não houver, deixe vazio
12. alternativa_a — texto da alternativa A (obrigatória)
13. alternativa_b — texto da alternativa B (obrigatória)
14. alternativa_c — texto da alternativa C (opcional)
15. alternativa_d — texto da alternativa D (opcional)
16. alternativa_e — texto da alternativa E (opcional)
17. gabarito — apenas a letra da resposta correta: A, B, C, D ou E

---

## Campos obrigatórios por questão

Obrigatórios:
- disciplina
- assunto
- banca
- ano
- numero_questao
- enunciado
- alternativa_a
- alternativa_b
- gabarito

Opcionais:
- nivel, cidade, cargo, concurso
- texto_vinculado
- alternativa_c, alternativa_d, alternativa_e

---

## Regras das alternativas

- Alternativa A é obrigatória.
- Alternativa B é obrigatória.
- Alternativas C, D e E são opcionais. Se não houver, deixe vazio.
- O gabarito deve conter apenas a letra correta: A, B, C, D ou E.
- O gabarito só pode apontar para uma alternativa preenchida naquela linha.

---

## Regras do gabarito

- Se houver PDF de gabarito separado, use esse arquivo para preencher a coluna gabarito.
- Se o gabarito estiver no próprio PDF da prova, identifique-o e use-o.
- Não tente adivinhar o gabarito.
- Não use interpretação própria para escolher a resposta correta.
- Use somente o gabarito oficial fornecido.
- Se não encontrar o gabarito de uma questão, deixe a coluna gabarito vazia ou marque como PENDENTE.
- Confira se o número da questão corresponde corretamente à letra do gabarito.

Exemplo:
Se no gabarito oficial estiver:
  Questão 1 — B
  Questão 2 — D
Preencher:
  questão 1 → gabarito B
  questão 2 → gabarito D

---

## Texto vinculado

Se houver texto de apoio antes da questão, coloque na coluna texto_vinculado.
Se o mesmo texto servir para várias questões, repita o texto vinculado nas linhas dessas questões.
Se não houver texto de apoio, deixe vazio.

---

## Metadados

Identifique os metadados pelo PDF:
- disciplina, assunto, banca, ano, nivel, cidade, cargo, concurso.

Se o PDF tiver seções por matéria, use a seção correta para cada questão.
Se o PDF tiver questões de matérias diferentes, cada linha deve receber a matéria correta.

---

## Atenção

- Não misture enunciado com alternativas.
- Não coloque o gabarito dentro do enunciado.
- Não coloque comentários ou explicações nas células.
- Não invente banca, ano, matéria ou assunto se não estiver claro.
- Não inclua questões incompletas, ilegíveis ou dependentes de imagem.
- Não altere a ordem das colunas da planilha.
- Não crie colunas extras.

---

## Entrega

Devolva o resultado em formato de tabela compatível com CSV ou XLSX, seguindo exatamente o modelo enviado.
Se possível, entregue a planilha pronta para download.`;

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
  { nome: "alternativa_a", obrig: true },
  { nome: "alternativa_b", obrig: true },
  { nome: "alternativa_c", obrig: false },
  { nome: "alternativa_d", obrig: false },
  { nome: "alternativa_e", obrig: false },
  { nome: "gabarito", obrig: true },
];

export default function ImportarPlanilhaPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
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
            fontSize: 13,
            color: "#7C3AED",
            fontWeight: 600,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 8,
          }}
        >
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
          Importar por Planilha
        </h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Importe questões organizadas em CSV ou XLS/XLSX — sem IA. Cada linha deve ter seus próprios metadados.
        </p>
      </div>

      {/* Aviso */}
      <div
        style={{
          display: "flex",
          gap: 12,
          background: "#FFFBEB",
          border: "1.5px solid #FCD34D",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 20,
        }}
      >
        <AlertCircle style={{ width: 18, height: 18, color: "#D97706", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 13, color: "#92400E", lineHeight: 1.6, margin: 0 }}>
          <strong>Atenção:</strong> Este modelo é indicado apenas para questões em texto. Não utilize para questões com
          imagens, gráficos, fórmulas visuais ou alternativas em imagem.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Modelo + Prompt ─────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Passo 1 — Preparar a planilha com IA
          </p>

          {/* Texto explicativo do fluxo */}
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 18,
            }}
          >
            <p style={{ fontSize: 13, color: "#14532D", lineHeight: 1.75, margin: 0 }}>
              <strong>Como usar:</strong> Baixe o modelo abaixo, envie para uma IA externa o{" "}
              <strong>PDF da prova</strong>, o <strong>PDF do gabarito oficial</strong> (se houver) e o{" "}
              <strong>modelo da planilha</strong>. Cole o prompt copiado. A IA preencherá a planilha no formato correto.
              Depois, volte aqui e importe o arquivo para revisão.
            </p>
          </div>

          {/* Botões lado a lado */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
            <a
              href="/api/admin/imports/spreadsheet-template"
              download="modelo_questoes.csv"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 18px",
                background: "#EDE9FE",
                border: "1.5px solid #C4B5FD",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                color: "#5B21B6",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
            >
              <Download style={{ width: 15, height: 15 }} />
              Baixar modelo de planilha
            </a>

            <button
              type="button"
              onClick={copiarPrompt}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 18px",
                background: promptCopiado ? "#ECFDF5" : "#F0FDF4",
                border: `1.5px solid ${promptCopiado ? "#6EE7B7" : "#86EFAC"}`,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                color: promptCopiado ? "#065F46" : "#14532D",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                transition: "all 0.2s",
              }}
            >
              {promptCopiado ? (
                <>
                  <Check style={{ width: 15, height: 15, color: "#059669" }} />
                  Prompt copiado com sucesso!
                </>
              ) : (
                <>
                  <Copy style={{ width: 15, height: 15 }} />
                  Copiar prompt para IA
                </>
              )}
            </button>
          </div>

          {/* Divisor */}
          <div style={{ borderTop: "1px solid #F3F4F6", marginBottom: 16 }} />

          {/* Tabela de colunas */}
          <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            Colunas da planilha modelo:
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F3F4F6" }}>
                  <th
                    style={{
                      padding: "6px 10px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#374151",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    Coluna
                  </th>
                  <th
                    style={{
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#374151",
                      borderBottom: "1px solid #E5E7EB",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Obrigatória
                  </th>
                </tr>
              </thead>
              <tbody>
                {COLUNAS.map((col, i) => (
                  <tr key={col.nome} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                    <td
                      style={{
                        padding: "5px 10px",
                        fontFamily: "monospace",
                        color: "#5B21B6",
                        borderBottom: "1px solid #F3F4F6",
                      }}
                    >
                      {col.nome}
                    </td>
                    <td
                      style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #F3F4F6" }}
                    >
                      {col.obrig ? (
                        <span style={{ color: "#DC2626", fontWeight: 700, fontSize: 13 }}>✓</span>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Regra das alternativas */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 8,
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <Info style={{ width: 15, height: 15, color: "#3B82F6", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#1E40AF", margin: 0, lineHeight: 1.6 }}>
              <strong>Alternativas:</strong> A e B são obrigatórias. C, D e E são opcionais. O gabarito deve apontar
              apenas para uma alternativa existente e preenchida naquela linha.
            </p>
          </div>
        </div>

        {/* ── Upload ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#374151",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Passo 2 — Importar a planilha preenchida
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setValidationErrors([]);
            }}
          />

          {!arquivo ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%",
                border: "2px dashed #E5E7EB",
                borderRadius: 14,
                padding: "32px 24px",
                background: "#FAFAFA",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-sans)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#7C3AED";
                (e.currentTarget as HTMLButtonElement).style.background = "#FAF5FF";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB";
                (e.currentTarget as HTMLButtonElement).style.background = "#FAFAFA";
              }}
            >
              <FileSpreadsheet style={{ width: 28, height: 28, color: "#D1D5DB" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Clique para selecionar a planilha</p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Formatos aceitos: .csv, .xls, .xlsx</p>
            </button>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: "#EDE9FE",
                border: "1.5px solid #C4B5FD",
                borderRadius: 12,
              }}
            >
              <FileSpreadsheet style={{ width: 22, height: 22, color: "#7C3AED", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#5B21B6",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {arquivo.name}
                </p>
                <p style={{ fontSize: 11, color: "#7C3AED" }}>{(arquivo.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setArquivo(null);
                  setValidationErrors([]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#7C3AED",
                  padding: 4,
                  fontFamily: "var(--font-sans)",
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          )}
        </div>

        {/* Erros de validação */}
        {validationErrors.length > 0 && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1.5px solid #FECACA",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 10 }}>
              {validationErrors.length} erro(s) encontrado(s) na planilha:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {validationErrors.map((err, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: "#991B1B",
                    background: "#FFF5F5",
                    padding: "6px 10px",
                    borderRadius: 6,
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>Linha {err.row}:</span>
                  <span>
                    [{err.field}] {err.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 32 }}>
          <Link href="/admin/importacoes/nova" className="btn btn-ghost">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={!arquivo || loading}
            className="btn btn-primary"
            style={{ minWidth: 180, opacity: !arquivo || loading ? 0.6 : 1 }}
          >
            {loading ? (
              <>
                <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Importando...
              </>
            ) : (
              <>
                <Upload style={{ width: 14, height: 14 }} /> Importar Planilha
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Prompt completo (expansível) ─────────────────────────────────────── */}
      <div
        style={{
          background: "#F8F7FF",
          border: "1.5px solid #EDE9FE",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 40,
        }}
      >
        <button
          type="button"
          onClick={() => setPromptAberto((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#4C1D95", margin: 0 }}>
                Ver prompt completo
              </p>
              <p style={{ fontSize: 12, color: "#7C3AED", margin: 0 }}>
                Clique para visualizar o texto que será copiado para a IA
              </p>
            </div>
          </div>
          {promptAberto ? (
            <ChevronUp style={{ width: 18, height: 18, color: "#7C3AED" }} />
          ) : (
            <ChevronDown style={{ width: 18, height: 18, color: "#7C3AED" }} />
          )}
        </button>

        {promptAberto && (
          <div style={{ padding: "0 20px 20px" }}>
            <div
              style={{
                background: "#1E1E2E",
                borderRadius: 10,
                padding: "16px 18px",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={copiarPrompt}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: promptCopiado ? "#059669" : "#374151",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-sans)",
                  transition: "background 0.2s",
                }}
              >
                {promptCopiado ? (
                  <>
                    <Check style={{ width: 13, height: 13, color: "#fff" }} />
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy style={{ width: 13, height: 13, color: "#9CA3AF" }} />
                    <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>Copiar</span>
                  </>
                )}
              </button>
              <pre
                style={{
                  fontSize: 12,
                  color: "#E2E8F0",
                  fontFamily: "monospace",
                  lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  paddingRight: 90,
                }}
              >
                {PROMPT_IA}
              </pre>
            </div>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
              Envie para uma IA o PDF da prova, o PDF do gabarito oficial (se houver) e o modelo da planilha. Cole este
              prompt. Importe aqui a planilha resultante.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
