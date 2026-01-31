-- AlterTable
ALTER TABLE "applicants" ADD COLUMN     "offerLetterPath" VARCHAR(500);

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;
