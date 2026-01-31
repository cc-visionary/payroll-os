// =============================================================================
// PeopleOS PH - Statutory Tables 2026 (SSS, PhilHealth, Pag-IBIG, Tax)
// =============================================================================
// Based on 2026 contribution rates:
// - SSS: 15% total (5% EE, 10% ER), MSC range P5,000-P35,000
// - PhilHealth: 5% total (2.5% EE, 2.5% ER), income floor P10,000, ceiling P100,000
// - Pag-IBIG: Max MFS P10,000, 2% EE + 2% ER (1% EE if salary <=P1,500)
// - Tax: TRAIN Law brackets (unchanged)
// =============================================================================

// SSS 2026 Contribution Table
// Total rate: 15% (EE: 5%, ER: 10%)
// MSC Range: P5,000 - P35,000
// Regular SS/EC up to MSC P20,000, MPF for MSC above P20,000
export const sssTable2026 = {
  type: "SSS",
  version: "2026-01",
  effectiveDate: "2026-01-01",
  sourceDocument: "SSS Circular No. 2024-006 (RA 11199)",
  tableData: {
    // Contribution rates
    eeRate: 0.05, // 5% employee share
    erRate: 0.10, // 10% employer share (includes EC)
    minMSC: 5000,
    maxMSC: 35000,
    mpfThreshold: 20000, // MSC above this goes to MPF
    brackets: [
      // MSC P5,000 - P20,000: Regular SS Program
      { minSalary: 0, maxSalary: 5249.99, msc: 5000, eeSs: 250, erSs: 500, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 5250, maxSalary: 5749.99, msc: 5500, eeSs: 275, erSs: 550, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 5750, maxSalary: 6249.99, msc: 6000, eeSs: 300, erSs: 600, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 6250, maxSalary: 6749.99, msc: 6500, eeSs: 325, erSs: 650, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 6750, maxSalary: 7249.99, msc: 7000, eeSs: 350, erSs: 700, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 7250, maxSalary: 7749.99, msc: 7500, eeSs: 375, erSs: 750, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 7750, maxSalary: 8249.99, msc: 8000, eeSs: 400, erSs: 800, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 8250, maxSalary: 8749.99, msc: 8500, eeSs: 425, erSs: 850, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 8750, maxSalary: 9249.99, msc: 9000, eeSs: 450, erSs: 900, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 9250, maxSalary: 9749.99, msc: 9500, eeSs: 475, erSs: 950, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 9750, maxSalary: 10249.99, msc: 10000, eeSs: 500, erSs: 1000, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 10250, maxSalary: 10749.99, msc: 10500, eeSs: 525, erSs: 1050, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 10750, maxSalary: 11249.99, msc: 11000, eeSs: 550, erSs: 1100, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 11250, maxSalary: 11749.99, msc: 11500, eeSs: 575, erSs: 1150, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 11750, maxSalary: 12249.99, msc: 12000, eeSs: 600, erSs: 1200, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 12250, maxSalary: 12749.99, msc: 12500, eeSs: 625, erSs: 1250, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 12750, maxSalary: 13249.99, msc: 13000, eeSs: 650, erSs: 1300, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 13250, maxSalary: 13749.99, msc: 13500, eeSs: 675, erSs: 1350, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 13750, maxSalary: 14249.99, msc: 14000, eeSs: 700, erSs: 1400, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 14250, maxSalary: 14749.99, msc: 14500, eeSs: 725, erSs: 1450, eeEc: 0, erEc: 10, eeMpf: 0, erMpf: 0 },
      { minSalary: 14750, maxSalary: 15249.99, msc: 15000, eeSs: 750, erSs: 1500, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 15250, maxSalary: 15749.99, msc: 15500, eeSs: 775, erSs: 1550, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 15750, maxSalary: 16249.99, msc: 16000, eeSs: 800, erSs: 1600, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 16250, maxSalary: 16749.99, msc: 16500, eeSs: 825, erSs: 1650, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 16750, maxSalary: 17249.99, msc: 17000, eeSs: 850, erSs: 1700, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 17250, maxSalary: 17749.99, msc: 17500, eeSs: 875, erSs: 1750, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 17750, maxSalary: 18249.99, msc: 18000, eeSs: 900, erSs: 1800, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 18250, maxSalary: 18749.99, msc: 18500, eeSs: 925, erSs: 1850, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 18750, maxSalary: 19249.99, msc: 19000, eeSs: 950, erSs: 1900, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 19250, maxSalary: 19749.99, msc: 19500, eeSs: 975, erSs: 1950, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      { minSalary: 19750, maxSalary: 20249.99, msc: 20000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 0, erMpf: 0 },
      // MSC P20,500 - P35,000: Regular SS + MPF Program
      { minSalary: 20250, maxSalary: 20749.99, msc: 20500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 25, erMpf: 50 },
      { minSalary: 20750, maxSalary: 21249.99, msc: 21000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 50, erMpf: 100 },
      { minSalary: 21250, maxSalary: 21749.99, msc: 21500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 75, erMpf: 150 },
      { minSalary: 21750, maxSalary: 22249.99, msc: 22000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 100, erMpf: 200 },
      { minSalary: 22250, maxSalary: 22749.99, msc: 22500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 125, erMpf: 250 },
      { minSalary: 22750, maxSalary: 23249.99, msc: 23000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 150, erMpf: 300 },
      { minSalary: 23250, maxSalary: 23749.99, msc: 23500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 175, erMpf: 350 },
      { minSalary: 23750, maxSalary: 24249.99, msc: 24000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 200, erMpf: 400 },
      { minSalary: 24250, maxSalary: 24749.99, msc: 24500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 225, erMpf: 450 },
      { minSalary: 24750, maxSalary: 25249.99, msc: 25000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 250, erMpf: 500 },
      { minSalary: 25250, maxSalary: 25749.99, msc: 25500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 275, erMpf: 550 },
      { minSalary: 25750, maxSalary: 26249.99, msc: 26000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 300, erMpf: 600 },
      { minSalary: 26250, maxSalary: 26749.99, msc: 26500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 325, erMpf: 650 },
      { minSalary: 26750, maxSalary: 27249.99, msc: 27000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 350, erMpf: 700 },
      { minSalary: 27250, maxSalary: 27749.99, msc: 27500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 375, erMpf: 750 },
      { minSalary: 27750, maxSalary: 28249.99, msc: 28000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 400, erMpf: 800 },
      { minSalary: 28250, maxSalary: 28749.99, msc: 28500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 425, erMpf: 850 },
      { minSalary: 28750, maxSalary: 29249.99, msc: 29000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 450, erMpf: 900 },
      { minSalary: 29250, maxSalary: 29749.99, msc: 29500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 475, erMpf: 950 },
      { minSalary: 29750, maxSalary: 30249.99, msc: 30000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 500, erMpf: 1000 },
      { minSalary: 30250, maxSalary: 30749.99, msc: 30500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 525, erMpf: 1050 },
      { minSalary: 30750, maxSalary: 31249.99, msc: 31000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 550, erMpf: 1100 },
      { minSalary: 31250, maxSalary: 31749.99, msc: 31500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 575, erMpf: 1150 },
      { minSalary: 31750, maxSalary: 32249.99, msc: 32000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 600, erMpf: 1200 },
      { minSalary: 32250, maxSalary: 32749.99, msc: 32500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 625, erMpf: 1250 },
      { minSalary: 32750, maxSalary: 33249.99, msc: 33000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 650, erMpf: 1300 },
      { minSalary: 33250, maxSalary: 33749.99, msc: 33500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 675, erMpf: 1350 },
      { minSalary: 33750, maxSalary: 34249.99, msc: 34000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 700, erMpf: 1400 },
      { minSalary: 34250, maxSalary: 34749.99, msc: 34500, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 725, erMpf: 1450 },
      { minSalary: 34750, maxSalary: null, msc: 35000, eeSs: 1000, erSs: 2000, eeEc: 0, erEc: 30, eeMpf: 750, erMpf: 1500 },
    ],
  },
};

// PhilHealth 2026 Contribution Table
// Total rate: 5% (EE: 2.5%, ER: 2.5%)
// Income floor: P10,000, ceiling: P100,000
export const philhealthTable2026 = {
  type: "PHILHEALTH",
  version: "2026-01",
  effectiveDate: "2026-01-01",
  sourceDocument: "PhilHealth Advisory 2025-0002 (UHC Law)",
  tableData: {
    premiumRate: 0.05, // 5% total (2.5% EE, 2.5% ER)
    eeRate: 0.025, // 2.5% employee share
    erRate: 0.025, // 2.5% employer share
    incomeFloor: 10000, // Minimum basic salary for computation
    incomeCeiling: 100000, // Maximum basic salary for computation
    minContribution: 500, // Minimum monthly contribution (5% of P10,000)
    maxContribution: 5000, // Maximum monthly contribution (5% of P100,000)
  },
};

// Pag-IBIG 2026 Contribution Table
// Effective February 2024 (Circular No. 460) - Max MFS increased to P10,000
export const pagibigTable2026 = {
  type: "PAGIBIG",
  version: "2026-01",
  effectiveDate: "2026-01-01",
  sourceDocument: "HDMF Circular No. 460",
  tableData: {
    // Rate structure based on monthly salary
    brackets: [
      { minSalary: 0, maxSalary: 1500, eeRate: 0.01, erRate: 0.02 }, // 1% EE, 2% ER for <=P1,500
      { minSalary: 1500.01, maxSalary: null, eeRate: 0.02, erRate: 0.02 }, // 2% EE, 2% ER for >P1,500
    ],
    maxMFS: 10000, // Maximum Monthly Fund Salary
    maxEeContribution: 200, // Maximum EE contribution (2% of P10,000)
    maxErContribution: 200, // Maximum ER contribution (2% of P10,000)
    maxTotalContribution: 400, // Maximum total monthly contribution
  },
};

// BIR Withholding Tax Table 2026
// TRAIN Law brackets (effective 2023 onwards, unchanged for 2026)
export const taxTable2026 = {
  type: "TAX",
  version: "2026-01",
  effectiveDate: "2026-01-01",
  sourceDocument: "TRAIN Law / RR No. 8-2018 (2023 onwards)",
  tableData: {
    // Annual income tax brackets
    brackets: [
      { minIncome: 0, maxIncome: 250000, baseTax: 0, rate: 0 },
      { minIncome: 250001, maxIncome: 400000, baseTax: 0, rate: 0.15 },
      { minIncome: 400001, maxIncome: 800000, baseTax: 22500, rate: 0.20 },
      { minIncome: 800001, maxIncome: 2000000, baseTax: 102500, rate: 0.25 },
      { minIncome: 2000001, maxIncome: 8000000, baseTax: 402500, rate: 0.30 },
      { minIncome: 8000001, maxIncome: null, baseTax: 2202500, rate: 0.35 },
    ],
    // Monthly income tax brackets (annual / 12)
    monthlyBrackets: [
      { minIncome: 0, maxIncome: 20833, baseTax: 0, rate: 0 },
      { minIncome: 20834, maxIncome: 33333, baseTax: 0, rate: 0.15 },
      { minIncome: 33334, maxIncome: 66667, baseTax: 1875, rate: 0.20 },
      { minIncome: 66668, maxIncome: 166667, baseTax: 8541.67, rate: 0.25 },
      { minIncome: 166668, maxIncome: 666667, baseTax: 33541.67, rate: 0.30 },
      { minIncome: 666668, maxIncome: null, baseTax: 183541.67, rate: 0.35 },
    ],
    // Semi-monthly income tax brackets (annual / 24)
    semiMonthlyBrackets: [
      { minIncome: 0, maxIncome: 10417, baseTax: 0, rate: 0 },
      { minIncome: 10418, maxIncome: 16667, baseTax: 0, rate: 0.15 },
      { minIncome: 16668, maxIncome: 33333, baseTax: 937.50, rate: 0.20 },
      { minIncome: 33334, maxIncome: 83333, baseTax: 4270.83, rate: 0.25 },
      { minIncome: 83334, maxIncome: 333333, baseTax: 16770.83, rate: 0.30 },
      { minIncome: 333334, maxIncome: null, baseTax: 91770.83, rate: 0.35 },
    ],
  },
};
