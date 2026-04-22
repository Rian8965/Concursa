import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export default async function AdminConfiguracoesPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/login");

  const theme = await prisma.brandTheme.findFirst({
    where: { isDefault: true, isActive: true },
  });

  return (
    <div className="orbit-stack max-w-3xl animate-fade-up">
      <PageHeader
        title="Configurações"
        description="Identidade visual e white-label da plataforma. A edição completa de cores e logos por API administrativa pode ser expandida conforme a necessidade da sua instituição."
      />

      {theme ? (
        <div className="orbit-panel">
          <div className="orbit-panel-header items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-md">
                <Settings className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Tema padrão ativo</p>
                <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">{theme.platformName}</p>
              </div>
            </div>
          </div>
          <div className="orbit-panel-body">
            <div className="flex flex-wrap gap-5">
              {[
                { label: "Primária", v: theme.primaryColor },
                { label: "Secundária", v: theme.secondaryColor },
                { label: "Acento", v: theme.accentColor },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[var(--bg-elevated)] px-4 py-3">
                  <span
                    className="h-9 w-9 shrink-0 rounded-xl border border-black/[0.08] shadow-sm"
                    style={{ background: c.v }}
                  />
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)]">{c.label}</p>
                    <code className="text-[13px] font-medium text-[var(--text-primary)]">{c.v}</code>
                  </div>
                </div>
              ))}
            </div>
            {theme.footerText ? (
              <p className="mt-6 text-sm leading-relaxed text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">Rodapé:</span> {theme.footerText}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="orbit-empty-state text-left sm:text-center">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Nenhum tema cadastrado. Execute o seed do banco (<code className="rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-800">npm run db:seed</code>) para criar o tema padrão.
          </p>
        </div>
      )}
    </div>
  );
}
