import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(72),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { token, password } = parsed.data;

  const record = await prisma.firstAccessToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!record) return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  if (record.usedAt) return NextResponse.json({ error: "Token já utilizado" }, { status: 400 });
  if (record.expiresAt.getTime() < Date.now()) return NextResponse.json({ error: "Token expirado" }, { status: 400 });

  const hash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (p) => {
    await p.user.update({ where: { id: record.userId }, data: { password: hash } });
    await p.firstAccessToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  });

  return NextResponse.json({ ok: true });
}

