-- AlterTable: vínculo de recorte de imagem por letra (A–E) na revisão de importação
-- Esta base usa histórico parcial de migrations. Para o shadow DB (migrate dev),
-- garantimos que a tabela exista antes do ALTER.
DO $$ BEGIN
  IF to_regclass('public.imported_question_assets') IS NULL THEN
    CREATE TABLE "imported_question_assets" (
      "id" TEXT NOT NULL,
      "importedQuestionId" TEXT NOT NULL,
      "importAssetId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      CONSTRAINT "imported_question_assets_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

ALTER TABLE "imported_question_assets" ADD COLUMN IF NOT EXISTS "alternativeLetter" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "imported_question_assets_importedQuestionId_alternativeLetter_idx"
  ON "imported_question_assets"("importedQuestionId", "alternativeLetter");
