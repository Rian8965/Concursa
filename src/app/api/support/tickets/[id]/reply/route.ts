import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminNotification } from "@/lib/admin/notifications";

const bodySchema = z.object({ message: z.string().min(2).max(8000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || ticket.createdById !== session.user.id) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });

  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      actor: "USER",
      actorUserId: session.user.id,
      content: parsed.data.message.trim(),
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "OPEN", updatedAt: new Date() },
  });

  await createAdminNotification({
    type: "SUPPORT_TICKET_CREATED",
    title: `Nova mensagem: ${ticket.protocol}`,
    body: parsed.data.message.trim().slice(0, 220),
    href: `/admin/suporte/${ticket.id}`,
    meta: { ticketId: ticket.id, protocol: ticket.protocol },
  });

  return NextResponse.json({ ok: true });
}

