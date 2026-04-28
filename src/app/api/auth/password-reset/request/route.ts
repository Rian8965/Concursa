import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";

const bodySchema = z.object({
  // pode vir e-mail ou CPF (por enquanto tentamos e-mail; CPF: busca em studentProfile.cpf)
  identifier: z.string().min(3).max(200),
});

function randomToken() {
  return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2)}`;
}

function normalizeCpf(s: string) {
  return s.replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // resposta neutra
    return NextResponse.json({ ok: true });
  }

  const identifier = parsed.data.identifier.trim();
  const isEmail = identifier.includes("@");
  const email = isEmail ? identifier.toLowerCase() : null;
  const cpf = !isEmail ? normalizeCpf(identifier) : null;

  const user = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } })
    : cpf
      ? await prisma.user.findFirst({
          where: { studentProfile: { cpf } },
          select: { id: true, email: true, name: true },
        })
      : null;

  // Não revelar se existe ou não (segurança)
  if (!user) return NextResponse.json({ ok: true });

  // rate limit simples: 1 pedido por minuto por usuário
  const last = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - new Date(last.createdAt).getTime() < 60_000) {
    return NextResponse.json({ ok: true });
  }

  const expiresMinutes = 30;
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  const token = randomToken();

  // revoga tokens anteriores não usados
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token,
      expiresMinutes,
    });
  } catch (e: any) {
    console.error("[email.password-reset] falha ao enviar", { to: user.email, message: String(e?.message ?? e) });
    // mantém resposta neutra
  }

  return NextResponse.json({ ok: true });
}

