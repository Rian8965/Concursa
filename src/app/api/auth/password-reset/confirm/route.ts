import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const bodySchema = z.object({
  token: z.string().min(10).max(400),
  password: z.string().min(6).max(200),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const token = parsed.data.token.trim();
  const prt = await prisma.passwordResetToken.findUnique({
    where: { token },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!prt) return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  if (prt.usedAt) return NextResponse.json({ error: "Token já utilizado" }, { status: 400 });
  if (new Date(prt.expiresAt).getTime() < Date.now()) return NextResponse.json({ error: "Token expirado" }, { status: 400 });

  const hash = await bcrypt.hash(parsed.data.password, 10);

  await prisma.$transaction(async (p) => {
    await p.user.update({ where: { id: prt.userId }, data: { password: hash } });
    await p.passwordResetToken.update({ where: { id: prt.id }, data: { usedAt: new Date() } });
  });

  return NextResponse.json({ ok: true });
}

