import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  findOrCreateSubject,
  findOrCreateTopic,
  findOrCreateExamBoard,
  findOrCreateCity,
  findOrCreateJobRole,
} from "@/lib/import/auto-create-meta";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

// ──────────────────────────────────────────────────────────────────────────────
// Mapeamento de nomes de colunas → canônico
// ──────────────────────────────────────────────────────────────────────────────

const COL_ALIASES: Record<string, string> = {
  // Metadados
  disciplina: "disciplina",
  materia: "disciplina",
  "disciplina materia": "disciplina",
  "disciplina/materia": "disciplina",
  assunto: "assunto",
  topico: "assunto",
  "topico assunto": "assunto",
  banca: "banca",
  "orgao banca": "banca",
  "organizadora": "banca",
  ano: "ano",
  "ano da prova": "ano",
  "ano prova": "ano",
  nivel: "nivel",
  "nivel escolaridade": "nivel",
  "nivel dificuldade": "nivel",
  cidade: "cidade",
  "cidade estado": "cidade",
  municipio: "cidade",
  cargo: "cargo",
  "cargo funcao": "cargo",
  funcao: "cargo",
  concurso: "concurso",
  "nome concurso": "concurso",
  "concurso publico": "concurso",
  edital: "concurso",
  // Dados da questão
  numero_questao: "numero_questao",
  "numero da questao": "numero_questao",
  "numero questao": "numero_questao",
  numero: "numero_questao",
  "no": "numero_questao",
  "questao": "numero_questao",
  enunciado: "enunciado",
  "texto da questao": "enunciado",
  "texto questao": "enunciado",
  texto_vinculado: "texto_vinculado",
  "texto vinculado": "texto_vinculado",
  "texto de apoio": "texto_vinculado",
  "texto base": "texto_vinculado",
  "texto apoio": "texto_vinculado",
  "texto referencia": "texto_vinculado",
  alternativa_a: "alternativa_a",
  "alternativa a": "alternativa_a",
  "alt a": "alternativa_a",
  "opcao a": "alternativa_a",
  a: "alternativa_a",
  alternativa_b: "alternativa_b",
  "alternativa b": "alternativa_b",
  "alt b": "alternativa_b",
  "opcao b": "alternativa_b",
  b: "alternativa_b",
  alternativa_c: "alternativa_c",
  "alternativa c": "alternativa_c",
  "alt c": "alternativa_c",
  "opcao c": "alternativa_c",
  c: "alternativa_c",
  alternativa_d: "alternativa_d",
  "alternativa d": "alternativa_d",
  "alt d": "alternativa_d",
  "opcao d": "alternativa_d",
  d: "alternativa_d",
  alternativa_e: "alternativa_e",
  "alternativa e": "alternativa_e",
  "alt e": "alternativa_e",
  "opcao e": "alternativa_e",
  e: "alternativa_e",
  gabarito: "gabarito",
  resposta: "gabarito",
  "resposta correta": "gabarito",
  "alternativa correta": "gabarito",
  "letra correta": "gabarito",
};

function normalizeColName(raw: string): string {
  return (raw ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s_/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────

type ParsedRow = {
  rowIndex: number;
  // Metadados por questão (texto livre — serão resolvidos para IDs)
  disciplina: string;
  assunto: string;
  banca: string;
  ano: string;
  nivel: string;
  cidade: string;
  cargo: string;
  concurso: string;
  // Dados da questão
  numero: string;
  enunciado: string;
  textoVinculado: string;
  altA: string;
  altB: string;
  altC: string;
  altD: string;
  altE: string;
  gabarito: string;
};

type RowError = { row: number; field: string; message: string };

// ──────────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Falha ao ler o formulário" }, { status: 400 });
  }

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const fileName = arquivo.name ?? "planilha";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "xls", "xlsx"].includes(ext)) {
    return NextResponse.json(
      { error: "Formato inválido. Envie um arquivo .csv, .xls ou .xlsx." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Verifique o formato." },
      { status: 400 },
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: "Planilha vazia ou inválida." }, { status: 400 });
  }
  const sheet = workbook.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rawRows.length === 0) {
    return NextResponse.json({ error: "A planilha não contém linhas de dados." }, { status: 400 });
  }

  // ── Parsear linhas ──────────────────────────────────────────────────────────

  function mapRow(raw: Record<string, unknown>): ParsedRow | null {
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      const norm = normalizeColName(k);
      const canonical = COL_ALIASES[norm];
      if (canonical) {
        mapped[canonical] = String(v ?? "").trim();
      }
    }
    // Linha em branco ou sem dado relevante → ignorar
    if (!mapped["enunciado"] && !mapped["gabarito"]) return null;
    return {
      rowIndex: 0,
      disciplina: mapped["disciplina"] ?? "",
      assunto: mapped["assunto"] ?? "",
      banca: mapped["banca"] ?? "",
      ano: mapped["ano"] ?? "",
      nivel: mapped["nivel"] ?? "",
      cidade: mapped["cidade"] ?? "",
      cargo: mapped["cargo"] ?? "",
      concurso: mapped["concurso"] ?? "",
      numero: mapped["numero_questao"] ?? "",
      enunciado: mapped["enunciado"] ?? "",
      textoVinculado: mapped["texto_vinculado"] ?? "",
      altA: mapped["alternativa_a"] ?? "",
      altB: mapped["alternativa_b"] ?? "",
      altC: mapped["alternativa_c"] ?? "",
      altD: mapped["alternativa_d"] ?? "",
      altE: mapped["alternativa_e"] ?? "",
      gabarito: (mapped["gabarito"] ?? "").toUpperCase().trim(),
    };
  }

  const parsedRows: ParsedRow[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const pr = mapRow(rawRows[i]!);
    if (!pr) continue;
    pr.rowIndex = i + 2; // linha 1 = cabeçalho
    parsedRows.push(pr);
  }

  if (parsedRows.length === 0) {
    return NextResponse.json(
      { error: "Não foi possível identificar questões. Verifique se as colunas seguem o modelo." },
      { status: 400 },
    );
  }

  // ── Validações por linha ────────────────────────────────────────────────────

  const parseErrors: RowError[] = [];

  for (const pr of parsedRows) {
    const row = pr.rowIndex;

    // Metadados obrigatórios
    if (!pr.disciplina) parseErrors.push({ row, field: "disciplina", message: "Disciplina/matéria ausente." });
    if (!pr.assunto) parseErrors.push({ row, field: "assunto", message: "Assunto ausente." });
    if (!pr.banca) parseErrors.push({ row, field: "banca", message: "Banca ausente." });
    if (!pr.ano) {
      parseErrors.push({ row, field: "ano", message: "Ano ausente." });
    } else {
      const anoInt = parseInt(pr.ano, 10);
      if (isNaN(anoInt) || anoInt < 1950 || anoInt > 2099) {
        parseErrors.push({ row, field: "ano", message: `Ano inválido: "${pr.ano}".` });
      }
    }

    // Dados obrigatórios
    if (!pr.numero) parseErrors.push({ row, field: "numero_questao", message: "Número da questão ausente." });
    if (!pr.enunciado) parseErrors.push({ row, field: "enunciado", message: "Enunciado ausente." });
    if (!pr.altA) parseErrors.push({ row, field: "alternativa_a", message: "Alternativa A ausente." });
    if (!pr.altB) parseErrors.push({ row, field: "alternativa_b", message: "Alternativa B ausente." });

    if (!pr.gabarito) {
      parseErrors.push({ row, field: "gabarito", message: "Gabarito ausente." });
    } else {
      // Gabarito deve apontar para uma alternativa existente e preenchida
      const altMap: Record<string, string> = {
        A: pr.altA,
        B: pr.altB,
        C: pr.altC,
        D: pr.altD,
        E: pr.altE,
      };
      const validLetters = Object.entries(altMap)
        .filter(([, v]) => v.trim())
        .map(([k]) => k);

      if (!validLetters.includes(pr.gabarito)) {
        if (!altMap[pr.gabarito]) {
          parseErrors.push({
            row,
            field: "gabarito",
            message: `Gabarito "${pr.gabarito}" inválido. Use apenas as letras das alternativas existentes nesta questão: ${validLetters.join(", ") || "(nenhuma preenchida)"}.`,
          });
        } else {
          parseErrors.push({
            row,
            field: "gabarito",
            message: `Gabarito "${pr.gabarito}" aponta para alternativa vazia.`,
          });
        }
      }
    }
  }

  if (parseErrors.length > 0) {
    return NextResponse.json({ error: "Erros de validação", validationErrors: parseErrors }, { status: 422 });
  }

  // ── Resolver metadados texto → ID (deduplica por texto para evitar N+1) ─────

  // Disciplina (subject)
  const uniqueDisciplinas = [...new Set(parsedRows.map((r) => r.disciplina).filter(Boolean))];
  const disciplinaIdMap: Record<string, string | null> = {};
  for (const name of uniqueDisciplinas) {
    disciplinaIdMap[name] = await findOrCreateSubject(name, prisma);
  }

  // Assunto (topic) — depende da disciplina
  const uniqueAssuntos = [
    ...new Map(
      parsedRows
        .filter((r) => r.assunto && r.disciplina)
        .map((r) => [`${r.disciplina}||${r.assunto}`, { disciplina: r.disciplina, assunto: r.assunto }] as const),
    ).values(),
  ];
  const assuntoIdMap: Record<string, string | null> = {};
  for (const { disciplina, assunto } of uniqueAssuntos) {
    const subjectId = disciplinaIdMap[disciplina];
    if (subjectId) {
      assuntoIdMap[`${disciplina}||${assunto}`] = await findOrCreateTopic(assunto, subjectId, prisma);
    }
  }

  // Banca (examBoard)
  const uniqueBancas = [...new Set(parsedRows.map((r) => r.banca).filter(Boolean))];
  const bancaIdMap: Record<string, string | null> = {};
  for (const name of uniqueBancas) {
    bancaIdMap[name] = await findOrCreateExamBoard(name, prisma);
  }

  // Cidade (city) — opcional, find-or-create
  const uniqueCidades = [...new Set(parsedRows.map((r) => r.cidade).filter(Boolean))];
  const cidadeIdMap: Record<string, string | null> = {};
  for (const name of uniqueCidades) {
    cidadeIdMap[name] = await findOrCreateCity(name, prisma);
  }

  // Cargo (jobRole) — opcional, find-or-create
  const uniqueCargos = [...new Set(parsedRows.map((r) => r.cargo).filter(Boolean))];
  const cargoIdMap: Record<string, string | null> = {};
  for (const name of uniqueCargos) {
    cargoIdMap[name] = await findOrCreateJobRole(name, prisma);
  }

  // Concurso — apenas find (não criar automaticamente)
  const uniqueConcursos = [...new Set(parsedRows.map((r) => r.concurso).filter(Boolean))];
  const concursoIdMap: Record<string, string | null> = {};
  for (const name of uniqueConcursos) {
    const found = await prisma.competition.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    concursoIdMap[name] = found?.id ?? null;
  }

  // ── Criar registro de importação (sem metadados globais) ───────────────────

  const pdfImport = await prisma.pDFImport.create({
    data: {
      originalFilename: fileName,
      status: "REVIEW_PENDING",
      totalExtracted: parsedRows.length,
      createdBy: session.user.id,
    },
  });

  // ── Criar ImportedQuestion para cada linha ─────────────────────────────────

  const vinculoExcecao = { semTexto: true, semImagem: true, at: new Date().toISOString() };

  await prisma.importedQuestion.createMany({
    data: parsedRows.map((pr, idx) => {
      const alts = [
        pr.altA ? { letter: "A", content: pr.altA } : null,
        pr.altB ? { letter: "B", content: pr.altB } : null,
        pr.altC ? { letter: "C", content: pr.altC } : null,
        pr.altD ? { letter: "D", content: pr.altD } : null,
        pr.altE ? { letter: "E", content: pr.altE } : null,
      ].filter(Boolean);

      const subjectId = disciplinaIdMap[pr.disciplina] ?? null;
      const topicId = assuntoIdMap[`${pr.disciplina}||${pr.assunto}`] ?? null;
      const examBoardId = bancaIdMap[pr.banca] ?? null;
      const cityId = pr.cidade ? (cidadeIdMap[pr.cidade] ?? null) : null;
      const jobRoleId = pr.cargo ? (cargoIdMap[pr.cargo] ?? null) : null;
      const competitionId = pr.concurso ? (concursoIdMap[pr.concurso] ?? null) : null;
      const anoInt = parseInt(pr.ano, 10);

      const rawTextObj = {
        source: "spreadsheet",
        nivel: pr.nivel || null,
        numero: pr.numero || String(idx + 1),
        textoVinculado: pr.textoVinculado || null,
        // Metadados originais (texto livre) para exibição na revisão
        meta: {
          disciplina: pr.disciplina,
          assunto: pr.assunto,
          banca: pr.banca,
          ano: pr.ano,
          cidade: pr.cidade || null,
          cargo: pr.cargo || null,
          concurso: pr.concurso || null,
        },
        // Dispensa checagem de vínculos com PDF (não há PDF nesta importação).
        review: { vinculoExcecao },
      };

      return {
        importId: pdfImport.id,
        content: pr.enunciado,
        alternatives: alts,
        correctAnswer: pr.gabarito || null,
        suggestedSubjectId: subjectId,
        suggestedTopicId: topicId,
        examBoardId,
        competitionId,
        cityId,
        jobRoleId,
        year: isNaN(anoInt) ? null : anoInt,
        sourcePosition: idx + 1,
        hasImage: false,
        rawText: JSON.stringify(rawTextObj),
        confidence: 1.0,
        status: "PENDING_REVIEW",
      };
    }),
  });

  return NextResponse.json({ importId: pdfImport.id, total: parsedRows.length }, { status: 201 });
}
