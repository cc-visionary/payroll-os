"use server";

// =============================================================================
// PeopleOS PH - Attendance Import Server Actions
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import type {
  AttendanceImportConfig,
  AttendanceColumnMapping,
  ValidatedAttendanceRow,
  ImportPreviewResult,
  ImportCommitResult,
  DuplicateStrategy,
  HolidayMap,
} from "@/lib/attendance/import-types";
import { DEFAULT_IMPORT_CONFIG } from "@/lib/attendance/import-types";
import {
  batchMatchEmployees,
  loadMatchableEmployees,
  buildMatchIndexes,
} from "@/lib/attendance/employee-matcher";
import {
  validateRows,
  generateValidationSummary,
  parseDate,
  parseTime,
} from "@/lib/attendance/row-validator";
import crypto from "crypto";
import { headers } from "next/headers";

/**
 * Truncate a string to a maximum length to prevent database column overflow.
 */
function truncateString(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return value;
  return value.length > maxLength ? value.substring(0, maxLength) : value;
}

/**
 * Format a Date object to YYYY-MM-DD string using local date components.
 * This avoids timezone issues when the Date is at midnight UTC.
 * For dates stored as @db.Date in PostgreSQL, use getUTCxxx methods since
 * Prisma returns them as midnight UTC.
 */
function formatDateKey(date: Date, useUtc = true): string {
  if (useUtc) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// =============================================================================
// Helper: Load holidays from company calendar
// =============================================================================

/**
 * Load holidays from the company calendar for a date range.
 * Returns a Map of date strings (YYYY-MM-DD) to holiday info.
 */
async function loadHolidaysForDateRange(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<HolidayMap> {
  const holidays: HolidayMap = new Map();

  // Get years covered by the date range
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  // Find holiday calendars for the relevant years
  const holidayCalendars = await prisma.holidayCalendar.findMany({
    where: {
      companyId,
      year: { in: years },
    },
    include: {
      events: {
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
          // Only include holiday types (not REST_DAY or SPECIAL_WORKING)
          dayType: {
            in: ["REGULAR_HOLIDAY", "SPECIAL_HOLIDAY"],
          },
        },
      },
    },
  });

  // Collect all events from all calendars
  for (const calendar of holidayCalendars) {
    for (const event of calendar.events) {
      // Use UTC components since Prisma returns @db.Date as midnight UTC
      const dateKey = formatDateKey(event.date, true);
      holidays.set(dateKey, {
        name: event.name,
        dayType: event.dayType as "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY",
      });
    }
  }

  console.log(`[Holiday Lookup] Company: ${companyId}, Years: ${years.join(", ")}, Found ${holidays.size} holidays:`,
    Array.from(holidays.entries()).map(([date, info]) => `${date}: ${info.name} (${info.dayType})`));

  return holidays;
}

// =============================================================================
// Helper: Load and match shift templates
// =============================================================================

interface ShiftTemplateInfo {
  id: string;
  code: string;
  name: string;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  scheduledWorkMinutes: number;
  graceMinutesLate: number;
  graceMinutesEarlyOut: number;
  isOvernight: boolean;
}

/**
 * Load all active shift templates for a company.
 */
async function loadShiftTemplates(companyId: string): Promise<ShiftTemplateInfo[]> {
  const templates = await prisma.shiftTemplate.findMany({
    where: {
      companyId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      startTime: true,
      endTime: true,
      breakMinutes: true,
      scheduledWorkMinutes: true,
      graceMinutesLate: true,
      graceMinutesEarlyOut: true,
      isOvernight: true,
    },
  });

  return templates;
}

/**
 * Patterns that indicate a rest day / no shift in the shift column.
 * These should result in shiftTemplateId = null.
 */
const REST_DAY_SHIFT_PATTERNS = [
  /^-$/,
  /^break$/i,
  /^rest$/i,
  /^rest\s*day$/i,
  /^off$/i,
  /^day\s*off$/i,
  /^leave$/i,
  /^holiday$/i,
  /^vacation$/i,
  /^n\/?a$/i,
  /^no\s*shifts?$/i,
];

/**
 * Check if shift value indicates no shift (rest day, break, etc.).
 */
function isNoShiftValue(shift: string | undefined): boolean {
  if (!shift || shift.trim() === "") return true;
  const trimmed = shift.trim();
  return REST_DAY_SHIFT_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Extract time from a Date object as HH:MM string.
 */
function formatTimeFromDate(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Match a shift string to a shift template.
 * Returns the template ID if found, undefined otherwise.
 *
 * Matching strategy:
 * 1. If shift is "-" or rest day indicator → return undefined (no template)
 * 2. Try to match by time range (e.g., "10:00-19:00" matches template with those times)
 * 3. Try to match by code or name
 */
function matchShiftToTemplate(
  shiftStr: string | undefined,
  templates: ShiftTemplateInfo[]
): ShiftTemplateInfo | undefined {
  if (!shiftStr || isNoShiftValue(shiftStr)) {
    return undefined;
  }

  const trimmed = shiftStr.trim();

  // Try to extract time range from the shift string
  // Pattern: "HH:MM-HH:MM" or "HHMM-HHMM HH:MM-HH:MM"
  let startTimeStr: string | undefined;
  let endTimeStr: string | undefined;

  // Pattern 1: Military time followed by standard time (e.g., "1000-1900 10:00-19:00")
  const dualTimePattern = /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
  const dualMatch = trimmed.match(dualTimePattern);
  if (dualMatch) {
    const [, startHour, startMin, endHour, endMin] = dualMatch;
    startTimeStr = `${startHour.padStart(2, "0")}:${startMin}`;
    endTimeStr = `${endHour.padStart(2, "0")}:${endMin}`;
  }

  // Pattern 2: Military time only (e.g., "1000-1900")
  if (!startTimeStr) {
    const militaryPattern = /^(\d{3,4})-(\d{3,4})$/;
    const militaryMatch = trimmed.match(militaryPattern);
    if (militaryMatch) {
      const [, startMilitary, endMilitary] = militaryMatch;
      const startPadded = startMilitary.padStart(4, "0");
      const endPadded = endMilitary.padStart(4, "0");
      startTimeStr = `${startPadded.slice(0, 2)}:${startPadded.slice(2)}`;
      endTimeStr = `${endPadded.slice(0, 2)}:${endPadded.slice(2)}`;
    }
  }

  // If we extracted times, try to match by time
  if (startTimeStr && endTimeStr) {
    for (const template of templates) {
      const templateStart = formatTimeFromDate(template.startTime);
      const templateEnd = formatTimeFromDate(template.endTime);

      if (templateStart === startTimeStr && templateEnd === endTimeStr) {
        return template;
      }
    }
  }

  // Try to match by code (case-insensitive)
  const lowerShift = trimmed.toLowerCase();
  for (const template of templates) {
    if (template.code.toLowerCase() === lowerShift) {
      return template;
    }
  }

  // Try to match by name (case-insensitive)
  for (const template of templates) {
    if (template.name.toLowerCase() === lowerShift) {
      return template;
    }
  }

  // Try partial name match
  for (const template of templates) {
    if (template.name.toLowerCase().includes(lowerShift) ||
        lowerShift.includes(template.name.toLowerCase())) {
      return template;
    }
  }

  return undefined;
}

// =============================================================================
// STEP 1: Create Import Record
// =============================================================================

interface CreateImportInput {
  fileName: string;
  fileSize: number;
  fileHash: string;
  columnMapping: AttendanceColumnMapping;
  totalRows: number;
}

export async function createImportRecord(input: CreateImportInput): Promise<{
  success: boolean;
  importId?: string;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.ATTENDANCE_IMPORT);

    // Check for duplicate file (same hash within last 24 hours)
    const recentDuplicate = await prisma.attendanceImport.findFirst({
      where: {
        companyId: auth.user.companyId,
        fileHash: input.fileHash,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentDuplicate) {
      return {
        success: false,
        error: `This file was already imported at ${recentDuplicate.createdAt.toLocaleString()}`,
      };
    }

    // Create import record
    const importRecord = await prisma.attendanceImport.create({
      data: {
        companyId: auth.user.companyId,
        fileName: input.fileName,
        filePath: "", // We don't store files, just process them
        fileSize: BigInt(input.fileSize),
        fileHash: input.fileHash,
        columnMapping: JSON.parse(JSON.stringify(input.columnMapping)),
        status: "PENDING",
        totalRows: input.totalRows,
        uploadedById: auth.user.id,
      },
    });

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    await audit.import("AttendanceImport", {
      importId: importRecord.id,
      fileName: input.fileName,
      totalRows: input.totalRows,
    });

    return { success: true, importId: importRecord.id };
  } catch (error) {
    console.error("Failed to create import record:", error);
    return { success: false, error: "Failed to create import record" };
  }
}

// =============================================================================
// STEP 2: Preview Import (Validate & Match)
// =============================================================================

interface PreviewImportInput {
  importId: string;
  rows: Array<{
    rowNumber: number;
    rawData: Record<string, unknown>;
    employeeCode?: string;
    employeeEmail?: string;
    employeeName?: string;
    date?: string;
    timeIn?: string;
    timeOut?: string;
    shift?: string;
    remarks?: string;
  }>;
  config: AttendanceImportConfig;
}

export async function previewImport(
  input: PreviewImportInput
): Promise<{ success: boolean; preview?: ImportPreviewResult; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.ATTENDANCE_IMPORT);

    // Load employees for matching
    const matchResults = await batchMatchEmployees(
      auth.user.companyId,
      input.rows,
      input.config.employeeMatching
    );

    // Determine date range from import rows for holiday lookup
    const rowsWithDates = input.rows
      .filter(r => r.date)
      .map(r => {
        const parsed = parseDate(r.date!);
        return parsed ? parsed.getTime() : null;
      })
      .filter((t): t is number => t !== null);

    let holidays: HolidayMap = new Map();
    if (rowsWithDates.length > 0) {
      const minDate = new Date(Math.min(...rowsWithDates));
      const maxDate = new Date(Math.max(...rowsWithDates));

      console.log(`[Holiday Lookup] Date range from import: ${minDate.toISOString()} to ${maxDate.toISOString()}`);

      // Add buffer for timezone issues
      minDate.setDate(minDate.getDate() - 1);
      maxDate.setDate(maxDate.getDate() + 1);

      console.log(`[Holiday Lookup] Date range with buffer: ${minDate.toISOString()} to ${maxDate.toISOString()}`);

      // Load holidays from company calendar
      holidays = await loadHolidaysForDateRange(auth.user.companyId, minDate, maxDate);
    }

    // Load shift templates for matching
    const shiftTemplates = await loadShiftTemplates(auth.user.companyId);
    console.log(`[Shift Template] Loaded ${shiftTemplates.length} shift templates for matching`);

    // Validate rows with holiday detection
    const validatedRows = validateRows(
      input.rows.map((r, i) => ({
        ...r,
        rowNumber: r.rowNumber || i + 2,
        rawData: r.rawData || {},
      })),
      matchResults,
      input.config,
      holidays
    );

    // Match shift templates to each validated row
    const rowsWithShiftTemplates = validatedRows.map(row => {
      const matchedTemplate = matchShiftToTemplate(row.shift, shiftTemplates);
      return {
        ...row,
        shiftTemplateId: matchedTemplate?.id,
      };
    });

    // Check for duplicates against existing records
    const duplicateCheckedRows = await checkDuplicates(
      auth.user.companyId,
      rowsWithShiftTemplates,
      input.config.duplicateStrategy
    );

    // Generate summary
    const { errorSummary, warningSummary } = generateValidationSummary(duplicateCheckedRows);

    const validRows = duplicateCheckedRows.filter((r) => r.status === "VALID");
    const invalidRows = duplicateCheckedRows.filter((r) => r.status === "INVALID");
    const duplicateRows = duplicateCheckedRows.filter((r) => r.status === "DUPLICATE");
    const warningRows = duplicateCheckedRows.filter(
      (r) => r.status === "VALID" && r.warnings.length > 0
    );

    const matchedEmployees = new Set(
      duplicateCheckedRows
        .filter((r) => r.matchedEmployeeId)
        .map((r) => r.matchedEmployeeId)
    ).size;

    const unmatchedRows = duplicateCheckedRows.filter((r) => !r.matchedEmployeeId);
    const ambiguousRows = duplicateCheckedRows.filter(
      (r) => r.errors.some((e) => e.code === "AMBIGUOUS_MATCH")
    );

    // Update import record
    await prisma.attendanceImport.update({
      where: { id: input.importId },
      data: {
        status: "PROCESSING",
        totalRows: input.rows.length,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        duplicateRows: duplicateRows.length,
      },
    });

    // NOTE: Raw rows are no longer stored separately.
    // All attendance data is written directly to AttendanceDayRecord during commit.

    const preview: ImportPreviewResult = {
      importId: input.importId,
      fileName: "", // Would come from import record
      totalRows: input.rows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      duplicateRows: duplicateRows.length,
      warningRows: warningRows.length,
      sampleRows: duplicateCheckedRows.slice(0, 50), // First 50 for UI preview
      allValidatedRows: duplicateCheckedRows, // All rows for commit
      errorSummary,
      warningSummary,
      matchedEmployees,
      unmatchedEmployees: unmatchedRows.length,
      ambiguousMatches: ambiguousRows.length,
    };

    return { success: true, preview };
  } catch (error) {
    console.error("Failed to preview import:", error);
    return { success: false, error: "Failed to preview import" };
  }
}

// =============================================================================
// STEP 3: Commit Import (Create Records)
// =============================================================================

interface CommitImportInput {
  importId: string;
  validatedRows: ValidatedAttendanceRow[];
  duplicateStrategy: DuplicateStrategy;
}

export async function commitImport(
  input: CommitImportInput
): Promise<ImportCommitResult> {
  const auth = await getAuthContext();
  if (!auth) {
    return {
      success: false,
      importId: input.importId,
      rowsProcessed: 0,
      createdTimeLogs: 0,
      updatedAttendanceRecords: 0,
      skippedDuplicates: 0,
      errors: ["Not authenticated"],
    };
  }

  try {
    await assertPermission(Permission.ATTENDANCE_IMPORT);

    // Filter to valid rows only
    const rowsToProcess = input.validatedRows.filter(
      (r) => r.status === "VALID" && r.matchedEmployeeId
    );

    let rowsProcessed = 0;
    let createdRecords = 0;
    let updatedRecords = 0;
    let skippedDuplicates = 0;
    const errors: string[] = [];

    // Update import status
    await prisma.attendanceImport.update({
      where: { id: input.importId },
      data: { status: "PROCESSING", startedAt: new Date() },
    });

    // Process rows in batches
    const batchSize = 100;
    for (let i = 0; i < rowsToProcess.length; i += batchSize) {
      const batch = rowsToProcess.slice(i, i + batchSize);

      for (const row of batch) {
        try {
          const result = await processImportRow(
            row,
            input.importId,
            input.duplicateStrategy,
            auth.user.companyId
          );

          if (result.rowProcessed) rowsProcessed++;
          if (result.created) createdRecords += result.created;
          if (result.updated) updatedRecords += result.updated;
          if (result.skipped) skippedDuplicates += result.skipped;
          if (result.error) errors.push(`Row ${row.rowNumber}: ${result.error}`);
        } catch (error) {
          errors.push(
            `Row ${row.rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      // Update progress
      await prisma.attendanceImport.update({
        where: { id: input.importId },
        data: { processedRows: Math.min(i + batchSize, rowsToProcess.length) },
      });
    }

    // Finalize import
    const finalStatus =
      errors.length === 0
        ? "COMPLETED"
        : errors.length < rowsToProcess.length
          ? "PARTIALLY_COMPLETED"
          : "FAILED";

    await prisma.attendanceImport.update({
      where: { id: input.importId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        processedRows: rowsToProcess.length,
        errorMessage: errors.length > 0 ? errors.slice(0, 10).join("\n") : null,
      },
    });

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    await audit.import("AttendanceImport", {
      importId: input.importId,
      status: finalStatus,
      rowsProcessed,
      createdRecords,
      updatedRecords,
      skippedDuplicates,
      errorCount: errors.length,
    });

    revalidatePath("/attendance");
    revalidatePath("/dashboard");

    return {
      success: errors.length === 0,
      importId: input.importId,
      rowsProcessed,
      createdTimeLogs: createdRecords, // Keep for backwards compatibility
      updatedAttendanceRecords: updatedRecords,
      skippedDuplicates,
      errors: errors.slice(0, 20), // Return first 20 errors
    };
  } catch (error) {
    console.error("Failed to commit import:", error);

    await prisma.attendanceImport.update({
      where: { id: input.importId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      importId: input.importId,
      rowsProcessed: 0,
      createdTimeLogs: 0,
      updatedAttendanceRecords: 0,
      skippedDuplicates: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check for duplicate attendance records.
 */
async function checkDuplicates(
  companyId: string,
  rows: ValidatedAttendanceRow[],
  strategy: DuplicateStrategy
): Promise<ValidatedAttendanceRow[]> {
  // Get all employee-date pairs
  const pairs = rows
    .filter((r) => r.matchedEmployeeId && r.date)
    .map((r) => ({
      employeeId: r.matchedEmployeeId!,
      date: r.date,
    }));

  if (pairs.length === 0) return rows;

  // Check for existing attendance records
  const existingRecords = await prisma.attendanceDayRecord.findMany({
    where: {
      OR: pairs.map((p) => ({
        employeeId: p.employeeId,
        attendanceDate: p.date,
      })),
    },
    select: {
      employeeId: true,
      attendanceDate: true,
      isLocked: true,
    },
  });

  // Build lookup set
  const existingSet = new Set(
    existingRecords.map(
      (r) => `${r.employeeId}|${r.attendanceDate.toISOString().split("T")[0]}`
    )
  );

  const lockedSet = new Set(
    existingRecords
      .filter((r) => r.isLocked)
      .map(
        (r) => `${r.employeeId}|${r.attendanceDate.toISOString().split("T")[0]}`
      )
  );

  // Mark duplicates
  return rows.map((row) => {
    if (!row.matchedEmployeeId || !row.date) return row;

    const key = `${row.matchedEmployeeId}|${row.date.toISOString().split("T")[0]}`;

    if (lockedSet.has(key)) {
      return {
        ...row,
        status: "DUPLICATE" as const,
        errors: [
          ...row.errors,
          {
            field: "date",
            code: "LOCKED_RECORD",
            message: "Attendance record is locked by payroll",
            severity: "error" as const,
          },
        ],
      };
    }

    if (existingSet.has(key)) {
      if (strategy === "ERROR") {
        return {
          ...row,
          status: "DUPLICATE" as const,
          errors: [
            ...row.errors,
            {
              field: "date",
              code: "DUPLICATE_RECORD",
              message: "Attendance record already exists for this date",
              severity: "error" as const,
            },
          ],
        };
      } else if (strategy === "SKIP") {
        return {
          ...row,
          status: "DUPLICATE" as const,
          warnings: [
            ...row.warnings,
            {
              field: "date",
              code: "DUPLICATE_SKIPPED",
              message: "Existing record will be kept",
              severity: "warning" as const,
            },
          ],
        };
      }
      // strategy === "REPLACE" - keep as VALID, will be updated
    }

    return row;
  });
}

/**
 * Process a single import row - create or update attendance record directly.
 * Computes worked minutes and attendance status in one step.
 */
async function processImportRow(
  row: ValidatedAttendanceRow,
  importId: string,
  duplicateStrategy: DuplicateStrategy,
  companyId: string
): Promise<{
  rowProcessed: boolean;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}> {
  if (!row.matchedEmployeeId || !row.date) {
    return { rowProcessed: false, created: 0, updated: 0, skipped: 0, error: "No matched employee or date" };
  }

  // Check for existing record
  const existingRecord = await prisma.attendanceDayRecord.findUnique({
    where: {
      employeeId_attendanceDate: {
        employeeId: row.matchedEmployeeId,
        attendanceDate: row.date,
      },
    },
  });

  if (existingRecord?.isLocked) {
    return {
      rowProcessed: false,
      created: 0,
      updated: 0,
      skipped: 1,
      error: "Record is locked by payroll",
    };
  }

  if (existingRecord && duplicateStrategy === "SKIP") {
    return { rowProcessed: false, created: 0, updated: 0, skipped: 1 };
  }

  // Load shift template if available (for grace periods and break minutes)
  let shiftTemplate: ShiftTemplateInfo | null = null;
  if (row.shiftTemplateId) {
    const template = await prisma.shiftTemplate.findUnique({
      where: { id: row.shiftTemplateId },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        breakMinutes: true,
        scheduledWorkMinutes: true,
        graceMinutesLate: true,
        graceMinutesEarlyOut: true,
        isOvernight: true,
      },
    });
    if (template) {
      shiftTemplate = template;
    }
  }

  // Get break minutes - use existing override if present, otherwise shift template
  const breakMinutes = existingRecord?.breakMinutesApplied ?? shiftTemplate?.breakMinutes ?? 60;

  // Calculate worked minutes for attendance status determination only
  // (late/undertime/OT are calculated on the fly when needed)
  let workedMinutes = 0;
  if (row.timeIn && row.timeOut) {
    const grossWorkedMinutes = Math.round(
      (row.timeOut.getTime() - row.timeIn.getTime()) / (1000 * 60)
    );
    workedMinutes = Math.max(0, grossWorkedMinutes - breakMinutes);
  }

  // Determine attendance status from import data or compute it
  let attendanceStatus: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "REST_DAY" = "PRESENT";

  // Check attendance type from import (Lark provides this)
  if (row.attendanceType === "ABSENT") {
    attendanceStatus = "ABSENT";
  } else if (row.attendanceType === "ON_LEAVE") {
    attendanceStatus = "ON_LEAVE";
  } else if (row.attendanceType === "REST_DAY") {
    attendanceStatus = "REST_DAY";
  } else if (workedMinutes > 0 && workedMinutes < 240) {
    // Less than 4 hours = half day
    attendanceStatus = "HALF_DAY";
  } else if (workedMinutes === 0 && !row.timeIn && !row.timeOut) {
    // No clock in/out and not explicitly marked
    attendanceStatus = "ABSENT";
  }

  // Determine day type from import or default to WORKDAY
  let dayType: "WORKDAY" | "REST_DAY" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" = "WORKDAY";
  if (row.attendanceType === "REGULAR_HOLIDAY") {
    dayType = "REGULAR_HOLIDAY";
  } else if (row.attendanceType === "SPECIAL_HOLIDAY") {
    dayType = "SPECIAL_HOLIDAY";
  } else if (row.attendanceType === "REST_DAY") {
    dayType = "REST_DAY";
  }

  // Build the record data (computed values like late/OT are calculated on the fly, not stored)
  // Schedule info comes from shiftTemplate relation, not stored on record
  const recordData = {
    actualTimeIn: row.timeIn || null,
    actualTimeOut: row.timeOut || null,
    sourceType: "LARK_IMPORT" as const,
    sourceBatchId: importId,
    // Shift template (schedule times come from this relation)
    shiftTemplateId: row.shiftTemplateId || null,
    attendanceStatus,
    dayType,
    // Default approval flags to false (admin must approve OT)
    earlyInApproved: false,
    lateOutApproved: false,
    // No excuse mechanism for late/undertime
    lateInApproved: false,
    earlyOutApproved: false,
  };

  if (existingRecord) {
    // Update existing record (REPLACE strategy)
    await prisma.attendanceDayRecord.update({
      where: { id: existingRecord.id },
      data: recordData,
    });

    return {
      rowProcessed: true,
      created: 0,
      updated: 1,
      skipped: 0,
    };
  } else {
    // Create new record
    await prisma.attendanceDayRecord.create({
      data: {
        employeeId: row.matchedEmployeeId,
        attendanceDate: row.date,
        ...recordData,
      },
    });

    return {
      rowProcessed: true,
      created: 1,
      updated: 0,
      skipped: 0,
    };
  }
}

// =============================================================================
// Utility: Compute file hash
// =============================================================================

export async function computeFileHash(content: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// =============================================================================
// Get Import History
// =============================================================================

export async function getImportHistory(limit: number = 20): Promise<{
  success: boolean;
  imports?: Array<{
    id: string;
    fileName: string;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    const imports = await prisma.attendanceImport.findMany({
      where: { companyId: auth.user.companyId },
      select: {
        id: true,
        fileName: true,
        status: true,
        totalRows: true,
        validRows: true,
        invalidRows: true,
        duplicateRows: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { success: true, imports };
  } catch (error) {
    console.error("Failed to get import history:", error);
    return { success: false, error: "Failed to get import history" };
  }
}

// =============================================================================
// Get Import Details
// =============================================================================

// =============================================================================
// Delete Import Record
// =============================================================================

export async function deleteImportRecord(importId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.ATTENDANCE_IMPORT);

    // Verify import belongs to company
    const importRecord = await prisma.attendanceImport.findFirst({
      where: {
        id: importId,
        companyId: auth.user.companyId,
      },
    });

    if (!importRecord) {
      return { success: false, error: "Import not found" };
    }

    // Delete the import record
    await prisma.attendanceImport.delete({
      where: { id: importId },
    });

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    await audit.delete("AttendanceImport", importId, {
      fileName: importRecord.fileName,
      totalRows: importRecord.totalRows,
      status: importRecord.status,
    });

    revalidatePath("/attendance/import");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete import record:", error);
    return { success: false, error: "Failed to delete import record" };
  }
}

// =============================================================================
// Get Import Details
// =============================================================================

export async function getImportDetails(importId: string): Promise<{
  success: boolean;
  import?: {
    id: string;
    fileName: string;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
  };
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    const importRecord = await prisma.attendanceImport.findFirst({
      where: {
        id: importId,
        companyId: auth.user.companyId,
      },
    });

    if (!importRecord) {
      return { success: false, error: "Import not found" };
    }

    // NOTE: Raw rows are no longer stored. Import details show summary only.
    return {
      success: true,
      import: {
        id: importRecord.id,
        fileName: importRecord.fileName,
        status: importRecord.status,
        totalRows: importRecord.totalRows,
        validRows: importRecord.validRows,
        invalidRows: importRecord.invalidRows,
        duplicateRows: importRecord.duplicateRows,
        createdAt: importRecord.createdAt,
        completedAt: importRecord.completedAt,
        errorMessage: importRecord.errorMessage,
      },
    };
  } catch (error) {
    console.error("Failed to get import details:", error);
    return { success: false, error: "Failed to get import details" };
  }
}
