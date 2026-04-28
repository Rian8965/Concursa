import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import TicketClient from "./ticket-client";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket || ticket.createdById !== session.user.id) redirect("/suporte");

  return <TicketClient ticket={ticket as any} />;
}

