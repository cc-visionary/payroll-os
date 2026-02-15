-- CreateEnum
CREATE TYPE "PenaltyStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PayslipLineCategory" ADD VALUE 'PENALTY_DEDUCTION';

-- AlterTable
ALTER TABLE "payslip_lines" ADD COLUMN     "penaltyInstallmentId" UUID;

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- CreateTable
CREATE TABLE "penalty_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "penalty_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "penaltyTypeId" UUID,
    "customDescription" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(12,2) NOT NULL,
    "status" "PenaltyStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveDate" DATE NOT NULL,
    "remarks" TEXT,
    "totalDeducted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_installments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "penaltyId" UUID NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "isDeducted" BOOLEAN NOT NULL DEFAULT false,
    "deductedAt" TIMESTAMP(3),
    "payrollRunId" UUID,
    "payslipLineId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "penalty_types_companyId_isActive_idx" ON "penalty_types"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_types_companyId_code_key" ON "penalty_types"("companyId", "code");

-- CreateIndex
CREATE INDEX "penalties_employeeId_status_idx" ON "penalties"("employeeId", "status");

-- CreateIndex
CREATE INDEX "penalties_status_idx" ON "penalties"("status");

-- CreateIndex
CREATE INDEX "penalty_installments_penaltyId_isDeducted_idx" ON "penalty_installments"("penaltyId", "isDeducted");

-- CreateIndex
CREATE INDEX "penalty_installments_payrollRunId_idx" ON "penalty_installments"("payrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_installments_penaltyId_installmentNumber_key" ON "penalty_installments"("penaltyId", "installmentNumber");

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_penaltyInstallmentId_fkey" FOREIGN KEY ("penaltyInstallmentId") REFERENCES "penalty_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_types" ADD CONSTRAINT "penalty_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_penaltyTypeId_fkey" FOREIGN KEY ("penaltyTypeId") REFERENCES "penalty_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_installments" ADD CONSTRAINT "penalty_installments_penaltyId_fkey" FOREIGN KEY ("penaltyId") REFERENCES "penalties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
