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
    <div className="orbit-shell min-h-screen">
      <StudentSidebar studentName={session.user.name} planName={studentProfile?.plan?.name} />
      <main className="student-main">
        <div className="student-main-inner">{children}</div>
      </main>
    </div>
  );
}
