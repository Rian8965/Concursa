import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const theme = await prisma.brandTheme.findFirst({
    where: { isDefault: true, isActive: true },
  });

  return NextResponse.json({ theme });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as any;
  if (!body?.theme) return NextResponse.json({ error: "Campo 'theme' é obrigatório" }, { status: 400 });

  const existing = await prisma.brandTheme.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });

  // se não existir, cria um tema padrão novo
  const data = {
    platformName: String(body.theme.platformName ?? "Plataforma").trim(),
    primaryColor: String(body.theme.primaryColor ?? "#7C3AED").trim(),
    secondaryColor: String(body.theme.secondaryColor ?? "#8B5CF6").trim(),
    accentColor: String(body.theme.accentColor ?? "#EA580C").trim(),
    logoUrl: body.theme.logoUrl ? String(body.theme.logoUrl) : null,
    loginBannerUrl: body.theme.loginBannerUrl ? String(body.theme.loginBannerUrl) : null,
    footerText: body.theme.footerText ? String(body.theme.footerText) : null,
    loginConfig: body.theme.loginConfig ?? null,
    uiConfig: body.theme.uiConfig ?? null,
  };

  const saved = existing
    ? await prisma.brandTheme.update({ where: { id: existing.id }, data })
    : await prisma.brandTheme.create({
      data: {
        name: "Tema padrão",
        slug: `tema-padrao-${Date.now()}`,
        isDefault: true,
        isActive: true,
        ...data,
      },
    });

  return NextResponse.json({ theme: saved });
}

