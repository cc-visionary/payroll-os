-- AlterEnum
ALTER TYPE "PayslipLineCategory" ADD VALUE 'THIRTEENTH_MONTH_PAY';

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- CreateTable
CREATE TABLE "thirteenth_month_accruals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" SMALLINT NOT NULL,
    "basicPayAmount" DECIMAL(12,2) NOT NULL,
    "payrollRunId" UUID,
    "payslipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thirteenth_month_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thirteenth_month_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "totalBasicPay" DECIMAL(14,2) NOT NULL,
    "thirteenthMonthPay" DECIMAL(12,2) NOT NULL,
    "monthsCovered" SMALLINT NOT NULL,
    "paidOn" DATE,
    "payrollRunId" UUID,
    "payslipId" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "thirteenth_month_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thirteenth_month_accruals_companyId_year_idx" ON "thirteenth_month_accruals"("companyId", "year");

-- CreateIndex
CREATE INDEX "thirteenth_month_accruals_employeeId_year_idx" ON "thirteenth_month_accruals"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "thirteenth_month_accruals_employeeId_year_month_key" ON "thirteenth_month_accruals"("employeeId", "year", "month");

-- CreateIndex
CREATE INDEX "thirteenth_month_payouts_companyId_year_idx" ON "thirteenth_month_payouts"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "thirteenth_month_payouts_employeeId_year_key" ON "thirteenth_month_payouts"("employeeId", "year");

-- AddForeignKey
ALTER TABLE "thirteenth_month_accruals" ADD CONSTRAINT "thirteenth_month_accruals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_accruals" ADD CONSTRAINT "thirteenth_month_accruals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_accruals" ADD CONSTRAINT "thirteenth_month_accruals_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_accruals" ADD CONSTRAINT "thirteenth_month_accruals_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_payouts" ADD CONSTRAINT "thirteenth_month_payouts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_payouts" ADD CONSTRAINT "thirteenth_month_payouts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_payouts" ADD CONSTRAINT "thirteenth_month_payouts_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_payouts" ADD CONSTRAINT "thirteenth_month_payouts_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thirteenth_month_payouts" ADD CONSTRAINT "thirteenth_month_payouts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
