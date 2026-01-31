-- AlterTable
ALTER TABLE "attendance_day_records" ALTER COLUMN "breakMinutesApplied" DROP NOT NULL,
ALTER COLUMN "breakMinutesApplied" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;
