// =============================================================================
// PeopleOS PH - Sample Employees Seeder (Dev Only)
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";

// Hiring entity IDs (created in 01-company.ts)
const GAMECOVE_HIRING_ENTITY_ID = "00000000-0000-0000-0000-000000000001";
const LUXIUM_HIRING_ENTITY_ID = "00000000-0000-0000-0000-000000000002";

const sampleEmployees = [
  {
    employeeNumber: "EMP001",
    firstName: "Juan",
    lastName: "Dela Cruz",
    workEmail: "juan.delacruz@gamecove.ph",
    hireDate: "2023-01-15",
    employmentType: "REGULAR" as const,
    employmentStatus: "ACTIVE" as const,
    regularizationDate: "2023-07-15",
    hiringEntityId: GAMECOVE_HIRING_ENTITY_ID,
  },
  {
    employeeNumber: "EMP002",
    firstName: "Maria",
    lastName: "Santos",
    workEmail: "maria.santos@gamecove.ph",
    hireDate: "2024-03-01",
    employmentType: "PROBATIONARY" as const,
    employmentStatus: "ACTIVE" as const,
    hiringEntityId: GAMECOVE_HIRING_ENTITY_ID,
  },
  {
    employeeNumber: "EMP003",
    firstName: "Pedro",
    lastName: "Reyes",
    workEmail: "pedro.reyes@luxium.ph",
    hireDate: "2022-06-10",
    employmentType: "REGULAR" as const,
    employmentStatus: "ACTIVE" as const,
    regularizationDate: "2022-12-10",
    hiringEntityId: LUXIUM_HIRING_ENTITY_ID,
  },
  {
    employeeNumber: "EMP004",
    firstName: "Ana",
    lastName: "Garcia",
    workEmail: "ana.garcia@gamecove.ph",
    hireDate: "2024-01-08",
    employmentType: "REGULAR" as const,
    employmentStatus: "ACTIVE" as const,
    regularizationDate: "2024-07-08",
    hiringEntityId: GAMECOVE_HIRING_ENTITY_ID,
  },
  {
    employeeNumber: "EMP005",
    firstName: "Jose",
    lastName: "Fernandez",
    workEmail: "jose.fernandez@luxium.ph",
    hireDate: "2023-09-01",
    employmentType: "REGULAR" as const,
    employmentStatus: "ACTIVE" as const,
    regularizationDate: "2024-03-01",
    hiringEntityId: LUXIUM_HIRING_ENTITY_ID,
  },
];

export async function seedSampleEmployees(prisma: PrismaClient, companyId: string) {
  for (const emp of sampleEmployees) {
    // Upsert employee
    const employee = await prisma.employee.upsert({
      where: {
        companyId_employeeNumber: { companyId, employeeNumber: emp.employeeNumber },
      },
      update: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        workEmail: emp.workEmail,
        hireDate: new Date(emp.hireDate),
        employmentType: emp.employmentType,
        employmentStatus: emp.employmentStatus,
        regularizationDate: emp.regularizationDate ? new Date(emp.regularizationDate) : null,
        hiringEntityId: emp.hiringEntityId,
      },
      create: {
        companyId,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        workEmail: emp.workEmail,
        hireDate: new Date(emp.hireDate),
        employmentType: emp.employmentType,
        employmentStatus: emp.employmentStatus,
        regularizationDate: emp.regularizationDate ? new Date(emp.regularizationDate) : null,
        hiringEntityId: emp.hiringEntityId,
      },
    });

    // Note: Employee schedules are now managed via RoleScorecard's shift template
    // and day-to-day attendance imports rather than explicit EmployeeSchedule records
  }
}
