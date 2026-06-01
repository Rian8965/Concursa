import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { prisma } from "@/lib/db/prisma";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Descomplique seu Concurso — Plataforma de estudos",
    template: "%s | Descomplique seu Concurso",
  },
  description:
    "Plataforma premium de estudos para concursos públicos com treino inteligente, simulados cronometrados e apostilas personalizadas.",
  keywords: ["concursos públicos", "estudos", "simulado", "questões", "aprovação", "descomplique seu concurso"],
  robots: "noindex, nofollow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3B0764",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let theme: {
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
    uiConfig: unknown;
  } | null = null;

  try {
    theme = await prisma.brandTheme.findFirst({
      where: { isDefault: true, isActive: true },
      select: { primaryColor: true, secondaryColor: true, accentColor: true, uiConfig: true },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const isComputeQuota = /compute time quota/i.test(message);
    // #region agent log
    console.error(
      JSON.stringify({
        sessionId: "f080c8",
        hypothesisId: isComputeQuota ? "H1" : "H4",
        location: "layout.tsx:brandTheme",
        message: isComputeQuota ? "postgres_compute_quota" : "brand_theme_query_failed",
        data: { isComputeQuota, errorPreview: message.slice(0, 240) },
        timestamp: Date.now(),
      }),
    );
    fetch("http://127.0.0.1:7920/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f080c8" },
      body: JSON.stringify({
        sessionId: "f080c8",
        hypothesisId: isComputeQuota ? "H1" : "H4",
        location: "layout.tsx:brandTheme",
        message: isComputeQuota ? "postgres_compute_quota" : "brand_theme_query_failed",
        data: { isComputeQuota, errorPreview: message.slice(0, 240) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  function darken(hex: string, amount = 0.12) {
    const h = (hex || "").replace("#", "").trim();
    if (h.length !== 6) return hex;
    const r = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount))));
    const g = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount))));
    const b = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount))));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  const radiusScale =
    typeof (theme?.uiConfig as any)?.radiusScale === "number"
      ? (theme?.uiConfig as any).radiusScale
      : 1;

  const rXl = Math.round(16 * radiusScale);
  const rPanel = Math.round(24 * radiusScale);
  const primaryHover = theme?.primaryColor ? darken(theme.primaryColor, 0.14) : undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${font.variable} antialiased`}
        style={{
          ...(theme?.primaryColor ? { ["--primary" as any]: theme.primaryColor } : {}),
          ...(primaryHover ? { ["--primary-hover" as any]: primaryHover } : {}),
          ...(theme?.secondaryColor ? { ["--secondary" as any]: theme.secondaryColor } : {}),
          ...(theme?.accentColor ? { ["--accent" as any]: theme.accentColor } : {}),
          ...(Number.isFinite(rXl) ? { ["--r-xl" as any]: `${rXl}px` } : {}),
          ...(Number.isFinite(rPanel) ? { ["--r-panel" as any]: `${rPanel}px` } : {}),
        }}
      >
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster
          position="top-right"
          richColors
          theme="light"
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
              background: "#FFFFFF",
              border: "1px solid rgba(17,24,39,0.08)",
              borderLeft: "3px solid var(--accent)",
              color: "#111827",
              boxShadow: "var(--shadow-md)",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}
