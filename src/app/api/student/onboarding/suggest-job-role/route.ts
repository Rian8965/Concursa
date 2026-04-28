import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runLlmJson } from "@/lib/ai/llm";
import { parseLlmJsonRobustly } from "@/lib/ai/parse-llm-json";

const bodySchema = z.object({ text: z.string().min(3).max(120) });

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });

  const text = parsed.data.text;
  const norm = normalize(text);
  const tokens = norm.split(" ").filter((t) => t.length >= 3).slice(0, 6);

  // Heurística: busca por partes do nome (rápida e sempre disponível).
  const whereOr = tokens.length
    ? tokens.map((t) => ({ name: { contains: t, mode: "insensitive" as const } }))
    : [{ name: { contains: text, mode: "insensitive" as const } }];

  const heuristic = await prisma.jobRole.findMany({
    where: { isActive: true, OR: whereOr },
    select: { id: true, name: true },
    take: 8,
    orderBy: { name: "asc" },
  });

  // IA: tenta escolher o melhor(s) cargo(s) dentre os existentes (quando há provider configurado).
  try {
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
      const candidates = await prisma.jobRole.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        take: 200,
        orderBy: { updatedAt: "desc" },
      });

      const system = `Você ajuda um aluno concurseiro a escolher um cargo equivalente.
Retorne SOMENTE JSON no formato:
{ "jobRoleIds": string[] }

Regras:
- Considere SEMELHANÇA por nome, sinônimos e área (ex.: "Agente Administrativo" ~ "Assistente Administrativo").
- Retorne até 6 ids.
- Se não tiver confiança, retorne [].
`;

      const user = `Texto informado pelo aluno: ${JSON.stringify(text)}

Opções disponíveis (id, nome):
${candidates.map((c) => `- ${c.id} | ${c.name}`).join("\n")}
`;

      const { jsonText } = await runLlmJson(system, user);
      const robust = parseLlmJsonRobustly(jsonText);
      if (robust.ok) {
        const obj = robust.value as { jobRoleIds?: unknown };
        const ids = Array.isArray(obj.jobRoleIds) ? obj.jobRoleIds.map(String).filter(Boolean) : [];
        if (ids.length) {
          const chosen = await prisma.jobRole.findMany({
            where: { id: { in: ids }, isActive: true },
            select: { id: true, name: true },
          });
          // Mantém ordem sugerida pelo LLM
          const map = new Map(chosen.map((c) => [c.id, c]));
          const ordered = ids.map((id) => map.get(id)).filter(Boolean) as Array<{ id: string; name: string }>;
          return NextResponse.json({ suggestions: ordered.slice(0, 6) });
        }
      }
    }
  } catch (e) {
    console.warn("[onboarding] LLM suggest failed; falling back to heuristic.", e);
  }

  return NextResponse.json({ suggestions: heuristic.slice(0, 6) });
}

