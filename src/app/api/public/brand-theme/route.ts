import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const theme = await prisma.brandTheme.findFirst({
    where: { isDefault: true, isActive: true },
    select: {
      id: true,
      platformName: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      logoUrl: true,
      faviconUrl: true,
      loginBannerUrl: true,
      footerText: true,
      loginConfig: true,
      uiConfig: true,
    },
  });

  // fallback seguro se não existir tema no banco
  if (!theme) {
    return NextResponse.json({
      theme: {
        platformName: "Descomplique Seu Concurso",
        primaryColor: "#7C3AED",
        secondaryColor: "#8B5CF6",
        accentColor: "#EA580C",
        logoUrl: "/brand-logo.png",
        loginBannerUrl: "/login-brand-logo.png",
        footerText: null,
        loginConfig: null,
        uiConfig: null,
      },
    });
  }

  return NextResponse.json({ theme });
}

