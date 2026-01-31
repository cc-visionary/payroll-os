// =============================================================================
// PeopleOS PH - Roles Seeder
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";
import { roles } from "../data/roles";

export async function seedRoles(prisma: PrismaClient) {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        permissions: role.permissions,
      },
      create: {
        code: role.code,
        name: role.name,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
    });
  }
}
