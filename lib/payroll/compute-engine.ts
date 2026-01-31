// =============================================================================
// PeopleOS PH - Payroll Computation Engine
// =============================================================================
//
// Main orchestrator for payroll computation. Takes inputs and produces payslips.
//
// Computation Flow:
// 1. Load pay period and ruleset
// 2. For each employee:
//    a. Calculate derived rates from pay profile
//    b. Compute basic pay
//    c. Compute deductions (late, undertime, absent)
//    d. Compute overtime pay
//    e. Compute night differential
//    f. Compute holiday/rest day premiums
//    g. Add allowances
//    h. Add manual adjustments
//    i. Add reimbursements, CA deductions, incentives
//    j. Calculate statutory deductions (if eligible)
//    k. Calculate withholding tax
//    l. Sum totals and generate payslip
// 3. Lock attendance records
// 4. Return computed payslips
//
// =============================================================================

import type {
  PayProfileInput,
  AttendanceDayInput,
  ComputedPayslip,
  ComputedPayslipLine,
  ManualAdjustment,
  RulesetInput,
  PayPeriodInput,
  EmployeeRegularizationInput,
  PayFrequency,
} from "./types";

import { calculateDerivedRates, type DerivedRates } from "./wage-calculator";

import {
  generateBasicPayLine,
  generateLateDeductionLine,
  generateUndertimeDeductionLine,
  generateLateUtDeductionLine,
  generateAbsentDeductionLine,
  generateRegularOvertimeLine,
  generateRestDayOvertimeLine,
  generateHolidayOvertimeLine,
  generateNightDiffLine,
  generateHolidayPremiumLines,
  generateRestDayPremiumLine,
  generateAllowanceLines,
  generateManualAdjustmentLines,
} from "./payslip-generator";

import {
  isEligibleForStatutory,
  generateSSSLines,
  generatePhilHealthLines,
  generatePagIBIGLines,
  generateWithholdingTaxLine,
  DEFAULT_SSS_TABLE_2024,
  DEFAULT_PHILHEALTH_TABLE_2024,
  DEFAULT_PAGIBIG_TABLE_2024,
  DEFAULT_TAX_TABLE_2023,
} from "./statutory-calculator";

// =============================================================================
// Types
// =============================================================================

/**
 * Input for computing a single employee's payslip.
 */
export interface EmployeePayrollInput {
  profile: PayProfileInput;
  regularization: EmployeeRegularizationInput;
  attendance: AttendanceDayInput[];
  manualAdjustments: ManualAdjustment[];
  // Note: reimbursements, cashAdvanceDeductions, orIncentives removed
  // These are now added manually via ManualAdjustmentLine
  reimbursements?: Array<{ id: string; amount: number; description: string }>;
  cashAdvanceDeductions?: Array<{ id: string; amount: number }>;
  orIncentives?: Array<{ id: string; amount: number; description: string }>;
  previousYtd: {
    grossPay: number;
    taxableIncome: number;
    taxWithheld: number;
  };
  // Declared wage override for statutory/tax calculations (SUPER_ADMIN only)
  // If set, this wage is used for SSS, PhilHealth, PagIBIG, and tax calculations
  // instead of the RoleScorecard wage. Actual payroll earnings still use RoleScorecard.
  statutoryOverride?: {
    baseRate: number;
    wageType: "MONTHLY" | "DAILY" | "HOURLY";
  };
  // Tax calculation mode (SUPER_ADMIN only)
  // When true: Withholding tax uses full taxable earnings (earnings - statutory - non-taxable)
  // When false (default): Withholding tax uses only Basic Pay - Late/Undertime
  taxOnFullEarnings?: boolean;
}

/**
 * Payroll run computation result.
 */
export interface PayrollComputationResult {
  payslips: ComputedPayslip[];
  totals: {
    grossPay: number;
    totalEarnings: number;
    totalDeductions: number;
    netPay: number;
    sssEeTotal: number;
    sssErTotal: number;
    philhealthEeTotal: number;
    philhealthErTotal: number;
    pagibigEeTotal: number;
    pagibigErTotal: number;
    withholdingTaxTotal: number;
  };
  employeeCount: number;
  errors: Array<{ employeeId: string; error: string }>;
}

// =============================================================================
// Main Computation Function
// =============================================================================

/**
 * Compute payroll for a pay period.
 *
 * @param payPeriod Pay period details
 * @param ruleset Ruleset with statutory tables
 * @param employees Employee inputs
 * @returns Computed payslips and totals
 */
export function computePayroll(
  payPeriod: PayPeriodInput,
  ruleset: RulesetInput,
  employees: EmployeePayrollInput[]
): PayrollComputationResult {
  const payslips: ComputedPayslip[] = [];
  const errors: Array<{ employeeId: string; error: string }> = [];

  // Compute each employee
  for (const employee of employees) {
    try {
      const payslip = computeEmployeePayslip(payPeriod, ruleset, employee);
      payslips.push(payslip);
    } catch (error) {
      errors.push({
        employeeId: employee.profile.employeeId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Calculate totals
  const totals = {
    grossPay: sum(payslips, "grossPay"),
    totalEarnings: sum(payslips, "totalEarnings"),
    totalDeductions: sum(payslips, "totalDeductions"),
    netPay: sum(payslips, "netPay"),
    sssEeTotal: sum(payslips, "sssEe"),
    sssErTotal: sum(payslips, "sssEr"),
    philhealthEeTotal: sum(payslips, "philhealthEe"),
    philhealthErTotal: sum(payslips, "philhealthEr"),
    pagibigEeTotal: sum(payslips, "pagibigEe"),
    pagibigErTotal: sum(payslips, "pagibigEr"),
    withholdingTaxTotal: sum(payslips, "withholdingTax"),
  };

  return {
    payslips,
    totals,
    employeeCount: payslips.length,
    errors,
  };
}

/**
 * Compute payslip for a single employee.
 */
export function computeEmployeePayslip(
  payPeriod: PayPeriodInput,
  ruleset: RulesetInput,
  employee: EmployeePayrollInput
): ComputedPayslip {
  const { profile, regularization, attendance } = employee;
  const lines: ComputedPayslipLine[] = [];

  // 1. Calculate derived rates
  const rates = calculateDerivedRates(profile);
  const standardMinutesPerDay = profile.standardHoursPerDay * 60;
  const periodsPerMonth = getPeriodsPerMonth(payPeriod.payFrequency);

  // 2. Count work days in period
  const workDays = countWorkDays(attendance);

  // 3. Generate basic pay line
  lines.push(
    generateBasicPayLine(profile, rates, workDays, payPeriod.payFrequency)
  );

  // 4. Generate deduction lines
  const totalLate = sumAttendance(attendance, "lateMinutes");
  const totalUndertime = sumAttendance(attendance, "undertimeMinutes");
  const totalAbsent = sumAttendance(attendance, "absentMinutes");

  // Combined Late/Undertime deduction line (uses minute_rate)
  const lateUtLine = generateLateUtDeductionLine(totalLate, totalUndertime, rates);
  if (lateUtLine) lines.push(lateUtLine);

  // Absent deduction only applies to MONTHLY wage type
  // For DAILY/HOURLY wage types, employees are only paid for days/hours worked,
  // so absences are already "deducted" by not being included in basic pay
  if (profile.wageType === "MONTHLY") {
    const absentLine = generateAbsentDeductionLine(
      totalAbsent,
      rates,
      standardMinutesPerDay
    );
    if (absentLine) lines.push(absentLine);
  }

  // 5. Generate overtime lines
  if (profile.isOtEligible) {
    const otLines = generateOvertimeLines(attendance, rates, standardMinutesPerDay);
    lines.push(...otLines);
  }

  // 6. Generate night differential line
  if (profile.isNdEligible) {
    const totalNd = sumAttendance(attendance, "nightDiffMinutes");
    const ndLine = generateNightDiffLine(totalNd, rates);
    if (ndLine) lines.push(ndLine);
  }

  // 7. Generate holiday and rest day premium lines
  const holidayLines = generateHolidayPremiumLines(
    attendance,
    rates,
    standardMinutesPerDay
  );
  lines.push(...holidayLines);

  const restDayLine = generateRestDayPremiumLine(attendance, rates);
  if (restDayLine) lines.push(restDayLine);

  // 8. Generate allowance lines
  const allowanceLines = generateAllowanceLines(profile, periodsPerMonth);
  lines.push(...allowanceLines);

  // 9. Generate manual adjustment lines
  // Note: Reimbursements, Cash Advances, and OR Incentives are now added
  // manually via ManualAdjustmentLine rather than automatically
  const adjustmentLines = generateManualAdjustmentLines(
    employee.manualAdjustments
  );
  lines.push(...adjustmentLines);

  // 13. Calculate statutory deductions (if eligible)
  let sssEe = 0,
    sssEr = 0,
    philhealthEe = 0,
    philhealthEr = 0,
    pagibigEe = 0,
    pagibigEr = 0;

  const isStatutoryEligible = isEligibleForStatutory(
    regularization,
    payPeriod,
    profile.isBenefitsEligible
  );

  if (isStatutoryEligible) {
    const sssTable = ruleset.sssTable || DEFAULT_SSS_TABLE_2024;
    const philhealthTable = ruleset.philhealthTable || DEFAULT_PHILHEALTH_TABLE_2024;
    const pagibigTable = ruleset.pagibigTable || DEFAULT_PAGIBIG_TABLE_2024;

    // Use MSC (Monthly Salary Credit = daily rate × 26) for statutory contributions
    // This is the standard base for SSS, PhilHealth, and Pag-IBIG per DOLE guidelines
    // If statutoryOverride is set, use the override wage instead of RoleScorecard wage
    let monthlyGross = rates.msc;
    if (employee.statutoryOverride) {
      const override = employee.statutoryOverride;
      // Calculate MSC from statutory override wage
      const standardWorkDaysPerMonth = profile.standardWorkDaysPerMonth || 26;
      const standardHoursPerDay = profile.standardHoursPerDay || 8;
      const statutoryDailyRate =
        override.wageType === "DAILY"
          ? override.baseRate
          : override.wageType === "HOURLY"
            ? override.baseRate * standardHoursPerDay
            : override.baseRate / standardWorkDaysPerMonth;
      monthlyGross = statutoryDailyRate * 26;
    }

    // SSS
    const sssLines = generateSSSLines(monthlyGross, sssTable, periodsPerMonth);
    lines.push(sssLines.eeLine);
    sssEe = sssLines.eeLine.amount;
    sssEr = sssLines.erLine.amount;

    // PhilHealth
    const philhealthLines = generatePhilHealthLines(
      monthlyGross,
      philhealthTable,
      periodsPerMonth
    );
    lines.push(philhealthLines.eeLine);
    philhealthEe = philhealthLines.eeLine.amount;
    philhealthEr = philhealthLines.erLine.amount;

    // Pag-IBIG
    const pagibigLines = generatePagIBIGLines(
      monthlyGross,
      pagibigTable,
      periodsPerMonth
    );
    lines.push(pagibigLines.eeLine);
    pagibigEe = pagibigLines.eeLine.amount;
    pagibigEr = pagibigLines.erLine.amount;
  }

  // 14. Calculate withholding tax
  let withholdingTax = 0;

  if (isStatutoryEligible) {
    const taxTable = ruleset.taxTable || DEFAULT_TAX_TABLE_2023;

    let currentPeriodTaxable: number;

    if (employee.taxOnFullEarnings) {
      // SUPER_ADMIN mode: Use full taxable earnings (all earnings - statutory - non-taxable)
      // This includes OT, holiday pay, bonuses, commissions, etc.
      const preStatutoryEarnings = sumEarnings(lines);
      const nonTaxableAllowances = calculateNonTaxableAllowances(profile, periodsPerMonth);
      currentPeriodTaxable = Math.max(
        0,
        preStatutoryEarnings - sssEe - philhealthEe - pagibigEe - nonTaxableAllowances
      );
    } else {
      // Default mode: Withholding tax is based ONLY on Basic Pay minus Late/Undertime
      // NOT on full earnings (excludes OT, holiday pay, bonuses, commissions, etc.)
      // If statutoryOverride is set, use that wage as the base
      let taxBasicPay: number;
      let taxLateUtDeduction: number;

      if (employee.statutoryOverride) {
        // Calculate basic pay from statutory override wage
        const override = employee.statutoryOverride;
        const standardWorkDaysPerMonth = profile.standardWorkDaysPerMonth || 26;
        const standardHoursPerDay = profile.standardHoursPerDay || 8;
        const overrideDailyRate =
          override.wageType === "DAILY"
            ? override.baseRate
            : override.wageType === "HOURLY"
              ? override.baseRate * standardHoursPerDay
              : override.baseRate / standardWorkDaysPerMonth;
        const overrideMinuteRate = overrideDailyRate / (standardHoursPerDay * 60);

        taxBasicPay = round(overrideDailyRate * workDays, 4);
        taxLateUtDeduction = round(overrideMinuteRate * (totalLate + totalUndertime), 4);
      } else {
        // Use actual rates from pay profile
        taxBasicPay = round(rates.dailyRate * workDays, 4);
        taxLateUtDeduction = round(rates.minuteRate * (totalLate + totalUndertime), 4);
      }

      // Tax base = Basic Pay - Late/Undertime - Statutory deductions
      const taxBase = taxBasicPay - taxLateUtDeduction;
      currentPeriodTaxable = Math.max(
        0,
        taxBase - sssEe - philhealthEe - pagibigEe
      );
    }

    const totalPeriodsPerYear = periodsPerMonth * 12;

    // Calculate the employee's effective payroll period for tax projection
    // The tax calculation uses cumulative method where:
    //   projectedAnnual = (cumulativeTaxable / periodsReceived) * totalPeriods
    //
    // IMPORTANT: For a new employee with no YTD history:
    //   - Calendar period might be 24 (December), but they've only had 1 payroll
    //   - Using 24 would project (15K/24)*24 = 15K annual = no tax (WRONG)
    //   - Using 1 would project (15K/1)*24 = 360K annual = taxable (CORRECT)
    //
    // Logic:
    // - If YTD > 0: employee has previous payrolls, use calendar period for accuracy
    // - If YTD = 0: this is their first payroll of the year, use period 1
    const calendarPeriod = calculateTaxPeriodNumber(payPeriod.startDate, periodsPerMonth);
    const hasYtdHistory = employee.previousYtd.taxableIncome > 0;
    const taxPeriodNumber = hasYtdHistory ? calendarPeriod : 1;

    const taxLine = generateWithholdingTaxLine(
      currentPeriodTaxable,
      employee.previousYtd.taxableIncome,
      employee.previousYtd.taxWithheld,
      taxPeriodNumber,
      totalPeriodsPerYear,
      taxTable
    );

    if (taxLine) {
      lines.push(taxLine);
      withholdingTax = taxLine.amount;
    }
  }

  // Sort lines by sort order
  lines.sort((a, b) => a.sortOrder - b.sortOrder);

  // Calculate final totals
  const totalEarnings = sumEarnings(lines);
  const totalDeductions = sumDeductions(lines);
  const grossPay = totalEarnings;
  const netPay = round(totalEarnings - totalDeductions, 4);

  // Calculate YTD
  const ytdGrossPay = employee.previousYtd.grossPay + grossPay;
  const ytdTaxableIncome =
    employee.previousYtd.taxableIncome +
    Math.max(0, grossPay - sssEe - philhealthEe - pagibigEe);
  const ytdTaxWithheld = employee.previousYtd.taxWithheld + withholdingTax;

  return {
    employeeId: profile.employeeId,
    lines,
    grossPay,
    totalEarnings,
    totalDeductions,
    netPay,
    sssEe,
    sssEr,
    philhealthEe,
    philhealthEr,
    pagibigEe,
    pagibigEr,
    withholdingTax,
    ytdGrossPay,
    ytdTaxableIncome,
    ytdTaxWithheld,
    payProfileSnapshot: profile,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate overtime lines from attendance records.
 *
 * OT Approval Rules:
 * - Early in / late out OT: ONLY counted if explicitly approved (earlyInApproved/lateOutApproved)
 * - Rest day OT: Auto-approved (always counted)
 * - Holiday OT: Auto-approved (always counted)
 *
 * Holiday OT includes:
 * - Stored overtimeHolidayMinutes
 * - Excess minutes beyond standard hours (workedMinutes - standardMinutesPerDay)
 */
function generateOvertimeLines(
  attendance: AttendanceDayInput[],
  rates: DerivedRates,
  standardMinutesPerDay: number
): ComputedPayslipLine[] {
  const lines: ComputedPayslipLine[] = [];

  // IMPORTANT: Only count OT for days where employee actually worked (workedMinutes > 0)
  // This prevents false OT earnings on rest days or holidays with no actual work rendered.

  // Regular OT (regular work days) - only count APPROVED early in/late out
  // AND only if there were actual worked minutes
  const regularOt = attendance
    .filter((a) => a.dayType === "WORKDAY" && a.workedMinutes > 0)
    .reduce((sum, a) => {
      const approvedEarlyIn = a.earlyInApproved ? a.otEarlyInMinutes : 0;
      const approvedLateOut = a.lateOutApproved ? a.otLateOutMinutes : 0;
      return sum + approvedEarlyIn + approvedLateOut;
    }, 0);

  const regularOtLine = generateRegularOvertimeLine(
    regularOt,
    rates,
    attendance.filter((a) => a.dayType === "WORKDAY" && a.workedMinutes > 0).map((a) => a.id)
  );
  if (regularOtLine) lines.push(regularOtLine);

  // Rest day OT - auto-approved BUT only if there was actual work
  const restDayOt = attendance
    .filter((a) => a.dayType === "REST_DAY" && a.workedMinutes > 0)
    .reduce((sum, a) => sum + a.overtimeRestDayMinutes, 0);
  const restDayOtLine = generateRestDayOvertimeLine(restDayOt, rates);
  if (restDayOtLine) lines.push(restDayOtLine);

  // Holiday OT - Regular (requires approval via earlyIn/lateOut flags)
  // Only counts approved OT fields to avoid double-counting with excess minutes
  const regularHolidayOt = attendance
    .filter((a) => a.dayType === "REGULAR_HOLIDAY" && a.workedMinutes > 0)
    .reduce((sum, a) => {
      // Only count approved early in/late out OT
      const approvedEarlyIn = a.earlyInApproved ? a.otEarlyInMinutes : 0;
      const approvedLateOut = a.lateOutApproved ? a.otLateOutMinutes : 0;
      return sum + approvedEarlyIn + approvedLateOut;
    }, 0);

  const regularHolidayOtLine = generateHolidayOvertimeLine(
    regularHolidayOt,
    rates,
    "REGULAR"
  );
  if (regularHolidayOtLine) lines.push(regularHolidayOtLine);

  // Holiday OT - Special (requires approval via earlyIn/lateOut flags)
  // Only counts approved OT fields to avoid double-counting with excess minutes
  const specialHolidayOt = attendance
    .filter((a) => a.dayType === "SPECIAL_HOLIDAY" && a.workedMinutes > 0)
    .reduce((sum, a) => {
      // Only count approved early in/late out OT
      const approvedEarlyIn = a.earlyInApproved ? a.otEarlyInMinutes : 0;
      const approvedLateOut = a.lateOutApproved ? a.otLateOutMinutes : 0;
      return sum + approvedEarlyIn + approvedLateOut;
    }, 0);

  const specialHolidayOtLine = generateHolidayOvertimeLine(
    specialHolidayOt,
    rates,
    "SPECIAL"
  );
  if (specialHolidayOtLine) lines.push(specialHolidayOtLine);

  return lines;
}

/**
 * Count work days for Basic Pay calculation.
 *
 * Basic Pay = dailyRate × workDays
 *
 * Work days include:
 * - Regular work days where employee worked (workedMinutes > 0)
 * - Leave days (paid leave)
 *
 * Work days do NOT include:
 * - Unworked regular holidays (paid separately via "Regular Holiday Pay - Unworked")
 * - Worked regular holidays (paid separately via "Regular Holiday Premium")
 * - Special holidays (no work = no pay)
 * - Rest days without work
 */
function countWorkDays(attendance: AttendanceDayInput[]): number {
  return attendance.filter((a) => {
    // Leave days count as work days (paid leave)
    if (a.isOnLeave) return true;

    // Days with actual work, but NOT holidays (holiday work gets premium, not basic pay)
    // - REGULAR_HOLIDAY work → Holiday Premium (200%)
    // - SPECIAL_HOLIDAY work → Holiday Premium (130%)
    if (
      a.workedMinutes > 0 &&
      a.dayType !== "REGULAR_HOLIDAY" &&
      a.dayType !== "SPECIAL_HOLIDAY"
    ) {
      return true;
    }

    return false;
  }).length;
}

/**
 * Sum a numeric field from attendance records.
 */
function sumAttendance(
  attendance: AttendanceDayInput[],
  field: keyof AttendanceDayInput
): number {
  return attendance.reduce((sum, a) => {
    const value = a[field];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

/**
 * Sum earnings from payslip lines.
 */
function sumEarnings(lines: ComputedPayslipLine[]): number {
  const earningCategories = [
    "BASIC_PAY",
    "OVERTIME_REGULAR",
    "OVERTIME_REST_DAY",
    "OVERTIME_HOLIDAY",
    "NIGHT_DIFFERENTIAL",
    "HOLIDAY_PAY",
    "REST_DAY_PAY",
    "ALLOWANCE",
    "REIMBURSEMENT",
    "INCENTIVE",
    "BONUS",
    "ADJUSTMENT_ADD",
  ];

  return lines
    .filter((l) => earningCategories.includes(l.category))
    .reduce((sum, l) => sum + l.amount, 0);
}

/**
 * Sum deductions from payslip lines.
 */
function sumDeductions(lines: ComputedPayslipLine[]): number {
  const deductionCategories = [
    "LATE_DEDUCTION",
    "UNDERTIME_DEDUCTION",
    "LATE_UT_DEDUCTION",
    "ABSENT_DEDUCTION",
    "SSS_EE",
    "PHILHEALTH_EE",
    "PAGIBIG_EE",
    "TAX_WITHHOLDING",
    "CASH_ADVANCE_DEDUCTION",
    "LOAN_DEDUCTION",
    "ADJUSTMENT_DEDUCT",
    "OTHER_DEDUCTION",
  ];

  return lines
    .filter((l) => deductionCategories.includes(l.category))
    .reduce((sum, l) => sum + l.amount, 0);
}

/**
 * Sum a field from computed payslips.
 */
function sum(payslips: ComputedPayslip[], field: keyof ComputedPayslip): number {
  return payslips.reduce((total, p) => {
    const value = p[field];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

/**
 * Calculate non-taxable allowances (de minimis).
 * Used when taxOnFullEarnings is enabled (SUPER_ADMIN mode).
 */
function calculateNonTaxableAllowances(
  profile: PayProfileInput,
  periodsPerMonth: number
): number {
  // De minimis limits (monthly)
  const deMinimisLimits = {
    riceSubsidy: 2000,
    clothingAllowance: 6000 / 12, // 6000 per year
    laundryAllowance: 300,
    medicalAllowance: 250,
  };

  const ricePerPeriod = Math.min(
    profile.riceSubsidy / periodsPerMonth,
    deMinimisLimits.riceSubsidy / periodsPerMonth
  );

  const clothingPerPeriod = Math.min(
    profile.clothingAllowance / periodsPerMonth,
    deMinimisLimits.clothingAllowance / periodsPerMonth
  );

  const laundryPerPeriod = Math.min(
    profile.laundryAllowance / periodsPerMonth,
    deMinimisLimits.laundryAllowance / periodsPerMonth
  );

  const medicalPerPeriod = Math.min(
    profile.medicalAllowance / periodsPerMonth,
    deMinimisLimits.medicalAllowance / periodsPerMonth
  );

  return ricePerPeriod + clothingPerPeriod + laundryPerPeriod + medicalPerPeriod;
}

/**
 * Get number of pay periods per month.
 */
function getPeriodsPerMonth(payFrequency: PayFrequency): number {
  switch (payFrequency) {
    case "MONTHLY":
      return 1;
    case "SEMI_MONTHLY":
      return 2;
    case "BI_WEEKLY":
      return 2.17;
    case "WEEKLY":
      return 4.33;
    default:
      return 2;
  }
}

/**
 * Calculate the tax period number within the current tax year.
 *
 * The stored periodNumber from PayPeriod may span multiple years, which breaks
 * the withholding tax projection calculation. This function calculates the
 * correct period number (1-24 for semi-monthly, 1-12 for monthly) based on
 * the pay period start date.
 *
 * For semi-monthly:
 *   - Jan 1-15 = period 1
 *   - Jan 16-31 = period 2
 *   - Feb 1-15 = period 3
 *   - etc.
 *
 * @param periodStartDate The start date of the pay period
 * @param periodsPerMonth Number of pay periods per month (2 for semi-monthly)
 * @returns Period number within the tax year (1-based)
 */
function calculateTaxPeriodNumber(
  periodStartDate: Date,
  periodsPerMonth: number
): number {
  const month = periodStartDate.getMonth(); // 0-11
  const day = periodStartDate.getDate();

  // Calculate periods completed in previous months
  const periodsFromPreviousMonths = month * periodsPerMonth;

  // Calculate which period within the current month
  // For semi-monthly: day 1-15 = period 1, day 16+ = period 2
  // For monthly: always period 1
  let periodWithinMonth = 1;
  if (periodsPerMonth === 2) {
    periodWithinMonth = day <= 15 ? 1 : 2;
  } else if (periodsPerMonth >= 4) {
    // Weekly: approximately which week of the month
    periodWithinMonth = Math.min(Math.ceil(day / 7), Math.floor(periodsPerMonth));
  }

  return Math.max(1, Math.floor(periodsFromPreviousMonths + periodWithinMonth));
}

/**
 * Round to specified decimal places.
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
