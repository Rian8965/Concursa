/**
 * Script para criar/atualizar os planos oficiais e pacotes de créditos extras no banco.
 * Executar com: npx tsx scripts/seed-plans.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensurePlanoAvancado, ensurePlanoPremium, ensureAiCreditPackages, ensurePlanoCompleto } from "../src/lib/billing/plan";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Criando planos...");

  const avancado = await ensurePlanoAvancado();
  console.log(`✓ Plano Avançado: ${avancado.id} (R$${((avancado.priceCents ?? 0) / 100).toFixed(2)})`);

  const premium = await ensurePlanoPremium();
  console.log(`✓ Plano Premium: ${premium.id} (R$${((premium.priceCents ?? 0) / 100).toFixed(2)})`);

  // Desativar plano legado
  await ensurePlanoCompleto();
  console.log("✓ Plano Completo (legado) desativado");

  console.log("\nCriando pacotes de créditos extras...");
  await ensureAiCreditPackages();
  console.log("✓ Pacotes de créditos extras criados/atualizados");

  // Criar configuração global de IA se não existir
  const existing = await prisma.aiGlobalConfig.findFirst();
  if (!existing) {
    await prisma.aiGlobalConfig.create({
      data: { updatedAt: new Date() },
    });
    console.log("✓ Configuração global de IA criada");
  } else {
    console.log("✓ Configuração global de IA já existe");
  }

  console.log("\nPronto!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
