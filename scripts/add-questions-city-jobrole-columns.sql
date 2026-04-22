-- Corrige: Invalid prisma.question.create(): column cityId of relation questions does not exist
-- Execute no PostgreSQL de produção/staging (psql, DBeaver, etc.) OU use: npx prisma db push
--
-- Adiciona colunas esperadas pelo schema.prisma (model Question: cityId, jobRoleId)

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "cityId" TEXT;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "jobRoleId" TEXT;

ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_cityId_fkey";
ALTER TABLE "questions" ADD CONSTRAINT "questions_cityId_fkey"
  FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_jobRoleId_fkey";
ALTER TABLE "questions" ADD CONSTRAINT "questions_jobRoleId_fkey"
  FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
