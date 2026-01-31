-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('NEW', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'OFFER_ACCEPTED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('PHONE_SCREEN', 'TECHNICAL', 'BEHAVIORAL', 'PANEL', 'FINAL');

-- CreateEnum
CREATE TYPE "InterviewResult" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('PAYROLL_REGISTER', 'BANK_DISBURSEMENT', 'SSS_CONTRIBUTIONS', 'PHILHEALTH_CONTRIBUTIONS', 'PAGIBIG_CONTRIBUTIONS', 'TAX_ALPHALIST', 'PAYSLIP_PDF');

-- CreateEnum
CREATE TYPE "CheckInType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('PERFORMANCE', 'LEARNING', 'PROJECT', 'BEHAVIORAL');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PARTIALLY_MET', 'NOT_MET', 'DEFERRED');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "hiringEntityId" UUID,
ADD COLUMN     "roleScorecardId" UUID;

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- CreateTable
CREATE TABLE "hiring_entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tradeName" VARCHAR(255),
    "tin" VARCHAR(20),
    "rdoCode" VARCHAR(10),
    "sssEmployerId" VARCHAR(20),
    "philhealthEmployerId" VARCHAR(20),
    "pagibigEmployerId" VARCHAR(20),
    "addressLine1" VARCHAR(255),
    "addressLine2" VARCHAR(255),
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "zipCode" VARCHAR(10),
    "country" VARCHAR(2) NOT NULL DEFAULT 'PH',
    "phoneNumber" VARCHAR(20),
    "email" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hiring_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_scorecards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "jobTitle" VARCHAR(100) NOT NULL,
    "departmentId" UUID,
    "missionStatement" TEXT NOT NULL,
    "keyResponsibilities" JSONB NOT NULL,
    "kpis" JSONB NOT NULL,
    "salaryRangeMin" DECIMAL(12,2),
    "salaryRangeMax" DECIMAL(12,2),
    "baseSalary" DECIMAL(12,2),
    "wageType" "WageType" NOT NULL DEFAULT 'MONTHLY',
    "shiftTemplateId" UUID,
    "workHoursPerDay" INTEGER NOT NULL DEFAULT 8,
    "workDaysPerWeek" VARCHAR(100) NOT NULL DEFAULT 'Monday to Saturday',
    "flexibleStartTime" VARCHAR(50),
    "flexibleEndTime" VARCHAR(50),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" DATE NOT NULL,
    "supersededById" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "lastName" VARCHAR(100) NOT NULL,
    "suffix" VARCHAR(20),
    "email" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20),
    "mobileNumber" VARCHAR(20),
    "roleScorecardId" UUID,
    "customJobTitle" VARCHAR(100),
    "departmentId" UUID,
    "hiringEntityId" UUID,
    "source" VARCHAR(100),
    "referredById" UUID,
    "resumePath" VARCHAR(500),
    "resumeFileName" VARCHAR(255),
    "coverLetterPath" VARCHAR(500),
    "portfolioUrl" VARCHAR(500),
    "linkedinUrl" VARCHAR(500),
    "expectedSalaryMin" DECIMAL(12,2),
    "expectedSalaryMax" DECIMAL(12,2),
    "expectedStartDate" DATE,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'NEW',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusChangedById" UUID,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "withdrawalReason" TEXT,
    "convertedToEmployeeId" UUID,
    "convertedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicantId" UUID NOT NULL,
    "interviewType" "InterviewType" NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "scheduledDate" DATE NOT NULL,
    "scheduledStartTime" TIME(0) NOT NULL,
    "scheduledEndTime" TIME(0) NOT NULL,
    "location" VARCHAR(255),
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "meetingLink" VARCHAR(500),
    "primaryInterviewerId" UUID,
    "interviewerIds" UUID[],
    "result" "InterviewResult" NOT NULL DEFAULT 'PENDING',
    "resultNotes" TEXT,
    "rating" INTEGER,
    "strengths" TEXT,
    "concerns" TEXT,
    "recommendation" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "payrollRunId" UUID NOT NULL,
    "exportType" "ExportType" NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "blobUrl" VARCHAR(500),
    "fileContent" BYTEA,
    "dataSnapshot" JSONB,
    "contentHash" VARCHAR(64) NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2),
    "generatedById" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "periodType" "CheckInType" NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_check_ins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "periodId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "reviewerId" UUID,
    "status" "CheckInStatus" NOT NULL DEFAULT 'DRAFT',
    "overallRating" INTEGER,
    "overallComments" TEXT,
    "accomplishments" TEXT,
    "challenges" TEXT,
    "learnings" TEXT,
    "supportNeeded" TEXT,
    "managerFeedback" TEXT,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checkInId" UUID NOT NULL,
    "goalType" "GoalType" NOT NULL DEFAULT 'PERFORMANCE',
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "targetDate" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "selfAssessment" TEXT,
    "managerAssessment" TEXT,
    "rating" INTEGER,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "checkInId" UUID NOT NULL,
    "skillCategory" VARCHAR(100) NOT NULL,
    "skillName" VARCHAR(100) NOT NULL,
    "selfRating" INTEGER,
    "managerRating" INTEGER,
    "comments" TEXT,
    "developmentPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hiring_entities_companyId_idx" ON "hiring_entities"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "hiring_entities_companyId_code_key" ON "hiring_entities"("companyId", "code");

-- CreateIndex
CREATE INDEX "role_scorecards_companyId_jobTitle_idx" ON "role_scorecards"("companyId", "jobTitle");

-- CreateIndex
CREATE INDEX "role_scorecards_departmentId_idx" ON "role_scorecards"("departmentId");

-- CreateIndex
CREATE INDEX "role_scorecards_shiftTemplateId_idx" ON "role_scorecards"("shiftTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "role_scorecards_companyId_jobTitle_effectiveDate_key" ON "role_scorecards"("companyId", "jobTitle", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "applicants_convertedToEmployeeId_key" ON "applicants"("convertedToEmployeeId");

-- CreateIndex
CREATE INDEX "applicants_companyId_status_idx" ON "applicants"("companyId", "status");

-- CreateIndex
CREATE INDEX "applicants_companyId_roleScorecardId_idx" ON "applicants"("companyId", "roleScorecardId");

-- CreateIndex
CREATE INDEX "applicants_email_idx" ON "applicants"("email");

-- CreateIndex
CREATE INDEX "interviews_applicantId_idx" ON "interviews"("applicantId");

-- CreateIndex
CREATE INDEX "interviews_scheduledDate_idx" ON "interviews"("scheduledDate");

-- CreateIndex
CREATE INDEX "interviews_primaryInterviewerId_idx" ON "interviews"("primaryInterviewerId");

-- CreateIndex
CREATE INDEX "user_companies_userId_idx" ON "user_companies"("userId");

-- CreateIndex
CREATE INDEX "user_companies_companyId_idx" ON "user_companies"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "user_companies_userId_companyId_key" ON "user_companies"("userId", "companyId");

-- CreateIndex
CREATE INDEX "export_artifacts_payrollRunId_exportType_idx" ON "export_artifacts"("payrollRunId", "exportType");

-- CreateIndex
CREATE INDEX "export_artifacts_companyId_generatedAt_idx" ON "export_artifacts"("companyId", "generatedAt");

-- CreateIndex
CREATE INDEX "export_artifacts_generatedById_idx" ON "export_artifacts"("generatedById");

-- CreateIndex
CREATE INDEX "check_in_periods_companyId_startDate_idx" ON "check_in_periods"("companyId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_periods_companyId_name_key" ON "check_in_periods"("companyId", "name");

-- CreateIndex
CREATE INDEX "performance_check_ins_employeeId_idx" ON "performance_check_ins"("employeeId");

-- CreateIndex
CREATE INDEX "performance_check_ins_status_idx" ON "performance_check_ins"("status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_check_ins_periodId_employeeId_key" ON "performance_check_ins"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "check_in_goals_checkInId_idx" ON "check_in_goals"("checkInId");

-- CreateIndex
CREATE INDEX "skill_ratings_checkInId_idx" ON "skill_ratings"("checkInId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_ratings_checkInId_skillCategory_skillName_key" ON "skill_ratings"("checkInId", "skillCategory", "skillName");

-- CreateIndex
CREATE INDEX "employees_roleScorecardId_idx" ON "employees"("roleScorecardId");

-- AddForeignKey
ALTER TABLE "hiring_entities" ADD CONSTRAINT "hiring_entities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_scorecards" ADD CONSTRAINT "role_scorecards_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_scorecards" ADD CONSTRAINT "role_scorecards_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_scorecards" ADD CONSTRAINT "role_scorecards_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "shift_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_scorecards" ADD CONSTRAINT "role_scorecards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_scorecards" ADD CONSTRAINT "role_scorecards_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "role_scorecards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_roleScorecardId_fkey" FOREIGN KEY ("roleScorecardId") REFERENCES "role_scorecards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_hiringEntityId_fkey" FOREIGN KEY ("hiringEntityId") REFERENCES "hiring_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicants" ADD CONSTRAINT "applicants_convertedToEmployeeId_fkey" FOREIGN KEY ("convertedToEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_primaryInterviewerId_fkey" FOREIGN KEY ("primaryInterviewerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_roleScorecardId_fkey" FOREIGN KEY ("roleScorecardId") REFERENCES "role_scorecards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_hiringEntityId_fkey" FOREIGN KEY ("hiringEntityId") REFERENCES "hiring_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_periods" ADD CONSTRAINT "check_in_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_check_ins" ADD CONSTRAINT "performance_check_ins_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "check_in_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_check_ins" ADD CONSTRAINT "performance_check_ins_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_check_ins" ADD CONSTRAINT "performance_check_ins_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_goals" ADD CONSTRAINT "check_in_goals_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "performance_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_ratings" ADD CONSTRAINT "skill_ratings_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "performance_check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
