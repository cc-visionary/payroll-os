-- AlterEnum
ALTER TYPE "EmploymentStatus" ADD VALUE 'RETIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmploymentType" ADD VALUE 'SEASONAL';
ALTER TYPE "EmploymentType" ADD VALUE 'CASUAL';

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- CreateTable
CREATE TABLE "attendance_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "shiftStartOverride" VARCHAR(5),
    "shiftEndOverride" VARCHAR(5),
    "breakMinutesOverride" INTEGER,
    "earlyInApproved" BOOLEAN NOT NULL DEFAULT false,
    "lateOutApproved" BOOLEAN NOT NULL DEFAULT false,
    "lateInApproved" BOOLEAN NOT NULL DEFAULT false,
    "earlyOutApproved" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "reasonCode" VARCHAR(50),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_overrides_employeeId_idx" ON "attendance_overrides"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_overrides_attendanceDate_idx" ON "attendance_overrides"("attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_overrides_employeeId_attendanceDate_key" ON "attendance_overrides"("employeeId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "attendance_overrides" ADD CONSTRAINT "attendance_overrides_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_overrides" ADD CONSTRAINT "attendance_overrides_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
