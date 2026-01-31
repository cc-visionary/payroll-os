// =============================================================================
// PeopleOS PH - Payroll Calendar Seeder
// =============================================================================
//
// NOTE: Pay periods are created on-demand when running payroll via:
// - createPayrollRunWithSelectedEmployees (creates calendar + period)
// - createCustomPayPeriod (manual creation)
//
// This seeder only creates the calendar structure. Pay periods are NOT seeded
// because they should be created as needed by the user.
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";

export async function seedPayrollCalendar(prisma: PrismaClient, companyId: string) {
  // Only create the payroll calendar structure for the current year
  // Pay periods will be created on-demand when users run payroll
  const currentYear = new Date().getFullYear();

  await prisma.payrollCalendar.upsert({
    where: {
      companyId_year_payFrequency: { companyId, year: currentYear, payFrequency: "SEMI_MONTHLY" },
    },
    update: {},
    create: {
      companyId,
      year: currentYear,
      payFrequency: "SEMI_MONTHLY",
    },
  });
}
