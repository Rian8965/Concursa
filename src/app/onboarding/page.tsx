import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") redirect("/admin/dashboard");
  return <OnboardingClient />;
}

