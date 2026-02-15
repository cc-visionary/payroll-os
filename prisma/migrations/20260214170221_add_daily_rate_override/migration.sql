-- AlterTable
ALTER TABLE "attendance_day_records" ADD COLUMN     "dailyRateOverride" DECIMAL(12,4);

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;
