import { prisma } from "@/lib/db/prisma";

export const PLAN_COMPLETO = {
  slug: "plano-completo",
  name: "Plano Completo",
  priceCents: 2790,
  durationDays: 30,
  features: {
    treinoIlimitado: true,
    simulados: true,
    apostilas: true,
    explicacoesIA: true,
    quizEdital: true,
    relatorios: true,
    graficos: true,
    revisarErros: true,
  },
} as const;

export async function ensurePlanoCompleto() {
  return prisma.plan.upsert({
    where: { slug: PLAN_COMPLETO.slug },
    update: {
      name: PLAN_COMPLETO.name,
      isActive: true,
      durationDays: PLAN_COMPLETO.durationDays,
      features: PLAN_COMPLETO.features as any,
    },
    create: {
      slug: PLAN_COMPLETO.slug,
      name: PLAN_COMPLETO.name,
      description: "Acesso completo à plataforma.",
      isActive: true,
      durationDays: PLAN_COMPLETO.durationDays,
      features: PLAN_COMPLETO.features as any,
    },
  });
}

