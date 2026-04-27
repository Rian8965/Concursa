import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasValidFinanceAuthCookie } from "@/lib/finance/extra-auth";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ ok: await hasValidFinanceAuthCookie() });
}

