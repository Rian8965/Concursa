import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Play, Trophy } from "lucide-react";

export default async function TreinoEntryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { studentCompetitions: { where: { isActive: true }, select: { competitionId: true }, take: 1 } },
  });
  if (!profile) redirect("/dashboard");

  const compId = profile.studentCompetitions?.[0]?.competitionId ?? null;
  if (compId) redirect(`/concursos/${compId}/treino`);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Treino"
        description="Para iniciar treino, você precisa de um concurso ativo ou definir uma trilha (cargo) no onboarding."
      />

      <div className="orbit-card-premium p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
          <Trophy className="h-8 w-8 text-violet-300" strokeWidth={1.5} />
        </div>
        <p className="text-[16px] font-bold text-[#0F172A]">Defina seu concurso/cargo</p>
        <p className="mt-2 text-[13.5px] text-[#64748B]">
          Assim que você definir sua trilha, você pode treinar normalmente (inclusive sem banca definida).
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/onboarding" className="btn btn-primary rounded-2xl">
            Definir trilha
          </Link>
          <Link href="/questoes" className="btn btn-ghost rounded-2xl">
            <Play className="h-4 w-4" />
            Ver questões
          </Link>
        </div>
      </div>
    </div>
  );
}

