import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import AdminTicketClient from "./ticket-client";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) redirect("/admin/suporte");

  return <AdminTicketClient ticket={ticket as any} />;
}

