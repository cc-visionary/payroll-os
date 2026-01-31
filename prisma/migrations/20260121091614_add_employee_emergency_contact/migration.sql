-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "emergencyContactName" VARCHAR(100),
ADD COLUMN     "emergencyContactNumber" VARCHAR(20),
ADD COLUMN     "emergencyContactRelationship" VARCHAR(50);

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;
