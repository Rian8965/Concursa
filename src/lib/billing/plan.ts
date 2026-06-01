import { prisma } from "@/lib/db/prisma";

// ============================================================
// PLANOS OFICIAIS DA PLATAFORMA
// ============================================================

export const PLAN_AVANCADO = {
  slug: "avancado",
  name: "Avançado",
  description: "Estudo guiado com IA. Melhor custo-benefício.",
  priceCents: 3990,     // R$ 39,90
  durationDays: 30,
  aiDailyLimit: 20,
  aiMonthlyLimit: 500,
  aiResponseCharLimit: 900,
  features: {
    treinoIlimitado: true,
    simulados: true,
    apostilas: true,
    explicacoesIA: true,
    quizEdital: true,
    relatorios: true,
    graficos: true,
    revisarErros: true,
    aiDailyLimit: 20,
    aiMonthlyLimit: 500,
  },
} as const;

export const PLAN_PREMIUM = {
  slug: "premium",
  name: "Premium",
  description: "Para quem estuda pesado. Mais correções com IA.",
  priceCents: 6990,     // R$ 69,90
  durationDays: 30,
  aiDailyLimit: 50,
  aiMonthlyLimit: 1200,
  aiResponseCharLimit: 1200,
  features: {
    treinoIlimitado: true,
    simulados: true,
    apostilas: true,
    explicacoesIA: true,
    quizEdital: true,
    relatorios: true,
    graficos: true,
    revisarErros: true,
    aiDailyLimit: 50,
    aiMonthlyLimit: 1200,
  },
} as const;

// Pacotes de créditos extras
export const AI_CREDIT_PACKAGES = [
  { slug: "creditos-50",  name: "Pacote Extra 50",  priceBrl: 5.00,  creditsAmount: 50  },
  { slug: "creditos-120", name: "Pacote Extra 120", priceBrl: 10.00, creditsAmount: 120 },
  { slug: "creditos-200", name: "Pacote Extra 200", priceBrl: 15.00, creditsAmount: 200 },
  { slug: "creditos-300", name: "Pacote Extra 300", priceBrl: 20.00, creditsAmount: 300 },
] as const;

// Mantido para compatibilidade com código legado durante migração gradual
/** @deprecated Use PLAN_AVANCADO ou PLAN_PREMIUM */
export const PLAN_COMPLETO = {
  slug: "plano-completo",
  name: "Plano Completo",
  priceCents: 2790,
  durationDays: 30,
  features: { treinoIlimitado: true, simulados: true, apostilas: true, explicacoesIA: true, quizEdital: true, relatorios: true, graficos: true, revisarErros: true },
} as const;

// ============================================================
// Funções de upsert no banco
// ============================================================

export async function ensurePlanoAvancado() {
  return prisma.plan.upsert({
    where: { slug: PLAN_AVANCADO.slug },
    update: {
      name: PLAN_AVANCADO.name,
      description: PLAN_AVANCADO.description,
      isActive: true,
      durationDays: PLAN_AVANCADO.durationDays,
      priceCents: PLAN_AVANCADO.priceCents,
      aiDailyLimit: PLAN_AVANCADO.aiDailyLimit,
      aiMonthlyLimit: PLAN_AVANCADO.aiMonthlyLimit,
      aiResponseCharLimit: PLAN_AVANCADO.aiResponseCharLimit,
      features: PLAN_AVANCADO.features as any,
    },
    create: {
      slug: PLAN_AVANCADO.slug,
      name: PLAN_AVANCADO.name,
      description: PLAN_AVANCADO.description,
      isActive: true,
      durationDays: PLAN_AVANCADO.durationDays,
      priceCents: PLAN_AVANCADO.priceCents,
      aiDailyLimit: PLAN_AVANCADO.aiDailyLimit,
      aiMonthlyLimit: PLAN_AVANCADO.aiMonthlyLimit,
      aiResponseCharLimit: PLAN_AVANCADO.aiResponseCharLimit,
      features: PLAN_AVANCADO.features as any,
    },
  });
}

export async function ensurePlanoPremium() {
  return prisma.plan.upsert({
    where: { slug: PLAN_PREMIUM.slug },
    update: {
      name: PLAN_PREMIUM.name,
      description: PLAN_PREMIUM.description,
      isActive: true,
      durationDays: PLAN_PREMIUM.durationDays,
      priceCents: PLAN_PREMIUM.priceCents,
      aiDailyLimit: PLAN_PREMIUM.aiDailyLimit,
      aiMonthlyLimit: PLAN_PREMIUM.aiMonthlyLimit,
      aiResponseCharLimit: PLAN_PREMIUM.aiResponseCharLimit,
      features: PLAN_PREMIUM.features as any,
    },
    create: {
      slug: PLAN_PREMIUM.slug,
      name: PLAN_PREMIUM.name,
      description: PLAN_PREMIUM.description,
      isActive: true,
      durationDays: PLAN_PREMIUM.durationDays,
      priceCents: PLAN_PREMIUM.priceCents,
      aiDailyLimit: PLAN_PREMIUM.aiDailyLimit,
      aiMonthlyLimit: PLAN_PREMIUM.aiMonthlyLimit,
      aiResponseCharLimit: PLAN_PREMIUM.aiResponseCharLimit,
      features: PLAN_PREMIUM.features as any,
    },
  });
}

/** @deprecated */
export async function ensurePlanoCompleto() {
  return prisma.plan.upsert({
    where: { slug: PLAN_COMPLETO.slug },
    update: {
      name: PLAN_COMPLETO.name,
      isActive: false,
      durationDays: PLAN_COMPLETO.durationDays,
      features: PLAN_COMPLETO.features as any,
    },
    create: {
      slug: PLAN_COMPLETO.slug,
      name: PLAN_COMPLETO.name,
      description: "Plano legado — migrado.",
      isActive: false,
      durationDays: PLAN_COMPLETO.durationDays,
      features: PLAN_COMPLETO.features as any,
    },
  });
}

export async function ensureAiCreditPackages() {
  for (const pkg of AI_CREDIT_PACKAGES) {
    await prisma.aiCreditPackage.upsert({
      where: { slug: pkg.slug },
      update: {
        name: pkg.name,
        priceBrl: pkg.priceBrl,
        creditsAmount: pkg.creditsAmount,
        active: true,
      },
      create: {
        slug: pkg.slug,
        name: pkg.name,
        priceBrl: pkg.priceBrl,
        creditsAmount: pkg.creditsAmount,
        active: true,
      },
    });
  }
}
