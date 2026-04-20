import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { saveImportPdfBuffer } from "@/lib/import-pdf-storage";
import { NextRequest, NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { runLlmJson } from "@/lib/ai/llm";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

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
    const withPos = p.paragraphs.filter((x) => x.text.trim().length > 0 && x.midY != null);
    const left = withPos.filter((x) => (x.midX ?? 0.5) < 0.5).sort((a, b) => (a.midY ?? 0) - (b.midY ?? 0));
    const right = withPos.filter((x) => (x.midX ?? 0.5) >= 0.5).sort((a, b) => (a.midY ?? 0) - (b.midY ?? 0));
    const joined = [...left, ...right].map((x) => x.text.trim()).filter(Boolean).join("\n");
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
      const location = requiredEnv("DOC_AI_LOCATION");
      const processorId = requiredEnv("DOC_AI_PROCESSOR_ID");

      const buf = Buffer.from(await provaFile.arrayBuffer());

      const client = new DocumentProcessorServiceClient({
        apiEndpoint: `${location}-documentai.googleapis.com`,
      });

      const name = client.processorPath(projectId, location, processorId);
      const [docaiRes] = await client.processDocument({
        name,
        rawDocument: { content: buf.toString("base64"), mimeType: "application/pdf" },
      });

      const fullText = docaiRes.document?.text ?? "";
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
        "{ meta: { city?, concurso?, ano?, banca?, cargo?, materia? }, baseTexts: [{id, text}], questions: [{number, statement, baseTextId?, alternatives:[{letter, text}], correctAnswerLetter?}] }",
        "REGRAS:",
        "- Se houver 'texto-base' (enunciado comum) que vale para várias questões, crie um item em baseTexts e aponte baseTextId em todas as questões relacionadas.",
        "- Ignorar redação/discursivas: não criar questions para essa seção.",
        "- Manter a ordem correta das questões.",
        "- Alternativas: normalizar letras A,B,C,D,E.",
      ].join("\n");

      const user = [
        "Extraia a prova abaixo em JSON.",
        "TEXTO:",
        combined,
      ].join("\n\n");

      const llm = await runLlmJson(system, user);
      const parsed = JSON.parse(llm.jsonText) as any;

      const baseTexts = Array.isArray(parsed?.baseTexts) ? parsed.baseTexts : [];
      const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

      const baseMap = new Map<string, string>();
      for (const bt of baseTexts) {
        if (bt?.id && typeof bt.text === "string") baseMap.set(String(bt.id), bt.text);
      }

      const importedQuestions = questions.map((q: any, idx: number) => {
        const base = q?.baseTextId ? baseMap.get(String(q.baseTextId)) : undefined;
        const statement = String(q?.statement ?? q?.content ?? "").trim();
        const content = base ? `${base.trim()}\n\n${statement}` : statement;

        const altsRaw = Array.isArray(q?.alternatives) ? q.alternatives : [];
        const alternatives = altsRaw
          .map((a: any, i: number) => ({
            letter: String(a?.letter ?? String.fromCharCode(65 + i)).toUpperCase().slice(0, 1),
            content: String(a?.text ?? a?.content ?? "").trim(),
          }))
          .filter((a: any) => a.content.length > 0);

        return {
          importId: pdfImport.id,
          content,
          alternatives,
          correctAnswer: q?.correctAnswerLetter ? String(q.correctAnswerLetter).toUpperCase().slice(0, 1) : (q?.correct_answer ?? null),
          suggestedSubjectId: subjectId ?? null,
          sourcePage: null,
          sourcePosition: idx + 1,
          hasImage: false,
          imageUrl: null,
          rawText: JSON.stringify({ baseTextId: q?.baseTextId ?? null, baseText: base ?? null, statement, meta: parsed?.meta ?? null }),
          confidence: null,
          status: "PENDING_REVIEW" as const,
        };
      });

      if (importedQuestions.length > 0) {
        await prisma.importedQuestion.createMany({ data: importedQuestions });
      }

      const elapsedMs = Date.now() - startedAt;

      await prisma.pDFImport.update({
        where: { id: pdfImport.id },
        data: {
          status: "REVIEW_PENDING",
          totalExtracted: importedQuestions.length,
          processingLog: JSON.stringify({
            pipeline: "ai",
            elapsedMs,
            provider: llm.provider,
            model: llm.model,
            inferredMeta: parsed?.meta ?? null,
          }),
          originalFilenameGabarito: gabaritoFile?.name ?? null,
          gabaritoInSamePdf: gabaritoNoMesmoPdf,
        },
      });

      return NextResponse.json({
        importId: pdfImport.id,
        totalExtracted: importedQuestions.length,
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

    const result = await pyRes.json();

    if (result.status === "FAILED") {
      await prisma.pDFImport.update({
        where: { id: pdfImport.id },
        data: { status: "FAILED", processingError: result.error, processingLog: JSON.stringify(result.metadata) },
      });
      return NextResponse.json({ error: `Falha no processamento: ${result.error}` }, { status: 422 });
    }

    // Metadados inferidos pelo Python (fallback quando admin não preencheu)
    const inferred = result.metadata?.inferred ?? {};
    const finalBanca = banca ?? inferred.banca ?? null;
    const finalConcurso = concurso ?? inferred.concurso ?? null;
    const finalCidade = cidade ?? inferred.cidade ?? null;
    const finalAno = year ? parseInt(year) : (inferred.ano ?? null);

    // Salvar questões extraídas no banco
    const importedQuestions = result.questions.map((q: {
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
