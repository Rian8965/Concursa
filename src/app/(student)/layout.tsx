import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StudentSidebar } from "@/components/shared/StudentSidebar";
import { prisma } from "@/lib/db/prisma";
import { getAccessStatus } from "@/lib/billing/access";
import Link from "next/link";
import { TrialConversionPopup } from "@/components/student/TrialConversionPopup";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN") redirect("/admin/dashboard");

  const studentProfile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { plan: true, studentCompetitions: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });

  // Onboarding obrigatório apenas para alunos criados via pagamento automático.
  // Importante: `/onboarding` fica fora do layout do aluno para evitar loop.
  const mustOnboard =
    Boolean((studentProfile as any)?.createdByPayment) &&
    Boolean((studentProfile as any)?.needsOnboarding) &&
    !studentProfile?.onboardingCompletedAt &&
    (studentProfile?.studentCompetitions?.length ?? 0) === 0;
  if (mustOnboard) redirect("/onboarding");

  // Verificar se é usuário em teste grátis ativo
  const trialStatus = (studentProfile as any)?.freeTrialStatus as string | null;
  const trialEndsAt = (studentProfile as any)?.freeTrialEndsAt as Date | null;
  const isActiveTrial =
    trialStatus === "active" && trialEndsAt != null && new Date(trialEndsAt) > new Date();

  // Expirar trial automaticamente se passou do prazo
  if (trialStatus === "active" && trialEndsAt != null && new Date(trialEndsAt) <= new Date()) {
    await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: { freeTrialStatus: "expired" } as any,
    });
    redirect("/trial-expirado");
  }

  // Se trial expirado (sem assinar), redirecionar para página de expiração
  if (trialStatus === "expired") {
    redirect("/trial-expirado");
  }

  // Regra de vencimento + tolerância (só para alunos pagos).
  const access = getAccessStatus({ accessExpiresAt: studentProfile?.accessExpiresAt ?? null, warnDays: 3, graceDays: 3 });
  if (access.status === "BLOCKED" && !isActiveTrial) {
    redirect("/renovar");
  }

  return (
    <div className="orbit-shell min-h-screen">
      <StudentSidebar studentName={session.user.name} planName={isActiveTrial ? "Teste Grátis" : studentProfile?.plan?.name} />
      {isActiveTrial && <TrialConversionPopup />}
      <main className="student-main">
        <div className="student-main-inner">
          {access.status === "EXPIRING_SOON" ? (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">
                Seu plano está prestes a vencer. Renove para continuar estudando sem interrupções.
              </p>
              <Link href="/renovar" className="orbit-link mt-2 inline-block text-sm font-bold text-amber-900">
                Renovar agora →
              </Link>
            </div>
          ) : null}
          {access.status === "GRACE_PERIOD" ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-extrabold text-red-900">
                Seu plano venceu, mas você ainda está no período de tolerância. Renove para evitar o bloqueio do acesso.
              </p>
              <Link href="/renovar" className="orbit-link mt-2 inline-block text-sm font-bold text-red-900">
                Renovar agora →
              </Link>
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
