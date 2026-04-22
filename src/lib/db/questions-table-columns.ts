import type { PrismaClient } from "@prisma/client";

/**
 * Bases antigas podem não ter cityId/jobRoleId em `questions` (erro: column does not exist).
 * Consulta o information_schema; sem cache para refletir migrações feitas a quente.
 */
export async function getQuestionOptionalLinkColumns(
  client: PrismaClient,
): Promise<{ hasCityId: boolean; hasJobRoleId: boolean }> {
  try {
    const rows = await client.$queryRaw<Array<{ col: string }>>`
      SELECT column_name::text AS col
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions'
    `;
    const names = new Set(rows.map((r) => r.col));
    const has = (a: string, b: string) => names.has(a) || names.has(b);
    return { hasCityId: has("cityId", "cityid"), hasJobRoleId: has("jobRoleId", "jobroleid") };
  } catch (e) {
    console.error("[questions-table-columns]", e);
    // Sem colunas: publicação ainda funciona; após `prisma db push` tudo entra
    return { hasCityId: false, hasJobRoleId: false };
  }
}
