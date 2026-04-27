import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { setFinanceAuthCookie } from "@/lib/finance/extra-auth";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

const bodySchema = z.object({
  password: z.string().min(4).max(200),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const hash = (process.env.FINANCE_REPORT_PASSWORD_HASH ?? "").trim();
  if (!hash) return NextResponse.json({ error: "Financeiro não configurado" }, { status: 500 });

  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!ok) return NextResponse.json({ error: "Senha incorreta" }, { status: 403 });

  setFinanceAuthCookie();
  return NextResponse.json({ ok: true });
}

