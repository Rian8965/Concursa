import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";

const statusLabels: Record<string, string> = {
  OPEN: "Aberto",
  IN_ANALYSIS: "Em análise",
  RESPONDED: "Respondido",
  RESOLVED: "Resolvido",
  AUTO_CLOSED: "Encerrado automaticamente",
};

export default async function AdminSuportePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const tickets = await prisma.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="space-y-8 pb-12">
      <PageHeader title="Suporte" description="Solicitações enviadas por alunos e admins" />

      <div className="orbit-card-premium p-6">
        {tickets.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhum chamado.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/admin/suporte/${t.id}`}
                className="block rounded-2xl border border-black/[0.08] bg-white p-4 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{t.protocol}</p>
                    <p className="mt-1 truncate text-sm font-extrabold text-[#0F172A]">{t.subject}</p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {t.createdBy.name} · {t.createdBy.email} · {t.type} · {statusLabels[t.status] ?? t.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#0F172A]">{t._count.messages} mensagens</p>
                    <p className="mt-1 text-[11px] text-[#94A3B8]">
                      Prazo: {new Date(t.dueAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

