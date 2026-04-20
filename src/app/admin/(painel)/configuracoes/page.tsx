import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

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
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Settings style={{ width: 22, height: 22, color: "#7C3AED" }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Configurações</h1>
      </div>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.55 }}>
        Identidade visual e white-label do ÓRBITA. A edição completa de cores e logos por API administrativa pode ser expandida
        conforme a necessidade da sua instituição.
      </p>

      {theme ? (
        <div className="card" style={{ padding: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tema padrão ativo
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 16 }}>{theme.platformName}</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Primária", v: theme.primaryColor },
              { label: "Secundária", v: theme.secondaryColor },
              { label: "Acento", v: theme.accentColor },
            ].map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: c.v,
                    border: "1px solid #E5E7EB",
                  }}
                />
                <span style={{ fontSize: 13, color: "#374151" }}>
                  {c.label}: <code style={{ fontSize: 12 }}>{c.v}</code>
                </span>
              </div>
            ))}
          </div>
          {theme.footerText ? (
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 16 }}>Rodapé: {theme.footerText}</p>
          ) : null}
        </div>
      ) : (
        <div className="card" style={{ padding: 20, color: "#6B7280", fontSize: 14 }}>
          Nenhum tema cadastrado. Execute o seed do banco (<code style={{ fontSize: 12 }}>npm run db:seed</code>) para criar o tema ÓRBITA padrão.
        </div>
      )}
    </div>
  );
}
