-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING', 'CLEARED', 'WITH_REMARKS', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "shift_templates" ALTER COLUMN "ndStartTime" SET DEFAULT '22:00:00'::time,
ALTER COLUMN "ndEndTime" SET DEFAULT '06:00:00'::time;

-- CreateTable
CREATE TABLE "separation_clearances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employeeId" UUID NOT NULL,
    "separationType" VARCHAR(50) NOT NULL,
    "separationReason" TEXT,
    "lastWorkingDate" DATE NOT NULL,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatedById" UUID NOT NULL,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "finalPayComputed" BOOLEAN NOT NULL DEFAULT false,
    "finalPayAmount" DECIMAL(12,2),
    "finalPayNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "separation_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_signoffs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clearanceId" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "categoryLabel" VARCHAR(100) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "signedOffById" UUID,
    "signedOffAt" TIMESTAMP(3),
    "remarks" TEXT,
    "hasAccountabilities" BOOLEAN NOT NULL DEFAULT false,
    "accountabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clearance_signoffs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "separation_clearances_employeeId_key" ON "separation_clearances"("employeeId");

-- CreateIndex
CREATE INDEX "separation_clearances_employeeId_idx" ON "separation_clearances"("employeeId");

-- CreateIndex
CREATE INDEX "separation_clearances_status_idx" ON "separation_clearances"("status");

-- CreateIndex
CREATE INDEX "clearance_signoffs_clearanceId_idx" ON "clearance_signoffs"("clearanceId");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_signoffs_clearanceId_category_key" ON "clearance_signoffs"("clearanceId", "category");

-- AddForeignKey
ALTER TABLE "separation_clearances" ADD CONSTRAINT "separation_clearances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "separation_clearances" ADD CONSTRAINT "separation_clearances_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_signoffs" ADD CONSTRAINT "clearance_signoffs_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "separation_clearances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_signoffs" ADD CONSTRAINT "clearance_signoffs_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
