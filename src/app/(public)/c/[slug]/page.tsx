import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { CompetitionCheckout } from "./CompetitionCheckout";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await prisma.competition.findUnique({
    where: { slug },
    select: { name: true },
  });
  return {
    title: competition ? `Inscrição — ${competition.name} | Descomplique seu Concurso` : "Concurso não encontrado",
    description: competition
      ? `Assine e estude para o concurso ${competition.name} com IA e questões exclusivas.`
      : undefined,
  };
}

export default async function ConcursoPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const competition = await prisma.competition.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      salesLinkActive: true,
      organization: true,
      description: true,
      city: { select: { name: true, state: true } },
      examBoard: { select: { acronym: true } },
    },
  });

  // Incrementa visita de forma assíncrona (fire & forget)
  if (competition) {
    void prisma.competition
      .update({ where: { slug }, data: { salesLinkVisits: { increment: 1 } } })
      .catch(() => {});
  }

  if (!competition) notFound();

  if (!competition.salesLinkActive || !competition.isActive) {
    return (
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#020617] px-6">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_40%,rgba(157,77,221,0.12),transparent_60%)]" />
        </div>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <svg className="h-7 w-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Concurso indisponível</h1>
          <p className="mt-3 max-w-sm text-sm text-white/50">
            O link de inscrição para o concurso <span className="font-semibold text-white/70">{competition.name}</span> não está disponível no momento.
          </p>
          <a
            href="https://descompliqueseuconcurso.com.br"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/70 hover:text-white transition-colors"
          >
            Voltar ao site
          </a>
        </div>
      </div>
    );
  }

  return <CompetitionCheckout competition={competition} />;
}
