// =============================================================================
// PeopleOS PH - Attendance Row Validation
// =============================================================================

import type {
  ParsedAttendanceRow,
  ValidatedAttendanceRow,
  RowValidationError,
  ImportRowStatus,
  AttendanceImportConfig,
  AttendanceType,
  HolidayMap,
} from "./import-types";
import type { EmployeeMatchResult } from "./employee-matcher";
import { setManilaHours } from "@/lib/utils/timezone";

/**
 * Patterns that indicate a rest day / day off in the shift column.
 * Case-insensitive matching.
 */
const REST_DAY_PATTERNS = [
  /^break$/i,
  /^rest$/i,
  /^rest\s*day$/i,
  /^off$/i,
  /^day\s*off$/i,
  /^leave$/i,
  /^holiday$/i,
  /^vacation$/i,
  /^休息$/,  // Chinese for rest
  /^-$/,     // Dash often indicates no work
  /^n\/?a$/i, // N/A
];

/**
 * Check if shift value indicates a rest day.
 */
function isRestDayShift(shift: string | undefined): boolean {
  if (!shift || shift.trim() === "") return false;
  const trimmed = shift.trim();
  return REST_DAY_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Patterns that indicate leave in the attendance result column.
 * Matches "Optional(Leave)", "Leave", etc.
 */
const LEAVE_RESULT_PATTERNS = [
  /^optional\s*\(\s*leave\s*\)/i, // Exact "Optional(Leave)" or "Optional (Leave)"
  /^leave$/i,                     // Just "Leave" by itself
  /\bvacation\b/i,                // Contains "vacation"
  /\bsick\b/i,                    // Contains "sick"
  /\bmaternity\b/i,               // Contains "maternity"
  /\bpaternity\b/i,               // Contains "paternity"
  /\bbereavement\b/i,             // Contains "bereavement"
];

/**
 * Check if attendance result indicates leave.
 */
function isLeaveResult(attendanceResult: string | undefined): boolean {
  if (!attendanceResult || attendanceResult.trim() === "") return false;
  const trimmed = attendanceResult.trim();
  return LEAVE_RESULT_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if attendance result indicates a rest day / break.
 * Matches "Optional(Break)" from Lark.
 */
function isRestDayResult(attendanceResult: string | undefined): boolean {
  if (!attendanceResult || attendanceResult.trim() === "") return false;
  const trimmed = attendanceResult.trim();
  return /^optional\s*\(\s*break\s*\)/i.test(trimmed);
}

/**
 * Check if attendance result indicates no shifts assigned (configuration error).
 * Matches "Optional(No shifts)" from Lark - this should be flagged as an error.
 */
function isNoShiftsResult(attendanceResult: string | undefined): boolean {
  if (!attendanceResult || attendanceResult.trim() === "") return false;
  const trimmed = attendanceResult.trim();
  return /^optional\s*\(\s*no\s*shifts?\s*\)/i.test(trimmed);
}

/**
 * Check if shift column indicates no shifts configured.
 * Matches "No shifts", "No shift" etc. from Lark export.
 */
function isNoShiftsShift(shift: string | undefined): boolean {
  if (!shift || shift.trim() === "") return false;
  const trimmed = shift.trim().toLowerCase();
  return trimmed === "no shifts" || trimmed === "no shift" || /^no\s*shifts?$/i.test(trimmed);
}

/**
 * Check if attendance result indicates "No record" (absent).
 * Matches "No record" from Lark - employee was expected to work but didn't clock in.
 */
function isNoRecordResult(attendanceResult: string | undefined): boolean {
  if (!attendanceResult || attendanceResult.trim() === "") return false;
  const trimmed = attendanceResult.trim();
  return /^no\s*record$/i.test(trimmed);
}

/**
 * Values that indicate "no time" / empty time in the import file.
 * These should not trigger validation errors.
 */
const EMPTY_TIME_VALUES = [
  "-",
  "--",
  "—",  // em dash
  "n/a",
  "na",
  "",
  "none",
  "null",
];

/**
 * Check if a time value should be treated as empty/no data.
 */
function isEmptyTimeValue(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" || EMPTY_TIME_VALUES.includes(trimmed);
}

/**
 * Format a Date object to YYYY-MM-DD string.
 * Uses local date components since parseDate creates dates at noon local time.
 * The holidays map uses UTC keys (from @db.Date), so we need to match that format.
 */
function formatDateKeyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parsed shift information with start, end, and break times.
 */
export interface ParsedShiftInfo {
  /** Original shift string */
  raw: string;
  /** Normalized shift name/code */
  name: string;
  /** Shift start time (HH:MM format) */
  startTime?: string;
  /** Shift end time (HH:MM format) */
  endTime?: string;
  /** Break start time (HH:MM format) - defaults to 13:00 */
  breakStart: string;
  /** Break end time (HH:MM format) - defaults to 14:00 */
  breakEnd: string;
}

/**
 * Parse shift values that may contain redundant time formats.
 * Handles formats like:
 * - "1000-1900 10:00-19:00" (military + standard time)
 * - "900-1800 09:00-18:00"
 * - "1200-2100 12:00-21:00"
 * - "Day Shift"
 * - "10:00-19:00"
 * - "Morning"
 *
 * Returns normalized shift info with extracted times and default break.
 */
export function parseShiftValue(
  shiftStr: string | undefined,
  defaultBreakStart: string = "13:00",
  defaultBreakEnd: string = "14:00"
): ParsedShiftInfo | null {
  if (!shiftStr || shiftStr.trim() === "") {
    return null;
  }

  const raw = shiftStr.trim();
  let startTime: string | undefined;
  let endTime: string | undefined;
  let name = raw;

  // Pattern 1: Military time followed by standard time (e.g., "1000-1900 10:00-19:00")
  // The standard time part is more reliable, so we extract that
  const dualTimePattern = /^(\d{3,4})-(\d{3,4})\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
  const dualMatch = raw.match(dualTimePattern);
  if (dualMatch) {
    const [, , , startHour, startMin, endHour, endMin] = dualMatch;
    startTime = `${startHour.padStart(2, "0")}:${startMin}`;
    endTime = `${endHour.padStart(2, "0")}:${endMin}`;
    name = `${startTime}-${endTime}`;

    return {
      raw,
      name,
      startTime,
      endTime,
      breakStart: defaultBreakStart,
      breakEnd: defaultBreakEnd,
    };
  }

  // Pattern 2: Standard time range only (e.g., "10:00-19:00" or "09:00-18:00")
  const standardTimePattern = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
  const standardMatch = raw.match(standardTimePattern);
  if (standardMatch) {
    const [, startHour, startMin, endHour, endMin] = standardMatch;
    startTime = `${startHour.padStart(2, "0")}:${startMin}`;
    endTime = `${endHour.padStart(2, "0")}:${endMin}`;
    name = `${startTime}-${endTime}`;

    return {
      raw,
      name,
      startTime,
      endTime,
      breakStart: defaultBreakStart,
      breakEnd: defaultBreakEnd,
    };
  }

  // Pattern 3: Military time only (e.g., "1000-1900" or "0900-1800")
  const militaryPattern = /^(\d{3,4})-(\d{3,4})$/;
  const militaryMatch = raw.match(militaryPattern);
  if (militaryMatch) {
    const [, startMilitary, endMilitary] = militaryMatch;
    // Convert military time to HH:MM
    const startPadded = startMilitary.padStart(4, "0");
    const endPadded = endMilitary.padStart(4, "0");
    startTime = `${startPadded.slice(0, 2)}:${startPadded.slice(2)}`;
    endTime = `${endPadded.slice(0, 2)}:${endPadded.slice(2)}`;
    name = `${startTime}-${endTime}`;

    return {
      raw,
      name,
      startTime,
      endTime,
      breakStart: defaultBreakStart,
      breakEnd: defaultBreakEnd,
    };
  }

  // Pattern 4: 12-hour format (e.g., "10:00 AM - 7:00 PM")
  const time12Pattern = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const time12Match = raw.match(time12Pattern);
  if (time12Match) {
    const [, startHourStr, startMin, startPeriod, endHourStr, endMin, endPeriod] = time12Match;
    let startHour = parseInt(startHourStr);
    let endHour = parseInt(endHourStr);

    // Convert to 24-hour
    if (startPeriod.toUpperCase() === "PM" && startHour !== 12) startHour += 12;
    if (startPeriod.toUpperCase() === "AM" && startHour === 12) startHour = 0;
    if (endPeriod.toUpperCase() === "PM" && endHour !== 12) endHour += 12;
    if (endPeriod.toUpperCase() === "AM" && endHour === 12) endHour = 0;

    startTime = `${startHour.toString().padStart(2, "0")}:${startMin}`;
    endTime = `${endHour.toString().padStart(2, "0")}:${endMin}`;
    name = `${startTime}-${endTime}`;

    return {
      raw,
      name,
      startTime,
      endTime,
      breakStart: defaultBreakStart,
      breakEnd: defaultBreakEnd,
    };
  }

  // No time pattern matched - return as-is with just the name
  return {
    raw,
    name: raw,
    startTime: undefined,
    endTime: undefined,
    breakStart: defaultBreakStart,
    breakEnd: defaultBreakEnd,
  };
}

/**
 * Parse a date string into a Date object.
 * Supports common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY, etc.
 * Also handles Excel date serial numbers and full ISO datetime strings.
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(cleaned)) {
    // Extract just the date part if it's a full ISO datetime
    const datePart = cleaned.split("T")[0];
    const parts = datePart.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      // Create date in local timezone (not UTC) to avoid off-by-one errors
      const date = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid DST issues
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Try MM/DD/YYYY (US format)
  const usFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const usMatch = cleaned.match(usFormat);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD/MM/YYYY (European format with slashes - if first number > 12)
  const slashFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const slashMatch = cleaned.match(slashFormat);
  if (slashMatch && parseInt(slashMatch[1]) > 12) {
    // First number > 12 means it must be day (European format)
    const [, day, month, year] = slashMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD-MM-YYYY (European format with dashes)
  const euDashFormat = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  const euDashMatch = cleaned.match(euDashFormat);
  if (euDashMatch) {
    const [, day, month, year] = euDashMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD.MM.YYYY (European format with dots)
  const euDotFormat = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
  const euDotMatch = cleaned.match(euDotFormat);
  if (euDotMatch) {
    const [, day, month, year] = euDotMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY/MM/DD (alternative ISO-like format)
  const altIsoFormat = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
  const altIsoMatch = cleaned.match(altIsoFormat);
  if (altIsoMatch) {
    const [, year, month, day] = altIsoMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Try month name formats (Jan 15, 2024 or 15 Jan 2024 or January 15, 2024)
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // Month Day, Year (e.g., "Jan 15, 2024" or "January 15, 2024")
  const monthNameFormat1 = /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/i;
  const monthMatch1 = cleaned.match(monthNameFormat1);
  if (monthMatch1) {
    const [, monthName, day, year] = monthMatch1;
    const monthIndex = monthNames.findIndex(m => monthName.toLowerCase().startsWith(m));
    if (monthIndex !== -1) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day), 12, 0, 0);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Day Month Year (e.g., "15 Jan 2024" or "15 January 2024")
  const monthNameFormat2 = /^(\d{1,2})\s+([a-zA-Z]+),?\s+(\d{4})$/i;
  const monthMatch2 = cleaned.match(monthNameFormat2);
  if (monthMatch2) {
    const [, day, monthName, year] = monthMatch2;
    const monthIndex = monthNames.findIndex(m => monthName.toLowerCase().startsWith(m));
    if (monthIndex !== -1) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day), 12, 0, 0);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Check if it's a numeric value (Excel serial date that came through as string)
  const numericValue = parseFloat(cleaned);
  if (!isNaN(numericValue) && numericValue > 0 && numericValue < 100000) {
    // Convert Excel serial date to JS Date
    // Excel serial date: days since 1899-12-30 (with leap year bug consideration)
    // 25569 is the number of days from 1899-12-30 to 1970-01-01
    const date = new Date((numericValue - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) return date;
  }

  // Try natural language date as last resort
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) return date;

  return null;
}

/**
 * Parse a time string into a Date object with the given date.
 */
export function parseTime(timeStr: string, baseDate: Date): Date | null {
  if (!timeStr) return null;

  const cleaned = timeStr.trim().toUpperCase();

  // Try 24-hour format (HH:MM or HH:MM:SS)
  const time24 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
  const match24 = cleaned.match(time24);
  if (match24) {
    const [, hours, minutes, seconds = "0"] = match24;
    // Use Manila timezone utility for consistent time handling
    return setManilaHours(new Date(baseDate), parseInt(hours), parseInt(minutes), parseInt(seconds));
  }

  // Try 12-hour format (HH:MM AM/PM)
  const time12 = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/;
  const match12 = cleaned.match(time12);
  if (match12) {
    const [, hoursStr, minutes, seconds = "0", period] = match12;
    let hours = parseInt(hoursStr);

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    // Use Manila timezone utility for consistent time handling
    return setManilaHours(new Date(baseDate), hours, parseInt(minutes), parseInt(seconds));
  }

  return null;
}

/**
 * Validate a single parsed row.
 * @param row - The parsed row from the import file
 * @param matchResult - The employee matching result
 * @param config - Import configuration
 * @param holidays - Map of date strings (YYYY-MM-DD) to holiday info for detecting holidays
 */
export function validateRow(
  row: ParsedAttendanceRow,
  matchResult: EmployeeMatchResult,
  config: AttendanceImportConfig,
  holidays?: HolidayMap
): ValidatedAttendanceRow {
  const errors: RowValidationError[] = [];
  const warnings: RowValidationError[] = [];

  // Validate employee identifier
  const hasCode = row.employeeCode && row.employeeCode.trim() !== "";
  const hasEmail = row.employeeEmail && row.employeeEmail.trim() !== "";
  const hasName = row.employeeName && row.employeeName.trim() !== "";

  if (!hasCode && !hasEmail && !hasName) {
    errors.push({
      field: "employee",
      code: "MISSING_EMPLOYEE_IDENTIFIER",
      message: "No employee identifier (code, email, or name)",
      severity: "error",
    });
  }

  // Validate date
  let parsedDate: Date | undefined;
  if (!row.date) {
    errors.push({
      field: "date",
      code: "MISSING_DATE",
      message: "Date is required",
      severity: "error",
    });
  } else {
    const parsed = parseDate(row.date);
    if (!parsed) {
      errors.push({
        field: "date",
        code: "INVALID_DATE",
        message: `Invalid date format: ${row.date}`,
        severity: "error",
      });
    } else {
      parsedDate = parsed;

      // Check date is not too far in the future
      const maxFutureDate = new Date();
      maxFutureDate.setMonth(maxFutureDate.getMonth() + 1);
      if (parsed > maxFutureDate) {
        warnings.push({
          field: "date",
          code: "FUTURE_DATE",
          message: "Date is more than 1 month in the future",
          severity: "warning",
        });
      }

      // Check date is not too old
      const minPastDate = new Date();
      minPastDate.setFullYear(minPastDate.getFullYear() - 2);
      if (parsed < minPastDate) {
        warnings.push({
          field: "date",
          code: "OLD_DATE",
          message: "Date is more than 2 years in the past",
          severity: "warning",
        });
      }
    }
  }

  // Validate times
  let parsedTimeIn: Date | undefined;
  let parsedTimeOut: Date | undefined;

  // Check if time values should be treated as empty (e.g., "-", "n/a")
  const timeInIsEmpty = isEmptyTimeValue(row.timeIn);
  const timeOutIsEmpty = isEmptyTimeValue(row.timeOut);

  if (parsedDate) {
    // Only validate timeIn if it has a real value (not empty placeholder)
    if (row.timeIn && !timeInIsEmpty) {
      const parsed = parseTime(row.timeIn, parsedDate);
      if (!parsed) {
        errors.push({
          field: "timeIn",
          code: "INVALID_TIME_IN",
          message: `Invalid time in format: ${row.timeIn}`,
          severity: "error",
        });
      } else {
        parsedTimeIn = parsed;
      }
    }

    // Only validate timeOut if it has a real value (not empty placeholder)
    if (row.timeOut && !timeOutIsEmpty) {
      const parsed = parseTime(row.timeOut, parsedDate);
      if (!parsed) {
        errors.push({
          field: "timeOut",
          code: "INVALID_TIME_OUT",
          message: `Invalid time out format: ${row.timeOut}`,
          severity: "error",
        });
      } else {
        parsedTimeOut = parsed;

        // Handle overnight shifts (time out is next day)
        if (parsedTimeIn && parsedTimeOut < parsedTimeIn) {
          parsedTimeOut = new Date(parsedTimeOut);
          parsedTimeOut.setDate(parsedTimeOut.getDate() + 1);
        }
      }
    }
  }

  // Determine attendance type based on time data, shift, and attendance result
  let attendanceType: AttendanceType = "PRESENT";
  let holidayName: string | undefined;
  // Consider time as "no data" if empty or placeholder values like "-"
  const hasNoTimeData = timeInIsEmpty && timeOutIsEmpty;

  // Check if this date is a holiday
  let isHolidayDate = false;
  let holidayInfo: { name: string; dayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" } | undefined;
  if (parsedDate && holidays) {
    // Use local date components since parseDate creates dates at noon local time
    // This ensures we match the YYYY-MM-DD format used in the holidays map
    const dateKey = formatDateKeyLocal(parsedDate);
    holidayInfo = holidays.get(dateKey);
    if (holidayInfo) {
      isHolidayDate = true;
      // Always set holidayName for reference, even if employee worked on the holiday
      holidayName = holidayInfo.name;
    }
  }

  // First check for "No shifts" configuration error - this should be an error
  // regardless of whether there's time data
  // Check both the attendanceResult column AND the shift column for "No shifts"
  if (isNoShiftsResult(row.attendanceResult) || isNoShiftsShift(row.shift)) {
    errors.push({
      field: "shift",
      code: "NO_SHIFTS_CONFIGURED",
      message: `No shift configured in Lark for this employee on this date. Please update the shift schedule in Lark and re-export.`,
      severity: "error",
    });
  }

  if (hasNoTimeData) {
    // Priority 1: Check attendance result for "Optional(Leave)" - On Leave
    if (isLeaveResult(row.attendanceResult)) {
      attendanceType = "ON_LEAVE";
      warnings.push({
        field: "time",
        code: "ON_LEAVE",
        message: `On leave - ${row.attendanceResult}`,
        severity: "warning",
      });
    }
    // Priority 2: Check if this date is a holiday from company calendar
    // Holiday takes priority over rest day (Optional(Break)) since holiday pay rules apply
    else if (isHolidayDate && holidayInfo) {
      attendanceType = holidayInfo.dayType; // "REGULAR_HOLIDAY" or "SPECIAL_HOLIDAY"
      warnings.push({
        field: "time",
        code: holidayInfo.dayType,
        message: `${holidayInfo.dayType === "REGULAR_HOLIDAY" ? "Regular Holiday" : "Special Holiday"}: ${holidayInfo.name}`,
        severity: "warning",
      });
    }
    // Priority 3: Check attendance result for "Optional(Break)" - Rest Day
    else if (isRestDayResult(row.attendanceResult)) {
      attendanceType = "REST_DAY";
      warnings.push({
        field: "time",
        code: "REST_DAY",
        message: `Rest day (break) - ${row.attendanceResult}`,
        severity: "warning",
      });
    }
    // Priority 4: Check attendance result for "No record" - Absent (expected to work but didn't)
    else if (isNoRecordResult(row.attendanceResult)) {
      attendanceType = "ABSENT";
      warnings.push({
        field: "time",
        code: "ABSENT",
        message: "No record - employee was expected to work but did not clock in",
        severity: "warning",
      });
    }
    // Priority 5: Check shift column for rest day indicators
    else if (isRestDayShift(row.shift)) {
      attendanceType = "REST_DAY";
      warnings.push({
        field: "time",
        code: "REST_DAY",
        message: "Rest day - no attendance expected",
        severity: "warning",
      });
    }
    // Priority 6: Has a shift but no time data and no special result = absent
    else if (row.shift && row.shift.trim() !== "") {
      attendanceType = "ABSENT";
      warnings.push({
        field: "time",
        code: "ABSENT",
        message: "No time in/out recorded - marked as absent",
        severity: "warning",
      });
    }
    // Priority 7: No shift and no time data = could be unscheduled day, treat as no data
    else {
      attendanceType = "ABSENT";
      warnings.push({
        field: "time",
        code: "NO_DATA",
        message: "No shift and no time data",
        severity: "warning",
      });
    }
  }

  // Validate employee match
  if (!matchResult.employeeId) {
    if (matchResult.ambiguousMatches && matchResult.ambiguousMatches.length > 0) {
      errors.push({
        field: "employee",
        code: "AMBIGUOUS_MATCH",
        message: `Multiple employees match: ${matchResult.ambiguousMatches
          .map((m) => m.name)
          .join(", ")}`,
        severity: "error",
      });
    } else {
      errors.push({
        field: "employee",
        code: "NO_MATCH",
        message: `No matching employee found for: ${row.employeeCode || row.employeeName || row.employeeEmail}`,
        severity: "error",
      });
    }
  } else if (matchResult.confidence < 1.0) {
    warnings.push({
      field: "employee",
      code: "FUZZY_MATCH",
      message: `Employee matched by name with ${Math.round(matchResult.confidence * 100)}% confidence`,
      severity: "warning",
    });
  }

  // Parse shift value to extract times and normalize format
  const parsedShift = parseShiftValue(row.shift);

  // Determine status
  let status: ImportRowStatus = "VALID";
  if (errors.length > 0) {
    status = "INVALID";
  } else if (hasNoTimeData && config.skipEmptyTimes && !config.createAbsentRecords) {
    // Only skip if explicitly configured to skip AND not creating absent records
    status = "SKIPPED";
  }
  // Otherwise, rows with no time data are VALID (will be processed as absent/rest day)

  return {
    rowNumber: row.rowNumber,
    rawData: row.rawData,
    employeeCode: row.employeeCode || "",
    employeeName: row.employeeName,
    date: parsedDate || new Date(),
    timeIn: parsedTimeIn,
    timeOut: parsedTimeOut,
    shift: parsedShift?.name || row.shift,
    remarks: row.remarks,
    attendanceResult: row.attendanceResult, // Original Lark result
    // Include parsed shift information
    shiftStartTime: parsedShift?.startTime,
    shiftEndTime: parsedShift?.endTime,
    breakStartTime: parsedShift?.breakStart,
    breakEndTime: parsedShift?.breakEnd,
    // Attendance type
    attendanceType,
    holidayName, // Name of the holiday if it's a holiday
    matchedEmployeeId: matchResult.employeeId || undefined,
    matchedEmployeeName: matchResult.employeeName || undefined,
    matchConfidence: matchResult.confidence,
    status,
    errors,
    warnings,
  };
}

/**
 * Batch validate rows.
 * @param rows - Array of parsed rows from the import file
 * @param matchResults - Array of employee matching results (same order as rows)
 * @param config - Import configuration
 * @param holidays - Map of date strings (YYYY-MM-DD) to holiday info for detecting holidays
 */
export function validateRows(
  rows: ParsedAttendanceRow[],
  matchResults: EmployeeMatchResult[],
  config: AttendanceImportConfig,
  holidays?: HolidayMap
): ValidatedAttendanceRow[] {
  return rows.map((row, index) =>
    validateRow(row, matchResults[index], config, holidays)
  );
}

/**
 * Generate error and warning summary.
 */
export function generateValidationSummary(rows: ValidatedAttendanceRow[]): {
  errorSummary: Record<string, number>;
  warningSummary: Record<string, number>;
} {
  const errorSummary: Record<string, number> = {};
  const warningSummary: Record<string, number> = {};

  for (const row of rows) {
    for (const error of row.errors) {
      errorSummary[error.code] = (errorSummary[error.code] || 0) + 1;
    }
    for (const warning of row.warnings) {
      warningSummary[warning.code] = (warningSummary[warning.code] || 0) + 1;
    }
  }

  return { errorSummary, warningSummary };
}
