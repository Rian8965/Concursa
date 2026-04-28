import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SuporteClient from "./suporte-client";

export default async function SuportePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <SuporteClient role={session.user.role as any} />;
}

