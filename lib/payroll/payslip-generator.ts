// =============================================================================
// PeopleOS PH - Payslip Line Generator
// =============================================================================
//
// Generates individual payslip lines from attendance records and other inputs.
// Each function generates lines for a specific component (basic pay, OT, etc.)
// =============================================================================

import type {
  PayProfileInput,
  AttendanceDayInput,
  ComputedPayslipLine,
  DayType,
  ManualAdjustment,
} from "./types";
import {
  calculateDerivedRates,
  calculateBasicPay,
  calculateLateDeduction,
  calculateUndertimeDeduction,
  calculateAbsentDeduction,
  calculateOvertimePay,
  calculateNightDiffPay,
  calculateHolidayPremiumPay,
  calculateRestDayPremiumPay,
  calculateUnworkedRegularHolidayPay,
  getDayRates,
  PH_MULTIPLIERS,
  type DerivedRates,
} from "./wage-calculator";

// =============================================================================
// Line Sort Order
// =============================================================================

const SORT_ORDER = {
  // Earnings
  BASIC_PAY: 100,
  REGULAR_HOLIDAY_PAY: 110,
  SPECIAL_HOLIDAY_PAY: 120,
  REST_DAY_PAY: 130,
  OVERTIME_REGULAR: 200,
  OVERTIME_REST_DAY: 210,
  OVERTIME_HOLIDAY: 220,
  NIGHT_DIFFERENTIAL: 300,
  ALLOWANCE: 400,
  REIMBURSEMENT: 500,
  INCENTIVE: 600,
  BONUS: 700,
  ADJUSTMENT_ADD: 800,

  // Deductions
  LATE_DEDUCTION: 1000,
  UNDERTIME_DEDUCTION: 1010,
  LATE_UT_DEDUCTION: 1015, // Combined Late + Undertime deduction
  ABSENT_DEDUCTION: 1020,
  SSS_EE: 1100,
  PHILHEALTH_EE: 1110,
  PAGIBIG_EE: 1120,
  TAX_WITHHOLDING: 1200,
  CASH_ADVANCE_DEDUCTION: 1300,
  LOAN_DEDUCTION: 1310,
  PENALTY_DEDUCTION: 1350,
  ADJUSTMENT_DEDUCT: 1400,
  OTHER_DEDUCTION: 1500,
} as const;

// =============================================================================
// Basic Pay Line
// =============================================================================

/**
 * Generate basic pay line.
 */
export function generateBasicPayLine(
  profile: PayProfileInput,
  rates: DerivedRates,
  workDays: number,
  payFrequency: "MONTHLY" | "SEMI_MONTHLY" | "BI_WEEKLY" | "WEEKLY"
): ComputedPayslipLine {
  const amount = calculateBasicPay(profile, rates, workDays, payFrequency);

  let description: string;
  let quantity: number | undefined;
  let rate: number | undefined;

  if (profile.wageType === "MONTHLY") {
    description =
      payFrequency === "SEMI_MONTHLY"
        ? "Basic Pay (Semi-Monthly)"
        : "Basic Pay (Monthly)";
  } else {
    description = `Basic Pay (${workDays} days)`;
    quantity = workDays;
    rate = rates.dailyRate;
  }

  return {
    category: "BASIC_PAY",
    description,
    quantity,
    rate,
    amount,
    sortOrder: SORT_ORDER.BASIC_PAY,
    ruleCode: "BASIC_PAY",
  };
}

// =============================================================================
// Deduction Lines
// =============================================================================

/**
 * Generate late deduction line.
 */
export function generateLateDeductionLine(
  totalLateMinutes: number,
  rates: DerivedRates
): ComputedPayslipLine | null {
  if (totalLateMinutes <= 0) return null;

  const amount = calculateLateDeduction(totalLateMinutes, rates);
  const hours = Math.round((totalLateMinutes / 60) * 100) / 100;

  return {
    category: "LATE_DEDUCTION",
    description: `Late Deduction (${hours} hrs)`,
    quantity: hours,
    rate: rates.hourlyRate,
    amount,
    sortOrder: SORT_ORDER.LATE_DEDUCTION,
    ruleCode: "LATE_DEDUCT",
  };
}

/**
 * Generate undertime deduction line.
 */
export function generateUndertimeDeductionLine(
  totalUndertimeMinutes: number,
  rates: DerivedRates
): ComputedPayslipLine | null {
  if (totalUndertimeMinutes <= 0) return null;

  const amount = calculateUndertimeDeduction(totalUndertimeMinutes, rates);
  const hours = Math.round((totalUndertimeMinutes / 60) * 100) / 100;

  return {
    category: "UNDERTIME_DEDUCTION",
    description: `Undertime Deduction (${hours} hrs)`,
    quantity: hours,
    rate: rates.hourlyRate,
    amount,
    sortOrder: SORT_ORDER.UNDERTIME_DEDUCTION,
    ruleCode: "UNDERTIME_DEDUCT",
  };
}

/**
 * Generate combined late/undertime deduction line.
 *
 * This combines late and undertime minutes into a single deduction line.
 * Amount = minuteRate × (lateMinutes + undertimeMinutes)
 *
 * @param totalLateMinutes Total late minutes
 * @param totalUndertimeMinutes Total undertime minutes
 * @param rates Derived rates (includes minuteRate)
 */
export function generateLateUtDeductionLine(
  totalLateMinutes: number,
  totalUndertimeMinutes: number,
  rates: DerivedRates
): ComputedPayslipLine | null {
  const totalMinutes = totalLateMinutes + totalUndertimeMinutes;
  if (totalMinutes <= 0) return null;

  // Calculate deduction using minute rate
  const amount = Math.round(rates.minuteRate * totalMinutes * 100) / 100;

  return {
    category: "LATE_UT_DEDUCTION",
    description: `Late/Undertime Deduction (${totalMinutes} mins)`,
    quantity: totalMinutes,
    rate: rates.minuteRate,
    amount,
    sortOrder: SORT_ORDER.LATE_UT_DEDUCTION,
    ruleCode: "LATE_UT_DEDUCT",
  };
}

/**
 * Generate absent deduction line.
 */
export function generateAbsentDeductionLine(
  totalAbsentMinutes: number,
  rates: DerivedRates,
  standardMinutesPerDay: number
): ComputedPayslipLine | null {
  if (totalAbsentMinutes <= 0) return null;

  const amount = calculateAbsentDeduction(
    totalAbsentMinutes,
    rates,
    standardMinutesPerDay
  );
  const days = Math.round((totalAbsentMinutes / standardMinutesPerDay) * 100) / 100;

  return {
    category: "ABSENT_DEDUCTION",
    description: `Absent Deduction (${days} days)`,
    quantity: days,
    rate: rates.dailyRate,
    amount,
    sortOrder: SORT_ORDER.ABSENT_DEDUCTION,
    ruleCode: "ABSENT_DEDUCT",
  };
}

// =============================================================================
// Overtime Lines
// =============================================================================

/**
 * Generate regular overtime line.
 */
export function generateRegularOvertimeLine(
  totalOtMinutes: number,
  rates: DerivedRates,
  attendanceRecordIds: string[]
): ComputedPayslipLine | null {
  if (totalOtMinutes <= 0) return null;

  const amount = calculateOvertimePay(
    totalOtMinutes,
    rates,
    PH_MULTIPLIERS.OT_REGULAR
  );

  return {
    category: "OVERTIME_REGULAR",
    description: `Regular Overtime (${totalOtMinutes} mins @ 125%)`,
    quantity: totalOtMinutes,
    rate: rates.minuteRate,
    multiplier: PH_MULTIPLIERS.OT_REGULAR,
    amount,
    sortOrder: SORT_ORDER.OVERTIME_REGULAR,
    ruleCode: "OT_REGULAR",
    ruleDescription: "Regular Day Overtime (125%)",
  };
}

/**
 * Generate rest day overtime line.
 */
export function generateRestDayOvertimeLine(
  totalOtMinutes: number,
  rates: DerivedRates
): ComputedPayslipLine | null {
  if (totalOtMinutes <= 0) return null;

  const amount = calculateOvertimePay(
    totalOtMinutes,
    rates,
    PH_MULTIPLIERS.REST_DAY_OT
  );

  return {
    category: "OVERTIME_REST_DAY",
    description: `Rest Day Overtime (${totalOtMinutes} mins @ 169%)`,
    quantity: totalOtMinutes,
    rate: rates.minuteRate,
    multiplier: PH_MULTIPLIERS.REST_DAY_OT,
    amount,
    sortOrder: SORT_ORDER.OVERTIME_REST_DAY,
    ruleCode: "OT_REST_DAY",
    ruleDescription: "Rest Day Overtime (169%)",
  };
}

/**
 * Generate holiday overtime line.
 */
export function generateHolidayOvertimeLine(
  totalOtMinutes: number,
  rates: DerivedRates,
  holidayType: "REGULAR" | "SPECIAL"
): ComputedPayslipLine | null {
  if (totalOtMinutes <= 0) return null;

  const multiplier =
    holidayType === "REGULAR"
      ? PH_MULTIPLIERS.REGULAR_HOLIDAY_OT
      : PH_MULTIPLIERS.SPECIAL_HOLIDAY_OT;

  const amount = calculateOvertimePay(totalOtMinutes, rates, multiplier);
  const pct = Math.round(multiplier * 100);

  return {
    category: "OVERTIME_HOLIDAY",
    description: `${holidayType === "REGULAR" ? "Regular" : "Special"} Holiday OT (${totalOtMinutes} mins @ ${pct}%)`,
    quantity: totalOtMinutes,
    rate: rates.minuteRate,
    multiplier,
    amount,
    sortOrder: SORT_ORDER.OVERTIME_HOLIDAY,
    ruleCode: `OT_${holidayType}_HOLIDAY`,
    ruleDescription: `${holidayType === "REGULAR" ? "Regular" : "Special"} Holiday Overtime (${pct}%)`,
  };
}

// =============================================================================
// Night Differential Line
// =============================================================================

/**
 * Generate night differential line.
 */
export function generateNightDiffLine(
  totalNdMinutes: number,
  rates: DerivedRates
): ComputedPayslipLine | null {
  if (totalNdMinutes <= 0) return null;

  const amount = calculateNightDiffPay(totalNdMinutes, rates, PH_MULTIPLIERS.NIGHT_DIFF);

  return {
    category: "NIGHT_DIFFERENTIAL",
    description: `Night Differential (${totalNdMinutes} mins @ 10%)`,
    quantity: totalNdMinutes,
    rate: rates.minuteRate,
    multiplier: PH_MULTIPLIERS.NIGHT_DIFF,
    amount,
    sortOrder: SORT_ORDER.NIGHT_DIFFERENTIAL,
    ruleCode: "NIGHT_DIFF",
    ruleDescription: "Night Differential (10%)",
  };
}

// =============================================================================
// Holiday & Rest Day Premium Lines
// =============================================================================

/**
 * Generate holiday premium lines from attendance records.
 * Uses per-day rate resolution when dailyRateOverride is set.
 */
export function generateHolidayPremiumLines(
  attendance: AttendanceDayInput[],
  rates: DerivedRates,
  standardMinutesPerDay: number,
  standardHoursPerDay: number = 8
): ComputedPayslipLine[] {
  const lines: ComputedPayslipLine[] = [];

  // Group by day type
  const regularHolidays = attendance.filter(
    (a) => a.dayType === "REGULAR_HOLIDAY" && a.workedMinutes > 0
  );
  const specialHolidays = attendance.filter(
    (a) => a.dayType === "SPECIAL_HOLIDAY" && a.workedMinutes > 0
  );
  const unworkedRegularHolidays = attendance.filter(
    (a) => a.dayType === "REGULAR_HOLIDAY" && a.workedMinutes === 0
  );

  // Regular holiday pay (worked) - FULL 200% for REGULAR HOURS ONLY
  // Per DOLE: Regular Holiday worked = 200% of daily rate
  // IMPORTANT: Cap at standard minutes per day - excess goes to Holiday OT (260%)
  if (regularHolidays.length > 0) {
    let totalRegularMinutes = 0;
    let totalAmount = 0;

    for (const a of regularHolidays) {
      const dayRates = getDayRates(rates, standardHoursPerDay, a.dailyRateOverride);
      const cappedMinutes = Math.min(a.workedMinutes, standardMinutesPerDay);
      totalRegularMinutes += cappedMinutes;
      totalAmount += dayRates.hourlyRate * (cappedMinutes / 60) * PH_MULTIPLIERS.REGULAR_HOLIDAY;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    if (totalAmount > 0) {
      lines.push({
        category: "HOLIDAY_PAY",
        description: `Regular Holiday Pay (${totalRegularMinutes} mins @ 200%)`,
        quantity: totalRegularMinutes,
        rate: rates.minuteRate,
        multiplier: PH_MULTIPLIERS.REGULAR_HOLIDAY,
        amount: totalAmount,
        sortOrder: SORT_ORDER.REGULAR_HOLIDAY_PAY,
        ruleCode: "REGULAR_HOLIDAY_WORKED",
        ruleDescription: "Regular Holiday Pay (200% of regular rate)",
      });
    }
  }

  // Special holiday pay (worked) - FULL 130% for REGULAR HOURS ONLY
  // Per DOLE: Special Holiday worked = 130% of daily rate (no work, no pay rule applies)
  // IMPORTANT: Cap at standard minutes per day - excess goes to Holiday OT
  if (specialHolidays.length > 0) {
    let totalRegularMinutes = 0;
    let totalAmount = 0;

    for (const a of specialHolidays) {
      const dayRates = getDayRates(rates, standardHoursPerDay, a.dailyRateOverride);
      const cappedMinutes = Math.min(a.workedMinutes, standardMinutesPerDay);
      totalRegularMinutes += cappedMinutes;
      totalAmount += dayRates.hourlyRate * (cappedMinutes / 60) * PH_MULTIPLIERS.SPECIAL_HOLIDAY;
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    if (totalAmount > 0) {
      lines.push({
        category: "HOLIDAY_PAY",
        description: `Special Holiday Pay (${totalRegularMinutes} mins @ 130%)`,
        quantity: totalRegularMinutes,
        rate: rates.minuteRate,
        multiplier: PH_MULTIPLIERS.SPECIAL_HOLIDAY,
        amount: totalAmount,
        sortOrder: SORT_ORDER.SPECIAL_HOLIDAY_PAY,
        ruleCode: "SPECIAL_HOLIDAY_WORKED",
        ruleDescription: "Special Holiday Pay (130% of regular rate)",
      });
    }
  }

  // Unworked regular holiday pay — per-day rate resolution
  if (unworkedRegularHolidays.length > 0) {
    const count = unworkedRegularHolidays.length;
    let totalAmount = 0;

    for (const a of unworkedRegularHolidays) {
      const dayRates = getDayRates(rates, standardHoursPerDay, a.dailyRateOverride);
      totalAmount += dayRates.dailyRate;
    }

    lines.push({
      category: "HOLIDAY_PAY",
      description: `Regular Holiday Pay - Unworked (${count} day${count > 1 ? "s" : ""})`,
      quantity: count,
      rate: rates.dailyRate,
      amount: totalAmount,
      sortOrder: SORT_ORDER.REGULAR_HOLIDAY_PAY + 1,
      ruleCode: "REGULAR_HOLIDAY_UNWORKED",
      ruleDescription: "Regular Holiday Pay (paid even if not worked)",
    });
  }

  return lines;
}

/**
 * Generate rest day premium line.
 * Uses per-day rate resolution when dailyRateOverride is set.
 */
export function generateRestDayPremiumLine(
  attendance: AttendanceDayInput[],
  rates: DerivedRates,
  standardHoursPerDay: number = 8
): ComputedPayslipLine | null {
  const restDayRecords = attendance.filter(
    (a) => a.dayType === "REST_DAY" && a.workedMinutes > 0
  );

  if (restDayRecords.length === 0) return null;

  let totalMinutes = 0;
  let totalAmount = 0;
  const premiumMultiplier = PH_MULTIPLIERS.REST_DAY - 1;

  for (const a of restDayRecords) {
    const dayRates = getDayRates(rates, standardHoursPerDay, a.dailyRateOverride);
    totalMinutes += a.workedMinutes;
    const regularPay = dayRates.hourlyRate * (a.workedMinutes / 60);
    totalAmount += regularPay * premiumMultiplier;
  }

  totalAmount = Math.round(totalAmount * 10000) / 10000;

  if (totalAmount <= 0) return null;

  return {
    category: "REST_DAY_PAY",
    description: `Rest Day Premium (${totalMinutes} mins @ 130%)`,
    quantity: totalMinutes,
    rate: rates.minuteRate,
    multiplier: premiumMultiplier,
    amount: totalAmount,
    sortOrder: SORT_ORDER.REST_DAY_PAY,
    ruleCode: "REST_DAY_PREMIUM",
    ruleDescription: "Rest Day Premium (30% additional)",
  };
}

// =============================================================================
// Allowance Lines
// =============================================================================

/**
 * Generate allowance lines from pay profile.
 */
export function generateAllowanceLines(
  profile: PayProfileInput,
  periodsPerMonth: number
): ComputedPayslipLine[] {
  const lines: ComputedPayslipLine[] = [];
  let sortOffset = 0;

  const addAllowance = (name: string, monthlyAmount: number) => {
    if (monthlyAmount <= 0) return;

    const amount = Math.round((monthlyAmount / periodsPerMonth) * 100) / 100;
    lines.push({
      category: "ALLOWANCE",
      description: name,
      amount,
      sortOrder: SORT_ORDER.ALLOWANCE + sortOffset++,
      ruleCode: `ALLOWANCE_${name.toUpperCase().replace(/\s/g, "_")}`,
    });
  };

  // De minimis allowances
  addAllowance("Rice Subsidy", profile.riceSubsidy);
  addAllowance("Clothing Allowance", profile.clothingAllowance);
  addAllowance("Laundry Allowance", profile.laundryAllowance);
  addAllowance("Medical Allowance", profile.medicalAllowance);

  // Other allowances
  addAllowance("Transportation Allowance", profile.transportationAllowance);
  addAllowance("Meal Allowance", profile.mealAllowance);
  addAllowance("Communication Allowance", profile.communicationAllowance);

  return lines;
}

// =============================================================================
// Manual Adjustment Lines
// =============================================================================

/**
 * Generate manual adjustment lines.
 */
export function generateManualAdjustmentLines(
  adjustments: ManualAdjustment[]
): ComputedPayslipLine[] {
  return adjustments.map((adj, index) => ({
    category: adj.type === "EARNING" ? "ADJUSTMENT_ADD" : "ADJUSTMENT_DEDUCT",
    description: adj.description,
    amount: adj.amount,
    sortOrder:
      adj.type === "EARNING"
        ? SORT_ORDER.ADJUSTMENT_ADD + index
        : SORT_ORDER.ADJUSTMENT_DEDUCT + index,
    manualAdjustmentId: adj.id,
    ruleCode: "MANUAL_ADJUSTMENT",
  }));
}

// =============================================================================
// Reimbursement, Cash Advance, OR Incentive Lines (REMOVED)
// =============================================================================
// Note: These generator functions have been removed.
// Reimbursements, Cash Advances, and OR Incentives are now added manually
// via ManualAdjustmentLine in the payroll adjustments tab.
