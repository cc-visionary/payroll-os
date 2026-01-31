// =============================================================================
// PeopleOS PH - Payroll Calendar Seeder
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function generatePayPeriods(year: number) {
  const periods = [];

  for (let month = 1; month <= 12; month++) {
    const monthName = MONTH_NAMES[month - 1];
    const monthShort = MONTH_SHORT[month - 1];

    // First half: 1-15 (Mid-month payroll)
    const firstHalfEnd = new Date(year, month - 1, 15);
    periods.push({
      // More descriptive code: "Jan 2026 (1-15)" style
      code: `${monthShort} ${year} (1-15)`,
      startDate: new Date(year, month - 1, 1),
      endDate: firstHalfEnd,
      cutoffDate: firstHalfEnd,
      payDate: new Date(year, month - 1, 20), // Pay on 20th
      periodNumber: (month - 1) * 2 + 1,
    });

    // Second half: 16-end of month (End-month payroll)
    const lastDay = new Date(year, month, 0).getDate();
    const secondHalfEnd = new Date(year, month - 1, lastDay);
    periods.push({
      // More descriptive code: "Jan 2026 (16-31)" style
      code: `${monthShort} ${year} (16-${lastDay})`,
      startDate: new Date(year, month - 1, 16),
      endDate: secondHalfEnd,
      cutoffDate: secondHalfEnd,
      payDate: new Date(year, month, 5), // Pay on 5th of next month
      periodNumber: (month - 1) * 2 + 2,
    });
  }

  return periods;
}

export async function seedPayrollCalendar(prisma: PrismaClient, companyId: string) {
  // Create payroll calendars for 2025 and 2026
  const calendar2025 = await prisma.payrollCalendar.upsert({
    where: {
      companyId_year_payFrequency: { companyId, year: 2025, payFrequency: "SEMI_MONTHLY" },
    },
    update: {},
    create: {
      companyId,
      year: 2025,
      payFrequency: "SEMI_MONTHLY",
    },
  });

  const calendar2026 = await prisma.payrollCalendar.upsert({
    where: {
      companyId_year_payFrequency: { companyId, year: 2026, payFrequency: "SEMI_MONTHLY" },
    },
    update: {},
    create: {
      companyId,
      year: 2026,
      payFrequency: "SEMI_MONTHLY",
    },
  });

  // Generate pay periods for 2025
  const periods2025 = generatePayPeriods(2025);
  for (const period of periods2025) {
    await prisma.payPeriod.upsert({
      where: {
        calendarId_code: { calendarId: calendar2025.id, code: period.code },
      },
      update: {
        startDate: period.startDate,
        endDate: period.endDate,
        cutoffDate: period.cutoffDate,
        payDate: period.payDate,
        periodNumber: period.periodNumber,
      },
      create: {
        calendarId: calendar2025.id,
        code: period.code,
        startDate: period.startDate,
        endDate: period.endDate,
        cutoffDate: period.cutoffDate,
        payDate: period.payDate,
        periodNumber: period.periodNumber,
      },
    });
  }

  // Generate pay periods for 2026
  const periods2026 = generatePayPeriods(2026);
  for (const period of periods2026) {
    await prisma.payPeriod.upsert({
      where: {
        calendarId_code: { calendarId: calendar2026.id, code: period.code },
      },
      update: {
        startDate: period.startDate,
        endDate: period.endDate,
        cutoffDate: period.cutoffDate,
        payDate: period.payDate,
        periodNumber: period.periodNumber,
      },
      create: {
        calendarId: calendar2026.id,
        code: period.code,
        startDate: period.startDate,
        endDate: period.endDate,
        cutoffDate: period.cutoffDate,
        payDate: period.payDate,
        periodNumber: period.periodNumber,
      },
    });
  }
}
