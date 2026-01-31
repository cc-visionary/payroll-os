// =============================================================================
// PeopleOS PH - Attendance Import Types
// =============================================================================

/**
 * Holiday info for a specific date.
 * Used during import to detect holidays from the company calendar.
 */
export interface HolidayInfo {
  name: string;
  dayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";
}

/**
 * Map of date strings (YYYY-MM-DD) to holiday info.
 */
export type HolidayMap = Map<string, HolidayInfo>;

/**
 * Standard column mapping for attendance import.
 * Supports both biometric exports and manual attendance sheets.
 */
export interface AttendanceColumnMapping {
  /** Column containing employee identifier (employee code/number) */
  employeeCode?: string;
  /** Column containing employee email (alternative matching) */
  employeeEmail?: string;
  /** Column containing employee name (for display/matching) */
  employeeName?: string;
  /** Column containing attendance date */
  date: string;
  /** Column containing clock-in time */
  timeIn?: string;
  /** Column containing clock-out time */
  timeOut?: string;
  /** Column containing shift name/code (optional) */
  shift?: string;
  /** Column containing attendance result (e.g., "Optional (Leave)") */
  attendanceResult?: string;
  /** Column containing remarks/notes */
  remarks?: string;
}

/**
 * Parsed row from import file before validation.
 */
export interface ParsedAttendanceRow {
  rowNumber: number;
  rawData: Record<string, unknown>;

  // Extracted fields
  employeeCode?: string;
  employeeEmail?: string;
  employeeName?: string;
  date?: string;
  timeIn?: string;
  timeOut?: string;
  shift?: string;
  attendanceResult?: string;
  remarks?: string;
}

/**
 * Validation error for a row.
 */
export interface RowValidationError {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Row status after validation and employee matching.
 */
export type ImportRowStatus =
  | "PENDING"
  | "VALID"
  | "INVALID"
  | "DUPLICATE"
  | "SKIPPED";

/**
 * Attendance type for rows without time in/out.
 */
export type AttendanceType =
  | "PRESENT"          // Has time in/out
  | "ABSENT"           // No time in/out but has scheduled shift
  | "REST_DAY"         // No time in/out and shift indicates rest/break/off
  | "ON_LEAVE"         // No time in/out and attendance result indicates leave
  | "REGULAR_HOLIDAY"  // No time in/out and date is a regular holiday
  | "SPECIAL_HOLIDAY"; // No time in/out and date is a special holiday

/**
 * Validated row ready for processing.
 */
export interface ValidatedAttendanceRow {
  rowNumber: number;
  rawData: Record<string, unknown>;

  // Parsed and validated fields
  employeeCode: string;
  employeeName?: string;
  date: Date;
  timeIn?: Date;
  timeOut?: Date;
  shift?: string;
  remarks?: string;
  attendanceResult?: string; // Original Lark result (e.g., "No record", "Optional(Break)")

  // Parsed shift information
  shiftStartTime?: string;  // HH:MM format
  shiftEndTime?: string;    // HH:MM format
  breakStartTime?: string;  // HH:MM format (default: 13:00)
  breakEndTime?: string;    // HH:MM format (default: 14:00)

  // Matched shift template (null for "-" or rest day shifts)
  shiftTemplateId?: string;

  // Attendance type (for rows without time data)
  attendanceType: AttendanceType;
  holidayName?: string; // Name of the holiday if it's a holiday (e.g., "New Year's Day")

  // Matching result
  matchedEmployeeId?: string;
  matchedEmployeeName?: string;
  matchConfidence: number;

  // Validation
  status: ImportRowStatus;
  errors: RowValidationError[];
  warnings: RowValidationError[];
}

/**
 * Import preview result before committing.
 */
export interface ImportPreviewResult {
  importId: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  warningRows: number;

  // Sample of rows for review (first 50)
  sampleRows: ValidatedAttendanceRow[];

  // All validated rows for commit (includes all rows, not just sample)
  allValidatedRows: ValidatedAttendanceRow[];

  // Summary of errors
  errorSummary: Record<string, number>;
  warningSummary: Record<string, number>;

  // Employee matching summary
  matchedEmployees: number;
  unmatchedEmployees: number;
  ambiguousMatches: number;
}

/**
 * Import commit result.
 */
export interface ImportCommitResult {
  success: boolean;
  importId: string;
  rowsProcessed: number;
  createdTimeLogs: number;
  updatedAttendanceRecords: number;
  skippedDuplicates: number;
  errors: string[];
}

/**
 * Duplicate detection strategy.
 */
export type DuplicateStrategy =
  | "SKIP"      // Skip rows that duplicate existing records
  | "REPLACE"   // Replace existing records with new data
  | "ERROR";    // Fail import if duplicates detected

/**
 * Employee matching rule configuration.
 */
export interface EmployeeMatchingConfig {
  /** Primary matching field */
  primaryMatch: "employeeCode" | "employeeEmail";
  /** Allow fallback to name matching */
  allowNameFallback: boolean;
  /** Minimum confidence for name matching (0.0 - 1.0) */
  nameMatchThreshold: number;
  /** Require exact match (no fuzzy matching) */
  requireExactMatch: boolean;
}

/**
 * Import configuration.
 */
export interface AttendanceImportConfig {
  columnMapping: AttendanceColumnMapping;
  employeeMatching: EmployeeMatchingConfig;
  duplicateStrategy: DuplicateStrategy;

  /** Date format for parsing (e.g., "YYYY-MM-DD", "MM/DD/YYYY") */
  dateFormat?: string;
  /** Time format for parsing (e.g., "HH:mm", "hh:mm A") */
  timeFormat?: string;
  /** Skip rows without time data */
  skipEmptyTimes: boolean;
  /** Create absent records for matched employees with no time data */
  createAbsentRecords: boolean;
}

/**
 * Default import configuration.
 */
export const DEFAULT_IMPORT_CONFIG: AttendanceImportConfig = {
  columnMapping: {
    employeeCode: "Employee ID",
    date: "Date",
    timeIn: "Time In",
    timeOut: "Time Out",
    shift: "Shift",
  },
  employeeMatching: {
    primaryMatch: "employeeCode",
    allowNameFallback: false,
    nameMatchThreshold: 0.85,
    requireExactMatch: true,
  },
  duplicateStrategy: "SKIP",
  skipEmptyTimes: false,  // Don't skip - detect as absent/rest day instead
  createAbsentRecords: true,  // Create records for absent/rest days
};
