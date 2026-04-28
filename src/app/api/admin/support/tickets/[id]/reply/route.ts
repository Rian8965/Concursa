import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendSupportTicketReplyEmail } from "@/lib/email/support";

const bodySchema = z.object({ message: z.string().min(2).max(8000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });

  const reply = parsed.data.message.trim();

  await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      actor: "ADMIN",
      actorUserId: session.user.id,
      content: reply,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: "RESPONDED",
      respondedAt: ticket.respondedAt ?? new Date(),
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Email para o usuário (best-effort)
  try {
    if (ticket.createdBy.email) {
      await sendSupportTicketReplyEmail({
        to: ticket.createdBy.email,
        name: ticket.createdBy.name,
        protocol: ticket.protocol,
        subject: ticket.subject,
        reply,
      });
    }
  } catch (e) {
    console.error("[support] reply email failed", e);
  }

  return NextResponse.json({ ok: true });
}

