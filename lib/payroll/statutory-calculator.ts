// =============================================================================
// PeopleOS PH - Statutory Deduction Calculators
// =============================================================================
//
// Calculates SSS, PhilHealth, Pag-IBIG, and Withholding Tax contributions.
//
// IMPORTANT: Statutory deductions ONLY apply if:
// 1. Employee is regularized (employmentType === 'REGULAR')
// 2. OR employee was regularized within the pay period
// 3. isBenefitsEligible is true in pay profile
//
// =============================================================================

import type {
  SSSTableInput,
  PhilHealthTableInput,
  PagIBIGTableInput,
  TaxTableInput,
  ComputedPayslipLine,
  EmployeeRegularizationInput,
  PayPeriodInput,
} from "./types";

// =============================================================================
// Regularization Check
// =============================================================================

/**
 * Check if employee is eligible for statutory contributions.
 *
 * Rules:
 * - Must be REGULAR employment type
 * - OR must have been regularized on or before the pay period end date
 * - Probationary employees are NOT covered until regularization
 *
 * @param regularization Employee's regularization info
 * @param payPeriod Current pay period
 * @param isBenefitsEligible From pay profile
 */
export function isEligibleForStatutory(
  regularization: EmployeeRegularizationInput,
  payPeriod: PayPeriodInput,
  isBenefitsEligible: boolean
): boolean {
  // Must be benefits eligible per pay profile
  if (!isBenefitsEligible) return false;

  // Already regular
  if (regularization.employmentType === "REGULAR") return true;

  // Check if regularized during or before this period
  if (regularization.regularizationDate) {
    return regularization.regularizationDate <= payPeriod.endDate;
  }

  // Probationary/Contractual/Consultant/Intern without regularization date
  return false;
}

// =============================================================================
// SSS Contributions
// =============================================================================

/**
 * Calculate SSS contributions based on monthly salary credit.
 *
 * 2024 SSS Table structure:
 * - Regular SS: Employee (4.5%) + Employer (9.5%) = 14%
 * - EC: Employer only (varies by bracket)
 * - MPF: Employee (varies) + Employer (varies) for salary > 20,000
 *
 * @param monthlySalary Monthly salary for contribution computation
 * @param table SSS contribution table
 */
export function calculateSSS(
  monthlySalary: number,
  table: SSSTableInput
): { ee: number; er: number; total: number } {
  const bracket = table.brackets.find(
    (b) => monthlySalary >= b.minSalary && monthlySalary <= b.maxSalary
  );

  if (!bracket) {
    // Use highest bracket if salary exceeds max
    const highestBracket = table.brackets[table.brackets.length - 1];
    return {
      ee: highestBracket.regularSsEe + highestBracket.mpfEe,
      er: highestBracket.regularSsEr + highestBracket.ecEr + highestBracket.mpfEr,
      total:
        highestBracket.regularSsEe +
        highestBracket.mpfEe +
        highestBracket.regularSsEr +
        highestBracket.ecEr +
        highestBracket.mpfEr,
    };
  }

  return {
    ee: bracket.regularSsEe + bracket.mpfEe,
    er: bracket.regularSsEr + bracket.ecEr + bracket.mpfEr,
    total:
      bracket.regularSsEe +
      bracket.mpfEe +
      bracket.regularSsEr +
      bracket.ecEr +
      bracket.mpfEr,
  };
}

/**
 * Generate SSS contribution lines.
 */
export function generateSSSLines(
  monthlySalary: number,
  table: SSSTableInput,
  payPeriodsPerMonth: number
): { eeLine: ComputedPayslipLine; erLine: ComputedPayslipLine } {
  const sss = calculateSSS(monthlySalary, table);

  // Divide by pay periods (e.g., 2 for semi-monthly)
  const eePerPeriod = round(sss.ee / payPeriodsPerMonth, 4);
  const erPerPeriod = round(sss.er / payPeriodsPerMonth, 4);

  return {
    eeLine: {
      category: "SSS_EE",
      description: "SSS Employee Share",
      amount: eePerPeriod,
      sortOrder: 1100,
      ruleCode: "SSS_EE",
      ruleDescription: `SSS EE (Monthly: ${sss.ee})`,
    },
    erLine: {
      category: "SSS_ER",
      description: "SSS Employer Share",
      amount: erPerPeriod,
      sortOrder: 1101,
      ruleCode: "SSS_ER",
      ruleDescription: `SSS ER (Monthly: ${sss.er})`,
    },
  };
}

// =============================================================================
// PhilHealth Contributions
// =============================================================================

/**
 * Calculate PhilHealth contributions.
 *
 * 2024 PhilHealth:
 * - Premium Rate: 5% of monthly basic salary
 * - Minimum Base: 10,000
 * - Maximum Base: 100,000
 * - Split: 50% employee, 50% employer
 *
 * @param monthlySalary Monthly salary
 * @param table PhilHealth contribution table
 */
export function calculatePhilHealth(
  monthlySalary: number,
  table: PhilHealthTableInput
): { ee: number; er: number; total: number } {
  // Apply salary floor and ceiling
  const base = Math.min(Math.max(monthlySalary, table.minBase), table.maxBase);

  // Calculate total premium
  const totalPremium = round(base * table.premiumRate, 4);

  // Split between EE and ER
  const ee = round(totalPremium * table.eeShare, 4);
  const er = round(totalPremium * (1 - table.eeShare), 4);

  return { ee, er, total: ee + er };
}

/**
 * Generate PhilHealth contribution lines.
 */
export function generatePhilHealthLines(
  monthlySalary: number,
  table: PhilHealthTableInput,
  payPeriodsPerMonth: number
): { eeLine: ComputedPayslipLine; erLine: ComputedPayslipLine } {
  const philhealth = calculatePhilHealth(monthlySalary, table);

  const eePerPeriod = round(philhealth.ee / payPeriodsPerMonth, 4);
  const erPerPeriod = round(philhealth.er / payPeriodsPerMonth, 4);

  return {
    eeLine: {
      category: "PHILHEALTH_EE",
      description: "PhilHealth Employee Share",
      amount: eePerPeriod,
      sortOrder: 1110,
      ruleCode: "PHILHEALTH_EE",
      ruleDescription: `PhilHealth EE (Monthly: ${philhealth.ee})`,
    },
    erLine: {
      category: "PHILHEALTH_ER",
      description: "PhilHealth Employer Share",
      amount: erPerPeriod,
      sortOrder: 1111,
      ruleCode: "PHILHEALTH_ER",
      ruleDescription: `PhilHealth ER (Monthly: ${philhealth.er})`,
    },
  };
}

// =============================================================================
// Pag-IBIG Contributions
// =============================================================================

/**
 * Calculate Pag-IBIG contributions.
 *
 * 2024 Pag-IBIG:
 * - EE Rate: 2% (up to 5,000 max base, so max 100)
 * - ER Rate: 2%
 * - Maximum Monthly Base: 5,000
 * - Maximum Monthly Contribution: 100 each
 *
 * @param monthlySalary Monthly salary
 * @param table Pag-IBIG contribution table
 */
export function calculatePagIBIG(
  monthlySalary: number,
  table: PagIBIGTableInput
): { ee: number; er: number; total: number } {
  // Apply salary ceiling
  const base = Math.min(monthlySalary, table.maxBase);

  const ee = round(base * table.eeRate, 4);
  const er = round(base * table.erRate, 4);

  return { ee, er, total: ee + er };
}

/**
 * Generate Pag-IBIG contribution lines.
 */
export function generatePagIBIGLines(
  monthlySalary: number,
  table: PagIBIGTableInput,
  payPeriodsPerMonth: number
): { eeLine: ComputedPayslipLine; erLine: ComputedPayslipLine } {
  const pagibig = calculatePagIBIG(monthlySalary, table);

  const eePerPeriod = round(pagibig.ee / payPeriodsPerMonth, 4);
  const erPerPeriod = round(pagibig.er / payPeriodsPerMonth, 4);

  return {
    eeLine: {
      category: "PAGIBIG_EE",
      description: "Pag-IBIG Employee Share",
      amount: eePerPeriod,
      sortOrder: 1120,
      ruleCode: "PAGIBIG_EE",
      ruleDescription: `Pag-IBIG EE (Monthly: ${pagibig.ee})`,
    },
    erLine: {
      category: "PAGIBIG_ER",
      description: "Pag-IBIG Employer Share",
      amount: erPerPeriod,
      sortOrder: 1121,
      ruleCode: "PAGIBIG_ER",
      ruleDescription: `Pag-IBIG ER (Monthly: ${pagibig.er})`,
    },
  };
}

// =============================================================================
// Withholding Tax
// =============================================================================

/**
 * Calculate withholding tax using graduated tax table.
 *
 * TRAIN Law Tax Table (2023+):
 * - 0 to 250,000: 0%
 * - 250,001 to 400,000: 15% of excess over 250,000
 * - 400,001 to 800,000: 22,500 + 20% of excess over 400,000
 * - 800,001 to 2,000,000: 102,500 + 25% of excess over 800,000
 * - 2,000,001 to 8,000,000: 402,500 + 30% of excess over 2,000,000
 * - Over 8,000,000: 2,202,500 + 35% of excess over 8,000,000
 *
 * Monthly withholding = Annual Tax / 12 (adjusted for YTD)
 *
 * @param annualTaxableIncome Annual taxable income (gross - statutory - non-taxable)
 * @param table Tax table
 */
export function calculateAnnualTax(
  annualTaxableIncome: number,
  table: TaxTableInput
): number {
  if (annualTaxableIncome <= 0) return 0;

  const bracket = table.brackets.find(
    (b) => annualTaxableIncome >= b.minIncome && annualTaxableIncome <= b.maxIncome
  );

  if (!bracket) {
    // Use highest bracket
    const highest = table.brackets[table.brackets.length - 1];
    const excess = annualTaxableIncome - highest.minIncome;
    return round(highest.baseTax + excess * highest.excessRate, 4);
  }

  const excess = annualTaxableIncome - bracket.minIncome;
  return round(bracket.baseTax + excess * bracket.excessRate, 4);
}

/**
 * Calculate monthly withholding tax.
 *
 * Uses cumulative method:
 * 1. Project annual taxable income = (YTD + current period) * periods remaining factor
 * 2. Calculate annual tax
 * 3. Deduct YTD tax already withheld
 * 4. Divide remaining by periods left
 *
 * @param currentPeriodTaxable Current period's taxable income
 * @param ytdTaxable Year-to-date taxable income (before this period)
 * @param ytdTaxWithheld Year-to-date tax already withheld
 * @param periodNumber Current pay period number (1-24 for semi-monthly)
 * @param totalPeriods Total pay periods in year (24 for semi-monthly)
 * @param table Tax table
 */
export function calculateWithholdingTax(
  currentPeriodTaxable: number,
  ytdTaxable: number,
  ytdTaxWithheld: number,
  periodNumber: number,
  totalPeriods: number,
  table: TaxTableInput
): number {
  // Cumulative taxable income up to this period
  const cumulativeTaxable = ytdTaxable + currentPeriodTaxable;

  // Project annual taxable income
  const projectedAnnual = (cumulativeTaxable / periodNumber) * totalPeriods;

  // Calculate projected annual tax
  const projectedAnnualTax = calculateAnnualTax(projectedAnnual, table);

  // Calculate tax due up to this period
  const taxDueToDate = (projectedAnnualTax / totalPeriods) * periodNumber;

  // This period's withholding = tax due - already withheld
  const currentWithholding = taxDueToDate - ytdTaxWithheld;

  return Math.max(0, round(currentWithholding, 4));
}

/**
 * Generate withholding tax line.
 */
export function generateWithholdingTaxLine(
  currentPeriodTaxable: number,
  ytdTaxable: number,
  ytdTaxWithheld: number,
  periodNumber: number,
  totalPeriods: number,
  table: TaxTableInput
): ComputedPayslipLine | null {
  const tax = calculateWithholdingTax(
    currentPeriodTaxable,
    ytdTaxable,
    ytdTaxWithheld,
    periodNumber,
    totalPeriods,
    table
  );

  if (tax <= 0) return null;

  return {
    category: "TAX_WITHHOLDING",
    description: "Withholding Tax",
    amount: tax,
    sortOrder: 1200,
    ruleCode: "WITHHOLDING_TAX",
    ruleDescription: "Income Tax Withholding (TRAIN Law)",
  };
}

// =============================================================================
// Default Statutory Tables (2024)
// =============================================================================

/**
 * Default SSS table effective January 2024.
 * Note: This is a simplified version. Full table has 30+ brackets.
 */
export const DEFAULT_SSS_TABLE_2024: SSSTableInput = {
  effectiveDate: new Date("2024-01-01"),
  brackets: [
    { minSalary: 0, maxSalary: 4249.99, regularSsEe: 180, regularSsEr: 380, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 4250, maxSalary: 4749.99, regularSsEe: 202.5, regularSsEr: 427.5, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 4750, maxSalary: 5249.99, regularSsEe: 225, regularSsEr: 475, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 5250, maxSalary: 5749.99, regularSsEe: 247.5, regularSsEr: 522.5, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 5750, maxSalary: 6249.99, regularSsEe: 270, regularSsEr: 570, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    // ... (abbreviated - full table would have all brackets)
    { minSalary: 19750, maxSalary: 20249.99, regularSsEe: 900, regularSsEr: 1900, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 20250, maxSalary: 24749.99, regularSsEe: 900, regularSsEr: 1900, ecEr: 30, mpfEe: 225, mpfEr: 225 },
    { minSalary: 24750, maxSalary: 29249.99, regularSsEe: 900, regularSsEr: 1900, ecEr: 30, mpfEe: 450, mpfEr: 450 },
    { minSalary: 29250, maxSalary: 34749.99, regularSsEe: 900, regularSsEr: 1900, ecEr: 30, mpfEe: 675, mpfEr: 675 },
    { minSalary: 34750, maxSalary: 999999, regularSsEe: 900, regularSsEr: 1900, ecEr: 30, mpfEe: 900, mpfEr: 900 },
  ],
};

/**
 * Default PhilHealth table effective 2024.
 */
export const DEFAULT_PHILHEALTH_TABLE_2024: PhilHealthTableInput = {
  effectiveDate: new Date("2024-01-01"),
  premiumRate: 0.05, // 5%
  minBase: 10000,
  maxBase: 100000,
  eeShare: 0.5, // 50% employee
};

/**
 * Default Pag-IBIG table effective 2024.
 */
export const DEFAULT_PAGIBIG_TABLE_2024: PagIBIGTableInput = {
  effectiveDate: new Date("2024-01-01"),
  eeRate: 0.02, // 2%
  erRate: 0.02, // 2%
  maxBase: 5000,
};

/**
 * Default TRAIN Law tax table effective 2023+.
 */
export const DEFAULT_TAX_TABLE_2023: TaxTableInput = {
  effectiveDate: new Date("2023-01-01"),
  brackets: [
    { minIncome: 0, maxIncome: 250000, baseTax: 0, excessRate: 0 },
    { minIncome: 250001, maxIncome: 400000, baseTax: 0, excessRate: 0.15 },
    { minIncome: 400001, maxIncome: 800000, baseTax: 22500, excessRate: 0.2 },
    { minIncome: 800001, maxIncome: 2000000, baseTax: 102500, excessRate: 0.25 },
    { minIncome: 2000001, maxIncome: 8000000, baseTax: 402500, excessRate: 0.3 },
    { minIncome: 8000001, maxIncome: 999999999, baseTax: 2202500, excessRate: 0.35 },
  ],
};

// =============================================================================
// Helpers
// =============================================================================

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
