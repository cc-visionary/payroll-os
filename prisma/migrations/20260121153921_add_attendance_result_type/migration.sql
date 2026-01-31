-- AlterTable
ALTER TABLE "attendance_raw_rows" ADD COLUMN     "attendanceResult" VARCHAR(255),
ADD COLUMN     "attendanceType" VARCHAR(50);

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;
