-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionReportStatus" ADD VALUE 'IN_ANALYSIS';
ALTER TYPE "QuestionReportStatus" ADD VALUE 'PROCEDENTE';
ALTER TYPE "QuestionReportStatus" ADD VALUE 'IMPROCEDENTE';

-- CreateTable
CREATE TABLE "question_report_events" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "QuestionReportStatus",
    "toStatus" "QuestionReportStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_report_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_revisions" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reportId" TEXT,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,

    CONSTRAINT "question_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_report_events_reportId_createdAt_idx" ON "question_report_events"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "question_revisions_questionId_editedAt_idx" ON "question_revisions"("questionId", "editedAt");

-- CreateIndex
CREATE INDEX "question_revisions_reportId_idx" ON "question_revisions"("reportId");

-- AddForeignKey
ALTER TABLE "question_report_events" ADD CONSTRAINT "question_report_events_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "question_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "question_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
