/*
  Warnings:

  - You are about to drop the column `date_end` on the `competition_stages` table. All the data in the column will be lost.
  - You are about to drop the column `date_start` on the `competition_stages` table. All the data in the column will be lost.
  - You are about to drop the column `edital_text` on the `competitions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "competition_stages" DROP COLUMN "date_end",
DROP COLUMN "date_start";

-- AlterTable
ALTER TABLE "competitions" DROP COLUMN "edital_text";

-- CreateTable
CREATE TABLE "training_session_questions" (
    "id" TEXT NOT NULL,
    "trainingSessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "selectedAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "replacedAt" TIMESTAMP(3),

    CONSTRAINT "training_session_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_session_questions_trainingSessionId_order_idx" ON "training_session_questions"("trainingSessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "training_session_questions_trainingSessionId_questionId_key" ON "training_session_questions"("trainingSessionId", "questionId");

-- AddForeignKey
ALTER TABLE "training_session_questions" ADD CONSTRAINT "training_session_questions_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session_questions" ADD CONSTRAINT "training_session_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
