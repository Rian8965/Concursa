-- Metadados por questão importada + tags no banco de questões
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "year" INTEGER;
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "examBoardId" TEXT;
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "competitionId" TEXT;
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "cityId" TEXT;
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "jobRoleId" TEXT;
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "imported_questions" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Foreign keys (suggestedSubjectId / suggestedTopicId permanecem como texto livre sem FK)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_questions_examBoardId_fkey') THEN
    ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_questions_competitionId_fkey') THEN
    ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_questions_cityId_fkey') THEN
    ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'imported_questions_jobRoleId_fkey') THEN
    ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "imported_questions_suggestedSubjectId_idx" ON "imported_questions"("suggestedSubjectId");
CREATE INDEX IF NOT EXISTS "imported_questions_suggestedTopicId_idx" ON "imported_questions"("suggestedTopicId");
CREATE INDEX IF NOT EXISTS "imported_questions_competitionId_idx" ON "imported_questions"("competitionId");
CREATE INDEX IF NOT EXISTS "imported_questions_examBoardId_idx" ON "imported_questions"("examBoardId");
CREATE INDEX IF NOT EXISTS "imported_questions_year_idx" ON "imported_questions"("year");
