// =============================================================================
// PeopleOS PH - Department Seeder
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";

const defaultDepartments = [
  { code: "OPS", name: "Operations" },
  { code: "HR", name: "Human Resources" },
  { code: "SLS", name: "Sales" },
  { code: "MKT", name: "Marketing" },
];

export async function seedDepartments(prisma: PrismaClient, companyId: string) {
  for (const dept of defaultDepartments) {
    await prisma.department.upsert({
      where: {
        // Since there's no unique constraint on code+companyId,
        // we need to find first and then create/update
        id: (
          await prisma.department.findFirst({
            where: { companyId, code: dept.code, deletedAt: null },
            select: { id: true },
          })
        )?.id || "00000000-0000-0000-0000-000000000000",
      },
      update: {
        name: dept.name,
      },
      create: {
        companyId,
        code: dept.code,
        name: dept.name,
      },
    });
  }

  return defaultDepartments.length;
}
