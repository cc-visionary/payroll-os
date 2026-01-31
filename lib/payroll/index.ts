// =============================================================================
// PeopleOS PH - Payroll Library Index
// =============================================================================

// Types
export * from "./types";

// Wage Calculator
export {
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
  PH_MULTIPLIERS,
} from "./wage-calculator";
export type { DerivedRates } from "./wage-calculator";

// Payslip Line Generator
export {
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

// Statutory Calculator
export {
  isEligibleForStatutory,
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateAnnualTax,
  calculateWithholdingTax,
  generateSSSLines,
  generatePhilHealthLines,
  generatePagIBIGLines,
  generateWithholdingTaxLine,
  DEFAULT_SSS_TABLE_2024,
  DEFAULT_PHILHEALTH_TABLE_2024,
  DEFAULT_PAGIBIG_TABLE_2024,
  DEFAULT_TAX_TABLE_2023,
} from "./statutory-calculator";

// Compute Engine
export {
  computePayroll,
  computeEmployeePayslip,
} from "./compute-engine";
export type {
  EmployeePayrollInput,
  PayrollComputationResult,
} from "./compute-engine";

// Day Type Resolver
export {
  resolveDayType,
  resolveDayTypesForRange,
  buildEventMap,
  getRestDayNumbers,
  DAY_TYPE_MULTIPLIERS,
  DAY_TYPE_PAID_IF_NOT_WORKED,
} from "./day-type-resolver";
export type { DayType, DayTypeResolution } from "./day-type-resolver";
