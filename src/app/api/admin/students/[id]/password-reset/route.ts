import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { getAppUrl } from "@/lib/billing/infinitepay";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

const bodySchema = z.object({
  sendEmail: z.boolean().optional().default(true),
});

function randomToken() {
  return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}.${Math.random().toString(36).slice(2)}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
  if (!user) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });

  const expiresMinutes = 30;
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  const token = randomToken();

  // revoga tokens anteriores não usados (evita confusão)
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
      createdByAdminId: session.user.id,
    },
  });

  const link = `${getAppUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;

  if (parsed.data.sendEmail) {
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token,
        expiresMinutes,
      });
    } catch (e: any) {
      console.error("[email.password-reset] falha ao enviar", { to: user.email, message: String(e?.message ?? e) });
      return NextResponse.json({ error: "Não foi possível enviar o e-mail", link }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, link });
}

