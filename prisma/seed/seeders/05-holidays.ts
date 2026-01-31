// =============================================================================
// PeopleOS PH - Holiday Calendar Seeder
// =============================================================================

import type { PrismaClient, DayType } from "../../../app/generated/prisma";
import { holidays2025, holidays2026 } from "../data/holidays";

/**
 * Parse a date string (YYYY-MM-DD) and create a Date at noon UTC.
 * This avoids timezone issues where midnight UTC can shift to a different
 * day when stored in PostgreSQL @db.Date fields.
 */
function parseDateAtNoonUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export async function seedHolidayCalendar(prisma: PrismaClient, companyId: string) {
  // Delete existing calendar events to ensure clean state
  // (handles corrupted data from timezone issues)
  const existingCalendars = await prisma.holidayCalendar.findMany({
    where: { companyId, year: { in: [2025, 2026] } },
    select: { id: true },
  });

  if (existingCalendars.length > 0) {
    await prisma.calendarEvent.deleteMany({
      where: { calendarId: { in: existingCalendars.map((c) => c.id) } },
    });
  }

  // Create calendar for 2025
  const calendar2025 = await prisma.holidayCalendar.upsert({
    where: {
      companyId_year: { companyId, year: 2025 },
    },
    update: {
      name: "Philippine Holidays 2025",
      isActive: true,
    },
    create: {
      companyId,
      year: 2025,
      name: "Philippine Holidays 2025",
      isActive: true,
    },
  });

  // Create calendar for 2026
  const calendar2026 = await prisma.holidayCalendar.upsert({
    where: {
      companyId_year: { companyId, year: 2026 },
    },
    update: {
      name: "Philippine Holidays 2026",
      isActive: true,
    },
    create: {
      companyId,
      year: 2026,
      name: "Philippine Holidays 2026",
      isActive: true,
    },
  });

  // Seed 2025 events
  for (const holiday of holidays2025) {
    const holidayDate = parseDateAtNoonUtc(holiday.date);

    await prisma.calendarEvent.upsert({
      where: {
        calendarId_date: { calendarId: calendar2025.id, date: holidayDate },
      },
      update: {
        name: holiday.name,
        dayType: holiday.dayType as DayType,
        isNational: holiday.isNational,
      },
      create: {
        calendarId: calendar2025.id,
        date: holidayDate,
        name: holiday.name,
        dayType: holiday.dayType as DayType,
        isNational: holiday.isNational,
      },
    });
  }

  // Seed 2026 events
  for (const holiday of holidays2026) {
    const holidayDate = parseDateAtNoonUtc(holiday.date);

    await prisma.calendarEvent.upsert({
      where: {
        calendarId_date: { calendarId: calendar2026.id, date: holidayDate },
      },
      update: {
        name: holiday.name,
        dayType: holiday.dayType as DayType,
        isNational: holiday.isNational,
      },
      create: {
        calendarId: calendar2026.id,
        date: holidayDate,
        name: holiday.name,
        dayType: holiday.dayType as DayType,
        isNational: holiday.isNational,
      },
    });
  }
}
