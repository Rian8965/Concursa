import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import AdminConfiguracoesClient from "./AdminConfiguracoesClient";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export default async function AdminConfiguracoesPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/login");

  const theme = await prisma.brandTheme.findFirst({
    where: { isDefault: true, isActive: true },
    select: {
      platformName: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      logoUrl: true,
      loginBannerUrl: true,
      footerText: true,
      loginConfig: true,
      uiConfig: true,
    },
  });

  return (
    <AdminConfiguracoesClient initialTheme={theme as any} />
  );
}
