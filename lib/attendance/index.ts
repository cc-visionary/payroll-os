// =============================================================================
// PeopleOS PH - Attendance Library Index
// =============================================================================

// Types
export * from "./import-types";

// File parsing
export {
  parseCSV,
  parseXLSX,
  detectFileType,
  detectColumnMapping,
  applyColumnMapping,
  parseAttendanceFile,
  getFileHeaders,
} from "./file-parser";

// Employee matching
export {
  loadMatchableEmployees,
  buildMatchIndexes,
  matchEmployee,
  batchMatchEmployees,
} from "./employee-matcher";
export type { EmployeeMatchResult } from "./employee-matcher";

// Row validation
export {
  parseDate,
  parseTime,
  validateRow,
  validateRows,
  generateValidationSummary,
} from "./row-validator";
