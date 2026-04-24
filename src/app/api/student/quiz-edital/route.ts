import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  // Busca matérias do cargo do aluno
  let subjects: { name: string }[] = [];
  if (enrollment.jobRoleId) {
    const links = await prisma.competitionJobRoleSubject.findMany({
      where: { competitionId, jobRoleId: enrollment.jobRoleId },
      include: { subject: { select: { name: true } } },
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
    }
  }

  // Se tiver editalText salvo (resumo estruturado gerado na criação)
  if (competition.editalText) {
    contextLines.push(`\nINFORMAÇÕES COMPLETAS DO EDITAL:\n${competition.editalText}`);
  }

  // Cronograma
  if (competition.stages.length > 0) {
    contextLines.push(`\nCRONOGRAMA / ETAPAS:`);
    for (const stage of competition.stages) {
      let dateStr = "";
      if (stage.dateStart) {
        try {
          const ds = new Date(stage.dateStart).toLocaleDateString("pt-BR");
          const de = stage.dateEnd ? ` a ${new Date(stage.dateEnd).toLocaleDateString("pt-BR")}` : "";
          dateStr = ` — ${ds}${de}`;
        } catch { /* ignorado */ }
      }
      contextLines.push(`  • ${stage.name}${dateStr}${stage.description ? `: ${stage.description}` : ""}`);
    }
  }

  const editalContext = contextLines.join("\n");

  // Chama Gemini com o contexto
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });

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
    editalContext,
    "---",
    "",
    `PERGUNTA DO ALUNO: ${question.trim()}`,
  ].join("\n");

  const models = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro-latest"];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
        },
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        if (res.status === 404 || t.includes("NOT_FOUND")) continue;
        throw new Error(`Gemini ${model} (${res.status}): ${t.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const answer = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!answer.trim()) continue;
      return NextResponse.json({ answer, model });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NOT_FOUND") || msg.includes("404")) continue;
      throw e;
    }
  }

  return NextResponse.json({ error: "Não foi possível obter resposta da IA" }, { status: 502 });
}
