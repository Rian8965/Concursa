import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/shared/AdminSidebar";
import { AdminLayoutMetrics } from "@/components/admin/AdminLayoutMetrics";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  return (
    <div className="orbit-shell min-h-screen">
      <AdminSidebar adminName={session.user.name} />
      <main className="orbit-main">
        <div className="orbit-main-inner">
          <AdminLayoutMetrics />
          {children}
        </div>
      </main>
    </div>
  );
}
