import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeEnunciadoBatchLlm } from "@/lib/import/enunciado-llm";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

/** Lote de IA: reforça flags de dependência. O cliente combina com heurística a partir do rascunho. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    items?: { id: string; content: string }[];
  };
  const items = body.items?.filter((x) => x?.id && typeof x.content === "string") ?? [];
  if (items.length > 120) {
    return NextResponse.json({ error: "Máximo 120 itens por requisição" }, { status: 400 });
  }

  let llm: Record<string, { needsTextSupport: boolean; needsFigure: boolean }> | null = null;
  try {
    if (items.length) llm = await analyzeEnunciadoBatchLlm(items);
  } catch (e) {
    console.error("[analyze-enunciado-dependencies]", e);
  }

  return NextResponse.json({ llm: llm ?? {}, hadLlm: Boolean(llm && Object.keys(llm).length) });
}
