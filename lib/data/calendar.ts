// =============================================================================
// PeopleOS PH - Holiday Calendar Data Fetching
// =============================================================================

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

/**
 * Get all holiday calendars for the company.
 */
export const getHolidayCalendars = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const calendars = await prisma.holidayCalendar.findMany({
    where: { companyId: auth.user.companyId },
    include: {
      _count: { select: { events: true } },
    },
    orderBy: { year: "desc" },
  });

  return calendars;
});

/**
 * Get a single holiday calendar with all events.
 */
export const getHolidayCalendar = cache(async (calendarId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const calendar = await prisma.holidayCalendar.findFirst({
    where: {
      id: calendarId,
      companyId: auth.user.companyId,
    },
    include: {
      events: {
        orderBy: { date: "asc" },
      },
    },
  });

  return calendar;
});

/**
 * Get calendar for a specific year.
 */
export const getCalendarByYear = cache(async (year: number) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const calendar = await prisma.holidayCalendar.findFirst({
    where: {
      companyId: auth.user.companyId,
      year,
    },
    include: {
      events: {
        orderBy: { date: "asc" },
      },
    },
  });

  return calendar;
});

/**
 * Get calendar events for a date range.
 * Used by attendance computation.
 */
export const getCalendarEventsForRange = cache(
  async (startDate: Date, endDate: Date) => {
    const auth = await getAuthContext();
    if (!auth) throw new Error("Not authenticated");

    // Get calendars for the years covered
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    const calendars = await prisma.holidayCalendar.findMany({
      where: {
        companyId: auth.user.companyId,
        year: { gte: startYear, lte: endYear },
        isActive: true,
      },
      select: { id: true },
    });

    const calendarIds = calendars.map((c) => c.id);

    const events = await prisma.calendarEvent.findMany({
      where: {
        calendarId: { in: calendarIds },
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    });

    return events;
  }
);

/**
 * Build a date-to-event map for quick lookup.
 * Key is ISO date string (YYYY-MM-DD).
 */
export async function buildEventMap(
  startDate: Date,
  endDate: Date
): Promise<Map<string, { dayType: string; holidayId: string; name: string }>> {
  const events = await getCalendarEventsForRange(startDate, endDate);

  const map = new Map<string, { dayType: string; holidayId: string; name: string }>();

  for (const event of events) {
    const dateKey = event.date.toISOString().split("T")[0];
    map.set(dateKey, {
      dayType: event.dayType,
      holidayId: event.id,
      name: event.name,
    });
  }

  return map;
}
