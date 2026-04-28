import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import RenovarClient from "./renovar-client";

export default async function RenovarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") redirect("/admin/dashboard");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { accessExpiresAt: true, plan: { select: { name: true } } },
  });

  return (
    <RenovarClient
      planName={profile?.plan?.name ?? "Plano Completo"}
      accessExpiresAt={profile?.accessExpiresAt ? profile.accessExpiresAt.toISOString() : null}
    />
  );
}

