-- AlterTable
ALTER TABLE "attendance_day_records" ADD COLUMN     "isOtApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otApprovedAt" TIMESTAMP(3),
ADD COLUMN     "otApprovedById" UUID;

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- AddForeignKey
ALTER TABLE "attendance_day_records" ADD CONSTRAINT "attendance_day_records_otApprovedById_fkey" FOREIGN KEY ("otApprovedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
