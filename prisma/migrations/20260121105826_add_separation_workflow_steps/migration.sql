-- AlterTable
ALTER TABLE "separation_clearances" ADD COLUMN     "coeDocumentId" UUID,
ADD COLUMN     "coeGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "coeGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "quitclaimDocumentId" UUID,
ADD COLUMN     "quitclaimGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quitclaimGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "quitclaimSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quitclaimSignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;
