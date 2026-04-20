import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/shared/StudentSidebar";
import { prisma } from "@/lib/db/prisma";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") redirect("/admin/dashboard");

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { plan: true },
  });

  return (
    <div className="min-h-screen" style={{ background: "#F8F7FF" }}>
      <StudentSidebar
        studentName={session.user.name}
        planName={studentProfile?.plan?.name}
      />
      <main style={{ paddingLeft: "240px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 40px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
