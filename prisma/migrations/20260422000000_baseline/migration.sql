-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'PAST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('TRAINING', 'EXAM', 'REVIEW', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "UsedInType" AS ENUM ('TRAINING', 'EXAM', 'APOSTILA');

-- CreateEnum
CREATE TYPE "UsedQuestionReason" AS ENUM ('NEW', 'REPEAT_EXHAUSTED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW_PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportAssetKind" AS ENUM ('TEXT_BLOCK', 'IMAGE');

-- CreateEnum
CREATE TYPE "ImportAssetScope" AS ENUM ('EXCLUSIVE', 'SHARED');

-- CreateEnum
CREATE TYPE "ImportAssetRole" AS ENUM ('SUPPORT_TEXT', 'FIGURE');

-- CreateEnum
CREATE TYPE "ImportedQuestionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "QuestionReportCategory" AS ENUM ('INCOMPLETE_STATEMENT', 'MISSING_TEXT', 'MISSING_IMAGE', 'MISSING_ALTERNATIVE', 'FORMAT_ERROR', 'WRONG_ANSWER', 'AMBIGUOUS_ANSWER', 'INCONSISTENT_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "QuestionReportStatus" AS ENUM ('PENDING', 'AI_REVIEWED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "phone" TEXT,
    "cpf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "durationDays" INTEGER,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_competitions" (
    "planId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "plan_competitions_pkey" PRIMARY KEY ("planId","competitionId")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "ibgeCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "area" TEXT,
    "level" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "organization" TEXT,
    "examBoardId" TEXT,
    "examBoardDefined" BOOLEAN NOT NULL DEFAULT false,
    "examDate" TIMESTAMP(3),
    "status" "CompetitionStatus" NOT NULL DEFAULT 'UPCOMING',
    "editalUrl" TEXT,
    "description" TEXT,
    "bannerUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_job_roles" (
    "competitionId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,

    CONSTRAINT "competition_job_roles_pkey" PRIMARY KEY ("competitionId","jobRoleId")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_subjects" (
    "competitionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "questionsCount" INTEGER,

    CONSTRAINT "competition_subjects_pkey" PRIMARY KEY ("competitionId","subjectId")
);

-- CreateTable
CREATE TABLE "job_role_subjects" (
    "jobRoleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "job_role_subjects_pkey" PRIMARY KEY ("jobRoleId","subjectId")
);

-- CreateTable
CREATE TABLE "competition_job_role_subjects" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "competition_job_role_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_stages" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_competitions" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "jobRoleId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "student_competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "supportText" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "subjectId" TEXT,
    "topicId" TEXT,
    "examBoardId" TEXT,
    "competitionId" TEXT,
    "cityId" TEXT,
    "jobRoleId" TEXT,
    "year" INTEGER,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "rawText" TEXT,
    "sourceDocument" TEXT,
    "sourcePage" INTEGER,
    "sourcePosition" INTEGER,
    "status" "QuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "importId" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isMarkedSuspect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_ai_meta" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "suggestedSubjectId" TEXT,
    "suggestedTopicId" TEXT,
    "suggestedExamBoardId" TEXT,
    "suggestedCityId" TEXT,
    "suggestedJobRoleId" TEXT,
    "suggestedYear" INTEGER,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_ai_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternatives" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_answers" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "aiExplanation" TEXT,
    "timeSpentSeconds" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionType" "SessionType" NOT NULL,
    "sessionId" TEXT,

    CONSTRAINT "student_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "competitionId" TEXT,
    "subjectId" TEXT,
    "topicId" TEXT,
    "filters" JSONB,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulated_exams" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "competitionId" TEXT,
    "title" TEXT,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "timeAllowedSeconds" INTEGER,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "status" "ExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulated_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulated_exam_questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "selectedAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpentSeconds" INTEGER,

    CONSTRAINT "simulated_exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apostilas" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "competitionId" TEXT,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apostilas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apostila_questions" (
    "id" TEXT NOT NULL,
    "apostilaId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "apostila_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "used_questions" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "usedInType" "UsedInType" NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contextKey" TEXT,
    "reason" "UsedQuestionReason" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "used_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_imports" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT,
    "cityId" TEXT,
    "examBoardId" TEXT,
    "jobRoleId" TEXT,
    "subjectId" TEXT,
    "year" INTEGER,
    "examDate" TIMESTAMP(3),
    "originalFilename" TEXT NOT NULL,
    "originalFilenameGabarito" TEXT,
    "gabaritoInSamePdf" BOOLEAN NOT NULL DEFAULT false,
    "storedPdfPath" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalExtracted" INTEGER NOT NULL DEFAULT 0,
    "totalApproved" INTEGER NOT NULL DEFAULT 0,
    "totalRejected" INTEGER NOT NULL DEFAULT 0,
    "processingLog" TEXT,
    "processingError" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_questions" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "alternatives" JSONB NOT NULL,
    "correctAnswer" TEXT,
    "suggestedSubjectId" TEXT,
    "suggestedTopicId" TEXT,
    "year" INTEGER,
    "examBoardId" TEXT,
    "competitionId" TEXT,
    "cityId" TEXT,
    "jobRoleId" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourcePage" INTEGER,
    "sourcePosition" INTEGER,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "rawText" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "ImportedQuestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_assets" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "kind" "ImportAssetKind" NOT NULL,
    "label" TEXT,
    "page" INTEGER NOT NULL,
    "bboxX" DOUBLE PRECISION NOT NULL,
    "bboxY" DOUBLE PRECISION NOT NULL,
    "bboxW" DOUBLE PRECISION NOT NULL,
    "bboxH" DOUBLE PRECISION NOT NULL,
    "scope" "ImportAssetScope" NOT NULL DEFAULT 'EXCLUSIVE',
    "extractedText" TEXT,
    "imageDataUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_question_assets" (
    "id" TEXT NOT NULL,
    "importedQuestionId" TEXT NOT NULL,
    "importAssetId" TEXT NOT NULL,
    "role" "ImportAssetRole" NOT NULL,
    "alternativeLetter" TEXT,

    CONSTRAINT "imported_question_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "category" "QuestionReportCategory" NOT NULL,
    "description" TEXT,
    "phase" TEXT NOT NULL,
    "sessionId" TEXT,
    "sessionType" TEXT,
    "status" "QuestionReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_report_ai_reviews" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_report_ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_themes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8b5cf6',
    "accentColor" TEXT NOT NULL DEFAULT '#06b6d4',
    "platformName" TEXT NOT NULL,
    "loginBannerUrl" TEXT,
    "footerText" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_cpf_key" ON "student_profiles"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cities_ibgeCode_key" ON "cities"("ibgeCode");

-- CreateIndex
CREATE UNIQUE INDEX "exam_boards_acronym_key" ON "exam_boards"("acronym");

-- CreateIndex
CREATE UNIQUE INDEX "job_roles_slug_key" ON "job_roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_slug_key" ON "competitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_subjectId_key" ON "topics"("slug", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_job_role_subjects_competitionId_jobRoleId_subje_key" ON "competition_job_role_subjects"("competitionId", "jobRoleId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "student_competitions_studentProfileId_competitionId_key" ON "student_competitions"("studentProfileId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "question_ai_meta_questionId_key" ON "question_ai_meta"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "alternatives_questionId_letter_key" ON "alternatives"("questionId", "letter");

-- CreateIndex
CREATE UNIQUE INDEX "simulated_exam_questions_examId_questionId_key" ON "simulated_exam_questions"("examId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "apostila_questions_apostilaId_questionId_key" ON "apostila_questions"("apostilaId", "questionId");

-- CreateIndex
CREATE INDEX "used_questions_studentProfileId_usedInType_contextKey_idx" ON "used_questions"("studentProfileId", "usedInType", "contextKey");

-- CreateIndex
CREATE INDEX "used_questions_studentProfileId_questionId_idx" ON "used_questions"("studentProfileId", "questionId");

-- CreateIndex
CREATE INDEX "imported_questions_suggestedSubjectId_idx" ON "imported_questions"("suggestedSubjectId");

-- CreateIndex
CREATE INDEX "imported_questions_suggestedTopicId_idx" ON "imported_questions"("suggestedTopicId");

-- CreateIndex
CREATE INDEX "imported_questions_competitionId_idx" ON "imported_questions"("competitionId");

-- CreateIndex
CREATE INDEX "imported_questions_examBoardId_idx" ON "imported_questions"("examBoardId");

-- CreateIndex
CREATE INDEX "imported_questions_year_idx" ON "imported_questions"("year");

-- CreateIndex
CREATE INDEX "imported_question_assets_importedQuestionId_alternativeLett_idx" ON "imported_question_assets"("importedQuestionId", "alternativeLetter");

-- CreateIndex
CREATE UNIQUE INDEX "imported_question_assets_importedQuestionId_importAssetId_key" ON "imported_question_assets"("importedQuestionId", "importAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "question_report_ai_reviews_reportId_key" ON "question_report_ai_reviews"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_themes_slug_key" ON "brand_themes"("slug");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_competitions" ADD CONSTRAINT "plan_competitions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_competitions" ADD CONSTRAINT "plan_competitions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_job_roles" ADD CONSTRAINT "competition_job_roles_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_job_roles" ADD CONSTRAINT "competition_job_roles_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_subjects" ADD CONSTRAINT "competition_subjects_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_subjects" ADD CONSTRAINT "competition_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_role_subjects" ADD CONSTRAINT "job_role_subjects_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_role_subjects" ADD CONSTRAINT "job_role_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_job_role_subjects" ADD CONSTRAINT "competition_job_role_subjects_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_job_role_subjects" ADD CONSTRAINT "competition_job_role_subjects_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_job_role_subjects" ADD CONSTRAINT "competition_job_role_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_stages" ADD CONSTRAINT "competition_stages_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_competitions" ADD CONSTRAINT "student_competitions_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_competitions" ADD CONSTRAINT "student_competitions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_competitions" ADD CONSTRAINT "student_competitions_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "pdf_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ai_meta" ADD CONSTRAINT "question_ai_meta_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ai_meta" ADD CONSTRAINT "question_ai_meta_suggestedSubjectId_fkey" FOREIGN KEY ("suggestedSubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ai_meta" ADD CONSTRAINT "question_ai_meta_suggestedTopicId_fkey" FOREIGN KEY ("suggestedTopicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ai_meta" ADD CONSTRAINT "question_ai_meta_suggestedExamBoardId_fkey" FOREIGN KEY ("suggestedExamBoardId") REFERENCES "exam_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ai_meta" ADD CONSTRAINT "question_ai_meta_suggestedCityId_fkey" FOREIGN KEY ("suggestedCityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_ai_meta" ADD CONSTRAINT "question_ai_meta_suggestedJobRoleId_fkey" FOREIGN KEY ("suggestedJobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternatives" ADD CONSTRAINT "alternatives_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulated_exams" ADD CONSTRAINT "simulated_exams_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulated_exams" ADD CONSTRAINT "simulated_exams_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulated_exam_questions" ADD CONSTRAINT "simulated_exam_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "simulated_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulated_exam_questions" ADD CONSTRAINT "simulated_exam_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apostilas" ADD CONSTRAINT "apostilas_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apostilas" ADD CONSTRAINT "apostilas_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apostila_questions" ADD CONSTRAINT "apostila_questions_apostilaId_fkey" FOREIGN KEY ("apostilaId") REFERENCES "apostilas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apostila_questions" ADD CONSTRAINT "apostila_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "used_questions" ADD CONSTRAINT "used_questions_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "used_questions" ADD CONSTRAINT "used_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_imports" ADD CONSTRAINT "pdf_imports_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "pdf_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_questions" ADD CONSTRAINT "imported_questions_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_assets" ADD CONSTRAINT "import_assets_importId_fkey" FOREIGN KEY ("importId") REFERENCES "pdf_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_question_assets" ADD CONSTRAINT "imported_question_assets_importedQuestionId_fkey" FOREIGN KEY ("importedQuestionId") REFERENCES "imported_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_question_assets" ADD CONSTRAINT "imported_question_assets_importAssetId_fkey" FOREIGN KEY ("importAssetId") REFERENCES "import_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_report_ai_reviews" ADD CONSTRAINT "question_report_ai_reviews_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "question_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
