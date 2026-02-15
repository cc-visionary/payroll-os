import { describe, test, expect } from "vitest";
import { computeEmployeePayslip } from "../payroll/compute-engine";
import { getDayRates, calculateDerivedRates } from "../payroll/wage-calculator";
import type { AttendanceDayInput, PayProfileInput, PayPeriodInput, RulesetInput } from "../payroll/types";
import type { EmployeePayrollInput } from "../payroll/compute-engine";

/**
 * Unit tests for daily rate override feature.
 *
 * When dailyRateOverride is set on an attendance day, ALL derived rates
 * for that day are recalculated from the override rate:
 * - Basic pay uses the override daily rate
 * - OT uses override hourly rate
 * - Late/undertime uses override minute rate
 * - Night differential uses override hourly rate
 * - Holiday premiums use override hourly rate
 *
 * Statutory (SSS, PhilHealth, Pag-IBIG) and tax calculations remain
 * unaffected — they still use the RoleScorecard rate.
 */

// =============================================================================
// Test Helpers
// =============================================================================

function makeProfile(overrides: Partial<PayProfileInput> = {}): PayProfileInput {
  return {
    employeeId: "emp-1",
    wageType: "DAILY",
    baseRate: 1000, // 1000/day = 125/hr = 2.0833/min
    payFrequency: "SEMI_MONTHLY",
    standardWorkDaysPerMonth: 26,
    standardHoursPerDay: 8,
    isBenefitsEligible: false, // Disable statutory for simpler tests
    isOtEligible: true,
    isNdEligible: true,
    riceSubsidy: 0,
    clothingAllowance: 0,
    laundryAllowance: 0,
    medicalAllowance: 0,
    transportationAllowance: 0,
    mealAllowance: 0,
    communicationAllowance: 0,
    ...overrides,
  };
}

function makePayPeriod(): PayPeriodInput {
  return {
    id: "pp-1",
    startDate: new Date("2026-02-01"),
    endDate: new Date("2026-02-15"),
    cutoffDate: new Date("2026-02-15"),
    payDate: new Date("2026-02-20"),
    periodNumber: 3,
    payFrequency: "SEMI_MONTHLY",
  };
}

function makeRuleset(): RulesetInput {
  return {
    id: "rs-1",
    version: 1,
    multipliers: [],
  };
}

function makeWorkDay(
  date: string,
  overrides: Partial<AttendanceDayInput> = {}
): AttendanceDayInput {
  return {
    id: `att-${date}`,
    attendanceDate: new Date(date),
    dayType: "WORKDAY",
    workedMinutes: 480, // Full 8-hour day
    lateMinutes: 0,
    undertimeMinutes: 0,
    absentMinutes: 0,
    otEarlyInMinutes: 0,
    otLateOutMinutes: 0,
    otBreakMinutes: 0,
    overtimeRestDayMinutes: 0,
    overtimeHolidayMinutes: 0,
    earlyInApproved: false,
    lateOutApproved: false,
    nightDiffMinutes: 0,
    isOnLeave: false,
    leaveIsPaid: false,
    ...overrides,
  };
}

function makeEmployeeInput(
  attendance: AttendanceDayInput[],
  profileOverrides: Partial<PayProfileInput> = {}
): EmployeePayrollInput {
  return {
    profile: makeProfile(profileOverrides),
    regularization: {
      employeeId: "emp-1",
      employmentType: "REGULAR",
      hireDate: new Date("2025-01-01"),
    },
    attendance,
    manualAdjustments: [],
    previousYtd: { grossPay: 0, taxableIncome: 0, taxWithheld: 0 },
  };
}

function findLine(
  payslip: ReturnType<typeof computeEmployeePayslip>,
  category: string
) {
  return payslip.lines.find((l) => l.category === category);
}

// =============================================================================
// getDayRates Helper Tests
// =============================================================================

describe("getDayRates helper", () => {
  const profile = makeProfile();
  const standardRates = calculateDerivedRates(profile);

  test("returns standard rates when no override", () => {
    const result = getDayRates(standardRates, 8, undefined);
    expect(result).toBe(standardRates); // Same reference
  });

  test("returns standard rates when override is null-ish", () => {
    const result = getDayRates(standardRates, 8, undefined);
    expect(result.dailyRate).toBe(1000);
  });

  test("derives all rates from override daily rate", () => {
    const result = getDayRates(standardRates, 8, 500);
    expect(result.dailyRate).toBe(500);
    expect(result.hourlyRate).toBe(62.5); // 500 / 8
    expect(result.minuteRate).toBeCloseTo(1.041667, 4); // 62.5 / 60
  });

  test("preserves MSC from standard rates (statutory unaffected)", () => {
    const result = getDayRates(standardRates, 8, 500);
    expect(result.msc).toBe(standardRates.msc); // Still based on standard rate
  });

  test("preserves monthlyRate from standard rates", () => {
    const result = getDayRates(standardRates, 8, 500);
    expect(result.monthlyRate).toBe(standardRates.monthlyRate);
  });
});

// =============================================================================
// Basic Pay with Mixed Rates
// =============================================================================

describe("Basic Pay with daily rate override", () => {
  test("10 standard days + 2 override days = correct total", () => {
    const attendance = [
      // 10 standard days at 1000/day
      ...Array.from({ length: 10 }, (_, i) =>
        makeWorkDay(`2026-02-0${i + 1 < 10 ? i + 1 : ""}${i + 1 >= 10 ? i + 1 : ""}`)
      ).map((d, i) => ({ ...d, id: `att-std-${i}`, attendanceDate: new Date(`2026-02-${String(i + 1).padStart(2, "0")}`) })),
      // 2 training days at 500/day
      makeWorkDay("2026-02-11", { dailyRateOverride: 500 }),
      makeWorkDay("2026-02-12", { dailyRateOverride: 500 }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const basicPay = findLine(payslip, "BASIC_PAY");
    expect(basicPay).toBeDefined();
    // 10 × 1000 + 2 × 500 = 11000
    expect(basicPay!.amount).toBe(11000);
  });

  test("all days with override = all use override rate", () => {
    const attendance = [
      makeWorkDay("2026-02-01", { dailyRateOverride: 600 }),
      makeWorkDay("2026-02-02", { dailyRateOverride: 600 }),
      makeWorkDay("2026-02-03", { dailyRateOverride: 600 }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const basicPay = findLine(payslip, "BASIC_PAY");
    expect(basicPay!.amount).toBe(1800); // 3 × 600
  });

  test("no overrides = standard calculation", () => {
    const attendance = [
      makeWorkDay("2026-02-01"),
      makeWorkDay("2026-02-02"),
      makeWorkDay("2026-02-03"),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const basicPay = findLine(payslip, "BASIC_PAY");
    expect(basicPay!.amount).toBe(3000); // 3 × 1000
  });
});

// =============================================================================
// Late/Undertime Deductions with Override
// =============================================================================

describe("Late/Undertime deductions with daily rate override", () => {
  test("late deduction uses override minute rate on override days", () => {
    const attendance = [
      // Standard day with 30 min late: 30 × 2.0833 = 62.50 (rounded)
      makeWorkDay("2026-02-01", { lateMinutes: 30 }),
      // Override day (500/day) with 30 min late: 30 × (500/8/60) = 30 × 1.0417 = 31.25
      makeWorkDay("2026-02-02", { lateMinutes: 30, dailyRateOverride: 500 }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const lateUt = findLine(payslip, "LATE_UT_DEDUCTION");
    expect(lateUt).toBeDefined();
    // Standard: 30 × (1000/8/60) = 30 × 2.083333 = 62.5
    // Override: 30 × (500/8/60) = 30 × 1.041667 = 31.25
    // Total: 93.75
    expect(lateUt!.amount).toBeCloseTo(93.75, 1);
    expect(lateUt!.quantity).toBe(60); // 30 + 30 minutes total
  });

  test("undertime deduction uses override minute rate", () => {
    const attendance = [
      makeWorkDay("2026-02-01", { undertimeMinutes: 60, dailyRateOverride: 400 }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const lateUt = findLine(payslip, "LATE_UT_DEDUCTION");
    expect(lateUt).toBeDefined();
    // 60 × (400/8/60) = 60 × 0.8333 = 50.00
    expect(lateUt!.amount).toBeCloseTo(50, 1);
  });
});

// =============================================================================
// Overtime with Override
// =============================================================================

describe("Overtime with daily rate override", () => {
  test("regular OT uses override hourly rate", () => {
    const attendance = [
      // Standard day: 60 min OT at 125% = (1000/8) × 1 × 1.25 = 156.25
      makeWorkDay("2026-02-01", {
        otLateOutMinutes: 60,
        lateOutApproved: true,
      }),
      // Override day (500/day): 60 min OT at 125% = (500/8) × 1 × 1.25 = 78.125
      makeWorkDay("2026-02-02", {
        otLateOutMinutes: 60,
        lateOutApproved: true,
        dailyRateOverride: 500,
      }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const regularOt = findLine(payslip, "OVERTIME_REGULAR");
    expect(regularOt).toBeDefined();
    // 156.25 + 78.125 = 234.375
    expect(regularOt!.amount).toBeCloseTo(234.375, 2);
    expect(regularOt!.quantity).toBe(120); // 60 + 60 total OT minutes
  });
});

// =============================================================================
// Night Differential with Override
// =============================================================================

describe("Night Differential with daily rate override", () => {
  test("ND uses override hourly rate", () => {
    const attendance = [
      // Standard day: 120 min ND at 10% = (1000/8) × (120/60) × 0.10 = 25.0
      makeWorkDay("2026-02-01", { nightDiffMinutes: 120 }),
      // Override day (500/day): 120 min ND at 10% = (500/8) × (120/60) × 0.10 = 12.5
      makeWorkDay("2026-02-02", { nightDiffMinutes: 120, dailyRateOverride: 500 }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const nd = findLine(payslip, "NIGHT_DIFFERENTIAL");
    expect(nd).toBeDefined();
    // 25.0 + 12.5 = 37.5
    expect(nd!.amount).toBeCloseTo(37.5, 2);
  });
});

// =============================================================================
// Holiday Premium with Override
// =============================================================================

describe("Holiday Premium with daily rate override", () => {
  test("regular holiday pay uses override hourly rate", () => {
    const attendance = [
      // Standard regular holiday: 480 min at 200% = (1000/8) × 8 × 2.0 = 2000
      makeWorkDay("2026-02-01", {
        dayType: "REGULAR_HOLIDAY",
        holidayMultiplier: 2.0,
      }),
      // Override (500/day) regular holiday: 480 min at 200% = (500/8) × 8 × 2.0 = 1000
      makeWorkDay("2026-02-02", {
        dayType: "REGULAR_HOLIDAY",
        holidayMultiplier: 2.0,
        dailyRateOverride: 500,
      }),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const holidayPay = payslip.lines.filter((l) => l.category === "HOLIDAY_PAY");
    expect(holidayPay.length).toBeGreaterThan(0);

    const totalHolidayPay = holidayPay.reduce((sum, l) => sum + l.amount, 0);
    // 2000 + 1000 = 3000
    expect(totalHolidayPay).toBeCloseTo(3000, 1);
  });
});

// =============================================================================
// Statutory & Tax NOT Affected
// =============================================================================

describe("Statutory and tax NOT affected by daily override", () => {
  test("MSC uses standard rate even with overrides", () => {
    const profile = makeProfile({ isBenefitsEligible: true });
    const attendance = [
      makeWorkDay("2026-02-01", { dailyRateOverride: 200 }),
      makeWorkDay("2026-02-02", { dailyRateOverride: 200 }),
      makeWorkDay("2026-02-03"),
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance, { isBenefitsEligible: true })
    );

    // SSS line should exist (benefits eligible)
    const sssLine = findLine(payslip, "SSS_EE");
    expect(sssLine).toBeDefined();

    // Verify SSS is the same as without overrides (standard rate)
    const noOverrideAttendance = [
      makeWorkDay("2026-02-01"),
      makeWorkDay("2026-02-02"),
      makeWorkDay("2026-02-03"),
    ];

    const noOverridePayslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(noOverrideAttendance, { isBenefitsEligible: true })
    );

    const noOverrideSss = findLine(noOverridePayslip, "SSS_EE");
    expect(sssLine!.amount).toBe(noOverrideSss!.amount);
  });
});

// =============================================================================
// Standard Days Unaffected
// =============================================================================

describe("Standard days unaffected when some days have overrides", () => {
  test("standard days still use profile rate", () => {
    // 1 override day + 1 standard day
    const attendance = [
      makeWorkDay("2026-02-01", { dailyRateOverride: 500 }),
      makeWorkDay("2026-02-02"), // Standard 1000/day
    ];

    const payslip = computeEmployeePayslip(
      makePayPeriod(),
      makeRuleset(),
      makeEmployeeInput(attendance)
    );

    const basicPay = findLine(payslip, "BASIC_PAY");
    expect(basicPay!.amount).toBe(1500); // 500 + 1000
  });
});
