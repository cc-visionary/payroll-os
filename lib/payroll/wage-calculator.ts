// =============================================================================
// PeopleOS PH - Wage Calculator
// =============================================================================
//
// Handles wage calculations for different wage types:
// - Monthly: Base rate is monthly salary
// - Daily: Base rate is daily rate
// - Hourly: Base rate is hourly rate
//
// Key formulas (DOLE standard):
// - Daily Rate (from Monthly) = Monthly Rate / Days per Month
// - Hourly Rate = Daily Rate / Hours per Day
// - Minute Rate = Hourly Rate / 60
// =============================================================================

import type { PayProfileInput, WageType, PayFrequency } from "./types";

/**
 * Derived rates from base rate based on wage type.
 */
export interface DerivedRates {
  monthlyRate: number;
  dailyRate: number;
  hourlyRate: number;
  minuteRate: number;
  /** Monthly Salary Credit (MSC) = dailyRate × 26, used for statutory contributions */
  msc: number;
}

/**
 * Calculate derived rates from pay profile.
 *
 * @param profile Pay profile with base rate and wage type
 * @returns All derived rates for computation
 */
export function calculateDerivedRates(profile: PayProfileInput): DerivedRates {
  const { wageType, baseRate, standardWorkDaysPerMonth, standardHoursPerDay } = profile;

  let monthlyRate: number;
  let dailyRate: number;
  let hourlyRate: number;

  switch (wageType) {
    case "MONTHLY":
      // Monthly salary - derive daily and hourly
      monthlyRate = baseRate;
      dailyRate = monthlyRate / standardWorkDaysPerMonth;
      hourlyRate = dailyRate / standardHoursPerDay;
      break;

    case "DAILY":
      // Daily rate - derive monthly and hourly
      dailyRate = baseRate;
      hourlyRate = dailyRate / standardHoursPerDay;
      monthlyRate = dailyRate * standardWorkDaysPerMonth;
      break;

    case "HOURLY":
      // Hourly rate - derive daily and monthly
      hourlyRate = baseRate;
      dailyRate = hourlyRate * standardHoursPerDay;
      monthlyRate = dailyRate * standardWorkDaysPerMonth;
      break;

    default:
      throw new Error(`Unknown wage type: ${wageType}`);
  }

  const minuteRate = hourlyRate / 60;

  // MSC (Monthly Salary Credit) for statutory contributions
  // Always based on daily rate × 26 (standard work days per month)
  const msc = dailyRate * 26;

  return {
    monthlyRate: round(monthlyRate, 4),
    dailyRate: round(dailyRate, 4),
    hourlyRate: round(hourlyRate, 4),
    minuteRate: round(minuteRate, 6),
    msc: round(msc, 4),
  };
}

/**
 * Calculate basic pay for a pay period.
 *
 * ALL employees (monthly, daily, hourly) are paid based on days present:
 * - Basic pay = Days Present × Daily Rate
 *
 * Daily rate derivation:
 * - Monthly employees: dailyRate = monthlyRate / standardWorkDaysPerMonth (typically 26)
 * - Daily employees: dailyRate = baseRate (as configured)
 * - Hourly employees: dailyRate = hourlyRate × standardHoursPerDay (typically 8)
 *
 * @param profile Pay profile (unused, kept for API compatibility)
 * @param rates Derived rates
 * @param workDays Number of days present in period
 * @param payFrequency Pay frequency (unused, kept for API compatibility)
 * @returns Basic pay amount
 */
export function calculateBasicPay(
  profile: PayProfileInput,
  rates: DerivedRates,
  workDays: number,
  payFrequency: PayFrequency
): number {
  // ALL employees: base pay = days present × daily rate
  // This includes monthly employees (daily rate = monthly / standardWorkDaysPerMonth)
  return round(rates.dailyRate * workDays, 4);
}

/**
 * Calculate late deduction.
 *
 * Per DOLE: Late deduction = (Late minutes / 60) × Hourly Rate
 *
 * @param lateMinutes Total late minutes
 * @param rates Derived rates
 * @returns Deduction amount (positive value)
 */
export function calculateLateDeduction(
  lateMinutes: number,
  rates: DerivedRates
): number {
  if (lateMinutes <= 0) return 0;
  return round(rates.minuteRate * lateMinutes, 4);
}

/**
 * Calculate undertime deduction.
 *
 * Per DOLE: Undertime deduction = (Undertime minutes / 60) × Hourly Rate
 *
 * @param undertimeMinutes Total undertime minutes
 * @param rates Derived rates
 * @returns Deduction amount (positive value)
 */
export function calculateUndertimeDeduction(
  undertimeMinutes: number,
  rates: DerivedRates
): number {
  if (undertimeMinutes <= 0) return 0;
  return round(rates.minuteRate * undertimeMinutes, 4);
}

/**
 * Calculate absent deduction.
 *
 * Per DOLE: Absent deduction = Daily Rate × Absent days
 * For partial day: (Absent minutes / Standard minutes) × Daily Rate
 *
 * @param absentMinutes Total absent minutes
 * @param rates Derived rates
 * @param standardMinutesPerDay Standard work minutes per day
 * @returns Deduction amount (positive value)
 */
export function calculateAbsentDeduction(
  absentMinutes: number,
  rates: DerivedRates,
  standardMinutesPerDay: number
): number {
  if (absentMinutes <= 0) return 0;

  const absentDays = absentMinutes / standardMinutesPerDay;
  return round(rates.dailyRate * absentDays, 4);
}

/**
 * Calculate overtime pay.
 *
 * Per DOLE Labor Code Art. 87:
 * - Regular Day OT: 125% of hourly rate
 * - Rest Day OT: 130% of hourly rate × 130% = 169%
 * - Regular Holiday OT: 200% of hourly rate × 130% = 260%
 * - Special Holiday OT: 130% of hourly rate × 130% = 169%
 *
 * @param otMinutes Overtime minutes
 * @param rates Derived rates
 * @param multiplier OT multiplier (e.g., 1.25 for regular OT)
 * @returns Overtime pay amount
 */
export function calculateOvertimePay(
  otMinutes: number,
  rates: DerivedRates,
  multiplier: number
): number {
  if (otMinutes <= 0) return 0;

  const otHours = otMinutes / 60;
  return round(rates.hourlyRate * otHours * multiplier, 4);
}

/**
 * Calculate night differential pay.
 *
 * Per DOLE Labor Code Art. 86:
 * Night Differential (10PM-6AM) = 10% additional
 * ND Pay = (ND hours × Hourly Rate × 0.10)
 *
 * @param ndMinutes Night differential minutes
 * @param rates Derived rates
 * @param ndMultiplier ND multiplier (default 0.10 = 10%)
 * @returns Night differential pay amount
 */
export function calculateNightDiffPay(
  ndMinutes: number,
  rates: DerivedRates,
  ndMultiplier: number = 0.1
): number {
  if (ndMinutes <= 0) return 0;

  const ndHours = ndMinutes / 60;
  return round(rates.hourlyRate * ndHours * ndMultiplier, 4);
}

/**
 * Calculate holiday premium pay.
 *
 * Per DOLE:
 * - Regular Holiday (worked): 200% of daily rate
 * - Special Holiday (worked): 130% of daily rate
 * - Regular Holiday (not worked but paid): 100% of daily rate
 *
 * Premium is the additional pay above basic:
 * - Regular Holiday Premium = Daily Rate × 100% (the extra 100%)
 * - Special Holiday Premium = Daily Rate × 30% (the extra 30%)
 *
 * @param workedMinutes Minutes worked on holiday
 * @param rates Derived rates
 * @param holidayMultiplier Holiday multiplier (e.g., 2.0 for regular holiday)
 * @param standardMinutesPerDay Standard work minutes
 * @returns Holiday premium pay amount
 */
export function calculateHolidayPremiumPay(
  workedMinutes: number,
  rates: DerivedRates,
  holidayMultiplier: number,
  standardMinutesPerDay: number
): number {
  if (workedMinutes <= 0 || holidayMultiplier <= 1) return 0;

  // Premium is the additional percentage above 100%
  const premiumMultiplier = holidayMultiplier - 1;
  const workedHours = workedMinutes / 60;
  const regularPay = rates.hourlyRate * workedHours;

  return round(regularPay * premiumMultiplier, 4);
}

/**
 * Calculate rest day premium pay.
 *
 * Per DOLE Labor Code Art. 93:
 * Rest Day Work = 130% of daily rate
 * Premium = 30% additional
 *
 * @param workedMinutes Minutes worked on rest day
 * @param rates Derived rates
 * @param restDayMultiplier Rest day multiplier (default 1.3)
 * @returns Rest day premium pay amount
 */
export function calculateRestDayPremiumPay(
  workedMinutes: number,
  rates: DerivedRates,
  restDayMultiplier: number = 1.3
): number {
  if (workedMinutes <= 0 || restDayMultiplier <= 1) return 0;

  const premiumMultiplier = restDayMultiplier - 1;
  const workedHours = workedMinutes / 60;
  const regularPay = rates.hourlyRate * workedHours;

  return round(regularPay * premiumMultiplier, 4);
}

/**
 * Calculate unworked regular holiday pay.
 *
 * Per DOLE: Regular holidays are paid even if not worked.
 * Unworked Regular Holiday Pay = 100% of daily rate
 *
 * @param rates Derived rates
 * @returns Holiday pay for unworked regular holiday
 */
export function calculateUnworkedRegularHolidayPay(rates: DerivedRates): number {
  return rates.dailyRate;
}

// =============================================================================
// Helper Functions
// =============================================================================

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
      return 2.17; // 26 periods / 12 months
    case "WEEKLY":
      return 4.33; // 52 periods / 12 months
    default:
      return 2; // Default to semi-monthly
  }
}

/**
 * Round to specified decimal places.
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Standard PH multipliers per DOLE.
 */
export const PH_MULTIPLIERS = {
  // Regular overtime
  OT_REGULAR: 1.25, // 125%

  // Rest day work
  REST_DAY: 1.3, // 130%
  REST_DAY_OT: 1.69, // 130% × 130%

  // Regular holiday
  REGULAR_HOLIDAY: 2.0, // 200%
  REGULAR_HOLIDAY_OT: 2.6, // 200% × 130%
  REGULAR_HOLIDAY_REST_DAY: 2.6, // 200% × 130%
  REGULAR_HOLIDAY_REST_DAY_OT: 3.38, // 200% × 130% × 130%

  // Special holiday
  SPECIAL_HOLIDAY: 1.3, // 130%
  SPECIAL_HOLIDAY_OT: 1.69, // 130% × 130%
  SPECIAL_HOLIDAY_REST_DAY: 1.5, // 150%
  SPECIAL_HOLIDAY_REST_DAY_OT: 1.95, // 150% × 130%

  // Night differential
  NIGHT_DIFF: 0.1, // 10%
  NIGHT_DIFF_OT: 0.1375, // 10% × 1.375 (OT + ND)
} as const;
