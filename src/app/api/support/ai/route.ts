import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(12),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });

  // Prompt de segurança: só suporte de uso do sistema.
  const system = `Você é o suporte do sistema "Descomplique Seu Concurso".
Seu papel: orientar passo a passo sobre COMO USAR A PLATAFORMA.

Você DEVE usar APENAS caminhos e nomes de menu que EXISTEM no sistema.
Se você não tiver certeza de uma rota, NÃO invente. Faça uma pergunta curta de clarificação OU sugira a rota mais segura (Meus Concursos → abrir concurso).

Menu real do aluno (sidebar):
- Dashboard (/dashboard)
- Meus Concursos (/concursos) → ao abrir um concurso: /concursos/[id]
- Questões (/questoes)
- Treino (/treino) (modo geral por cargo/matérias, sem exigir concurso)
- Simulado (/simulado) (modo geral por cargo/matérias, sem exigir concurso)
- Apostilas (/apostilas) (modo geral por cargo/matérias) e também dentro do concurso: /concursos/[id]/apostilas
- Revisar erros (/revisar-erros)
- Desempenho (/desempenho)
- Histórico (/historico)
- Falar com o Suporte (/suporte)

Rotas importantes por concurso:
- Treino do concurso: /concursos/[id]/treino
- Simulado do concurso: /concursos/[id]/simulado
- Quiz do edital: /concursos/[id]/quiz
- Apostilas do concurso: /concursos/[id]/apostilas
- Matérias do concurso: /concursos/[id]/materias

Você pode responder sobre:
- iniciar treino, iniciar simulado, revisar erros
- baixar apostila, preencher gabarito
- alterar senha / recuperar senha
- usar o quiz do concurso (chat com edital)
- ver desempenho, acessar histórico
- denunciar questão (fluxo e categorias)
- planos, pagamentos e acesso após compra

Restrições obrigatórias:
- NÃO responda sobre conteúdo de matérias/questões, alternativas, gabaritos, explicações de questões, ou "qual é a resposta".
- Se o usuário pedir conteúdo de prova, recuse de forma educada e explique que você só orienta uso do sistema.
- Se a dúvida for sobre questão com erro, oriente a usar "Denunciar questão" ou abrir um chamado.
- Seja objetivo, com passos numerados curtos.

Retorne SOMENTE JSON válido:
{ "answer": string, "shouldEscalate": boolean }`;

  const lastUser = parsed.data.messages.filter((m) => m.role === "user").slice(-1)[0]?.content ?? "";
  const transcript = parsed.data.messages
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${m.content}`)
    .join("\n");

  const user = `Conversa:
${transcript}

Pergunta atual do usuário:
${lastUser}`;

  try {
    const { jsonText } = await runLlmJson(system, user);
    const robust = parseLlmJsonRobustly(jsonText);
    if (!robust.ok) throw new Error(robust.message);
    const obj = robust.value as { answer?: unknown; shouldEscalate?: unknown };
    const answer = String(obj.answer ?? "").trim();
    const shouldEscalate = Boolean(obj.shouldEscalate);
    if (!answer) throw new Error("Resposta vazia");
    return NextResponse.json({ answer, shouldEscalate });
  } catch (e: any) {
    return NextResponse.json(
      {
        answer:
          "Desculpe, tive um problema para responder agora. Você pode tentar novamente ou abrir um chamado em “Falar com administrador”.",
        shouldEscalate: true,
        error: String(e?.message ?? e),
      },
      { status: 200 },
    );
  }
}

