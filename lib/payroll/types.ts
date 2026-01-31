// =============================================================================
// PeopleOS PH - Payroll Computation Types
// =============================================================================

import type { Prisma } from "@/app/generated/prisma";

type Decimal = Prisma.Decimal;

/**
 * Wage type determines how basic pay is calculated.
 */
export type WageType = "MONTHLY" | "DAILY" | "HOURLY";

/**
 * Pay frequency affects statutory contribution calculations.
 */
export type PayFrequency = "MONTHLY" | "SEMI_MONTHLY" | "BI_WEEKLY" | "WEEKLY";

/**
 * Day type for attendance computation.
 */
export type DayType =
  | "WORKDAY"
  | "REST_DAY"
  | "REGULAR_HOLIDAY"
  | "SPECIAL_HOLIDAY"
  | "SPECIAL_WORKING";

/**
 * Payslip line category.
 */
export type PayslipLineCategory =
  | "BASIC_PAY"
  | "OVERTIME_REGULAR"
  | "OVERTIME_REST_DAY"
  | "OVERTIME_HOLIDAY"
  | "NIGHT_DIFFERENTIAL"
  | "HOLIDAY_PAY"
  | "REST_DAY_PAY"
  | "ALLOWANCE"
  | "REIMBURSEMENT"
  | "INCENTIVE"
  | "BONUS"
  | "ADJUSTMENT_ADD"
  | "LATE_DEDUCTION"
  | "UNDERTIME_DEDUCTION"
  | "LATE_UT_DEDUCTION"
  | "ABSENT_DEDUCTION"
  | "SSS_EE"
  | "SSS_ER"
  | "PHILHEALTH_EE"
  | "PHILHEALTH_ER"
  | "PAGIBIG_EE"
  | "PAGIBIG_ER"
  | "TAX_WITHHOLDING"
  | "CASH_ADVANCE_DEDUCTION"
  | "LOAN_DEDUCTION"
  | "ADJUSTMENT_DEDUCT"
  | "OTHER_DEDUCTION";

/**
 * Pay profile snapshot for computation.
 */
export interface PayProfileInput {
  employeeId: string;
  wageType: WageType;
  baseRate: number;
  payFrequency: PayFrequency;
  standardWorkDaysPerMonth: number;
  standardHoursPerDay: number;

  // Eligibility
  isBenefitsEligible: boolean;
  isOtEligible: boolean;
  isNdEligible: boolean;

  // Allowances (per pay period)
  riceSubsidy: number;
  clothingAllowance: number;
  laundryAllowance: number;
  medicalAllowance: number;
  transportationAllowance: number;
  mealAllowance: number;
  communicationAllowance: number;
}

/**
 * Attendance day record input for computation.
 */
export interface AttendanceDayInput {
  id: string;
  attendanceDate: Date;
  dayType: DayType;
  holidayName?: string;

  // Time data
  workedMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  absentMinutes: number;

  // Overtime minutes (already computed based on shift)
  // Early in/late out OT requires approval to count in payroll
  // Rest day/holiday OT is auto-approved
  otEarlyInMinutes: number;
  otLateOutMinutes: number;
  overtimeRestDayMinutes: number;
  overtimeHolidayMinutes: number;

  // OT Approval flags
  // Only early in/late out requires approval; rest day/holiday OT is auto-approved
  earlyInApproved: boolean;
  lateOutApproved: boolean;

  // Night differential
  nightDiffMinutes: number;

  // Multipliers applied (from day type resolution)
  holidayMultiplier?: number;
  restDayMultiplier?: number;

  // Leave info
  isOnLeave: boolean;
  leaveIsPaid: boolean;
  leaveHours?: number;
}

/**
 * Computed payslip line.
 */
export interface ComputedPayslipLine {
  category: PayslipLineCategory;
  description: string;
  quantity?: number;
  rate?: number;
  multiplier?: number;
  amount: number;
  sortOrder: number;

  // Source traceability
  attendanceDayRecordId?: string;
  manualAdjustmentId?: string;

  // Rule traceability
  ruleCode?: string;
  ruleDescription?: string;
}

/**
 * Computed payslip result.
 */
export interface ComputedPayslip {
  employeeId: string;
  lines: ComputedPayslipLine[];

  // Totals
  grossPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;

  // Statutory breakdowns
  sssEe: number;
  sssEr: number;
  philhealthEe: number;
  philhealthEr: number;
  pagibigEe: number;
  pagibigEr: number;
  withholdingTax: number;

  // YTD (to be updated)
  ytdGrossPay: number;
  ytdTaxableIncome: number;
  ytdTaxWithheld: number;

  // Pay profile snapshot
  payProfileSnapshot: PayProfileInput;
}

/**
 * Manual adjustment for a payroll run.
 */
export interface ManualAdjustment {
  id?: string;
  employeeId: string;
  type: "EARNING" | "DEDUCTION";
  category: PayslipLineCategory;
  description: string;
  amount: number;
  remarks?: string;
}

/**
 * Ruleset version with multiplier rules.
 */
export interface RulesetInput {
  id: string;
  version: number;

  // Multiplier rules
  multipliers: MultiplierRuleInput[];

  // Statutory table references
  sssTable?: SSSTableInput;
  philhealthTable?: PhilHealthTableInput;
  pagibigTable?: PagIBIGTableInput;
  taxTable?: TaxTableInput;
}

/**
 * Multiplier rule for OT, ND, holidays.
 */
export interface MultiplierRuleInput {
  code: string;
  name: string;
  dayType?: DayType;
  isRestDay?: boolean;
  isOvertime?: boolean;
  isNightDiff?: boolean;
  multiplier: number;
  priority: number;
}

/**
 * SSS contribution table.
 */
export interface SSSTableInput {
  effectiveDate: Date;
  brackets: Array<{
    minSalary: number;
    maxSalary: number;
    regularSsEe: number;
    regularSsEr: number;
    ecEr: number;
    mpfEe: number;
    mpfEr: number;
  }>;
}

/**
 * PhilHealth contribution table.
 */
export interface PhilHealthTableInput {
  effectiveDate: Date;
  premiumRate: number; // e.g., 0.05 for 5%
  minBase: number;
  maxBase: number;
  eeShare: number; // e.g., 0.5 for 50% employee share
}

/**
 * Pag-IBIG contribution table.
 */
export interface PagIBIGTableInput {
  effectiveDate: Date;
  eeRate: number; // e.g., 0.02 for 2%
  erRate: number;
  maxBase: number;
}

/**
 * Withholding tax table.
 */
export interface TaxTableInput {
  effectiveDate: Date;
  brackets: Array<{
    minIncome: number;
    maxIncome: number;
    baseTax: number;
    excessRate: number;
  }>;
}

/**
 * Employee regularization status for statutory eligibility.
 */
export interface EmployeeRegularizationInput {
  employeeId: string;
  employmentType: "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "CONSULTANT" | "INTERN";
  regularizationDate?: Date;
  hireDate: Date;
}

/**
 * Pay period context for computation.
 */
export interface PayPeriodInput {
  id: string;
  startDate: Date;
  endDate: Date;
  cutoffDate: Date;
  payDate: Date;
  periodNumber: number;
  payFrequency: PayFrequency;
}

/**
 * Full payroll computation context.
 */
export interface PayrollComputationContext {
  payPeriod: PayPeriodInput;
  ruleset: RulesetInput;
  employees: Array<{
    profile: PayProfileInput;
    regularization: EmployeeRegularizationInput;
    attendance: AttendanceDayInput[];
    manualAdjustments: ManualAdjustment[];
    reimbursements: Array<{ id: string; amount: number; description: string }>;
    cashAdvanceDeductions: Array<{ id: string; amount: number }>;
    orIncentives: Array<{ id: string; amount: number; description: string }>;
    previousYtd: {
      grossPay: number;
      taxableIncome: number;
      taxWithheld: number;
    };
  }>;
}
