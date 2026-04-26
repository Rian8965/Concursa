import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function die(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function formatDQ(n: number) {
  return `DQ${String(n).padStart(3, "0")}`;
}

async function main() {
  if (!process.env.DATABASE_URL) die("DATABASE_URL não configurada.");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const missing = await prisma.question.count({ where: { code: null } });
  if (missing === 0) {
    console.log("✅ Todas as questões já possuem código.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Encontradas ${missing} questão(ões) sem código. Gerando…`);

  // Descobre o maior número já usado (DQ###)
  const withCodes = await prisma.question.findMany({
    where: { code: { not: null } },
    select: { code: true },
  });
  let maxN = 0;
  for (const r of withCodes) {
    const m = String(r.code).match(/^DQ(\d+)$/i);
    if (!m) continue;
    const n = parseInt(m[1]!, 10);
    if (Number.isFinite(n)) maxN = Math.max(maxN, n);
  }

  // Lista determinística para preencher sem “pular” muito
  const batch = await prisma.question.findMany({
    where: { code: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let cur = maxN + 1;
  for (const q of batch) {
    // evita colisão se alguém rodar em paralelo (unique constraint)
    // tenta até 20 incrementos por item (suficiente na prática)
    for (let tries = 0; tries < 20; tries += 1) {
      const code = formatDQ(cur);
      cur += 1;
      try {
        await prisma.question.update({ where: { id: q.id }, data: { code } });
        break;
      } catch {
        // colisão → tenta próximo
      }
    }
  }

  // Ajusta o sequenciador para o próximo número
  await prisma.questionCodeSeq.upsert({
    where: { id: 1 },
    create: { id: 1, next: cur },
    update: { next: cur },
  });

  console.log("✅ Backfill concluído.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});

