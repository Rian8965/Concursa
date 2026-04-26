import type { PrismaClient } from "@prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

function formatDQ(n: number) {
  const v = Math.max(1, Math.floor(n));
  return `DQ${String(v).padStart(3, "0")}`;
}

/**
 * Gera próximo código DQxxx de forma atômica.
 * Depende da tabela `question_code_seq` (migração).
 */
export async function nextQuestionCode(tx: Tx): Promise<string> {
  // garante linha singleton
  await tx.questionCodeSeq.upsert({
    where: { id: 1 },
    create: { id: 1, next: 1 },
    update: {},
  });

  const row = await tx.questionCodeSeq.update({
    where: { id: 1 },
    data: { next: { increment: 1 } },
    select: { next: true },
  });

  // row.next agora aponta para o próximo; o código atual é next-1
  return formatDQ(row.next - 1);
}

