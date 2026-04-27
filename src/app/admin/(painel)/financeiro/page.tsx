import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import FinanceiroClient from "./FinanceiroClient";

export default async function AdminFinanceiroPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  return <FinanceiroClient />;
}

