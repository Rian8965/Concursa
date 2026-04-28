import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function AdminNotificacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const items = await prisma.adminNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-8 pb-12">
      <PageHeader title="Notificações" description="Alertas do sistema (pagamentos, denúncias, suporte)" />

      <div className="orbit-card-premium p-6">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">Nenhuma notificação.</p>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.href || "/admin/notificacoes"}
                className={[
                  "block rounded-2xl border border-black/[0.08] bg-white p-4 hover:bg-slate-50",
                  n.readAt ? "opacity-70" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#0F172A]">{n.title}</p>
                    {n.body ? <p className="mt-1 text-xs text-[#64748B]">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {n.type} · {new Date(n.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!n.readAt ? (
                    <span className="rounded-xl bg-violet-600 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      Novo
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

