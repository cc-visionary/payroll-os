/*
  Warnings:

  - You are about to drop the column `deviceId` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `deviceType` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `isOtApproved` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `locationAccuracy` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `locationName` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `otApprovedAt` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the column `otApprovedById` on the `attendance_day_records` table. All the data in the column will be lost.
  - You are about to drop the `attendance_adjustments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `attendance_overrides` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `attendance_raw_rows` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "attendance_adjustments" DROP CONSTRAINT "attendance_adjustments_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "attendance_adjustments" DROP CONSTRAINT "attendance_adjustments_attendanceDayRecordId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_adjustments" DROP CONSTRAINT "attendance_adjustments_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "attendance_day_records" DROP CONSTRAINT "attendance_day_records_otApprovedById_fkey";

-- DropForeignKey
ALTER TABLE "attendance_overrides" DROP CONSTRAINT "attendance_overrides_createdById_fkey";

-- DropForeignKey
ALTER TABLE "attendance_overrides" DROP CONSTRAINT "attendance_overrides_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_raw_rows" DROP CONSTRAINT "attendance_raw_rows_importId_fkey";

-- AlterTable
ALTER TABLE "attendance_day_records" DROP COLUMN "deviceId",
DROP COLUMN "deviceType",
DROP COLUMN "ipAddress",
DROP COLUMN "isOtApproved",
DROP COLUMN "latitude",
DROP COLUMN "locationAccuracy",
DROP COLUMN "locationName",
DROP COLUMN "longitude",
DROP COLUMN "otApprovedAt",
DROP COLUMN "otApprovedById",
ADD COLUMN     "earlyInApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "earlyOutApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateInApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateOutApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideAt" TIMESTAMP(3),
ADD COLUMN     "overrideById" UUID,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "overrideReasonCode" VARCHAR(50);

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- DropTable
DROP TABLE "attendance_adjustments";

-- DropTable
DROP TABLE "attendance_overrides";

-- DropTable
DROP TABLE "attendance_raw_rows";

-- DropEnum
DROP TYPE "AdjustmentType";

-- DropEnum
DROP TYPE "ImportRowStatus";

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_overrideById_fkey" FOREIGN KEY ("overrideById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
