// =============================================================================
// PeopleOS PH - Export Types
// =============================================================================

import type { ExportType } from "@/app/generated/prisma";

export type { ExportType };

/**
 * Common export metadata
 */
export interface ExportMetadata {
  payrollRunId: string;
  payPeriodCode: string;
  companyName: string;
  generatedAt: Date;
  generatedBy: string;
  recordCount: number;
  totalAmount?: number;
}

/**
 * Payroll register row for CSV export
 */
export interface PayrollRegisterRow {
  employeeNumber: string;
  employeeName: string;
  department: string;
  position: string;
  wageType: string;
  baseRate: number;
  basicPay: number;
  overtime: number;
  nightDiff: number;
  holidayPay: number;
  restDayPay: number;
  allowances: number;
  reimbursements: number;
  adjustmentsAdd: number;
  grossPay: number;
  lateDeduction: number;
  undertimeDeduction: number;
  absentDeduction: number;
  sssEe: number;
  philhealthEe: number;
  pagibigEe: number;
  withholdingTax: number;
  cashAdvanceDeduction: number;
  loanDeduction: number;
  adjustmentsDeduct: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  bankName: string;
  bankAccountNumber: string;
}

/**
 * Bank disbursement row
 */
export interface BankDisbursementRow {
  sequenceNumber: number;
  employeeNumber: string;
  employeeName: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  amount: number;
  remarks: string;
}

/**
 * SSS contribution row
 */
export interface SSSContributionRow {
  employeeNumber: string;
  employeeName: string;
  sssNumber: string;
  monthlyBasicSalary: number;
  employeeShare: number;
  employerShare: number;
  ecContribution: number;
  totalContribution: number;
}

/**
 * PhilHealth contribution row
 */
export interface PhilHealthContributionRow {
  employeeNumber: string;
  employeeName: string;
  philhealthNumber: string;
  monthlyBasicSalary: number;
  employeeShare: number;
  employerShare: number;
  totalContribution: number;
}

/**
 * Pag-IBIG contribution row
 */
export interface PagIBIGContributionRow {
  employeeNumber: string;
  employeeName: string;
  pagibigNumber: string;
  monthlyBasicSalary: number;
  employeeShare: number;
  employerShare: number;
  totalContribution: number;
}

/**
 * Export result with content and metadata
 */
export interface ExportResult {
  success: boolean;
  exportType: ExportType;
  fileName: string;
  mimeType: string;
  content: Buffer;
  contentHash: string;
  recordCount: number;
  totalAmount?: number;
  dataSnapshot: Record<string, unknown>;
  error?: string;
}

/**
 * Export artifact for storage
 */
export interface ExportArtifactInput {
  companyId: string;
  payrollRunId: string;
  exportType: ExportType;
  fileName: string;
  mimeType: string;
  content: Buffer;
  contentHash: string;
  recordCount: number;
  totalAmount?: number;
  dataSnapshot: Record<string, unknown>;
  generatedById: string;
}

/**
 * Export history item
 */
export interface ExportHistoryItem {
  id: string;
  exportType: ExportType;
  fileName: string;
  fileSizeBytes: number;
  recordCount: number;
  totalAmount: number | null;
  generatedAt: Date;
  generatedBy: string;
}

/**
 * Storage strategy for exports
 */
export type StorageStrategy = "database" | "blob";

/**
 * Configuration for export storage
 */
export interface ExportStorageConfig {
  // Max file size for database storage (bytes)
  maxDbStorageSize: number;
  // Vercel Blob store name
  blobStoreName?: string;
  // Default expiration in days (0 = no expiration)
  defaultExpirationDays: number;
}

export const DEFAULT_EXPORT_STORAGE_CONFIG: ExportStorageConfig = {
  maxDbStorageSize: 1024 * 1024, // 1MB
  defaultExpirationDays: 0, // No expiration
};

// =============================================================================
// DETAILED PAYROLL EXPORT TYPES
// =============================================================================

/**
 * Detailed payroll register row with all breakdowns and attendance
 */
export interface DetailedPayrollRow {
  // Employee Info
  employeeNumber: string;
  employeeName: string;
  department: string;
  position: string;
  hiringEntity: string;
  wageType: string;
  baseRate: number;

  // Attendance Summary
  workingDays: number;
  daysWorked: number;
  daysAbsent: number;
  regularHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeHours: number;
  nightDiffHours: number;

  // Holiday Work
  regularHolidayDays: number;
  regularHolidayPay: number;
  specialHolidayDays: number;
  specialHolidayPay: number;

  // Rest Day Work
  restDayDays: number;
  restDayPay: number;

  // Earnings Breakdown
  basicPay: number;
  overtimePay: number;
  nightDiffPay: number;
  holidayPay: number;  // Total holiday pay
  allowances: number;
  reimbursements: number;
  adjustmentsAdd: number;
  grossPay: number;

  // Deductions Breakdown
  lateDeduction: number;
  undertimeDeduction: number;
  absentDeduction: number;
  sssEe: number;
  sssEr: number;
  philhealthEe: number;
  philhealthEr: number;
  pagibigEe: number;
  pagibigEr: number;
  withholdingTax: number;
  cashAdvanceDeduction: number;
  loanDeduction: number;
  adjustmentsDeduct: number;
  otherDeductions: number;
  totalDeductions: number;

  // Net Pay
  netPay: number;

  // Bank Info
  bankName: string;
  bankAccountNumber: string;
}

/**
 * Daily attendance record for detailed export
 */
export interface AttendanceDetailRow {
  employeeNumber: string;
  employeeName: string;
  date: string;
  dayOfWeek: string;
  dayType: string;  // REGULAR_WORKING_DAY, REGULAR_HOLIDAY, SPECIAL_HOLIDAY, REST_DAY, etc.
  holidayName: string | null;
  scheduledIn: string | null;
  scheduledOut: string | null;
  actualIn: string | null;
  actualOut: string | null;
  hoursWorked: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  nightDiffMinutes: number;
  status: string;  // PRESENT, ABSENT, ON_LEAVE, HOLIDAY, etc.
  remarks: string | null;
}
