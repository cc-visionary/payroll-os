"use server";

// =============================================================================
// PeopleOS PH - Holiday Calendar Server Actions
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";

// =============================================================================
// Types
// =============================================================================

export interface CreateCalendarInput {
  year: number;
  name: string;
}

export interface CreateCalendarEventInput {
  calendarId: string;
  date: string;
  name: string;
  dayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | "SPECIAL_WORKING" | "REST_DAY";
  isNational: boolean;
}

export interface UpdateCalendarEventInput {
  name?: string;
  dayType?: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | "SPECIAL_WORKING" | "REST_DAY";
  isNational?: boolean;
}

export interface ImportCalendarRow {
  date: string;
  name: string;
  type: string;
}

// =============================================================================
// Calendar CRUD
// =============================================================================

/**
 * Create a new holiday calendar for a year.
 * Permission: calendar:manage
 */
export async function createHolidayCalendar(input: CreateCalendarInput) {
  const auth = await assertPermission(Permission.CALENDAR_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check if calendar already exists for this year
  const existing = await prisma.holidayCalendar.findFirst({
    where: {
      companyId: auth.user.companyId,
      year: input.year,
    },
  });

  if (existing) {
    return {
      success: false,
      error: `Calendar for ${input.year} already exists`,
      existingId: existing.id,
    };
  }

  try {
    const calendar = await prisma.holidayCalendar.create({
      data: {
        companyId: auth.user.companyId,
        year: input.year,
        name: input.name || `${input.year} Holiday Calendar`,
        isActive: true,
      },
    });

    await audit.create("HolidayCalendar", calendar.id, {
      year: input.year,
      name: input.name,
    });

    revalidatePath("/calendar");

    return {
      success: true,
      calendarId: calendar.id,
      message: "Calendar created successfully",
    };
  } catch (error) {
    console.error("Failed to create calendar:", error);
    return { success: false, error: "Failed to create calendar" };
  }
}

/**
 * Add a calendar event (holiday).
 * Permission: calendar:manage
 *
 * IMPORTANT: Adding events to a calendar that has been used in computed
 * attendance will NOT retroactively change those records. This is by design
 * to preserve payroll integrity.
 */
export async function createCalendarEvent(input: CreateCalendarEventInput) {
  const auth = await assertPermission(Permission.CALENDAR_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Parse the date string (YYYY-MM-DD) and create a Date at noon UTC
  // This avoids timezone boundary issues when storing as @db.Date
  const [year, month, day] = input.date.split("-").map(Number);
  const eventDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Verify calendar exists and belongs to company
  const calendar = await prisma.holidayCalendar.findFirst({
    where: {
      id: input.calendarId,
      companyId: auth.user.companyId,
    },
  });

  if (!calendar) {
    return { success: false, error: "Calendar not found" };
  }

  // Check if event already exists for this date
  // Use date range to handle any timezone edge cases (start of day to end of day UTC)
  const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  const existing = await prisma.calendarEvent.findFirst({
    where: {
      calendarId: input.calendarId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
  });

  if (existing) {
    return {
      success: false,
      error: `An event "${existing.name}" already exists for ${input.date}. Only one event per date is allowed.`,
      existingId: existing.id,
    };
  }

  // Warn if date has locked attendance records
  const lockedRecords = await prisma.attendanceDayRecord.count({
    where: {
      attendanceDate: eventDate,
      isLocked: true,
    },
  });

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        calendarId: input.calendarId,
        date: eventDate,
        name: input.name,
        dayType: input.dayType,
        isNational: input.isNational,
      },
    });

    await audit.create("CalendarEvent", event.id, {
      calendarId: input.calendarId,
      date: input.date,
      name: input.name,
      dayType: input.dayType,
      lockedRecordsAffected: lockedRecords,
    });

    revalidatePath(`/calendar/${input.calendarId}`);

    return {
      success: true,
      eventId: event.id,
      message: "Event created successfully",
      warning:
        lockedRecords > 0
          ? `Note: ${lockedRecords} attendance records for this date are already locked in payroll and will not be affected.`
          : undefined,
    };
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return { success: false, error: "Failed to create event" };
  }
}

/**
 * Update a calendar event.
 * Permission: calendar:manage
 */
export async function updateCalendarEvent(eventId: string, input: UpdateCalendarEventInput) {
  const auth = await assertPermission(Permission.CALENDAR_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { calendar: true },
  });

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  // Check if any attendance records use this event and are locked
  const lockedRecords = await prisma.attendanceDayRecord.count({
    where: {
      holidayId: eventId,
      isLocked: true,
    },
  });

  if (lockedRecords > 0 && input.dayType && input.dayType !== event.dayType) {
    return {
      success: false,
      error: `Cannot change day type: ${lockedRecords} attendance records are locked in completed payroll. The original day type will be preserved for those records.`,
    };
  }

  try {
    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        name: input.name,
        dayType: input.dayType,
        isNational: input.isNational,
      },
    });

    await audit.update(
      "CalendarEvent",
      eventId,
      { name: event.name, dayType: event.dayType },
      { name: input.name, dayType: input.dayType }
    );

    revalidatePath(`/calendar/${event.calendarId}`);

    return { success: true, message: "Event updated successfully" };
  } catch (error) {
    console.error("Failed to update calendar event:", error);
    return { success: false, error: "Failed to update event" };
  }
}

/**
 * Delete a calendar event.
 * Permission: calendar:manage
 */
export async function deleteCalendarEvent(eventId: string) {
  const auth = await assertPermission(Permission.CALENDAR_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: { calendar: true },
  });

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  // Check if any attendance records reference this event
  const referencedRecords = await prisma.attendanceDayRecord.count({
    where: { holidayId: eventId },
  });

  if (referencedRecords > 0) {
    return {
      success: false,
      error: `Cannot delete: ${referencedRecords} attendance records reference this event. You can only edit the event name.`,
    };
  }

  try {
    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    await audit.delete("CalendarEvent", eventId, {
      date: event.date,
      name: event.name,
      dayType: event.dayType,
    });

    revalidatePath(`/calendar/${event.calendarId}`);

    return { success: true, message: "Event deleted successfully" };
  } catch (error) {
    console.error("Failed to delete calendar event:", error);
    return { success: false, error: "Failed to delete event" };
  }
}

/**
 * Import calendar events from CSV data.
 * Permission: calendar:manage
 *
 * Expected CSV format:
 * date,name,type
 * 2025-01-01,New Year's Day,REGULAR_HOLIDAY
 * 2025-02-25,EDSA Revolution Anniversary,SPECIAL_HOLIDAY
 */
export async function importCalendarEvents(calendarId: string, rows: ImportCalendarRow[]) {
  const auth = await assertPermission(Permission.CALENDAR_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Verify calendar
  const calendar = await prisma.holidayCalendar.findFirst({
    where: {
      id: calendarId,
      companyId: auth.user.companyId,
    },
  });

  if (!calendar) {
    return { success: false, error: "Calendar not found" };
  }

  const results = {
    total: rows.length,
    created: 0,
    skipped: 0,
    errors: [] as { row: number; error: string }[],
  };

  // Validate day types
  const validDayTypes = ["REGULAR_HOLIDAY", "SPECIAL_HOLIDAY", "SPECIAL_WORKING", "REST_DAY"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Validate date
    const dateMatch = row.date?.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!dateMatch) {
      results.errors.push({ row: rowNum, error: `Invalid date format: ${row.date}` });
      continue;
    }

    // Validate day type
    const dayType = row.type?.toUpperCase().replace(/ /g, "_");
    if (!validDayTypes.includes(dayType)) {
      results.errors.push({ row: rowNum, error: `Invalid type: ${row.type}` });
      continue;
    }

    // Validate name
    if (!row.name?.trim()) {
      results.errors.push({ row: rowNum, error: "Name is required" });
      continue;
    }

    // Parse the date string (YYYY-MM-DD) and create a Date at noon UTC
    // This avoids timezone boundary issues when storing as @db.Date
    const [year, month, day] = row.date.split("-").map(Number);
    const eventDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    // Check if event already exists using date range to handle timezone edge cases
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const existing = await prisma.calendarEvent.findFirst({
      where: {
        calendarId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    if (existing) {
      results.skipped++;
      results.errors.push({ row: rowNum, error: `Event "${existing.name}" already exists for ${row.date}` });
      continue;
    }

    try {
      await prisma.calendarEvent.create({
        data: {
          calendarId,
          date: eventDate,
          name: row.name.trim(),
          dayType: dayType as "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | "SPECIAL_WORKING",
          isNational: true,
        },
      });
      results.created++;
    } catch (error) {
      results.errors.push({ row: rowNum, error: "Database error" });
    }
  }

  await audit.import("CalendarEvent", {
    calendarId,
    year: calendar.year,
    total: results.total,
    created: results.created,
    skipped: results.skipped,
    errorCount: results.errors.length,
  });

  revalidatePath(`/calendar/${calendarId}`);

  return {
    success: true,
    ...results,
    message: `Imported ${results.created} events, skipped ${results.skipped} duplicates`,
  };
}

/**
 * Clone a calendar to a new year with date adjustments.
 * Permission: calendar:manage
 */
export async function cloneCalendarToYear(sourceCalendarId: string, targetYear: number) {
  const auth = await assertPermission(Permission.CALENDAR_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const sourceCalendar = await prisma.holidayCalendar.findFirst({
    where: {
      id: sourceCalendarId,
      companyId: auth.user.companyId,
    },
    include: { events: true },
  });

  if (!sourceCalendar) {
    return { success: false, error: "Source calendar not found" };
  }

  // Check if target year calendar exists
  const existing = await prisma.holidayCalendar.findFirst({
    where: {
      companyId: auth.user.companyId,
      year: targetYear,
    },
  });

  if (existing) {
    return {
      success: false,
      error: `Calendar for ${targetYear} already exists`,
      existingId: existing.id,
    };
  }

  try {
    // Create new calendar
    const newCalendar = await prisma.holidayCalendar.create({
      data: {
        companyId: auth.user.companyId,
        year: targetYear,
        name: `${targetYear} Holiday Calendar`,
        isActive: true,
      },
    });

    // Clone events with adjusted dates
    const yearDiff = targetYear - sourceCalendar.year;

    for (const event of sourceCalendar.events) {
      if (event.isRecurring) {
        // Use UTC methods to preserve the date when adjusting year
        // event.date from @db.Date comes as midnight UTC
        const newDate = new Date(Date.UTC(
          event.date.getUTCFullYear() + yearDiff,
          event.date.getUTCMonth(),
          event.date.getUTCDate(),
          12, 0, 0 // noon UTC to avoid timezone boundary issues
        ));

        await prisma.calendarEvent.create({
          data: {
            calendarId: newCalendar.id,
            date: newDate,
            name: event.name,
            dayType: event.dayType,
            isNational: event.isNational,
            isRecurring: event.isRecurring,
          },
        });
      }
    }

    await audit.create("HolidayCalendar", newCalendar.id, {
      year: targetYear,
      clonedFrom: sourceCalendarId,
      sourceYear: sourceCalendar.year,
    });

    revalidatePath("/calendar");

    return {
      success: true,
      calendarId: newCalendar.id,
      message: `Calendar cloned to ${targetYear}. Please review and adjust dates for non-fixed holidays.`,
    };
  } catch (error) {
    console.error("Failed to clone calendar:", error);
    return { success: false, error: "Failed to clone calendar" };
  }
}
