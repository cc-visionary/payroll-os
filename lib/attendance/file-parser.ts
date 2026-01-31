// =============================================================================
// PeopleOS PH - Attendance File Parser (CSV/XLSX)
// =============================================================================

import * as XLSX from "xlsx";
import type {
  AttendanceColumnMapping,
  ParsedAttendanceRow,
} from "./import-types";

/**
 * Parse CSV content into rows.
 */
export function parseCSV(content: string): Record<string, unknown>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, unknown> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }

    // Skip completely empty rows
    if (Object.values(row).some((v) => v !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted values.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse XLSX file buffer into rows.
 * Handles files with merged title rows by detecting the actual header row.
 */
export function parseXLSX(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // Detect if first row is a merged title row
  // Check if row 1 has very few non-empty cells (likely a merged title)
  // and row 2 has multiple cells (likely the actual headers)
  const headerRowIndex = detectHeaderRow(sheet);

  // Convert to JSON, specifying the header row if not the first row
  // Using raw: true to preserve Date objects and numbers, then handle conversion in extractValue
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true, // Preserve original types (Date, Number) for proper handling
    range: headerRowIndex, // Start from detected header row
  });

  return rows;
}

/**
 * Detect the actual header row in an XLSX sheet.
 * Returns 0 if row 1 is the header, 1 if row 2 is the header, etc.
 */
function detectHeaderRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  // Check if there are merged cells in the first row
  const merges = sheet["!merges"] || [];
  const firstRowHasWideMerge = merges.some(
    (merge) => merge.s.r === 0 && (merge.e.c - merge.s.c) > 2
  );

  if (firstRowHasWideMerge) {
    // First row has a wide horizontal merge - likely a title row
    return 1;
  }

  // Count non-empty cells in first two rows
  let row1Count = 0;
  let row2Count = 0;

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell1 = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
    const cell2 = sheet[XLSX.utils.encode_cell({ r: 1, c: col })];

    if (cell1?.v !== undefined && cell1?.v !== null && cell1?.v !== "") {
      row1Count++;
    }
    if (cell2?.v !== undefined && cell2?.v !== null && cell2?.v !== "") {
      row2Count++;
    }
  }

  // If row 1 has very few values but row 2 has many, row 1 is probably a title
  if (row1Count <= 2 && row2Count >= 3) {
    return 1;
  }

  // Default to first row as header
  return 0;
}

/**
 * Get the effective header value for a column, considering merged cells.
 * For vertically merged headers (e.g., "Name" in A1-A2), gets the merged cell value.
 * For the target header row, prefers that row's value but falls back to merged cell from row 0.
 */
function getEffectiveHeaderValue(
  sheet: XLSX.WorkSheet,
  col: number,
  headerRowIndex: number,
  merges: XLSX.Range[]
): string {
  // First, try to get value from the header row
  const headerCell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: col })];
  if (headerCell?.v !== undefined && headerCell?.v !== null && headerCell?.v !== "") {
    return headerCell.v.toString();
  }

  // If header row is 1, check if there's a vertical merge from row 0 that includes this column
  if (headerRowIndex === 1) {
    // Check for vertically merged cells that span both row 0 and row 1
    for (const merge of merges) {
      if (merge.s.c === col && merge.e.c === col && merge.s.r === 0 && merge.e.r >= 1) {
        // This column has a vertical merge from row 0 - get the value from row 0
        const mergedCell = sheet[XLSX.utils.encode_cell({ r: 0, c: col })];
        if (mergedCell?.v !== undefined && mergedCell?.v !== null && mergedCell?.v !== "") {
          return mergedCell.v.toString();
        }
      }
    }
  }

  return `Column ${col + 1}`;
}

/**
 * Detect file type from content/name.
 */
export function detectFileType(
  fileName: string
): "csv" | "xlsx" | "xls" | "unknown" {
  const ext = fileName.toLowerCase().split(".").pop();

  switch (ext) {
    case "csv":
      return "csv";
    case "xlsx":
      return "xlsx";
    case "xls":
      return "xls";
    default:
      return "unknown";
  }
}

/**
 * Detect column mapping from headers.
 * Returns suggested mapping based on common column names.
 */
export function detectColumnMapping(
  headers: string[]
): Partial<AttendanceColumnMapping> {
  const mapping: Partial<AttendanceColumnMapping> = {};
  const normalized = headers.map((h) => h.toLowerCase().trim());

  // Employee ID patterns - matches against employeeNumber in database
  const codePatterns = [
    "employee id",
    "employee_id",
    "employeeid",
    "emp id",
    "emp_id",
    "empid",
    "employee number",
    "employee_number",
    "employeenumber",
    "emp no",
    "emp_no",
    "empno",
    "id",
    "code",
    "employee code",
  ];
  for (let i = 0; i < normalized.length; i++) {
    if (codePatterns.includes(normalized[i])) {
      mapping.employeeCode = headers[i];
      break;
    }
  }

  // Employee name patterns
  const namePatterns = [
    "employee name",
    "employee_name",
    "employeename",
    "name",
    "full name",
    "full_name",
    "fullname",
  ];
  for (let i = 0; i < normalized.length; i++) {
    if (namePatterns.includes(normalized[i])) {
      mapping.employeeName = headers[i];
      break;
    }
  }

  // Email patterns
  const emailPatterns = [
    "email",
    "employee email",
    "employee_email",
    "work email",
    "work_email",
  ];
  for (let i = 0; i < normalized.length; i++) {
    if (emailPatterns.includes(normalized[i])) {
      mapping.employeeEmail = headers[i];
      break;
    }
  }

  // Date patterns
  const datePatterns = [
    "date",
    "attendance date",
    "attendance_date",
    "attendancedate",
    "work date",
    "work_date",
    "day",
  ];
  for (let i = 0; i < normalized.length; i++) {
    if (datePatterns.includes(normalized[i])) {
      mapping.date = headers[i];
      break;
    }
  }

  // Time in patterns - use regex for flexible matching
  // Prefer "Clock-in No. 1 time" (the actual time column) over columns containing "attendance result"
  // Matches: "Clock-in No. 1 time", "time in", "Clock In", etc.
  const clockInTimeRegex = /clock[\s-]*in.*\btime\b(?!.*result)/i;
  for (let i = 0; i < headers.length; i++) {
    if (clockInTimeRegex.test(headers[i])) {
      mapping.timeIn = headers[i];
      break;
    }
  }
  // Fallback to generic time in patterns
  if (!mapping.timeIn) {
    const timeInRegex = /\btime\s*in\b|\bcheck[\s-]*in\b|\barrival\b|\bstart\s*time\b/i;
    for (let i = 0; i < headers.length; i++) {
      if (timeInRegex.test(headers[i]) && !headers[i].toLowerCase().includes("result")) {
        mapping.timeIn = headers[i];
        break;
      }
    }
  }

  // Time out patterns - use regex for flexible matching
  // Prefer "Clock-out No. 1 time" (the actual time column) over columns containing "attendance result"
  // Matches: "Clock-out No. 1 time", "time out", "Clock Out", etc.
  const clockOutTimeRegex = /clock[\s-]*out.*\btime\b(?!.*result)/i;
  for (let i = 0; i < headers.length; i++) {
    if (clockOutTimeRegex.test(headers[i])) {
      mapping.timeOut = headers[i];
      break;
    }
  }
  // Fallback to generic time out patterns
  if (!mapping.timeOut) {
    const timeOutRegex = /\btime\s*out\b|\bcheck[\s-]*out\b|\bdeparture\b|\bend\s*time\b/i;
    for (let i = 0; i < headers.length; i++) {
      if (timeOutRegex.test(headers[i]) && !headers[i].toLowerCase().includes("result")) {
        mapping.timeOut = headers[i];
        break;
      }
    }
  }

  // Shift patterns
  const shiftPatterns = [
    "shift",
    "schedule",
    "shift name",
    "shift_name",
    "work schedule",
  ];
  for (let i = 0; i < normalized.length; i++) {
    if (shiftPatterns.includes(normalized[i])) {
      mapping.shift = headers[i];
      break;
    }
  }

  // Remarks patterns
  const remarksPatterns = [
    "remarks",
    "notes",
    "comment",
    "comments",
    "note",
  ];
  for (let i = 0; i < normalized.length; i++) {
    if (remarksPatterns.includes(normalized[i])) {
      mapping.remarks = headers[i];
      break;
    }
  }

  // Attendance result patterns - use regex for flexible matching
  // Prefer "Clock-in No. 1 attendance result" over generic "result" columns
  // This column contains "Optional(Leave)", "Optional(Break)", "No record", etc.
  const clockInAttendanceResultRegex = /clock[\s-]*in.*attendance\s*result/i;
  for (let i = 0; i < headers.length; i++) {
    if (clockInAttendanceResultRegex.test(headers[i])) {
      mapping.attendanceResult = headers[i];
      break;
    }
  }
  // Fallback to generic attendance result patterns if clock-in specific not found
  if (!mapping.attendanceResult) {
    const attendanceResultRegex = /\battendance\s*result\b/i;
    for (let i = 0; i < headers.length; i++) {
      if (attendanceResultRegex.test(headers[i])) {
        mapping.attendanceResult = headers[i];
        break;
      }
    }
  }

  return mapping;
}

/**
 * Extract value from row using column mapping.
 */
function extractValue(
  row: Record<string, unknown>,
  columnName: string | undefined
): string | undefined {
  if (!columnName) return undefined;

  const value = row[columnName];
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (value instanceof Date) {
    // Format date as YYYY-MM-DD for consistent parsing
    return value.toISOString().split("T")[0];
  }
  return String(value).trim() || undefined;
}

/**
 * Extract date value from row, handling Excel date serial numbers.
 * Excel stores dates as numbers (days since 1900-01-01 or 1904-01-01).
 */
function extractDateValue(
  row: Record<string, unknown>,
  columnName: string | undefined
): string | undefined {
  if (!columnName) return undefined;

  const value = row[columnName];
  if (value === null || value === undefined) return undefined;

  // Handle Date objects directly
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value.toISOString().split("T")[0];
    }
    return undefined;
  }

  // Handle Excel date serial numbers (numbers that look like dates)
  if (typeof value === "number") {
    // Excel serial date: days since 1899-12-30 (accounting for Excel's leap year bug)
    // Valid date range: roughly 1 (1900-01-01) to 50000+ (year 2036+)
    if (value > 0 && value < 100000) {
      try {
        // Use xlsx's utility to convert serial date to JS Date
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch {
        // Fall through to string parsing
      }
    }
  }

  // Handle string values
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Check if it looks like a date string that Excel might have formatted
    // Handle common Excel date formats
    const datePatterns = [
      // ISO format: 2024-01-15
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // US format: 01/15/2024 or 1/15/2024
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // European format: 15-01-2024 or 15/01/2024
      /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/,
      // Excel full datetime: 2024-01-15T00:00:00.000Z
      /^(\d{4})-(\d{2})-(\d{2})T/,
      // Month name formats: Jan 15, 2024 or 15 Jan 2024
      /^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/,
      /^\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}$/,
    ];

    // Try to parse as-is first
    return trimmed;
  }

  return String(value).trim() || undefined;
}

/**
 * Apply column mapping to extract attendance data from raw rows.
 */
export function applyColumnMapping(
  rows: Record<string, unknown>[],
  mapping: AttendanceColumnMapping
): ParsedAttendanceRow[] {
  return rows.map((row, index) => ({
    rowNumber: index + 2, // 1-indexed, plus header row
    rawData: row,
    employeeCode: extractValue(row, mapping.employeeCode),
    employeeEmail: extractValue(row, mapping.employeeEmail),
    employeeName: extractValue(row, mapping.employeeName),
    date: extractDateValue(row, mapping.date), // Use special date extraction
    timeIn: extractValue(row, mapping.timeIn),
    timeOut: extractValue(row, mapping.timeOut),
    shift: extractValue(row, mapping.shift),
    attendanceResult: extractValue(row, mapping.attendanceResult),
    remarks: extractValue(row, mapping.remarks),
  }));
}

/**
 * Parse attendance file (CSV or XLSX) and apply column mapping.
 */
export async function parseAttendanceFile(
  file: File,
  mapping?: Partial<AttendanceColumnMapping>
): Promise<{
  rows: ParsedAttendanceRow[];
  headers: string[];
  detectedMapping: Partial<AttendanceColumnMapping>;
}> {
  const fileType = detectFileType(file.name);

  let rawRows: Record<string, unknown>[];

  if (fileType === "csv") {
    const content = await file.text();
    rawRows = parseCSV(content);
  } else if (fileType === "xlsx" || fileType === "xls") {
    const buffer = await file.arrayBuffer();
    rawRows = parseXLSX(buffer);
  } else {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  if (rawRows.length === 0) {
    return { rows: [], headers: [], detectedMapping: {} };
  }

  // Extract headers from first row
  const headers = Object.keys(rawRows[0]);

  // Detect or use provided mapping
  const detectedMapping = detectColumnMapping(headers);
  const finalMapping: AttendanceColumnMapping = {
    ...detectedMapping,
    ...mapping,
    date: mapping?.date || detectedMapping.date || "Date",
  };

  // Apply mapping
  const rows = applyColumnMapping(rawRows, finalMapping);

  return { rows, headers, detectedMapping };
}

/**
 * Get headers from file for mapping UI.
 */
export async function getFileHeaders(file: File): Promise<string[]> {
  const fileType = detectFileType(file.name);

  if (fileType === "csv") {
    const content = await file.text();
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) return [];
    return parseCSVLine(lines[0]);
  } else if (fileType === "xlsx" || fileType === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];

    // Detect if first row is a merged title row
    const headerRowIndex = detectHeaderRow(sheet);

    // Get range and extract the correct header row
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const merges = sheet["!merges"] || [];
    const headers: string[] = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
      // Use effective header value which handles vertical merges
      headers.push(getEffectiveHeaderValue(sheet, col, headerRowIndex, merges));
    }

    return headers;
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}
