/*
  Warnings:

  - You are about to drop the column `timeInLogId` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `timeOutLogId` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the `pay_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `raw_time_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('LARK_IMPORT', 'MANUAL', 'BIOMETRIC', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "attendance_day_records" DROP CONSTRAINT "attendance_day_records_timeInLogId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_day_records" DROP CONSTRAINT "attendance_day_records_timeOutLogId_fkey";

-- DropForeignKey
ALTER TABLE "pay_profiles" DROP CONSTRAINT "pay_profiles_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "pay_profiles" DROP CONSTRAINT "pay_profiles_defaultShiftTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "pay_profiles" DROP CONSTRAINT "pay_profiles_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "raw_time_logs" DROP CONSTRAINT "raw_time_logs_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "raw_time_logs" DROP CONSTRAINT "raw_time_logs_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "raw_time_logs" DROP CONSTRAINT "raw_time_logs_enteredById_fkey";

-- DropForeignKey
ALTER TABLE "raw_time_logs" DROP CONSTRAINT "raw_time_logs_sourceBatchId_fkey";

-- AlterTable
ALTER TABLE "attendance_day_records" DROP COLUMN "timeInLogId",
DROP COLUMN "timeOutLogId",
ADD COLUMN     "deviceId" VARCHAR(100),
ADD COLUMN     "deviceType" VARCHAR(50),
ADD COLUMN     "enteredById" UUID,
ADD COLUMN     "ipAddress" VARCHAR(45),
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "locationAccuracy" DECIMAL(8,2),
ADD COLUMN     "locationName" VARCHAR(255),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "manualReason" TEXT,
ADD COLUMN     "sourceBatchId" UUID,
ADD COLUMN     "sourceRecordId" VARCHAR(100),
ADD COLUMN     "sourceType" "AttendanceSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- DropTable
DROP TABLE "pay_profiles";

-- DropTable
DROP TABLE "raw_time_logs";

-- DropEnum
DROP TYPE "TimeLogSource";

-- DropEnum
DROP TYPE "TimeLogType";

-- CreateIndex
CREATE INDEX "attendance_day_records_sourceBatchId_idx" ON "attendance_day_records"("sourceBatchId");

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "attendance_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
