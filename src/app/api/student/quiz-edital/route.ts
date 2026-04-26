import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type GeminiOk = { ok: true; answer: string; model: string };
type GeminiErr = { ok: false; retryable: boolean; status?: number; message: string; raw?: string };

function trimText(s: string, maxChars: number) {
  const t = (s ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[Contexto truncado automaticamente para caber no limite do modelo]`;
}

async function callGemini(args: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model: string;
}): Promise<GeminiOk | GeminiErr> {
  const { apiKey, systemPrompt, userPrompt, model } = args;

  const urls = [
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const retryable = res.status === 429 || res.status >= 500;
        // 404/NOT_FOUND: tenta próximo endpoint/modelo
        if (res.status === 404 || t.includes("NOT_FOUND")) continue;
        // tenta extrair mensagem útil do JSON de erro do Gemini
        let extracted = "";
        try {
          const j = JSON.parse(t) as any;
          extracted = j?.error?.message ? String(j.error.message) : "";
        } catch { /* ignore */ }
        const msg = extracted ? `Gemini ${model} (${res.status}): ${extracted}` : `Gemini ${model} (${res.status})`;
        return { ok: false, retryable, status: res.status, message: msg, raw: t.slice(0, 2400) };
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const answer = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!answer.trim()) return { ok: false, retryable: false, message: `Resposta vazia do modelo ${model}` };
      return { ok: true, answer, model };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, retryable: true, message: msg };
    }
  }

  return { ok: false, retryable: false, message: `Modelo/endpoint não encontrado para ${model}` };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { competitionId, question } = (await req.json()) as {
    competitionId: string;
    question: string;
  };

  if (!competitionId || !question?.trim()) {
    return NextResponse.json({ error: "competitionId e question são obrigatórios" }, { status: 400 });
  }

  const profile = await prisma.studentProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // Verifica se o aluno está matriculado neste concurso
  const enrollment = await prisma.studentCompetition.findUnique({
    where: { studentProfileId_competitionId: { studentProfileId: profile.id, competitionId } },
    include: { jobRole: { select: { id: true, name: true } } },
  });
  if (!enrollment) return NextResponse.json({ error: "Concurso não vinculado" }, { status: 403 });

  // Busca dados completos do concurso
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      city: true,
      examBoard: true,
      stages: { orderBy: { order: "asc" } },
    },
  });
  if (!competition) return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });

  // Busca matérias do cargo (se houver) ou do concurso (fallback)
  let subjects: { name: string }[] = [];
  if (enrollment.jobRoleId) {
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId, jobRoleId: enrollment.jobRoleId },
      include: { subject: { select: { name: true } } },
      orderBy: { subject: { name: "asc" } },
    });
    subjects = links.map((l) => l.subject);
  } else {
    const links = await prisma.competitionSubject.findMany({
      where: { competitionId },
      include: { subject: { select: { name: true } } },
      orderBy: { subject: { name: "asc" } },
    });
    subjects = links.map((l) => l.subject);
  }

  // Monta o contexto do edital a partir dos dados estruturados
  const contextLines: string[] = [];

  contextLines.push(`CONCURSO: ${competition.name}`);
  if (competition.organization) contextLines.push(`ÓRGÃO/ENTIDADE: ${competition.organization}`);
  if (competition.examBoard) contextLines.push(`BANCA ORGANIZADORA: ${competition.examBoard.acronym}${competition.examBoard.name !== competition.examBoard.acronym ? ` — ${competition.examBoard.name}` : ""}`);
  if (competition.city) contextLines.push(`CIDADE: ${competition.city.name}, ${competition.city.state}`);
  if (competition.examDate) {
    try {
      const d = new Date(competition.examDate);
      if (!isNaN(d.getTime())) {
        contextLines.push(`DATA DA PROVA: ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`);
      }
    } catch { /* ignorado */ }
  }
  if (competition.description) contextLines.push(`\nDESCRIÇÃO DO CONCURSO:\n${competition.description}`);

  // Cargo do aluno e matérias
  if (enrollment.jobRole) {
    contextLines.push(`\nCARGO DO ALUNO: ${enrollment.jobRole.name}`);
    if (subjects.length > 0) {
      contextLines.push(`MATÉRIAS DO CARGO:`);
      subjects.forEach((s) => contextLines.push(`  • ${s.name}`));
    } else {
      contextLines.push(`MATÉRIAS DO CARGO: (não configuradas)`);
    }
  } else {
    if (subjects.length > 0) {
      contextLines.push(`\nMATÉRIAS DO CONCURSO:`);
      subjects.forEach((s) => contextLines.push(`  • ${s.name}`));
    }
  }

  // Cronograma
  if (competition.stages.length > 0) {
    contextLines.push(`\nCRONOGRAMA / ETAPAS:`);
    for (const stage of competition.stages) {
      // stage.description guarda as datas enquanto as colunas dateStart/dateEnd não existem no banco
      const datePart = stage.description ? ` — ${stage.description}` : "";
      contextLines.push(`  • ${stage.name}${datePart}`);
    }
  }

  const editalContext = contextLines.join("\n");

  // Chama Gemini com o contexto
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      {
        code: "GEMINI_NOT_CONFIGURED",
        error: "A IA do Quiz não está configurada (GEMINI_API_KEY ausente).",
      },
      { status: 424 },
    );
  }

  const hasAnyContext =
    Boolean(competition.organization) ||
    Boolean(competition.examBoard) ||
    Boolean(competition.city) ||
    Boolean(competition.examDate) ||
    Boolean(competition.description?.trim()) ||
    subjects.length > 0 ||
    competition.stages.length > 0;
  if (!hasAnyContext) {
    return NextResponse.json(
      {
        code: "NO_EDITAL_CONTEXT",
        error:
          "Este concurso ainda não tem informações de edital cadastradas (descrição, etapas e matérias). Assim, o Quiz não consegue responder com base no edital.",
      },
      { status: 404 },
    );
  }

  const systemPrompt = [
    "Você é um assistente especializado em concursos públicos brasileiros.",
    "Você tem acesso ao conteúdo do edital do concurso ao qual o aluno está vinculado.",
    "REGRAS IMPORTANTES:",
    "- Responda SOMENTE com base nas informações do edital fornecido abaixo.",
    "- Se a informação não estiver disponível no contexto do edital, diga explicitamente que não encontrou essa informação no edital.",
    "- Seja objetivo e direto. Use linguagem clara e acessível.",
    "- Formate bem a resposta: use listas quando aplicável.",
    "- Não invente informações. Não use conhecimento externo ao edital.",
  ].join("\n");

  const userPrompt = [
    "CONTEXTO DO EDITAL:",
    "---",
    trimText(editalContext, 14000),
    "---",
    "",
    `PERGUNTA DO ALUNO: ${trimText(question.trim(), 1200)}`,
  ].join("\n");

  const models = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
  ];

  let lastErr: GeminiErr | null = null;
  for (const model of models) {
    const r = await callGemini({ apiKey: geminiKey, systemPrompt, userPrompt, model });
    if (r.ok) return NextResponse.json({ answer: r.answer, model: r.model });
    lastErr = r;
    // se não for retryable (ex: modelo inexistente), tenta próximo modelo
    // se for retryable (429/5xx), ainda tenta modelos menores
  }

  console.error("[quiz-edital] gemini failed", {
    competitionId,
    studentProfileId: profile.id,
    status: lastErr?.status,
    message: lastErr?.message,
    raw: lastErr?.raw,
  });

  return NextResponse.json(
    {
      code: "GEMINI_FAILED",
      error: "Não foi possível obter resposta da IA no momento. Tente novamente em instantes.",
      details: lastErr ? { status: lastErr.status, message: lastErr.message, raw: lastErr.raw } : undefined,
    },
    { status: lastErr?.status === 429 ? 429 : 502 },
  );
}
