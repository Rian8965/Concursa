import type { PrismaClient } from "@prisma/client";

/**
 * Bases antigas podem não ter cityId/jobRoleId em `questions` (erro: column does not exist).
 * Consulta o `information_schema`; compara nomes em minúsculo (comport. típico do PG).
 *
 * `OMIT_QUESTION_CITY_JOBS=1` no Cloud Run/Firebase força a NÃO enviar estes campos
 * (útil se a detecção falhar ou o Prisma ainda inserir coluna inexistente no deploy).
 */
export async function getQuestionOptionalLinkColumns(
  client: PrismaClient,
): Promise<{ hasCityId: boolean; hasJobRoleId: boolean }> {
  const forced = process.env.OMIT_QUESTION_CITY_JOBS === "1" || process.env.OMIT_QUESTION_CITY_JOBS === "true";
  if (forced) {
    return { hasCityId: false, hasJobRoleId: false };
  }

  try {
    const rows = await client.$queryRaw<Array<{ col: string }>>`
      SELECT column_name::text AS col
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'questions'
    `;
    const lower = new Set(rows.map((r) => r.col.toLowerCase()));
    return {
      hasCityId: lower.has("cityid"),
      hasJobRoleId: lower.has("jobroleid"),
    };
  } catch (e) {
    console.error("[questions-table-columns]", e);
    return { hasCityId: false, hasJobRoleId: false };
  }
}
