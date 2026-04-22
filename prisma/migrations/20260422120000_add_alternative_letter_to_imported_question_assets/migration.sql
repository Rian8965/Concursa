-- AlterTable: vínculo de recorte de imagem por letra (A–E) na revisão de importação
ALTER TABLE "imported_question_assets" ADD COLUMN "alternativeLetter" TEXT;

-- CreateIndex
CREATE INDEX "imported_question_assets_importedQuestionId_alternativeLetter_idx" ON "imported_question_assets"("importedQuestionId", "alternativeLetter");
