import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { newSupportProtocol } from "@/lib/support/protocol";
import { sendSupportTicketCreatedEmail } from "@/lib/email/support";
import { createAdminNotification } from "@/lib/admin/notifications";

const postSchema = z.object({
  subject: z.string().min(3).max(140),
  type: z.enum(["ACCESS", "PAYMENT", "QUESTION_ERROR", "USAGE_DOUBT", "TECHNICAL", "OTHER"]).default("OTHER"),
  message: z.string().min(10).max(8000),
  attachments: z.array(z.any()).max(6).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where: { createdById: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      protocol: true,
      subject: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      dueAt: true,
    },
  });

  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const protocol = newSupportProtocol();
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const ticket = await prisma.supportTicket.create({
    data: {
      protocol,
      createdById: session.user.id,
      userId: session.user.id,
      studentProfileId: profile?.id ?? null,
      subject: parsed.data.subject.trim(),
      type: parsed.data.type as any,
      status: "OPEN",
      dueAt,
      messages: {
        create: {
          actor: "USER",
          actorUserId: session.user.id,
          content: parsed.data.message.trim(),
          attachments: (parsed.data.attachments ?? null) as any,
        },
      },
    },
    select: { id: true, protocol: true, subject: true },
  });

  // Email de confirmação (best-effort)
  try {
    await sendSupportTicketCreatedEmail({
      to: session.user.email ?? "",
      name: session.user.name,
      protocol: ticket.protocol,
      subject: ticket.subject,
    });
  } catch (e) {
    console.error("[support] send created email failed", e);
  }

  // Notificação para admin (no sistema)
  await createAdminNotification({
    type: "SUPPORT_TICKET_CREATED",
    title: `Novo chamado: ${ticket.protocol}`,
    body: ticket.subject,
    href: `/admin/suporte/${ticket.id}`,
    meta: { ticketId: ticket.id },
  });

  return NextResponse.json({ ok: true, ticketId: ticket.id, protocol: ticket.protocol });
}

