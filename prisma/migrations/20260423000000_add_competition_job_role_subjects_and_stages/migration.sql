-- CreateTable: vínculo 3 vias cargo-dentro-concurso + matéria
CREATE TABLE IF NOT EXISTS "competition_job_role_subjects" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "jobRoleId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,

  CONSTRAINT "competition_job_role_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable: etapas/fases do concurso
CREATE TABLE IF NOT EXISTS "competition_stages" (
  "id" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "competition_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "competition_job_role_subjects_competitionId_jobRoleId_subjectId_key"
  ON "competition_job_role_subjects"("competitionId", "jobRoleId", "subjectId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_job_role_subjects_competitionId_fkey') THEN
    ALTER TABLE "competition_job_role_subjects"
      ADD CONSTRAINT "competition_job_role_subjects_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_job_role_subjects_jobRoleId_fkey') THEN
    ALTER TABLE "competition_job_role_subjects"
      ADD CONSTRAINT "competition_job_role_subjects_jobRoleId_fkey"
      FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_job_role_subjects_subjectId_fkey') THEN
    ALTER TABLE "competition_job_role_subjects"
      ADD CONSTRAINT "competition_job_role_subjects_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_stages_competitionId_fkey') THEN
    ALTER TABLE "competition_stages"
      ADD CONSTRAINT "competition_stages_competitionId_fkey"
      FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
