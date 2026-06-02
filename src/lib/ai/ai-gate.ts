/**
 * ai-gate.ts
 * Gate centralizado de controle de uso da IA por aluno.
 * Verifica limites do plano, créditos extras e trava global antes de permitir chamada.
 */
import { prisma } from "@/lib/db/prisma";

// Limites padrão para alunos legacy sem plano com limites definidos
export const LEGACY_DAILY_LIMIT = 20;
export const LEGACY_MONTHLY_LIMIT = 500;
export const LEGACY_CHAR_LIMIT = 900;

// Custo estimado por token do Gemini Flash (em USD) — configurável via AiGlobalConfig
const DEFAULT_INPUT_PRICE_PER_1M = 0.075;
const DEFAULT_OUTPUT_PRICE_PER_1M = 0.30;

export type AiGateResult =
  | { allowed: true; source: "plan_quota" | "extra_credit" | "legacy_allowance"; charLimit: number }
  | { allowed: false; reason: "no_subscription" | "daily_limit" | "monthly_limit_no_credits" | "global_block" | "manual_block"; message: string; canBuyCredits: boolean };

/**
 * Verifica se o aluno pode usar a IA agora.
 * NÃO incrementa contadores — use recordAiUsage() após sucesso da chamada.
 */
export async function canUseAI(userId: string): Promise<AiGateResult> {
  // 1. Buscar perfil do aluno com plano
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (!profile) {
    return {
      allowed: false,
      reason: "no_subscription",
      message: "Para usar as correções com IA, escolha um dos planos disponíveis.",
      canBuyCredits: false,
    };
  }

  // 2. Verificar trava manual por aluno
  if (profile.aiBlockedManually) {
    return {
      allowed: false,
      reason: "manual_block",
      message: "O uso de IA está temporariamente bloqueado para sua conta. Entre em contato com o suporte.",
      canBuyCredits: false,
    };
  }

  // 3. Verificar assinatura ativa ou teste grátis ativo
  const now = new Date();
  const hasActiveSubscription =
    profile.accessExpiresAt != null && profile.accessExpiresAt > now;

  // --- Fluxo especial: usuário em Teste Grátis ---
  const trialStatus = (profile as any).freeTrialStatus as string | null;
  const trialEndsAt = (profile as any).freeTrialEndsAt as Date | null;
  const isActiveTrial =
    trialStatus === "active" && trialEndsAt != null && new Date(trialEndsAt) > now;

  if (!hasActiveSubscription && isActiveTrial) {
    // Limites do teste grátis
    const TRIAL_DAILY = 5;
    const TRIAL_TOTAL = 35;
    const TRIAL_CHAR_LIMIT = 600;

    // Reset diário do trial se necessário
    const lastReset = (profile as any).freeTrialLastDailyResetAt as Date | null;
    const todayStr = now.toDateString();
    if (!lastReset || new Date(lastReset).toDateString() !== todayStr) {
      await prisma.studentProfile.update({
        where: { id: profile.id },
        data: { freeTrialAiUsedToday: 0, freeTrialLastDailyResetAt: now } as any,
      });
      (profile as any).freeTrialAiUsedToday = 0;
    }

    const usedToday = (profile as any).freeTrialAiUsedToday ?? 0;
    const usedTotal = (profile as any).freeTrialAiUsedTotal ?? 0;

    if (usedToday >= TRIAL_DAILY) {
      return {
        allowed: false,
        reason: "daily_limit",
        message:
          "Você atingiu o limite diário de correções com IA do teste grátis. Amanhã novas correções estarão disponíveis.",
        canBuyCredits: false,
      };
    }

    if (usedTotal >= TRIAL_TOTAL) {
      return {
        allowed: false,
        reason: "monthly_limit_no_credits",
        message:
          "Você usou todas as correções com IA disponíveis no teste grátis. Para continuar usando a IA, escolha um dos planos.",
        canBuyCredits: false,
      };
    }

    return { allowed: true, source: "plan_quota", charLimit: TRIAL_CHAR_LIMIT };
  }

  if (!hasActiveSubscription) {
    return {
      allowed: false,
      reason: "no_subscription",
      message: "Para usar as correções com IA, escolha um dos planos disponíveis.",
      canBuyCredits: false,
    };
  }

  // 4. Verificar trava global da plataforma
  const globalConfig = await getOrCreateGlobalConfig();

  if (!globalConfig.aiEnabled) {
    return {
      allowed: false,
      reason: "global_block",
      message: "No momento, as correções com IA estão temporariamente indisponíveis. Tente novamente mais tarde.",
      canBuyCredits: false,
    };
  }

  if (globalConfig.manualBlockUntil && globalConfig.manualBlockUntil > now) {
    return {
      allowed: false,
      reason: "global_block",
      message: "No momento, as correções com IA estão temporariamente indisponíveis. Tente novamente mais tarde.",
      canBuyCredits: false,
    };
  }

  // Verificar limite global de custo diário
  await resetGlobalDailyIfNeeded(globalConfig);
  if (globalConfig.globalDailyCostUsedBrl >= globalConfig.pauseAllThresholdBrl) {
    return {
      allowed: false,
      reason: "global_block",
      message: "No momento, as correções com IA estão temporariamente indisponíveis. Tente novamente mais tarde.",
      canBuyCredits: false,
    };
  }

  // 5. Determinar limites do plano
  const plan = profile.plan;
  const dailyLimit = profile.aiDailyLimitOverride ?? plan?.aiDailyLimit ?? LEGACY_DAILY_LIMIT;
  const monthlyLimit = profile.aiMonthlyLimitOverride ?? plan?.aiMonthlyLimit ?? LEGACY_MONTHLY_LIMIT;
  const charLimit = plan?.aiResponseCharLimit ?? LEGACY_CHAR_LIMIT;
  const planSlug = plan?.slug ?? "legacy";

  // 6. Resetar contadores se necessário
  await resetDailyIfNeeded(profile);
  await resetMonthlyIfNeeded(profile);

  // Recarregar perfil após possível reset
  const freshProfile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      aiCorrectionsToday: true,
      aiCorrectionsMonth: true,
    },
  });
  const correctionsToday = freshProfile?.aiCorrectionsToday ?? 0;
  const correctionsMonth = freshProfile?.aiCorrectionsMonth ?? 0;

  // 7. Verificar limite diário
  if (correctionsToday >= dailyLimit) {
    const allowExtraAboveDaily = globalConfig.allowExtraCreditsAboveDailyLimit;
    if (!allowExtraAboveDaily) {
      return {
        allowed: false,
        reason: "daily_limit",
        message:
          "Você atingiu o limite diário de correções com IA do seu plano. Amanhã novas correções estarão disponíveis.",
        canBuyCredits: true,
      };
    }
    // Se configurado para permitir créditos extras acima do limite diário, cai no fluxo abaixo
  }

  // 8. Verificar limite mensal
  if (correctionsMonth < monthlyLimit) {
    // Ainda tem cota do plano — usar cota normal
    const source = planSlug === "legacy" ? "legacy_allowance" : "plan_quota";
    return { allowed: true, source, charLimit };
  }

  // 9. Cota mensal esgotada — verificar créditos extras
  const creditBalance = await prisma.studentAiCreditBalance.findUnique({
    where: { studentProfileId: profile.id },
  });

  if (creditBalance && creditBalance.availableCredits > 0) {
    return { allowed: true, source: "extra_credit", charLimit };
  }

  return {
    allowed: false,
    reason: "monthly_limit_no_credits",
    message:
      "Você atingiu o limite mensal de correções com IA do seu plano. Para continuar usando a IA agora, compre créditos extras ou aguarde a renovação do seu ciclo.",
    canBuyCredits: true,
  };
}

/**
 * Registra o uso de uma correção de IA APÓS sucesso da chamada à API.
 * Incrementa contadores, atualiza saldo de créditos e cria log.
 */
export async function recordAiUsage(input: {
  userId: string;
  questionId?: string | null;
  source: "plan_quota" | "extra_credit" | "legacy_allowance";
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): Promise<string | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: input.userId },
    include: { plan: true },
  });
  if (!profile) return null;

  // Calcular custo estimado
  const globalConfig = await getOrCreateGlobalConfig();
  const exchangeRate = globalConfig.exchangeRateUsdBrl;
  const inputCostUsd = input.inputTokens
    ? (input.inputTokens / 1_000_000) * DEFAULT_INPUT_PRICE_PER_1M
    : 0;
  const outputCostUsd = input.outputTokens
    ? (input.outputTokens / 1_000_000) * DEFAULT_OUTPUT_PRICE_PER_1M
    : 0;
  const totalCostUsd = inputCostUsd + outputCostUsd;
  const totalCostBrl = totalCostUsd * exchangeRate;

  // Créditos extras antes
  let extraBefore = 0;
  let extraAfter = 0;
  if (input.source === "extra_credit") {
    const bal = await prisma.studentAiCreditBalance.findUnique({
      where: { studentProfileId: profile.id },
    });
    extraBefore = bal?.availableCredits ?? 0;
    extraAfter = Math.max(0, extraBefore - 1);
  }

  // Criar log
  const log = await prisma.aiUsageLog.create({
    data: {
      studentProfileId: profile.id,
      planId: profile.planId ?? undefined,
      questionId: input.questionId ?? undefined,
      usageSource: input.source,
      model: input.model,
      inputTokens: input.inputTokens ?? undefined,
      outputTokens: input.outputTokens ?? undefined,
      estimatedCostUsd: totalCostUsd || undefined,
      estimatedCostBrl: totalCostBrl || undefined,
      exchangeRateUsed: exchangeRate,
      extraCreditBalanceBefore: input.source === "extra_credit" ? extraBefore : undefined,
      extraCreditBalanceAfter: input.source === "extra_credit" ? extraAfter : undefined,
      status: "success",
    },
  });

  // Atualizar contadores do perfil
  const profileUpdates: Record<string, unknown> = {
    aiLastUsageAt: new Date(),
    aiEstimatedCostTodayBrl: { increment: totalCostBrl },
    aiEstimatedCostMonthBrl: { increment: totalCostBrl },
    aiEstimatedCostTotalBrl: { increment: totalCostBrl },
  };

  if (input.source === "plan_quota" || input.source === "legacy_allowance") {
    profileUpdates.aiCorrectionsToday = { increment: 1 };
    profileUpdates.aiCorrectionsMonth = { increment: 1 };
    // Se está em trial, também incrementar contadores específicos
    const tStatus = (profile as any).freeTrialStatus as string | null;
    if (tStatus === "active") {
      profileUpdates.freeTrialAiUsedToday = { increment: 1 };
      profileUpdates.freeTrialAiUsedTotal = { increment: 1 };
    }
  } else if (input.source === "extra_credit") {
    profileUpdates.aiCorrectionsToday = { increment: 1 };
  }

  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: profileUpdates as any,
  });

  // Descontar crédito extra se necessário
  if (input.source === "extra_credit") {
    const updatedBalance = await prisma.studentAiCreditBalance.upsert({
      where: { studentProfileId: profile.id },
      update: {
        availableCredits: { decrement: 1 },
        totalUsedExtraCredits: { increment: 1 },
      },
      create: {
        studentProfileId: profile.id,
        availableCredits: 0,
        totalPurchasedCredits: 0,
        totalUsedExtraCredits: 1,
      },
    });

    await prisma.aiCreditTransaction.create({
      data: {
        studentProfileId: profile.id,
        transactionType: "usage",
        creditsAmount: -1,
        balanceBefore: extraBefore,
        balanceAfter: updatedBalance.availableCredits,
        relatedAiUsageLogId: log.id,
        description: "Uso de 1 crédito extra para correção com IA",
      },
    });

    // Atualizar log com saldo atualizado
    await prisma.aiUsageLog.update({
      where: { id: log.id },
      data: { extraCreditBalanceAfter: updatedBalance.availableCredits },
    });
  }

  // Atualizar custo global do dia
  await prisma.aiGlobalConfig.updateMany({
    data: {
      globalDailyCostUsedBrl: { increment: totalCostBrl },
      globalDailyCallsUsed: { increment: 1 },
    } as any,
  });

  return log.id;
}

/**
 * Registra erro em log de uso de IA (não desconta limite).
 */
export async function recordAiError(input: {
  userId: string;
  questionId?: string | null;
  source: "plan_quota" | "extra_credit" | "legacy_allowance";
  model: string;
  errorMessage: string;
}): Promise<void> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: input.userId } });
  if (!profile) return;

  await prisma.aiUsageLog.create({
    data: {
      studentProfileId: profile.id,
      planId: profile.planId ?? undefined,
      questionId: input.questionId ?? undefined,
      usageSource: input.source,
      model: input.model ?? "unknown",
      status: "error",
      errorMessage: input.errorMessage,
    },
  });
}

// ---- Helpers internos ----

async function getOrCreateGlobalConfig() {
  let config = await prisma.aiGlobalConfig.findFirst();
  if (!config) {
    config = await prisma.aiGlobalConfig.create({
      data: { updatedAt: new Date() },
    });
  }
  return config;
}

async function resetGlobalDailyIfNeeded(config: { id: string; globalLastDailyResetAt: Date | null }) {
  const now = new Date();
  const lastReset = config.globalLastDailyResetAt;
  const needsReset =
    !lastReset ||
    lastReset.getUTCDate() !== now.getUTCDate() ||
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCFullYear() !== now.getUTCFullYear();

  if (needsReset) {
    await prisma.aiGlobalConfig.update({
      where: { id: config.id },
      data: {
        globalDailyCallsUsed: 0,
        globalDailyCostUsedBrl: 0,
        globalLastDailyResetAt: now,
        updatedAt: now,
      },
    });
  }
}

async function resetDailyIfNeeded(profile: { id: string; aiLastDailyResetAt: Date | null }) {
  const now = new Date();
  const lastReset = profile.aiLastDailyResetAt;
  const needsReset =
    !lastReset ||
    lastReset.getUTCDate() !== now.getUTCDate() ||
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCFullYear() !== now.getUTCFullYear();

  if (needsReset) {
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        aiCorrectionsToday: 0,
        aiEstimatedCostTodayBrl: 0,
        aiLastDailyResetAt: now,
      },
    });
  }
}

async function resetMonthlyIfNeeded(profile: { id: string; aiLastMonthlyResetAt: Date | null; accessExpiresAt: Date | null }) {
  const now = new Date();
  const lastReset = profile.aiLastMonthlyResetAt;

  const needsReset =
    !lastReset ||
    lastReset.getUTCMonth() !== now.getUTCMonth() ||
    lastReset.getUTCFullYear() !== now.getUTCFullYear();

  if (needsReset) {
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        aiCorrectionsMonth: 0,
        aiEstimatedCostMonthBrl: 0,
        aiLastMonthlyResetAt: now,
      },
    });
  }
}
