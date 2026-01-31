/*
  Warnings:

  - You are about to drop the column `absentMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `computedAt` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `computedByJobId` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `grossWorkedMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `holidayMultiplier` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `isBreakApplicable` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `lateMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `leaveTypeCode` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `ndMultiplier` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `nightDiffMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `otEarlyInMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `otLateOutMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `otMultiplier` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `overtimeHolidayMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `overtimeRestDayMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `restDayMultiplier` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `rulesetVersionId` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledBreakMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledEndTime` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledStartTime` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledWorkMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `undertimeMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `workedMinutes` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `rulesetVersionId` on the `payroll_runs` table. All the data in the column will be lost.
  - You are about to drop the column `cashAdvanceId` on the `payslip_lines` table. All the data in the column will be lost.
  - You are about to drop the column `orIncentiveId` on the `payslip_lines` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursementId` on the `payslip_lines` table. All the data in the column will be lost.
  - You are about to drop the `attachments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cash_advances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clearance_signoffs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employee_schedules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `job_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `multiplier_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `or_incentives` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reimbursements` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rest_day_rules` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ruleset_versions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rulesets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `separation_clearances` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `statutory_table_versions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirteenth_month_accruals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirteenth_month_payouts` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "EmploymentEventType" ADD VALUE 'DECLARED_WAGE_OVERRIDE';

-- AlterEnum
ALTER TYPE "ExportType" ADD VALUE 'PAYSLIP_PDF_ZIP';

-- DropForeignKey
ALTER TABLE "attendance_day_records" DROP CONSTRAINT "attendance_day_records_computedByJobId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_day_records" DROP CONSTRAINT "attendance_day_records_rulesetVersionId_fkey";

-- DropForeignKey
ALTER TABLE "cash_advances" DROP CONSTRAINT "cash_advances_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "cash_advances" DROP CONSTRAINT "cash_advances_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "cash_advances" DROP CONSTRAINT "cash_advances_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "clearance_signoffs" DROP CONSTRAINT "clearance_signoffs_clearanceId_fkey";

-- DropForeignKey
ALTER TABLE "clearance_signoffs" DROP CONSTRAINT "clearance_signoffs_signedOffById_fkey";

-- DropForeignKey
ALTER TABLE "employee_schedules" DROP CONSTRAINT "employee_schedules_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "employee_schedules" DROP CONSTRAINT "employee_schedules_shiftTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "job_logs" DROP CONSTRAINT "job_logs_jobId_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_companyId_fkey";

-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_createdById_fkey";

-- DropForeignKey
ALTER TABLE "multiplier_rules" DROP CONSTRAINT "multiplier_rules_rulesetVersionId_fkey";

-- DropForeignKey
ALTER TABLE "or_incentives" DROP CONSTRAINT "or_incentives_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "or_incentives" DROP CONSTRAINT "or_incentives_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "or_incentives" DROP CONSTRAINT "or_incentives_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "payroll_runs" DROP CONSTRAINT "payroll_runs_rulesetVersionId_fkey";

-- DropForeignKey
ALTER TABLE "payslip_lines" DROP CONSTRAINT "payslip_lines_cashAdvanceId_fkey";

-- DropForeignKey
ALTER TABLE "payslip_lines" DROP CONSTRAINT "payslip_lines_orIncentiveId_fkey";

-- DropForeignKey
ALTER TABLE "payslip_lines" DROP CONSTRAINT "payslip_lines_reimbursementId_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "reimbursements" DROP CONSTRAINT "reimbursements_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "ruleset_versions" DROP CONSTRAINT "ruleset_versions_pagibigTableVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ruleset_versions" DROP CONSTRAINT "ruleset_versions_philhealthTableVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ruleset_versions" DROP CONSTRAINT "ruleset_versions_rulesetId_fkey";

-- DropForeignKey
ALTER TABLE "ruleset_versions" DROP CONSTRAINT "ruleset_versions_sssTableVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ruleset_versions" DROP CONSTRAINT "ruleset_versions_taxTableVersionId_fkey";

-- DropForeignKey
ALTER TABLE "rulesets" DROP CONSTRAINT "rulesets_companyId_fkey";

-- DropForeignKey
ALTER TABLE "separation_clearances" DROP CONSTRAINT "separation_clearances_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "separation_clearances" DROP CONSTRAINT "separation_clearances_initiatedById_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_accruals" DROP CONSTRAINT "thirteenth_month_accruals_companyId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_accruals" DROP CONSTRAINT "thirteenth_month_accruals_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_accruals" DROP CONSTRAINT "thirteenth_month_accruals_payrollRunId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_accruals" DROP CONSTRAINT "thirteenth_month_accruals_payslipId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_payouts" DROP CONSTRAINT "thirteenth_month_payouts_companyId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_payouts" DROP CONSTRAINT "thirteenth_month_payouts_createdById_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_payouts" DROP CONSTRAINT "thirteenth_month_payouts_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_payouts" DROP CONSTRAINT "thirteenth_month_payouts_payrollRunId_fkey";

-- DropForeignKey
ALTER TABLE "thirteenth_month_payouts" DROP CONSTRAINT "thirteenth_month_payouts_payslipId_fkey";

-- AlterTable
ALTER TABLE "attendance_day_records" DROP COLUMN "absentMinutes",
DROP COLUMN "computedAt",
DROP COLUMN "computedByJobId",
DROP COLUMN "grossWorkedMinutes",
DROP COLUMN "holidayMultiplier",
DROP COLUMN "isBreakApplicable",
DROP COLUMN "lateMinutes",
DROP COLUMN "leaveTypeCode",
DROP COLUMN "ndMultiplier",
DROP COLUMN "nightDiffMinutes",
DROP COLUMN "otEarlyInMinutes",
DROP COLUMN "otLateOutMinutes",
DROP COLUMN "otMultiplier",
DROP COLUMN "overtimeHolidayMinutes",
DROP COLUMN "overtimeRestDayMinutes",
DROP COLUMN "restDayMultiplier",
DROP COLUMN "rulesetVersionId",
DROP COLUMN "scheduledBreakMinutes",
DROP COLUMN "scheduledEndTime",
DROP COLUMN "scheduledStartTime",
DROP COLUMN "scheduledWorkMinutes",
DROP COLUMN "undertimeMinutes",
DROP COLUMN "workedMinutes";

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "declaredWageEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "declaredWageOverride" DECIMAL(12,2),
ADD COLUMN     "declaredWageReason" TEXT,
ADD COLUMN     "declaredWageSetAt" TIMESTAMP(3),
ADD COLUMN     "declaredWageSetById" UUID,
ADD COLUMN     "declaredWageType" "WageType",
ADD COLUMN     "taxOnFullEarnings" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payroll_runs" DROP COLUMN "rulesetVersionId";

-- AlterTable
ALTER TABLE "payslip_lines" DROP COLUMN "cashAdvanceId",
DROP COLUMN "orIncentiveId",
DROP COLUMN "reimbursementId";

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- DropTable
DROP TABLE "attachments";

-- DropTable
DROP TABLE "cash_advances";

-- DropTable
DROP TABLE "clearance_signoffs";

-- DropTable
DROP TABLE "employee_schedules";

-- DropTable
DROP TABLE "job_logs";

-- DropTable
DROP TABLE "jobs";

-- DropTable
DROP TABLE "multiplier_rules";

-- DropTable
DROP TABLE "or_incentives";

-- DropTable
DROP TABLE "reimbursements";

-- DropTable
DROP TABLE "rest_day_rules";

-- DropTable
DROP TABLE "ruleset_versions";

-- DropTable
DROP TABLE "rulesets";

-- DropTable
DROP TABLE "separation_clearances";

-- DropTable
DROP TABLE "statutory_table_versions";

-- DropTable
DROP TABLE "thirteenth_month_accruals";

-- DropTable
DROP TABLE "thirteenth_month_payouts";

-- DropEnum
DROP TYPE "ClearanceStatus";

-- DropEnum
DROP TYPE "JobStatus";

-- DropEnum
DROP TYPE "JobType";

-- DropEnum
DROP TYPE "StatutoryType";

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_declaredWageSetById_fkey" FOREIGN KEY ("declaredWageSetById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
