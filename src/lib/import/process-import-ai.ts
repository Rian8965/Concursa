import { prisma } from "@/lib/db/prisma";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";
import { processPdfWithDocumentAi } from "@/lib/docai/process-pdf";
import {
  extractGabaritoSectionFromProvaFullText,
  parseGabaritoMap,
  resolveCorrectAnswerForImportedQuestion,
} from "@/lib/import/gabarito";
import {
  coerceMetaYear,
  matchExamBoardBancaToId,
  matchSubjectNameToId,
} from "@/lib/import/import-meta-match";
import {
  findOrCreateCity,
  findOrCreateExamBoard,
  findOrCreateJobRole,
  findOrCreateSubject,
  findOrCreateTopic,
} from "@/lib/import/auto-create-meta";
import { readImportPdfBuffer, readImportGabaritoPdfBuffer } from "@/lib/import-pdf-storage";

type DocaiLayout = {
  textAnchor?: { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> };
  boundingPoly?: { normalizedVertices?: Array<{ x?: number; y?: number }>; vertices?: Array<{ x?: number; y?: number }> };
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function segText(fullText: string, layout?: DocaiLayout) {
  const segs = layout?.textAnchor?.textSegments ?? [];
  if (!fullText || !segs.length) return "";
  let out = "";
  for (const s of segs) {
    const a = Number(s.startIndex ?? 0);
    const b = Number(s.endIndex ?? 0);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) out += fullText.slice(a, b);
  }
  return out;
}

function bboxStats(layout?: DocaiLayout) {
  const verts = layout?.boundingPoly?.normalizedVertices ?? layout?.boundingPoly?.vertices ?? [];
  const xs = verts.map((v) => (typeof v.x === "number" ? v.x : NaN)).filter((n) => Number.isFinite(n));
  const ys = verts.map((v) => (typeof v.y === "number" ? v.y : NaN)).filter((n) => Number.isFinite(n));
  if (!xs.length || !ys.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const midX = (minX + maxX) / 2;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midY = (minY + maxY) / 2;
  return { midX, midY };
}

function reconstructReadingOrder(pages: Array<{ pageNumber: number | null; paragraphs: Array<{ text: string; midX: number | null; midY: number | null }> }>) {
  const out: Array<{ page: number | null; text: string }> = [];
  for (const p of pages) {
    const withPos = p.paragraphs
      .filter((x) => x.text.trim().length > 0 && x.midY != null)
      .filter((x) => (x.midY ?? 0) > 0.06 && (x.midY ?? 1) < 0.94);

    // Detecta 2 colunas: se há parágrafos claramente na coluna esquerda (midX<0.40)
    // e na direita (midX>0.60), os itens do centro (cabeçalhos / separadores) são
    // atribuídos à coluna mais próxima — sem descartar ninguém.
    const leftItems  = withPos.filter((x) => (x.midX ?? 0.5) < 0.40);
    const rightItems = withPos.filter((x) => (x.midX ?? 0.5) > 0.60);
    const midItems   = withPos.filter((x) => (x.midX ?? 0.5) >= 0.40 && (x.midX ?? 0.5) <= 0.60);
    const likelyTwoCols = leftItems.length >= 3 && rightItems.length >= 3;

    let joined: string;
    if (likelyTwoCols) {
      // Cabeçalhos centrais e similares vão no início (menores midY) da coluna esquerda
      const leftFull  = [...midItems.filter((x) => (x.midX ?? 0.5) <= 0.5), ...leftItems]
        .sort((a, b) => (a.midY ?? 0) - (b.midY ?? 0));
      const rightFull = [...midItems.filter((x) => (x.midX ?? 0.5) > 0.5), ...rightItems]
        .sort((a, b) => (a.midY ?? 0) - (b.midY ?? 0));
      joined = [...leftFull, ...rightFull]
        .map((x) => x.text.trim())
        .filter(Boolean)
        .join("\n");
    } else {
      joined = [...withPos]
        .sort((a, b) => {
          const dy = (a.midY ?? 0) - (b.midY ?? 0);
          if (Math.abs(dy) > 0.002) return dy;
          return (a.midX ?? 0.5) - (b.midX ?? 0.5);
        })
        .map((x) => x.text.trim())
        .filter(Boolean)
        .join("\n");
    }
    out.push({ page: p.pageNumber, text: joined });
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function statementLooksGrounded(statement: string, corpusNorm: string): boolean {
  const st = normalizeForMatch(statement);
  if (!st) return false;
  // Pega tokens “fortes” (>=4) para evitar aceitar frases inventadas.
  const tokens = Array.from(new Set(st.split(" ").filter((t) => t.length >= 4)));
  if (tokens.length < 4) return true; // enunciado curto: não dá pra exigir muito
  let hits = 0;
  for (const t of tokens.slice(0, 18)) {
    if (corpusNorm.includes(t)) hits++;
  }
  // Exige pelo menos 3 tokens presentes no OCR para considerar “do PDF”.
  return hits >= 3;
}

function filterHallucinatedQuestions(rawQuestions: any[], corpusNorm: string) {
  const kept: any[] = [];
  const dropped: Array<{ number: number | null; reason: string }> = [];
  for (const q of rawQuestions) {
    const numberRaw = q?.number;
    const number = typeof numberRaw === "number" && Number.isFinite(numberRaw) ? Math.max(1, Math.floor(numberRaw)) : null;
    const statement = String(q?.statement ?? q?.content ?? "").trim();
    if (!statement) {
      dropped.push({ number, reason: "empty_statement" });
      continue;
    }
    if (!statementLooksGrounded(statement, corpusNorm)) {
      dropped.push({ number, reason: "not_grounded_in_ocr" });
      continue;
    }
    kept.push(q);
  }
  return { kept, dropped };
}

export async function processImportAiJob(importId: string): Promise<void> {
  const startedAt = Date.now();
  const pdfImport = await prisma.pDFImport.findUnique({ where: { id: importId } });
  if (!pdfImport) throw new Error("Importação não encontrada.");

  // Idempotência: se o job for reexecutado (retries do Cloud Tasks), não pode duplicar questões/assets.
  // Limpamos qualquer resultado anterior desta importação antes de processar de novo.
  await prisma.$transaction(async (tx) => {
    await tx.importedQuestionAsset.deleteMany({
      where: { importedQuestion: { importId } },
    }).catch(() => {});
    await tx.importedQuestion.deleteMany({ where: { importId } }).catch(() => {});
    await tx.importAsset.deleteMany({ where: { importId } }).catch(() => {});
    await tx.pDFImport.update({
      where: { id: importId },
      data: { status: "PROCESSING", processingError: null, totalExtracted: 0 },
    });
  });

  const storedPdfPath = pdfImport.storedPdfPath;
  const provaBuf = await readImportPdfBuffer(storedPdfPath);
  if (!provaBuf) throw new Error("Não foi possível ler o PDF armazenado para esta importação.");

  // Metadados (enriquecimento)
  let banca: string | undefined;
  let concurso: string | undefined;
  let cidade: string | undefined;
  let materia: string | undefined;

  if (pdfImport.competitionId) {
    const comp = await prisma.competition.findUnique({
      where: { id: pdfImport.competitionId },
      include: { city: true, examBoard: true },
    });
    if (comp) {
      concurso = comp.name;
      cidade = `${comp.city.name} - ${comp.city.state}`;
      banca = comp.examBoard?.acronym;
    }
  }

  if (pdfImport.subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: pdfImport.subjectId } });
    materia = subject?.name;
  }

  // Document AI (Batch em prod via GCS; online em dev)
  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION").trim().toLowerCase();
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID").trim();

  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${location}-documentai.googleapis.com`,
  });
  const name = client.processorPath(projectId, location, processorId);

  const processed = await processPdfWithDocumentAi({
    client,
    processorName: name,
    storedPdfPath,
    pdfBytes: provaBuf,
    importIdForOutputPrefix: importId,
  });

  const fullText = processed.document?.text ?? "";

  const gabaritoBuf = await readImportGabaritoPdfBuffer(importId);
  let gabaritoOcrText = "";
  if (gabaritoBuf && gabaritoBuf.length) {
    try {
      const gRes = await processPdfWithDocumentAi({
        client,
        processorName: name,
        storedPdfPath: null,
        pdfBytes: gabaritoBuf,
        importIdForOutputPrefix: `${importId}-gabarito`,
      });
      gabaritoOcrText = (gRes.document?.text ?? "").trim();
    } catch (e) {
      console.warn("[import][job] OCR do gabarito falhou; seguindo sem texto do arquivo.", e);
    }
  }

  if (!gabaritoOcrText && pdfImport.gabaritoInSamePdf && fullText.trim()) {
    gabaritoOcrText = extractGabaritoSectionFromProvaFullText(fullText).trim();
  }

  const gabaritoMap = parseGabaritoMap(gabaritoOcrText);

  const doc = processed.document as unknown as {
    pages?: Array<{ pageNumber?: number; paragraphs?: Array<{ layout?: DocaiLayout }> }>;
  } | undefined;

  const pages =
    doc?.pages?.map((p) => {
      const paragraphs =
        (p.paragraphs ?? [])
          .map((para) => {
            const s = bboxStats(para.layout);
            return { text: segText(fullText, para.layout), midX: s?.midX ?? null, midY: s?.midY ?? null };
          })
          .filter((x) => x.text.trim().length > 0);
      return { pageNumber: p.pageNumber ?? null, paragraphs };
    }) ?? [];

  const ordered = reconstructReadingOrder(pages);
  const pageLines = ordered.map((p) => `--- Página ${p.page ?? "?"} ---\n${p.text}`);
  const combinedAllPages = pageLines.join("\n\n");
  const corpusNorm = normalizeForMatch(combinedAllPages);

  const envChunk = Number.parseInt(process.env.IMPORT_LLM_PAGE_CHUNK ?? "6", 10);
  const envOverlap = Number.parseInt(process.env.IMPORT_LLM_PAGE_OVERLAP ?? "1", 10);
  const chunkSize = Number.isFinite(envChunk) && envChunk > 0 ? Math.min(12, envChunk) : 6;
  const overlap = Number.isFinite(envOverlap) && envOverlap >= 0 ? Math.min(chunkSize - 1, envOverlap) : 1;
  const minQuestionsEnv = Number.parseInt(process.env.IMPORT_MIN_QUESTIONS ?? "20", 10);
  const minQuestions = Number.isFinite(minQuestionsEnv) && minQuestionsEnv > 0 ? minQuestionsEnv : 20;

  const system = [
    "Você é um extrator especializado de provas de concurso público.",
    "Receberá texto OCR em ordem de leitura (já organizado por páginas e colunas).",
    "IMPORTANTE: você receberá apenas um TRECHO do PDF. Extraia SOMENTE as questões que aparecem nesse trecho.",
    "",
    "═══ COMO IDENTIFICAR QUESTÕES vs ALTERNATIVAS ═══",
    "• Uma QUESTÃO começa com número seguido de ponto, parêntese ou travessão: '1.', '01)', 'Questão 1', '1 -'.",
    "  O corpo da questão (enunciado) vem logo após o número.",
    "• Uma ALTERNATIVA pertence à questão anterior e começa com LETRA seguida de ponto/parêntese: 'A)', 'a.', 'B)', etc.",
    "  NUNCA trate uma alternativa como se fosse uma questão nova.",
    "• Se um parágrafo começa com letra + ) ou letra + . e o conteúdo é curto (opção de múltipla escolha), é ALTERNATIVA.",
    "",
    "═══ ALTERNATIVAS (CRÍTICO) ═══",
    "• Cada questão de múltipla escolha tem EXATAMENTE as alternativas que aparecem no PDF (geralmente A, B, C, D, E — 5 alternativas).",
    "• Extraia TODAS as alternativas visíveis: A, B, C, D e E. NUNCA pare na D se houver E.",
    "• Se a prova vai até alternativa E, todas as questões devem ter 5 alternativas em 'alternatives'.",
    "• Não omita alternativas por limitação de contexto — elas são obrigatórias.",
    "",
    "═══ ANTI-REPETIÇÃO (CRÍTICO) ═══",
    "• Cada número de questão deve aparecer UMA ÚNICA VEZ no array 'questions'.",
    "• Se o mesmo número aparecer novamente no OCR (cabeçalho repetido, quebra de coluna), ignore a segunda ocorrência.",
    "",
    "═══ ANTI-ALUCINAÇÃO (CRÍTICO) ═══",
    "• NÃO invente questões, alternativas, textos-base, banca, cidade, ano ou qualquer conteúdo.",
    "• Se o OCR estiver ilegível para uma questão, omita-a ou deixe campos como null.",
    "",
    "═══ GABARITO (CRÍTICO) ═══",
    "• NÃO tente adivinhar ou inferir a resposta correta de cada questão.",
    "• O campo 'correctAnswerLetter' deve ser SEMPRE omitido ou null — o gabarito oficial é processado separadamente pelo sistema.",
    "• Sua função é extrair o CONTEÚDO da prova (questões e alternativas), NÃO determinar respostas corretas.",
    "",
    "TAREFA: retornar APENAS JSON válido sem markdown no formato exato:",
    "{ \"meta\": { \"city\"?: string, \"concurso\"?: string, \"ano\"?: number|null, \"banca\"?: string, \"cargo\"?: string, \"materia\"?: string },",
    "  \"baseTexts\": [{\"id\": string, \"text\": string, \"appliesToQuestionNumbers\"?: number[]}],",
    "  \"questions\": [{\"number\": number, \"statement\": string, \"baseTextId\"?: string, \"materia\"?: string, \"assunto\"?: string,",
    "                  \"alternatives\": [{\"letter\": string, \"text\": string}] }] }",
    "",
    "REGRAS ADICIONAIS:",
    "- MATÉRIA: em provas com várias disciplinas, leia o título de seção logo antes das questões para preencher 'materia'.",
    "- ASSUNTO: preencha o tópico específico abordado em cada questão.",
    "- Texto-base compartilhado: crie baseTexts com id único e aponte baseTextId. Não cole o texto-base dentro do enunciado.",
    "- Ignorar questões dissertativas/redação.",
    "- Numeração: reconhecer padrões '1.', '01', 'Questão 1', '1 -'.",
    "- 'number' deve ser inteiro positivo. Não invente números.",
  ].join("\n");

  const yearHint = pdfImport.year;

  type ParsedChunk = { baseTexts: any[]; questions: any[]; meta?: unknown; provider: string; model: string };
  const chunks: Array<ParsedChunk> = [];
  const chunkSummaries: Array<{ from: number; to: number; questions: number; ok: boolean; note?: string }> = [];

  if (!pageLines.length) {
    await prisma.pDFImport.update({
      where: { id: importId },
      data: { status: "FAILED", processingError: "Document AI não retornou páginas/parágrafos para extrair texto." },
    });
    return;
  }

  let llmProvider: string | null = null;
  let llmModel: string | null = null;

  async function extractChunks(opts: { chunkSize: number; overlap: number }) {
    const chunksLocal: ParsedChunk[] = [];
    const summariesLocal: Array<{ from: number; to: number; questions: number; ok: boolean; note?: string }> = [];

    const stride = Math.max(1, opts.chunkSize - opts.overlap);
    for (let start = 0; start < pageLines.length; start += stride) {
      const end = Math.min(start + opts.chunkSize, pageLines.length);
      const slice = pageLines.slice(start, end).join("\n\n");
      const fromPage = ordered[start]?.page ?? start + 1;
      const toPage = ordered[end - 1]?.page ?? end;

      const user = [
        `Extraia a prova abaixo em JSON (somente páginas ${fromPage}–${toPage} deste trecho).`,
        "TEXTO DA PROVA (SUBCONJUNTO):",
        slice,
      ].join("\n\n");

      // Retry local: se falhar/truncar, tenta mais 1x com instrução mais “curta” (menos meta) para caber.
      for (let attempt = 0; attempt < 2; attempt++) {
        const systemTry = attempt === 0
          ? system
          : `${system}\n\nMODO RESGATE: se estiver grande, retorne SOMENTE questions (e baseTexts vazio), mantendo JSON válido.`;
        try {
          const llm = await runLlmJson(systemTry, user);
          llmProvider = llm.provider;
          llmModel = llm.model;
          const llmRobust = parseLlmJsonRobustly(llm.jsonText);
          if (!llmRobust.ok) {
            if (attempt === 1) summariesLocal.push({ from: start + 1, to: end, questions: 0, ok: false, note: llmRobust.message });
            continue;
          }
          const parsed = llmRobust.value as { baseTexts?: unknown; questions?: unknown; meta?: unknown };
          const baseTexts = Array.isArray(parsed?.baseTexts) ? parsed.baseTexts : [];
          const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
          chunksLocal.push({ baseTexts, questions, meta: parsed?.meta, provider: llm.provider, model: llm.model });
          summariesLocal.push({ from: start + 1, to: end, questions: questions.length, ok: true });
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (attempt === 1) summariesLocal.push({ from: start + 1, to: end, questions: 0, ok: false, note: msg });
        }
      }

      if (end >= pageLines.length) break;
    }

    return { chunksLocal, summariesLocal };
  }

  function mergeFromChunks(chunksIn: ParsedChunk[]) {
    const baseMapLocal = new Map<string, string>();
    const baseAppliesLocal = new Map<string, number[]>();
    for (const c of chunksIn) {
      for (const bt of c.baseTexts as any[]) {
        if (bt?.id && typeof bt.text === "string") {
          const id = String(bt.id);
          const t = String(bt.text ?? "").trim();
          if (!t) continue;
          if (!baseMapLocal.has(id)) baseMapLocal.set(id, t);
          const numsRaw = Array.isArray(bt.appliesToQuestionNumbers) ? bt.appliesToQuestionNumbers : null;
          const nums = (numsRaw ?? [])
            .map((n: any) => (typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null))
            .filter((n: any) => typeof n === "number") as number[];
          if (nums.length) {
            const prev = baseAppliesLocal.get(id) ?? [];
            baseAppliesLocal.set(id, Array.from(new Set([...prev, ...nums])).sort((a, b) => a - b));
          }
        }
      }
    }

    const questionsByNumberLocal = new Map<number, any>();
    for (const c of chunksIn) {
      for (const q of c.questions as any[]) {
        const numberRaw = q?.number;
        const number = typeof numberRaw === "number" && Number.isFinite(numberRaw) ? Math.max(1, Math.floor(numberRaw)) : null;
        if (!number) continue;
        const prev = questionsByNumberLocal.get(number);
        const nextStmt = String(q?.statement ?? q?.content ?? "").trim();
        const prevStmt = prev ? String(prev?.statement ?? prev?.content ?? "").trim() : "";
        if (!prev || nextStmt.length > prevStmt.length) questionsByNumberLocal.set(number, q);
      }
    }

    const questionsLocal = Array.from(questionsByNumberLocal.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, q]) => q);

    return { baseMapLocal, baseAppliesLocal, questionsLocal };
  }

  // Passo 1: extração com chunkSize configurado
  const pass1 = await extractChunks({ chunkSize, overlap });
  chunks.push(...pass1.chunksLocal);
  chunkSummaries.push(...pass1.summariesLocal);

  // Se extraiu pouco, faz Passo 2 automático com chunk menor (mais chamadas, menos truncagem)
  const merged1 = mergeFromChunks(chunks);
  if (merged1.questionsLocal.length > 0 && merged1.questionsLocal.length < minQuestions && pageLines.length >= 8) {
    const fallbackChunkSize = Math.max(2, Math.min(4, chunkSize - 2));
    const pass2 = await extractChunks({ chunkSize: fallbackChunkSize, overlap: 1 });
    chunks.push(...pass2.chunksLocal);
    chunkSummaries.push(...pass2.summariesLocal.map((s) => ({ ...s, note: s.note ? `fallback:${s.note}` : "fallback" })));
  }

  if (!chunks.length) {
    const note = chunkSummaries.map((c) => `${c.from}-${c.to}:${c.ok ? "ok" : `fail:${(c.note ?? "").slice(0, 120)}`}`).join(" | ");
    await prisma.pDFImport.update({
      where: { id: importId },
      data: { status: "FAILED", processingError: `Falha ao extrair JSON do modelo em todos os chunks. Resumo: ${note}`.slice(0, 1500) },
    });
    return;
  }

  // Merge meta (primeiro chunk com meta útil)
  let mergedMetaFromChunks: Record<string, unknown> = {};
  for (const c of chunks) {
    if (c.meta && typeof c.meta === "object") {
      mergedMetaFromChunks = { ...(c.meta as Record<string, unknown>) };
      break;
    }
  }

  const mergedMeta = {
    ...mergedMetaFromChunks,
    concurso: (mergedMetaFromChunks.concurso as string | undefined) ?? concurso ?? undefined,
    city: (mergedMetaFromChunks.city as string | undefined) ?? cidade ?? undefined,
    banca: (mergedMetaFromChunks.banca as string | undefined) ?? banca ?? undefined,
    materia: (mergedMetaFromChunks.materia as string | undefined) ?? materia ?? undefined,
    ano:
      mergedMetaFromChunks.ano != null && mergedMetaFromChunks.ano !== ""
        ? mergedMetaFromChunks.ano
        : yearHint != null
          ? yearHint
          : undefined,
  };

  const mergedAll = mergeFromChunks(chunks);
  const baseMap = mergedAll.baseMapLocal;
  const baseApplies = mergedAll.baseAppliesLocal;
  const questionsMerged = mergedAll.questionsLocal;
  const grounded = filterHallucinatedQuestions(questionsMerged, corpusNorm);
  const questions = grounded.kept;

  if (!questions.length) {
    await prisma.pDFImport.update({
      where: { id: importId },
      data: {
        status: "FAILED",
        processingError:
          "A IA não retornou questões confiáveis (0 itens após validação anti-alucinação). Verifique OCR/qualidade do PDF e tente novamente.".slice(0, 1500),
        processingLog: JSON.stringify({
          pipeline: "ai",
          llmChunking: { chunkSize, overlap, pages: pageLines.length, chunkSummaries },
          grounding: { merged: questionsMerged.length, kept: grounded.kept.length, dropped: grounded.dropped.slice(0, 30) },
        }),
      },
    });
    return;
  }

  const baseAssetIdByBaseId = new Map<string, string>();
  for (const [baseId, text] of baseMap.entries()) {
    const t = String(text ?? "").trim();
    if (!t) continue;
    const asset = await prisma.importAsset.create({
      data: {
        importId,
        kind: "TEXT_BLOCK",
        scope: "SHARED",
        page: 1,
        bboxX: 0,
        bboxY: 0,
        bboxW: 1,
        bboxH: 0.02,
        extractedText: t,
        label: `AI_BASETEXT:${baseId}`,
      },
      select: { id: true },
    });
    baseAssetIdByBaseId.set(baseId, asset.id);
  }

  function normalizeAlternatives(alts: Array<{ letter: string; content: string }>) {
    const cleaned = alts
      .map((a) => ({
        letter: String(a.letter ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1),
        content: String(a.content ?? "").trim(),
      }))
      .filter((a) => a.content.length > 0);
    const out: Array<{ letter: string; content: string }> = [];
    const seen = new Set<string>();
    for (const a of cleaned) {
      const letter = a.letter || String.fromCharCode(65 + out.length);
      if (seen.has(letter)) continue;
      seen.add(letter);
      out.push({ letter, content: a.content });
      if (out.length >= 6) break;
    }
    out.sort((a, b) => a.letter.localeCompare(b.letter));
    return out;
  }

  function computeHeuristicConfidence(q: { statement: string; alternatives: Array<{ letter: string; content: string }>; correctAnswer: string | null; number?: number | null }) {
    let c = 0.78;
    const st = (q.statement ?? "").trim();
    if (st.length < 40) c -= 0.18;
    if (st.length > 1800) c -= 0.08;
    const alts = q.alternatives ?? [];
    if (alts.length < 4) c -= 0.22;
    if (alts.length > 6) c -= 0.10;
    const letters = alts.map((a) => a.letter);
    if (new Set(letters).size !== letters.length) c -= 0.18;
    if (!q.correctAnswer) c -= 0.10;
    if (q.correctAnswer && !new Set(letters).has(q.correctAnswer)) c -= 0.18;
    if (!q.number || !Number.isFinite(q.number)) c -= 0.08;
    return Math.max(0.05, Math.min(0.98, Number(c.toFixed(2))));
  }

  const impRow = await prisma.pDFImport.findUnique({ where: { id: importId } });
  const [subjectRows, examBoardRows] = await Promise.all([
    prisma.subject.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.examBoard.findMany({ select: { id: true, name: true, acronym: true } }),
  ]);
  const mm = mergedMeta as Record<string, unknown>;
  const bancaStr = typeof mm.banca === "string" ? mm.banca : null;
  const materiaGlobal = typeof mm.materia === "string" ? mm.materia : null;
  const yGlobal = coerceMetaYear(mm.ano, yearHint) ?? yearHint;
  const examIdMatchGlobal = matchExamBoardBancaToId(bancaStr, examBoardRows, null);
  const examIdGlobal =
    examIdMatchGlobal ??
    (bancaStr ? await findOrCreateExamBoard(bancaStr, prisma) : null) ??
    impRow?.examBoardId ??
    null;

  const subjMatchGlobal = matchSubjectNameToId(materiaGlobal, subjectRows);
  const subjFromGlobal =
    subjMatchGlobal ??
    (materiaGlobal ? await findOrCreateSubject(materiaGlobal, prisma) : null) ??
    (pdfImport.subjectId || null);

  const cityStr = typeof mm.city === "string" ? mm.city : null;
  const cargoStr = typeof mm.cargo === "string" ? mm.cargo : null;
  const cityIdGlobal =
    cityStr
      ? await findOrCreateCity(cityStr, prisma).then((id) => id ?? impRow?.cityId ?? null)
      : impRow?.cityId ?? null;
  const jobRoleIdGlobal =
    cargoStr
      ? await findOrCreateJobRole(cargoStr, prisma).then((id) => id ?? impRow?.jobRoleId ?? null)
      : impRow?.jobRoleId ?? null;

  let createdCount = 0;
  const createdByNumber = new Map<number, string>();

  for (let idx = 0; idx < questions.length; idx++) {
    const q: any = (questions as any[])[idx];
    const baseTextId = q?.baseTextId != null ? String(q.baseTextId) : null;
    const numberRaw = q?.number;
    const number = typeof numberRaw === "number" && Number.isFinite(numberRaw) ? Math.max(1, Math.floor(numberRaw)) : null;
    const statement = String(q?.statement ?? q?.content ?? "").trim();
    const commentary = typeof q?.commentary === "string" ? q.commentary.trim() : null;
    const materiaQuestao = typeof q?.materia === "string" && q.materia.trim() ? q.materia.trim() : null;
    const assuntoQuestao = typeof q?.assunto === "string" && q.assunto.trim() ? q.assunto.trim() : null;

    const altsRaw = Array.isArray(q?.alternatives) ? q.alternatives : [];
    const alternatives = normalizeAlternatives(
      altsRaw.map((a: any, i: number) => ({
        letter: String(a?.letter ?? String.fromCharCode(65 + i)),
        content: String(a?.text ?? a?.content ?? ""),
      })),
    );

    const resolved = resolveCorrectAnswerForImportedQuestion({
      questionNumber: number,
      alternatives,
      gabaritoMap,
    });

    const correctAnswer = resolved.correctAnswer;
    const confidence = computeHeuristicConfidence({ statement, alternatives, correctAnswer, number: number ?? undefined });

    const perSubjMatch = materiaQuestao ? matchSubjectNameToId(materiaQuestao, subjectRows) : null;
    const perSubj =
      perSubjMatch ??
      (materiaQuestao && materiaQuestao !== materiaGlobal ? await findOrCreateSubject(materiaQuestao, prisma) : null) ??
      subjFromGlobal;

    let perTopicId: string | null = null;
    if (assuntoQuestao && perSubj) {
      perTopicId = await findOrCreateTopic(assuntoQuestao, perSubj, prisma);
    }

    const created = await prisma.importedQuestion.create({
      data: {
        importId,
        content: statement,
        alternatives,
        correctAnswer,
        suggestedSubjectId: perSubj,
        suggestedTopicId: perTopicId,
        year: yGlobal,
        examBoardId: examIdGlobal,
        competitionId: impRow?.competitionId ?? null,
        cityId: cityIdGlobal,
        jobRoleId: jobRoleIdGlobal,
        sourcePage: null,
        sourcePosition: idx + 1,
        hasImage: false,
        imageUrl: null,
        rawText: JSON.stringify({
          number,
          baseTextId,
          statement,
          commentary,
          meta: mergedMeta,
          materia: materiaQuestao ?? undefined,
          assunto: assuntoQuestao ?? undefined,
          answerSource: resolved.answerSource,
          gabaritoMatchNumber: resolved.gabaritoMatchNumber ?? undefined,
        }),
        confidence,
        status: "PENDING_REVIEW" as const,
      },
      select: { id: true },
    });
    createdCount++;
    if (number != null) createdByNumber.set(number, created.id);

    if (baseTextId && baseAssetIdByBaseId.has(baseTextId)) {
      const assetId = baseAssetIdByBaseId.get(baseTextId)!;
      await prisma.importedQuestionAsset.create({
        data: {
          importedQuestionId: created.id,
          importAssetId: assetId,
          role: "SUPPORT_TEXT",
        },
      }).catch(() => {});
    }
  }

  // Vínculo extra baseTexts.appliesToQuestionNumbers
  for (const [baseId, nums] of baseApplies.entries()) {
    if (!baseAssetIdByBaseId.has(baseId)) continue;
    const assetId = baseAssetIdByBaseId.get(baseId)!;
    for (const n of nums) {
      const qid = createdByNumber.get(n);
      if (!qid) continue;
      await prisma.importedQuestionAsset.create({
        data: { importedQuestionId: qid, importAssetId: assetId, role: "SUPPORT_TEXT" },
      }).catch(() => {});
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const firstChunk = chunks.length ? chunks[0] : null;
  await prisma.pDFImport.update({
    where: { id: importId },
    data: {
      status: "REVIEW_PENDING",
      totalExtracted: createdCount,
      processingLog: JSON.stringify({
        pipeline: "ai",
        elapsedMs,
        docaiMode: processed.mode,
        docaiPageCount: processed.pageCount,
        llmChunking: { chunkSize, overlap, pages: pageLines.length, chunkSummaries },
        provider: llmProvider ?? firstChunk?.provider,
        model: llmModel ?? firstChunk?.model,
      }),
      gabaritoInSamePdf: pdfImport.gabaritoInSamePdf,
    },
  });
}

