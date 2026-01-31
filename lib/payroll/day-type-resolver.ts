// =============================================================================
// PeopleOS PH - Day Type Resolution Logic
// =============================================================================
//
// This module resolves the day type for any given date, which determines
// the pay multiplier for attendance calculations. The resolution follows
// Philippine labor law requirements.
//
// RESOLUTION ORDER (highest to lowest priority):
// 1. Calendar Events (holidays, special working days)
// 2. Default Rest Days (Saturday and Sunday)
// 3. Default: Regular Working Day
//
// PAY MULTIPLIERS (per DOLE):
// - Regular Working Day: 100%
// - Rest Day: 130%
// - Special Holiday: 130% (no pay if not worked)
// - Special Holiday + Rest Day: 150%
// - Regular Holiday: 200% (paid even if not worked)
// - Regular Holiday + Rest Day: 260%
//
// =============================================================================

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

// Day type enum matching Prisma schema
export type DayType =
  | "REGULAR_WORKING_DAY"
  | "REST_DAY"
  | "REGULAR_HOLIDAY"
  | "SPECIAL_HOLIDAY"
  | "REGULAR_HOLIDAY_REST_DAY"
  | "SPECIAL_HOLIDAY_REST_DAY"
  | "SPECIAL_WORKING_DAY"
  | "COMPANY_EVENT";

// Pay multipliers per day type (as decimal)
export const DAY_TYPE_MULTIPLIERS: Record<DayType, number> = {
  REGULAR_WORKING_DAY: 1.0,
  REST_DAY: 1.3,
  SPECIAL_HOLIDAY: 1.3,
  SPECIAL_HOLIDAY_REST_DAY: 1.5,
  REGULAR_HOLIDAY: 2.0,
  REGULAR_HOLIDAY_REST_DAY: 2.6,
  SPECIAL_WORKING_DAY: 1.0,
  COMPANY_EVENT: 1.0, // Configurable per company
};

// Whether the day type pays even if not worked
export const DAY_TYPE_PAID_IF_NOT_WORKED: Record<DayType, boolean> = {
  REGULAR_WORKING_DAY: false,
  REST_DAY: false,
  SPECIAL_HOLIDAY: false, // "No work, no pay" for special holidays
  SPECIAL_HOLIDAY_REST_DAY: false,
  REGULAR_HOLIDAY: true, // Paid even if not worked
  REGULAR_HOLIDAY_REST_DAY: true,
  SPECIAL_WORKING_DAY: false,
  COMPANY_EVENT: false,
};

export interface DayTypeResolution {
  dayType: DayType;
  multiplier: number;
  paidIfNotWorked: boolean;
  holidayId: string | null;
  holidayName: string | null;
  isRestDay: boolean;
}

/**
 * Resolve the day type for a specific date.
 *
 * This is the core function that determines how an employee's work
 * on a given date should be compensated.
 *
 * @param date - The date to resolve
 * @param restDayNumbers - Array of day-of-week numbers (0=Sun, 6=Sat) that are rest days
 * @param eventMap - Pre-fetched calendar events for the date range
 */
export function resolveDayType(
  date: Date,
  restDayNumbers: number[],
  eventMap: Map<string, { dayType: string; holidayId: string; name: string }>
): DayTypeResolution {
  const dateKey = date.toISOString().split("T")[0];
  const dayOfWeek = date.getDay();
  const isRestDay = restDayNumbers.includes(dayOfWeek);

  // Check for calendar event first (highest priority)
  const event = eventMap.get(dateKey);

  if (event) {
    // Handle holiday + rest day combinations
    if (event.dayType === "REGULAR_HOLIDAY" && isRestDay) {
      return {
        dayType: "REGULAR_HOLIDAY_REST_DAY",
        multiplier: DAY_TYPE_MULTIPLIERS.REGULAR_HOLIDAY_REST_DAY,
        paidIfNotWorked: true,
        holidayId: event.holidayId,
        holidayName: event.name,
        isRestDay: true,
      };
    }

    if (event.dayType === "SPECIAL_HOLIDAY" && isRestDay) {
      return {
        dayType: "SPECIAL_HOLIDAY_REST_DAY",
        multiplier: DAY_TYPE_MULTIPLIERS.SPECIAL_HOLIDAY_REST_DAY,
        paidIfNotWorked: false,
        holidayId: event.holidayId,
        holidayName: event.name,
        isRestDay: true,
      };
    }

    // Regular holiday or special holiday without rest day overlap
    const dayType = event.dayType as DayType;
    return {
      dayType,
      multiplier: DAY_TYPE_MULTIPLIERS[dayType],
      paidIfNotWorked: DAY_TYPE_PAID_IF_NOT_WORKED[dayType],
      holidayId: event.holidayId,
      holidayName: event.name,
      isRestDay: false,
    };
  }

  // No calendar event - check if it's a rest day
  if (isRestDay) {
    return {
      dayType: "REST_DAY",
      multiplier: DAY_TYPE_MULTIPLIERS.REST_DAY,
      paidIfNotWorked: false,
      holidayId: null,
      holidayName: null,
      isRestDay: true,
    };
  }

  // Default: Regular working day
  return {
    dayType: "REGULAR_WORKING_DAY",
    multiplier: DAY_TYPE_MULTIPLIERS.REGULAR_WORKING_DAY,
    paidIfNotWorked: false,
    holidayId: null,
    holidayName: null,
    isRestDay: false,
  };
}

/**
 * Build event map for a date range.
 * Caches results for performance.
 */
export const buildEventMap = cache(
  async (
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, { dayType: string; holidayId: string; name: string }>> => {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    // Get active calendars for the years covered
    const calendars = await prisma.holidayCalendar.findMany({
      where: {
        companyId,
        year: { gte: startYear, lte: endYear },
        isActive: true,
      },
      select: { id: true },
    });

    const calendarIds = calendars.map((c) => c.id);

    // Get all events in the date range
    const events = await prisma.calendarEvent.findMany({
      where: {
        calendarId: { in: calendarIds },
        date: { gte: startDate, lte: endDate },
      },
    });

    // Build lookup map
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
);

/**
 * Default rest days: Saturday (6) and Sunday (0).
 * Note: RestDayRule and EmployeeSchedule tables removed.
 * Rest day determination is now simplified to use defaults.
 */
const DEFAULT_REST_DAYS = [0, 6]; // Sunday and Saturday

/**
 * Get rest day numbers (returns default: Saturday and Sunday).
 * @deprecated Use DEFAULT_REST_DAYS constant directly instead.
 */
export function getRestDayNumbers(_companyId?: string): number[] {
  return DEFAULT_REST_DAYS;
}

/**
 * Resolve day types for a date range.
 * This is the main entry point for attendance computation.
 *
 * @returns Map of date string (YYYY-MM-DD) to DayTypeResolution
 */
export async function resolveDayTypesForRange(
  startDate: Date,
  endDate: Date
): Promise<Map<string, DayTypeResolution>> {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const companyId = auth.user.companyId;

  // Fetch data in parallel
  const [eventMap, restDayNumbers] = await Promise.all([
    buildEventMap(companyId, startDate, endDate),
    getRestDayNumbers(companyId),
  ]);

  // Resolve each date in the range
  const results = new Map<string, DayTypeResolution>();
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split("T")[0];
    const resolution = resolveDayType(currentDate, restDayNumbers, eventMap);
    results.set(dateKey, resolution);

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return results;
}

/**
 * Calculate holiday pay for a regular holiday.
 *
 * Per DOLE: Regular holidays are paid even if not worked, at 100% of daily rate.
 * If worked, the employee receives 200% (double pay).
 *
 * @param dailyRate - Employee's daily rate
 * @param hoursWorked - Hours actually worked (0 if not worked)
 * @param standardHours - Standard work hours (usually 8)
 */
export function calculateRegularHolidayPay(
  dailyRate: number,
  hoursWorked: number,
  standardHours: number = 8
): { basePay: number; holidayPremium: number; total: number } {
  // Base pay: 100% of daily rate (paid regardless of work)
  const basePay = dailyRate;

  if (hoursWorked === 0) {
    // Not worked: just the base pay
    return { basePay, holidayPremium: 0, total: basePay };
  }

  // Worked: additional 100% premium
  const hourlyRate = dailyRate / standardHours;
  const holidayPremium = hourlyRate * hoursWorked; // 100% premium for hours worked

  return {
    basePay,
    holidayPremium,
    total: basePay + holidayPremium,
  };
}

/**
 * Calculate special holiday pay.
 *
 * Per DOLE: Special holidays follow "no work, no pay" unless there's a
 * company policy or CBA that provides otherwise. If worked, 130% of daily rate.
 *
 * @param dailyRate - Employee's daily rate
 * @param hoursWorked - Hours actually worked
 * @param standardHours - Standard work hours (usually 8)
 */
export function calculateSpecialHolidayPay(
  dailyRate: number,
  hoursWorked: number,
  standardHours: number = 8
): { basePay: number; holidayPremium: number; total: number } {
  if (hoursWorked === 0) {
    // Not worked: no pay (no work, no pay rule)
    return { basePay: 0, holidayPremium: 0, total: 0 };
  }

  // Worked: 130% of hourly rate for hours worked
  const hourlyRate = dailyRate / standardHours;
  const basePay = hourlyRate * hoursWorked;
  const holidayPremium = basePay * 0.3; // 30% premium

  return {
    basePay,
    holidayPremium,
    total: basePay + holidayPremium,
  };
}

/**
 * Calculate rest day pay.
 *
 * Per DOLE: Work on rest day is paid at 130% of daily rate.
 *
 * @param dailyRate - Employee's daily rate
 * @param hoursWorked - Hours actually worked
 * @param standardHours - Standard work hours (usually 8)
 */
export function calculateRestDayPay(
  dailyRate: number,
  hoursWorked: number,
  standardHours: number = 8
): { basePay: number; restDayPremium: number; total: number } {
  if (hoursWorked === 0) {
    return { basePay: 0, restDayPremium: 0, total: 0 };
  }

  const hourlyRate = dailyRate / standardHours;
  const basePay = hourlyRate * hoursWorked;
  const restDayPremium = basePay * 0.3; // 30% premium

  return {
    basePay,
    restDayPremium,
    total: basePay + restDayPremium,
  };
}
