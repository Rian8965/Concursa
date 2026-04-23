-- Add isMarkedSuspect to questions
ALTER TABLE "questions" ADD COLUMN "isMarkedSuspect" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum QuestionReportCategory
CREATE TYPE "QuestionReportCategory" AS ENUM (
  'INCOMPLETE_STATEMENT',
  'MISSING_TEXT',
  'MISSING_IMAGE',
  'MISSING_ALTERNATIVE',
  'FORMAT_ERROR',
  'WRONG_ANSWER',
  'AMBIGUOUS_ANSWER',
  'INCONSISTENT_CONTENT',
  'OTHER'
);

-- CreateEnum QuestionReportStatus
CREATE TYPE "QuestionReportStatus" AS ENUM (
  'PENDING',
  'AI_REVIEWED',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED'
);

-- CreateTable question_reports
CREATE TABLE "question_reports" (
    "id"               TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "questionId"       TEXT NOT NULL,
    "category"         "QuestionReportCategory" NOT NULL,
    "description"      TEXT,
    "phase"            TEXT NOT NULL,
    "sessionId"        TEXT,
    "sessionType"      TEXT,
    "status"           "QuestionReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote"        TEXT,
    "resolvedAt"       TIMESTAMP(3),
    "resolvedBy"       TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable question_report_ai_reviews
CREATE TABLE "question_report_ai_reviews" (
    "id"         TEXT NOT NULL,
    "reportId"   TEXT NOT NULL,
    "verdict"    TEXT NOT NULL,
    "analysis"   TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_report_ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "question_report_ai_reviews_reportId_key" ON "question_report_ai_reviews"("reportId");

-- AddForeignKey question_reports -> student_profiles
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey question_reports -> questions
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey question_report_ai_reviews -> question_reports
ALTER TABLE "question_report_ai_reviews" ADD CONSTRAINT "question_report_ai_reviews_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "question_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
