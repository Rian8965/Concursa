import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/providers/session-provider";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "ÓRBITA Concursos — Sua aprovação está em órbita",
    template: "%s | ÓRBITA Concursos",
  },
  description:
    "Plataforma premium de estudos para concursos públicos com treino inteligente, simulados cronometrados e apostilas personalizadas.",
  keywords: ["concursos públicos", "estudos", "simulado", "questões", "aprovação", "órbita"],
  robots: "noindex, nofollow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3B0764",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${font.variable} antialiased`}>
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
