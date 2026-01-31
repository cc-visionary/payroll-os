// =============================================================================
// PeopleOS PH - Shift Templates Seeder
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";
import { shifts } from "../data/shifts";

// Convert time string "HH:MM" to Date object for Prisma @db.Time field
function timeStringToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  // Use a fixed date (1970-01-01) since only time matters for @db.Time
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

// Convert optional time string to Date or null
function optionalTimeStringToDate(timeStr: string | undefined): Date | null {
  if (!timeStr) return null;
  return timeStringToDate(timeStr);
}

export async function seedShiftTemplates(prisma: PrismaClient, companyId: string) {
  for (const shift of shifts) {
    const startTime = timeStringToDate(shift.startTime);
    const endTime = timeStringToDate(shift.endTime);
    const breakStartTime = optionalTimeStringToDate(shift.breakStartTime);
    const breakEndTime = optionalTimeStringToDate(shift.breakEndTime);

    await prisma.shiftTemplate.upsert({
      where: {
        companyId_code: { companyId, code: shift.code },
      },
      update: {
        name: shift.name,
        startTime,
        endTime,
        breakMinutes: shift.breakMinutes,
        breakStartTime,
        breakEndTime,
        scheduledWorkMinutes: shift.scheduledWorkMinutes,
        isOvernight: shift.isOvernight,
      },
      create: {
        companyId,
        code: shift.code,
        name: shift.name,
        startTime,
        endTime,
        breakMinutes: shift.breakMinutes,
        breakStartTime,
        breakEndTime,
        scheduledWorkMinutes: shift.scheduledWorkMinutes,
        isOvernight: shift.isOvernight,
      },
    });
  }
}
