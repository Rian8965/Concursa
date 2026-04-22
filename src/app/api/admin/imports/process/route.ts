import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { saveImportPdfBuffer } from "@/lib/import-pdf-storage";
import { NextRequest, NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";
import { DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS } from "@/lib/docai/process-options";
import {
  extractGabaritoSectionFromProvaFullText,
  parseGabaritoMap,
  resolveCorrectAnswerForImportedQuestion,
} from "@/lib/import/gabarito";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

/** Evita que JSON inválido (ex.: resposta do Python/LLM) derrube o processo com erro opaco. */
function safeJsonParse<T>(raw: string, label: string): { ok: true; value: T } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `${label}: ${msg}` };
  }
}

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL ?? "http://localhost:8000";
const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET ?? "secret-compartilhado";

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
  const verts =
    layout?.boundingPoly?.normalizedVertices ??
    layout?.boundingPoly?.vertices ??
    [];
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
    // Remove prováveis headers/footers pelo Y normalizado.
    const withPos = p.paragraphs.filter((x) => x.text.trim().length > 0 && x.midY != null)
      .filter((x) => (x.midY ?? 0) > 0.06 && (x.midY ?? 1) < 0.94);

    const left = withPos.filter((x) => (x.midX ?? 0.5) < 0.45).sort((a, b) => (a.midY ?? 0) - (b.midY ?? 0));
    const right = withPos.filter((x) => (x.midX ?? 0.5) > 0.55).sort((a, b) => (a.midY ?? 0) - (b.midY ?? 0));
    const oneCol = [...withPos].sort((a, b) => {
      const dy = (a.midY ?? 0) - (b.midY ?? 0);
      if (Math.abs(dy) > 0.002) return dy;
      return (a.midX ?? 0.5) - (b.midX ?? 0.5);
    });

    const likelyTwoCols = left.length >= 5 && right.length >= 5;
    const joined = (likelyTwoCols ? [...left, ...right] : oneCol)
      .map((x) => x.text.trim())
      .filter(Boolean)
      .join("\n");
    out.push({ page: p.pageNumber, text: joined });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const provaFile = formData.get("prova") as File | null;
  const gabaritoFile = formData.get("gabarito") as File | null;
  const gabaritoNoMesmoPdf = formData.get("gabaritoNoMesmoPdf") === "true";
  const competitionId = formData.get("competitionId") as string | null;
  const subjectId = formData.get("subjectId") as string | null;
  const year = formData.get("year") as string | null;
  const useAi = formData.get("useAi") === "true" || (process.env.IMPORT_PIPELINE ?? "").toLowerCase() === "ai";

  if (!provaFile) {
    return NextResponse.json({ error: "Arquivo da prova é obrigatório" }, { status: 400 });
  }

  // Criar registro da importação
  const pdfImport = await prisma.pDFImport.create({
    data: {
      competitionId: competitionId || null,
      originalFilename: provaFile.name,
      year: year ? parseInt(year) : null,
      subjectId: subjectId || null,
      status: "PROCESSING",
      createdBy: session.user.id,
    },
  });

  let storedPdfPath: string | null = null;
  try {
    const buf = Buffer.from(await provaFile.arrayBuffer());
    storedPdfPath = await saveImportPdfBuffer(pdfImport.id, buf);
    await prisma.pDFImport.update({
      where: { id: pdfImport.id },
      data: { storedPdfPath },
    });
  } catch (e) {
    await prisma.pDFImport.update({
      where: { id: pdfImport.id },
      data: { status: "FAILED", processingError: "Não foi possível salvar o PDF no servidor." },
    });
    return NextResponse.json({ error: "Falha ao armazenar o arquivo PDF." }, { status: 500 });
  }

  // Buscar metadados do concurso para enriquecer a extração
  let banca: string | undefined;
  let concurso: string | undefined;
  let cidade: string | undefined;
  let materia: string | undefined;

  if (competitionId) {
    const comp = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: { city: true, examBoard: true },
    });
    if (comp) {
      concurso = comp.name;
      cidade = `${comp.city.name} - ${comp.city.state}`;
      banca = comp.examBoard?.acronym;
      await prisma.pDFImport.update({
        where: { id: pdfImport.id },
        data: {
          examBoardId: comp.examBoardId ?? undefined,
          cityId: comp.cityId ?? undefined,
        },
      });
    }
  }

  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    materia = subject?.name;
  }

  try {
    if (useAi) {
      const startedAt = Date.now();

      // Document AI
      const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
      const location = requiredEnv("DOC_AI_LOCATION").trim().toLowerCase();
      const processorId = requiredEnv("DOC_AI_PROCESSOR_ID").trim();

      const buf = Buffer.from(await provaFile.arrayBuffer());

      const client = new DocumentProcessorServiceClient({
        apiEndpoint: `${location}-documentai.googleapis.com`,
      });

      const name = client.processorPath(projectId, location, processorId);

      let docaiRes: any;
      try {
        const [res] = await client.processDocument({
          name,
          rawDocument: { content: buf.toString("base64"), mimeType: "application/pdf" },
          ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
        });
        docaiRes = res;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const userFacing =
          message.includes("PERMISSION_DENIED")
            ? "Permissão negada no Document AI (produção). Você precisa dar acesso ao processor para a service account do Firebase App Hosting no projeto concursa-docai."
            : message.includes("NOT_FOUND") || message.includes("not found")
              ? "Processor do Document AI não encontrado. Confira DOC_AI_LOCATION (ex: us) e DOC_AI_PROCESSOR_ID no Firebase App Hosting."
              : `Falha no Document AI: ${message}`.slice(0, 900);

        // #region agent log
        fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
          body: JSON.stringify({
            sessionId: "03dbee",
            runId: "pre-fix",
            hypothesisId: "H-docai-prod-permission",
            location: "src/app/api/admin/imports/process/route.ts:docai:catch",
            message: "docai processDocument failed",
            data: {
              projectId,
              location,
              processorIdPrefix: processorId.slice(0, 6),
              errorHasPermissionDenied: message.includes("PERMISSION_DENIED"),
              errorHasNotFound: message.toLowerCase().includes("not found"),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        await prisma.pDFImport.update({
          where: { id: pdfImport.id },
          data: {
            status: "FAILED",
            processingError: userFacing,
          },
        });
        return NextResponse.json({ error: userFacing }, { status: 502 });
      }

      const fullText = docaiRes.document?.text ?? "";

      async function docaiExtractPdfText(pdfBuf: Buffer): Promise<string> {
        const [res] = await client.processDocument({
          name,
          rawDocument: { content: pdfBuf.toString("base64"), mimeType: "application/pdf" },
          ...DOCUMENT_AI_IMAGELESS_REQUEST_FIELDS,
        });
        return res.document?.text ?? "";
      }

      let gabaritoOcrText = "";
      if (gabaritoFile && gabaritoFile.size > 0) {
        try {
          const gBuf = Buffer.from(await gabaritoFile.arrayBuffer());
          gabaritoOcrText = (await docaiExtractPdfText(gBuf)).trim();
        } catch (e) {
          console.warn("[import] OCR do gabarito falhou; seguindo sem texto do arquivo.", e);
        }
      }
      if (!gabaritoOcrText && gabaritoNoMesmoPdf && fullText.trim()) {
        gabaritoOcrText = extractGabaritoSectionFromProvaFullText(fullText).trim();
      }

      const gabaritoMap = parseGabaritoMap(gabaritoOcrText);
      const gabaritoOcrForLlm = gabaritoOcrText.length > 100_000 ? gabaritoOcrText.slice(0, 100_000) : gabaritoOcrText;

      const doc = docaiRes.document as unknown as {
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
      const combined = ordered.map((p) => `--- Página ${p.page ?? "?"} ---\n${p.text}`).join("\n\n");

      // LLM (Gemini/OpenAI) — estrutura questões + texto-base
      const system = [
        "Você é um extrator de provas de concurso.",
        "Você receberá texto OCR (já em ordem de leitura por páginas/colunas).",
        "TAREFA: retornar APENAS JSON válido (sem markdown) no formato:",
        "{ meta: { city?, concurso?, ano?: number|null, banca?, cargo?, materia? }, baseTexts: [{id, text, appliesToQuestionNumbers?: number[]}], questions: [{number, statement, baseTextId?, materia?, alternatives:[{letter, text}], correctAnswerLetter?, commentary?}] }",
        "REGRAS:",
        "- Se existir a seção TEXTO DO GABARITO abaixo, use-a para preencher correctAnswerLetter (A–E) de cada questão pelo NÚMERO da questão. Se o gabarito não tiver resposta para aquele número ou estiver ilegível, use null.",
        "- MATÉRIA (crítico): em cadernos com várias disciplinas, o PDF costuma mostrar o NOME DA MATÉRIA em título de seção, cabeçalho ou linha logo ANTES do bloco de questões daquela matéria (ex.: 'LÍNGUA PORTUGUESA', 'RACIOCÍNIO LÓGICO', 'Conhecimentos Específicos — Informática'). Para CADA questão, preencha o campo 'materia' com a matéria vigente: repita a última matéria anunciada no OCR até aparecer outra seção. Não confunda com o enunciado da questão.",
        "- meta: preencha banca, concurso, cargo, ano (4 dígitos se visível), city (cidade/UF) a partir da capa/cabeçalho global. meta.materia pode resumir a matéria predominante ou ficar omitido se só existir matéria por questão.",
        "- NÃO cole texto-base dentro do enunciado. Se houver 'texto-base' compartilhado por várias questões, crie um item em baseTexts e aponte baseTextId nas questões relacionadas.",
        "- Ignore blocos que sejam só instruções gerais da prova (comandos para o candidato); não os coloquem em meta nem como enunciado de questão.",
        "- Se um texto-base vale claramente para um intervalo de questões (ex: 1 a 3), inclua appliesToQuestionNumbers no baseText.",
        "- Ignorar redação/discursivas: seções como 'Redação', 'Discursiva', 'Escreva um texto...' NÃO devem virar questions nem baseTexts.",
        "- Manter a ordem correta das questões.",
        "- Alternativas: normalizar letras A,B,C,D,E.",
        "- Numeração: reconhecer padrões (1., 01, Questão 1, Q.1). O campo number deve ser um número (1..N).",
        "- Comentários/explicações (quando existirem) devem ir em commentary; não misturar no statement.",
      ].join("\n");

      const user = [
        "Extraia a prova abaixo em JSON.",
        "TEXTO DA PROVA:",
        combined,
        gabaritoOcrForLlm
          ? `\n\n---\nTEXTO DO GABARITO (OCR — priorize para correctAnswerLetter; formato comum: número + letra A–E):\n${gabaritoOcrForLlm}\n`
          : "",
      ].join("\n\n");

      const llm = await runLlmJson(system, user);
      const llmRobust = parseLlmJsonRobustly(llm.jsonText);
      if (!llmRobust.ok) {
        const detail = `Resposta JSON do modelo (IA): ${llmRobust.message}`;
        await prisma.pDFImport.update({
          where: { id: pdfImport.id },
          data: { status: "FAILED", processingError: detail.slice(0, 500) },
        });
        return NextResponse.json(
          {
            error: "O modelo devolveu JSON inválido ou truncado. Tente processar de novo ou use o pipeline Python.",
            detail,
          },
          { status: 422 },
        );
      }
      const parsed = llmRobust.value as {
        baseTexts?: unknown;
        questions?: unknown;
        meta?: unknown;
      };

      const baseTexts = Array.isArray(parsed?.baseTexts) ? parsed.baseTexts : [];
      const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

      const yearHint = pdfImport.year;
      const aiMetaRaw = parsed?.meta && typeof parsed.meta === "object" ? { ...parsed.meta } : {};
      const mergedMeta = {
        ...aiMetaRaw,
        concurso: aiMetaRaw.concurso ?? concurso ?? undefined,
        city: aiMetaRaw.city ?? cidade ?? undefined,
        banca: aiMetaRaw.banca ?? banca ?? undefined,
        materia: aiMetaRaw.materia ?? materia ?? undefined,
        ano:
          aiMetaRaw.ano != null && aiMetaRaw.ano !== ""
            ? aiMetaRaw.ano
            : yearHint != null
              ? yearHint
              : undefined,
      };
      delete (mergedMeta as { instructions?: unknown }).instructions;

      const baseMap = new Map<string, string>();
      const baseApplies = new Map<string, number[]>();
      for (const bt of baseTexts) {
        if (bt?.id && typeof bt.text === "string") {
          const id = String(bt.id);
          baseMap.set(id, bt.text);
          const numsRaw = Array.isArray(bt.appliesToQuestionNumbers) ? bt.appliesToQuestionNumbers : null;
          const nums = (numsRaw ?? [])
            .map((n: any) => (typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null))
            .filter((n: any) => typeof n === "number") as number[];
          if (nums.length) baseApplies.set(id, Array.from(new Set(nums)).sort((a, b) => a - b));
        }
      }

      // 3.1) Persistir textos-base como ImportAsset (compartilhado), para poder vincular/editar na revisão
      const baseAssetIdByBaseId = new Map<string, string>();
      for (const [baseId, text] of baseMap.entries()) {
        const t = String(text ?? "").trim();
        if (!t) continue;
        const asset = await prisma.importAsset.create({
          data: {
            importId: pdfImport.id,
            kind: "TEXT_BLOCK",
            scope: "SHARED",
            // Não temos bbox/page reais via LLM; começa como "placeholder" para o admin ajustar depois no canvas.
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
        // Se não veio letra, força A..E
        if (out.length > 0 && out.every((a) => !a.letter)) {
          return out.map((a, i) => ({ ...a, letter: String.fromCharCode(65 + i) }));
        }
        // Ordena por letra A..Z
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

      // 3.2) Criar questões importadas e (se aplicável) vínculos com o texto-base compartilhado
      let createdCount = 0;
      const createdByNumber = new Map<number, string>();
      const createdDirectBase = new Map<string, string[]>(); // baseId -> [questionId]
      for (let idx = 0; idx < questions.length; idx++) {
        const q: any = questions[idx];
        const baseTextId = q?.baseTextId != null ? String(q.baseTextId) : null;
        const numberRaw = q?.number;
        const number = typeof numberRaw === "number" && Number.isFinite(numberRaw) ? Math.max(1, Math.floor(numberRaw)) : null;
        const statement = String(q?.statement ?? q?.content ?? "").trim();
        const commentary = typeof q?.commentary === "string" ? q.commentary.trim() : null;
        const materiaQuestao =
          typeof q?.materia === "string" && q.materia.trim() ? q.materia.trim() : null;

        const altsRaw = Array.isArray(q?.alternatives) ? q.alternatives : [];
        const alternatives = normalizeAlternatives(
          altsRaw.map((a: any, i: number) => ({
            letter: String(a?.letter ?? String.fromCharCode(65 + i)),
            content: String(a?.text ?? a?.content ?? ""),
          })),
        );

        const letterFromLlm = q?.correctAnswerLetter
          ? String(q.correctAnswerLetter).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1)
          : (q?.correct_answer ? String(q.correct_answer).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 1) : null);

        const resolved = resolveCorrectAnswerForImportedQuestion({
          questionNumber: number,
          alternatives,
          letterFromLlm: letterFromLlm || null,
          gabaritoMap,
        });
        const correctAnswer = resolved.correctAnswer;

        const confidence = computeHeuristicConfidence({ statement, alternatives, correctAnswer, number: number ?? undefined });

        const created = await prisma.importedQuestion.create({
          data: {
            importId: pdfImport.id,
            content: statement,
            alternatives,
            correctAnswer,
            suggestedSubjectId: subjectId ?? null,
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
          const arr = createdDirectBase.get(baseTextId) ?? [];
          arr.push(created.id);
          createdDirectBase.set(baseTextId, arr);
        }
      }

      // 3.3) Vínculo extra: baseTexts.appliesToQuestionNumbers (quando a IA sabe o intervalo, mas não marcou baseTextId em todas)
      for (const [baseId, nums] of baseApplies.entries()) {
        if (!baseAssetIdByBaseId.has(baseId)) continue;
        const assetId = baseAssetIdByBaseId.get(baseId)!;
        for (const n of nums) {
          const qid = createdByNumber.get(n);
          if (!qid) continue;
          // Se já foi criado por baseTextId direto, ignora (unique constraint também protege).
          await prisma.importedQuestionAsset.create({
            data: { importedQuestionId: qid, importAssetId: assetId, role: "SUPPORT_TEXT" },
          }).catch(() => {});
        }
      }

      const elapsedMs = Date.now() - startedAt;

      await prisma.pDFImport.update({
        where: { id: pdfImport.id },
        data: {
          status: "REVIEW_PENDING",
          totalExtracted: createdCount,
          processingLog: JSON.stringify({
            pipeline: "ai",
            elapsedMs,
            provider: llm.provider,
            model: llm.model,
            inferredMeta: parsed?.meta ?? null,
            baseTexts: baseMap.size,
            gabarito: {
              separateFile: Boolean(gabaritoFile?.size),
              samePdfFlag: gabaritoNoMesmoPdf,
              ocrChars: gabaritoOcrText.length,
              mapSize: gabaritoMap.size,
            },
          }),
          originalFilenameGabarito: gabaritoFile?.name ?? null,
          gabaritoInSamePdf: gabaritoNoMesmoPdf,
        },
      });

      return NextResponse.json({
        importId: pdfImport.id,
        totalExtracted: createdCount,
        usedOcr: true,
        pipeline: "ai",
      }, { status: 201 });
    }

    // Verificar se o serviço Python está acessível (pipeline antigo)
    try {
      const health = await fetch(`${PDF_SERVICE_URL}/health`, {
        headers: { "X-Service-Secret": PDF_SERVICE_SECRET },
        signal: AbortSignal.timeout(5000),
      });
      if (!health.ok) throw new Error("Serviço indisponível");
    } catch {
      return NextResponse.json(
        { error: "O microserviço de PDF não está rodando. Inicie com: cd pdf-service && uvicorn main:app --reload" },
        { status: 503 }
      );
    }

    // Montar FormData para o serviço Python
    const pyFormData = new FormData();
    pyFormData.append("prova_file", provaFile);
    if (gabaritoFile) pyFormData.append("gabarito_file", gabaritoFile);
    pyFormData.append("gabarito_no_mesmo_pdf", String(gabaritoNoMesmoPdf));
    if (banca) pyFormData.append("banca", banca);
    if (concurso) pyFormData.append("concurso", concurso);
    if (cidade) pyFormData.append("cidade", cidade);
    if (materia) pyFormData.append("materia", materia);
    if (year) pyFormData.append("ano", year);

    const pyRes = await fetch(`${PDF_SERVICE_URL}/process`, {
      method: "POST",
      headers: { "X-Service-Secret": PDF_SERVICE_SECRET },
      body: pyFormData,
      signal: AbortSignal.timeout(120000), // 2 min para PDFs grandes
    });

    if (!pyRes.ok) {
      const err = await pyRes.text();
      throw new Error(`Erro no serviço Python: ${err}`);
    }

    const rawBody = await pyRes.text();
    const bodyParsed = safeJsonParse<Record<string, unknown>>(rawBody, "Resposta do microserviço de PDF (JSON)");
    if (!bodyParsed.ok) {
      await prisma.pDFImport.update({
        where: { id: pdfImport.id },
        data: { status: "FAILED", processingError: bodyParsed.message.slice(0, 500) },
      });
      return NextResponse.json(
        {
          error:
            "O serviço de PDF devolveu conteúdo que não é JSON válido. Pode ser PDF muito grande, caracteres não escapados no JSON, ou bug no serviço Python. Verifique os logs do pdf-service.",
          detail: bodyParsed.message,
        },
        { status: 502 },
      );
    }
    const result = bodyParsed.value as {
      status?: string;
      questions?: unknown;
      metadata?: {
        used_ocr?: boolean;
        answer_key_found?: boolean;
        answer_key_count?: number;
        inferred?: Record<string, unknown>;
        [k: string]: unknown;
      };
      error?: string;
      total_extracted?: number;
    };

    if (result.status === "FAILED") {
      await prisma.pDFImport.update({
        where: { id: pdfImport.id },
        data: { status: "FAILED", processingError: result.error, processingLog: JSON.stringify(result.metadata) },
      });
      return NextResponse.json({ error: `Falha no processamento: ${result.error}` }, { status: 422 });
    }

    // Metadados inferidos pelo Python (fallback quando admin não preencheu)
    const inferred = (result.metadata?.inferred ?? {}) as {
      banca?: string;
      concurso?: string;
      cidade?: string;
      ano?: number;
      estado?: string;
      cargo?: string;
    };
    const finalBanca = banca ?? inferred.banca ?? null;
    const finalConcurso = concurso ?? inferred.concurso ?? null;
    const finalCidade = cidade ?? inferred.cidade ?? null;
    const finalAno = year ? parseInt(year) : (inferred.ano ?? null);

    // Salvar questões extraídas no banco
    const questionsIn = Array.isArray(result.questions) ? result.questions : [];
    const importedQuestions = questionsIn.map((q: {
      content: string;
      alternatives: { letter: string; content: string }[];
      correct_answer?: string | null;
      source_page?: number | null;
      source_position?: number | null;
      has_image?: boolean;
      image_base64?: string | null;
      raw_text?: string | null;
      confidence?: number | null;
      suggested_subject?: string | null;
      suggested_subject_confidence?: string | null;
      suggested_subject_alternatives?: string[] | null;
    }) => ({
      importId: pdfImport.id,
      content: q.content,
      alternatives: q.alternatives,
      correctAnswer: q.correct_answer ?? null,
      suggestedSubjectId: subjectId ?? null,
      // Guardar sugestão de matéria como JSON no log da questão
      sourcePage: q.source_page ?? null,
      sourcePosition: q.source_position ?? null,
      hasImage: q.has_image ?? false,
      imageUrl: q.image_base64 ?? null,
      rawText: q.raw_text ?? null,
      confidence: q.confidence ?? null,
      status: "PENDING_REVIEW" as const,
      // Guardar classificação automática no raw_text estendido
      ...(q.suggested_subject ? {
        rawText: JSON.stringify({
          originalText: q.raw_text,
          suggestedSubject: q.suggested_subject,
          suggestedSubjectConfidence: q.suggested_subject_confidence,
          suggestedSubjectAlternatives: q.suggested_subject_alternatives,
        }),
      } : {}),
    }));

    if (importedQuestions.length > 0) {
      await prisma.importedQuestion.createMany({ data: importedQuestions });
    }

    await prisma.pDFImport.update({
      where: { id: pdfImport.id },
      data: {
        status: "REVIEW_PENDING",
        totalExtracted: result.total_extracted,
        processingLog: JSON.stringify({
          ...result.metadata,
          // Enriquecer com metadados finais mesclados
          finalBanca,
          finalConcurso,
          finalCidade,
          finalAno,
          inferredFromPdf: inferred,
        }),
        originalFilenameGabarito: gabaritoFile?.name ?? null,
        gabaritoInSamePdf: gabaritoNoMesmoPdf,
      },
    });

    return NextResponse.json({
      importId: pdfImport.id,
      totalExtracted: result.total_extracted,
      usedOcr: result.metadata?.used_ocr ?? false,
      answerKeyFound: result.metadata?.answer_key_found ?? false,
      answerKeyCount: result.metadata?.answer_key_count ?? 0,
      inferred: {
        banca: finalBanca,
        concurso: finalConcurso,
        cidade: finalCidade,
        ano: finalAno,
        estado: inferred.estado ?? null,
        cargo: inferred.cargo ?? null,
      },
    }, { status: 201 });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await prisma.pDFImport.update({
      where: { id: pdfImport.id },
      data: { status: "FAILED", processingError: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
