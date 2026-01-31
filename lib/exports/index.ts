// =============================================================================
// PeopleOS PH - Exports Library
// =============================================================================
// Re-exports all export-related functions and types
// =============================================================================

// Types
export type {
  ExportType,
  ExportMetadata,
  PayrollRegisterRow,
  BankDisbursementRow,
  SSSContributionRow,
  PhilHealthContributionRow,
  PagIBIGContributionRow,
  ExportResult,
  ExportArtifactInput,
  ExportHistoryItem,
  StorageStrategy,
  ExportStorageConfig,
} from "./types";

export { DEFAULT_EXPORT_STORAGE_CONFIG } from "./types";

// Generators
export {
  generateContentHash,
  generatePayrollRegisterCSV,
  generateBankDisbursementCSV,
  generateSSSContributionsCSV,
  generatePhilHealthContributionsCSV,
  generatePagIBIGContributionsCSV,
} from "./generators";

// Storage
export {
  determineStorageStrategy,
  storeExportArtifact,
  getExportArtifactContent,
  getExportHistory,
  findExistingExport,
  cleanupExpiredExports,
  getCompanyStorageUsage,
} from "./storage";
