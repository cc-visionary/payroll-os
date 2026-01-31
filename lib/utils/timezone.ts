/**
 * Manila Timezone Utilities
 *
 * This module provides timezone-agnostic date/time handling for the Philippine
 * payroll system. All schedule times (shift start/end, break times) are stored
 * as UTC values but represent Manila local time (UTC+8).
 *
 * Key functions:
 * - setManilaHours(): Set hours on a date using Manila time (works in any server timezone)
 * - getManilaHours(): Get hours from a date in Manila time
 * - toManilaDate(): Convert a UTC date to Manila local time representation
 * - buildScheduleDate(): Build a full datetime from attendanceDate + schedule time
 */

/**
 * Manila timezone offset in hours (UTC+8)
 * Philippines does not observe daylight saving time, so this is constant.
 */
export const MANILA_OFFSET_HOURS = 8;

/**
 * Manila timezone offset in milliseconds
 */
export const MANILA_OFFSET_MS = MANILA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Set hours on a date using Manila time, regardless of server timezone.
 *
 * This is the timezone-agnostic replacement for date.setHours() when working
 * with schedule times that represent Manila local time.
 *
 * @param date - The base date to modify (will be mutated)
 * @param hours - Hours in Manila time (0-23)
 * @param minutes - Minutes (0-59)
 * @param seconds - Seconds (0-59), default 0
 * @param ms - Milliseconds (0-999), default 0
 * @returns The modified date
 *
 * @example
 * // Set to 9:30 AM Manila time
 * const schedStart = setManilaHours(new Date(attendanceDate), 9, 30);
 * // Result: 01:30 UTC (9:30 Manila = 01:30 UTC)
 */
export function setManilaHours(
  date: Date,
  hours: number,
  minutes: number = 0,
  seconds: number = 0,
  ms: number = 0
): Date {
  // Convert Manila local time to UTC by subtracting the offset
  // 9:30 Manila = 1:30 UTC (subtract 8 hours)
  date.setUTCHours(hours - MANILA_OFFSET_HOURS, minutes, seconds, ms);
  return date;
}

/**
 * Get the hours component of a date in Manila time.
 *
 * @param date - The date to extract hours from
 * @returns Hours in Manila time (0-23)
 *
 * @example
 * const utcDate = new Date("2026-01-14T06:02:00Z"); // 2:02 PM Manila
 * getManilaHours(utcDate); // Returns 14
 */
export function getManilaHours(date: Date): number {
  return (date.getUTCHours() + MANILA_OFFSET_HOURS) % 24;
}

/**
 * Get the minutes component of a date.
 * (Minutes are the same in all timezones)
 */
export function getManilaMinutes(date: Date): number {
  return date.getUTCMinutes();
}

/**
 * Build a schedule datetime from an attendance date and schedule time.
 *
 * This combines:
 * - The date portion from attendanceDate
 * - The time portion from scheduleTime (interpreted as Manila local time)
 *
 * @param attendanceDate - The date of attendance (typically midnight UTC)
 * @param scheduleTime - Schedule time stored as Date (e.g., 1970-01-01T09:30:00Z for 9:30 AM)
 * @returns A new Date representing the schedule time on that attendance date in UTC
 *
 * @example
 * const attendanceDate = new Date("2026-01-14T00:00:00Z");
 * const shiftStart = new Date("1970-01-01T09:30:00Z"); // 9:30 AM
 * const schedStart = buildScheduleDate(attendanceDate, shiftStart);
 * // Result: 2026-01-14T01:30:00Z (9:30 AM Manila = 1:30 AM UTC)
 */
export function buildScheduleDate(
  attendanceDate: Date,
  scheduleTime: Date | string | null
): Date | null {
  if (!scheduleTime) return null;

  const schedTime = typeof scheduleTime === "string" ? new Date(scheduleTime) : scheduleTime;
  const hours = schedTime.getUTCHours();
  const minutes = schedTime.getUTCMinutes();

  const result = new Date(attendanceDate);
  setManilaHours(result, hours, minutes, 0, 0);

  return result;
}

/**
 * Build schedule start and end dates with overnight shift handling.
 *
 * @param attendanceDate - The date of attendance
 * @param startTime - Schedule start time (as stored in DB)
 * @param endTime - Schedule end time (as stored in DB)
 * @returns Object with schedStart and schedEnd dates, or null if times are missing
 */
export function buildScheduleRange(
  attendanceDate: Date,
  startTime: Date | string | null,
  endTime: Date | string | null
): { schedStart: Date; schedEnd: Date } | null {
  if (!startTime || !endTime) return null;

  const startTimeDate = typeof startTime === "string" ? new Date(startTime) : startTime;
  const endTimeDate = typeof endTime === "string" ? new Date(endTime) : endTime;

  const startH = startTimeDate.getUTCHours();
  const startM = startTimeDate.getUTCMinutes();
  const endH = endTimeDate.getUTCHours();
  const endM = endTimeDate.getUTCMinutes();

  const schedStart = new Date(attendanceDate);
  setManilaHours(schedStart, startH, startM, 0, 0);

  const schedEnd = new Date(attendanceDate);
  setManilaHours(schedEnd, endH, endM, 0, 0);

  // Handle overnight shifts (end time is next day)
  // Check if end hour (in Manila time) is before start hour
  if (endH < startH || (endH === startH && endM < startM)) {
    schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
  }

  return { schedStart, schedEnd };
}

/**
 * Format a date's time component in Manila timezone.
 *
 * @param date - The date to format
 * @returns Time string in HH:MM format (Manila time)
 */
export function formatManilaTime(date: Date | null): string {
  if (!date) return "";
  const hours = getManilaHours(date);
  const minutes = getManilaMinutes(date);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Parse a time string (HH:MM) and return hours and minutes.
 *
 * @param timeStr - Time string in HH:MM format
 * @returns Object with hours and minutes, or null if invalid
 */
export function parseTimeString(timeStr: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return {
    hours: parseInt(match[1], 10),
    minutes: parseInt(match[2], 10),
  };
}

/**
 * Calculate late minutes between clock-in time and schedule start.
 *
 * @param clockIn - Actual clock-in time (UTC)
 * @param schedStart - Scheduled start time (UTC, converted from Manila time)
 * @returns Late minutes (0 if on time or early)
 */
export function calculateLateMinutes(clockIn: Date, schedStart: Date): number {
  if (clockIn <= schedStart) return 0;
  return Math.round((clockIn.getTime() - schedStart.getTime()) / (1000 * 60));
}

/**
 * Calculate undertime minutes between clock-out time and schedule end.
 *
 * @param clockOut - Actual clock-out time (UTC)
 * @param schedEnd - Scheduled end time (UTC, converted from Manila time)
 * @returns Undertime minutes (0 if on time or late)
 */
export function calculateUndertimeMinutes(clockOut: Date, schedEnd: Date): number {
  if (clockOut >= schedEnd) return 0;
  return Math.round((schedEnd.getTime() - clockOut.getTime()) / (1000 * 60));
}

/**
 * Calculate overtime minutes (early clock-in).
 *
 * @param clockIn - Actual clock-in time (UTC)
 * @param schedStart - Scheduled start time (UTC)
 * @param approved - Whether early-in OT is approved
 * @returns OT minutes (0 if not approved or not early)
 */
export function calculateEarlyInOT(
  clockIn: Date,
  schedStart: Date,
  approved: boolean
): number {
  if (!approved || clockIn >= schedStart) return 0;
  return Math.round((schedStart.getTime() - clockIn.getTime()) / (1000 * 60));
}

/**
 * Calculate overtime minutes (late clock-out).
 *
 * @param clockOut - Actual clock-out time (UTC)
 * @param schedEnd - Scheduled end time (UTC)
 * @param approved - Whether late-out OT is approved
 * @returns OT minutes (0 if not approved or not late)
 */
export function calculateLateOutOT(
  clockOut: Date,
  schedEnd: Date,
  approved: boolean
): number {
  if (!approved || clockOut <= schedEnd) return 0;
  return Math.round((clockOut.getTime() - schedEnd.getTime()) / (1000 * 60));
}

/**
 * Get the start of day in Manila time for a given date.
 *
 * @param date - Any date
 * @returns Date representing midnight Manila time
 */
export function startOfManilaDay(date: Date): Date {
  const result = new Date(date);
  // Set to midnight Manila time (16:00 previous day UTC)
  result.setUTCHours(-MANILA_OFFSET_HOURS, 0, 0, 0);
  return result;
}

/**
 * Check if two dates are the same day in Manila timezone.
 */
export function isSameManilaDay(date1: Date, date2: Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Convert to Manila time by adding offset
  d1.setUTCHours(d1.getUTCHours() + MANILA_OFFSET_HOURS);
  d2.setUTCHours(d2.getUTCHours() + MANILA_OFFSET_HOURS);

  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

/**
 * Extract hours and minutes from a TIME value.
 *
 * Handles both Date objects and string formats from Prisma/PostgreSQL.
 * When using @prisma/adapter-pg, TIME columns may be returned as strings
 * like "09:00:00" instead of Date objects.
 *
 * @param time - TIME value as Date object or string
 * @returns Object with hours and minutes, or null if invalid
 *
 * @example
 * // Date object (1970-01-01T09:00:00Z - hours stored as UTC)
 * extractTimeComponents(new Date("1970-01-01T09:00:00Z")) // { hours: 9, minutes: 0 }
 *
 * // String format from PostgreSQL
 * extractTimeComponents("09:00:00") // { hours: 9, minutes: 0 }
 */
export function extractTimeComponents(
  time: Date | string | null | undefined
): { hours: number; minutes: number } | null {
  if (!time) return null;

  // Handle string format (e.g., "09:00:00" or "09:00")
  if (typeof time === "string") {
    const parts = time.split(":");
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        return { hours, minutes };
      }
    }
    return null;
  }

  // Handle Date object - extract UTC hours/minutes
  // TIME values are stored with hours in UTC position
  if (time instanceof Date && !isNaN(time.getTime())) {
    return {
      hours: time.getUTCHours(),
      minutes: time.getUTCMinutes(),
    };
  }

  return null;
}

/**
 * Result of attendance time calculations
 */
export interface AttendanceTimeCalc {
  lateMinutes: number;
  undertimeMinutes: number;
  otEarlyInMinutes: number;
  otLateOutMinutes: number;
}

/**
 * Calculate late, undertime, and overtime from clock times and schedule.
 *
 * This is the single source of truth for attendance time calculations.
 * It handles both Date objects and string formats for scheduled times
 * (PostgreSQL TIME columns via @prisma/adapter-pg may return as strings).
 *
 * @param actualTimeIn - Clock in time (full timestamp with timezone)
 * @param actualTimeOut - Clock out time (full timestamp with timezone)
 * @param scheduledStartTime - Schedule start (TIME value, may be Date or string)
 * @param scheduledEndTime - Schedule end (TIME value, may be Date or string)
 * @param attendanceDate - The date of attendance (for building schedule datetime)
 * @param earlyInApproved - Whether early clock-in is approved as OT
 * @param lateOutApproved - Whether late clock-out is approved as OT
 * @returns Calculated late, undertime, and OT minutes
 */
export function calculateAttendanceTimes(
  actualTimeIn: Date | null,
  actualTimeOut: Date | null,
  scheduledStartTime: Date | string | null,
  scheduledEndTime: Date | string | null,
  attendanceDate: Date,
  earlyInApproved: boolean,
  lateOutApproved: boolean,
  // Break override info - when break is reduced/removed, adjust schedule accordingly
  shiftBreakMinutes?: number,
  breakMinutesApplied?: number | null
): AttendanceTimeCalc {
  const result: AttendanceTimeCalc = {
    lateMinutes: 0,
    undertimeMinutes: 0,
    otEarlyInMinutes: 0,
    otLateOutMinutes: 0,
  };

  // Need all inputs to calculate
  if (!actualTimeIn || !actualTimeOut || !scheduledStartTime || !scheduledEndTime) {
    return result;
  }

  // Extract schedule time components (handles both Date and string)
  const startComponents = extractTimeComponents(scheduledStartTime);
  const endComponents = extractTimeComponents(scheduledEndTime);

  if (!startComponents || !endComponents) {
    return result;
  }

  // Build full datetime from clock times
  const clockIn = new Date(actualTimeIn);
  const clockOut = new Date(actualTimeOut);

  // Build schedule datetimes using attendance date as base
  const schedStart = setManilaHours(
    new Date(attendanceDate),
    startComponents.hours,
    startComponents.minutes
  );
  const schedEnd = setManilaHours(
    new Date(attendanceDate),
    endComponents.hours,
    endComponents.minutes
  );

  // Handle overnight shifts (end time is next day)
  if (endComponents.hours < startComponents.hours) {
    schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
  }

  // Calculate break adjustment - if break is reduced/removed, the effective schedule changes
  // e.g., 9AM-6PM with 60min break = 8 hours expected work
  // If break = 0, leaving at 5PM still completes 8 hours of work (no undertime)
  let breakAdjustmentMinutes = 0;
  if (shiftBreakMinutes !== undefined && breakMinutesApplied !== null && breakMinutesApplied !== undefined) {
    // Break was explicitly overridden - calculate the difference
    breakAdjustmentMinutes = shiftBreakMinutes - breakMinutesApplied;
  }

  // Calculate late (clock in after schedule start)
  // NOTE: Break adjustment should NOT be applied to late minutes.
  // Being late in the morning has nothing to do with whether lunch break was taken.
  // Break adjustment only applies to undertime (leaving early).
  if (clockIn > schedStart) {
    const lateMinutes = Math.round(
      (clockIn.getTime() - schedStart.getTime()) / (1000 * 60)
    );
    result.lateMinutes = lateMinutes;
  } else if (clockIn < schedStart && earlyInApproved) {
    // Early In OT (only if approved)
    result.otEarlyInMinutes = Math.round(
      (schedStart.getTime() - clockIn.getTime()) / (1000 * 60)
    );
  }

  // Calculate undertime (clock out before schedule end)
  if (clockOut < schedEnd) {
    let undertimeMinutes = Math.round(
      (schedEnd.getTime() - clockOut.getTime()) / (1000 * 60)
    );
    // If break was reduced/removed, reduce undertime by that amount
    // (because schedule window included break time that's no longer applicable)
    if (breakAdjustmentMinutes > 0) {
      undertimeMinutes = Math.max(0, undertimeMinutes - breakAdjustmentMinutes);
    }
    result.undertimeMinutes = undertimeMinutes;
  } else if (clockOut > schedEnd && lateOutApproved) {
    // Late Out OT (only if approved)
    result.otLateOutMinutes = Math.round(
      (clockOut.getTime() - schedEnd.getTime()) / (1000 * 60)
    );
  }

  return result;
}
