// =============================================================================
// PeopleOS PH - Statutory Tables Constants
// =============================================================================
// Government-mandated contribution rates stored as constants.
// These rarely change (annual updates) and don't need a database.
// =============================================================================

import type {
  SSSTableInput,
  PhilHealthTableInput,
  PagIBIGTableInput,
  TaxTableInput,
} from "./types";

// =============================================================================
// SSS Contribution Table (2026)
// =============================================================================
// Total rate: 15% (EE: 5%, ER: 10%)
// MSC Range: P5,000 - P35,000
// Regular SS/EC up to MSC P20,000, MPF for MSC above P20,000
// Source: SSS Circular No. 2024-006 (RA 11199)
// =============================================================================

export const SSS_TABLE: SSSTableInput = {
  effectiveDate: new Date("2026-01-01"),
  brackets: [
    // MSC P5,000 - P20,000: Regular SS Program
    { minSalary: 0, maxSalary: 5249.99, regularSsEe: 250, regularSsEr: 500, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 5250, maxSalary: 5749.99, regularSsEe: 275, regularSsEr: 550, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 5750, maxSalary: 6249.99, regularSsEe: 300, regularSsEr: 600, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 6250, maxSalary: 6749.99, regularSsEe: 325, regularSsEr: 650, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 6750, maxSalary: 7249.99, regularSsEe: 350, regularSsEr: 700, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 7250, maxSalary: 7749.99, regularSsEe: 375, regularSsEr: 750, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 7750, maxSalary: 8249.99, regularSsEe: 400, regularSsEr: 800, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 8250, maxSalary: 8749.99, regularSsEe: 425, regularSsEr: 850, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 8750, maxSalary: 9249.99, regularSsEe: 450, regularSsEr: 900, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 9250, maxSalary: 9749.99, regularSsEe: 475, regularSsEr: 950, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 9750, maxSalary: 10249.99, regularSsEe: 500, regularSsEr: 1000, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 10250, maxSalary: 10749.99, regularSsEe: 525, regularSsEr: 1050, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 10750, maxSalary: 11249.99, regularSsEe: 550, regularSsEr: 1100, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 11250, maxSalary: 11749.99, regularSsEe: 575, regularSsEr: 1150, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 11750, maxSalary: 12249.99, regularSsEe: 600, regularSsEr: 1200, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 12250, maxSalary: 12749.99, regularSsEe: 625, regularSsEr: 1250, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 12750, maxSalary: 13249.99, regularSsEe: 650, regularSsEr: 1300, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 13250, maxSalary: 13749.99, regularSsEe: 675, regularSsEr: 1350, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 13750, maxSalary: 14249.99, regularSsEe: 700, regularSsEr: 1400, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 14250, maxSalary: 14749.99, regularSsEe: 725, regularSsEr: 1450, ecEr: 10, mpfEe: 0, mpfEr: 0 },
    { minSalary: 14750, maxSalary: 15249.99, regularSsEe: 750, regularSsEr: 1500, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 15250, maxSalary: 15749.99, regularSsEe: 775, regularSsEr: 1550, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 15750, maxSalary: 16249.99, regularSsEe: 800, regularSsEr: 1600, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 16250, maxSalary: 16749.99, regularSsEe: 825, regularSsEr: 1650, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 16750, maxSalary: 17249.99, regularSsEe: 850, regularSsEr: 1700, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 17250, maxSalary: 17749.99, regularSsEe: 875, regularSsEr: 1750, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 17750, maxSalary: 18249.99, regularSsEe: 900, regularSsEr: 1800, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 18250, maxSalary: 18749.99, regularSsEe: 925, regularSsEr: 1850, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 18750, maxSalary: 19249.99, regularSsEe: 950, regularSsEr: 1900, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 19250, maxSalary: 19749.99, regularSsEe: 975, regularSsEr: 1950, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    { minSalary: 19750, maxSalary: 20249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 0, mpfEr: 0 },
    // MSC P20,500 - P35,000: Regular SS + MPF Program
    { minSalary: 20250, maxSalary: 20749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 25, mpfEr: 50 },
    { minSalary: 20750, maxSalary: 21249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 50, mpfEr: 100 },
    { minSalary: 21250, maxSalary: 21749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 75, mpfEr: 150 },
    { minSalary: 21750, maxSalary: 22249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 100, mpfEr: 200 },
    { minSalary: 22250, maxSalary: 22749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 125, mpfEr: 250 },
    { minSalary: 22750, maxSalary: 23249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 150, mpfEr: 300 },
    { minSalary: 23250, maxSalary: 23749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 175, mpfEr: 350 },
    { minSalary: 23750, maxSalary: 24249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 200, mpfEr: 400 },
    { minSalary: 24250, maxSalary: 24749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 225, mpfEr: 450 },
    { minSalary: 24750, maxSalary: 25249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 250, mpfEr: 500 },
    { minSalary: 25250, maxSalary: 25749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 275, mpfEr: 550 },
    { minSalary: 25750, maxSalary: 26249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 300, mpfEr: 600 },
    { minSalary: 26250, maxSalary: 26749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 325, mpfEr: 650 },
    { minSalary: 26750, maxSalary: 27249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 350, mpfEr: 700 },
    { minSalary: 27250, maxSalary: 27749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 375, mpfEr: 750 },
    { minSalary: 27750, maxSalary: 28249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 400, mpfEr: 800 },
    { minSalary: 28250, maxSalary: 28749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 425, mpfEr: 850 },
    { minSalary: 28750, maxSalary: 29249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 450, mpfEr: 900 },
    { minSalary: 29250, maxSalary: 29749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 475, mpfEr: 950 },
    { minSalary: 29750, maxSalary: 30249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 500, mpfEr: 1000 },
    { minSalary: 30250, maxSalary: 30749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 525, mpfEr: 1050 },
    { minSalary: 30750, maxSalary: 31249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 550, mpfEr: 1100 },
    { minSalary: 31250, maxSalary: 31749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 575, mpfEr: 1150 },
    { minSalary: 31750, maxSalary: 32249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 600, mpfEr: 1200 },
    { minSalary: 32250, maxSalary: 32749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 625, mpfEr: 1250 },
    { minSalary: 32750, maxSalary: 33249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 650, mpfEr: 1300 },
    { minSalary: 33250, maxSalary: 33749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 675, mpfEr: 1350 },
    { minSalary: 33750, maxSalary: 34249.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 700, mpfEr: 1400 },
    { minSalary: 34250, maxSalary: 34749.99, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 725, mpfEr: 1450 },
    { minSalary: 34750, maxSalary: Infinity, regularSsEe: 1000, regularSsEr: 2000, ecEr: 30, mpfEe: 750, mpfEr: 1500 },
  ],
};

// =============================================================================
// PhilHealth Contribution Table (2026)
// =============================================================================
// Total rate: 5% (EE: 2.5%, ER: 2.5%)
// Income floor: P10,000, ceiling: P100,000
// Source: PhilHealth Advisory 2025-0002 (UHC Law)
// =============================================================================

export const PHILHEALTH_TABLE: PhilHealthTableInput = {
  effectiveDate: new Date("2026-01-01"),
  premiumRate: 0.05, // 5% total
  minBase: 10000, // Income floor
  maxBase: 100000, // Income ceiling
  eeShare: 0.5, // 50% employee share (2.5% of 5%)
};

// =============================================================================
// Pag-IBIG Contribution Table (2026)
// =============================================================================
// Max MFS: P10,000
// Rates: 2% EE + 2% ER (1% EE if salary <= P1,500)
// Source: HDMF Circular No. 460
// =============================================================================

export const PAGIBIG_TABLE: PagIBIGTableInput = {
  effectiveDate: new Date("2026-01-01"),
  eeRate: 0.02, // 2% for salary > P1,500
  erRate: 0.02, // 2% employer
  maxBase: 10000, // Maximum Monthly Fund Salary
};

// =============================================================================
// BIR Withholding Tax Table (2026)
// =============================================================================
// TRAIN Law brackets (effective 2023 onwards)
// Source: TRAIN Law / RR No. 8-2018
// =============================================================================

export const TAX_TABLE: TaxTableInput = {
  effectiveDate: new Date("2026-01-01"),
  brackets: [
    // Annual brackets
    { minIncome: 0, maxIncome: 250000, baseTax: 0, excessRate: 0 },
    { minIncome: 250001, maxIncome: 400000, baseTax: 0, excessRate: 0.15 },
    { minIncome: 400001, maxIncome: 800000, baseTax: 22500, excessRate: 0.20 },
    { minIncome: 800001, maxIncome: 2000000, baseTax: 102500, excessRate: 0.25 },
    { minIncome: 2000001, maxIncome: 8000000, baseTax: 402500, excessRate: 0.30 },
    { minIncome: 8000001, maxIncome: Infinity, baseTax: 2202500, excessRate: 0.35 },
  ],
};

// =============================================================================
// Tax Brackets for Different Pay Frequencies
// =============================================================================
// Pre-calculated brackets for monthly and semi-monthly payroll
// =============================================================================

export const TAX_TABLE_MONTHLY = {
  effectiveDate: new Date("2026-01-01"),
  brackets: [
    { minIncome: 0, maxIncome: 20833, baseTax: 0, excessRate: 0 },
    { minIncome: 20834, maxIncome: 33333, baseTax: 0, excessRate: 0.15 },
    { minIncome: 33334, maxIncome: 66667, baseTax: 1875, excessRate: 0.20 },
    { minIncome: 66668, maxIncome: 166667, baseTax: 8541.67, excessRate: 0.25 },
    { minIncome: 166668, maxIncome: 666667, baseTax: 33541.67, excessRate: 0.30 },
    { minIncome: 666668, maxIncome: Infinity, baseTax: 183541.67, excessRate: 0.35 },
  ],
};

export const TAX_TABLE_SEMI_MONTHLY = {
  effectiveDate: new Date("2026-01-01"),
  brackets: [
    { minIncome: 0, maxIncome: 10417, baseTax: 0, excessRate: 0 },
    { minIncome: 10418, maxIncome: 16667, baseTax: 0, excessRate: 0.15 },
    { minIncome: 16668, maxIncome: 33333, baseTax: 937.50, excessRate: 0.20 },
    { minIncome: 33334, maxIncome: 83333, baseTax: 4270.83, excessRate: 0.25 },
    { minIncome: 83334, maxIncome: 333333, baseTax: 16770.83, excessRate: 0.30 },
    { minIncome: 333334, maxIncome: Infinity, baseTax: 91770.83, excessRate: 0.35 },
  ],
};
