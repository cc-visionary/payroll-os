// =============================================================================
// PeopleOS PH - Users Seeder
// =============================================================================
// Creates test users with different roles for development/testing.
// =============================================================================

import type { PrismaClient } from "../../../app/generated/prisma";
import { hash } from "bcryptjs";

// Test users configuration
// In development, we use simple passwords. In production, use env vars.
const TEST_USERS = [
  {
    email: "admin@gamecove.ph",
    password: "Admin123!",
    roles: ["SUPER_ADMIN", "HR_ADMIN"],
    description: "Super Administrator - Full system access",
  },
  {
    email: "hr@gamecove.ph",
    password: "HrAdmin123!",
    roles: ["HR_ADMIN"],
    description: "HR Manager - Manage employees, attendance, schedules",
  },
  {
    email: "payroll@gamecove.ph",
    password: "Payroll123!",
    roles: ["PAYROLL_ADMIN"],
    description: "Payroll Officer - Run payroll, exports, statutory",
  },
  {
    email: "finance@gamecove.ph",
    password: "Finance123!",
    roles: ["FINANCE_MANAGER"],
    description: "Finance Manager - Approve payroll, view reports",
  },
];

export interface CreatedUser {
  email: string;
  password: string;
  roles: string[];
  description: string;
}

export async function seedAdminUser(
  prisma: PrismaClient,
  companyId: string
): Promise<CreatedUser[]> {
  const createdUsers: CreatedUser[] = [];

  // Get all roles
  const allRoles = await prisma.role.findMany();
  const roleMap = new Map(allRoles.map((r) => [r.code, r.id]));

  for (const userConfig of TEST_USERS) {
    // Use env var password if available, otherwise use default
    const envKey = `${userConfig.email.split("@")[0].toUpperCase()}_PASSWORD`;
    const password = process.env[envKey] || userConfig.password;
    const passwordHash = await hash(password, 12);

    // Verify all required roles exist
    const missingRoles = userConfig.roles.filter((r) => !roleMap.has(r));
    if (missingRoles.length > 0) {
      console.warn(`  Skipping ${userConfig.email}: Missing roles: ${missingRoles.join(", ")}`);
      continue;
    }

    // Upsert the user
    const user = await prisma.user.upsert({
      where: { email: userConfig.email },
      update: {
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
      create: {
        email: userConfig.email,
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        companyId,
      },
    });

    // Assign roles (delete existing and recreate to ensure correct assignment)
    await prisma.userRole.deleteMany({
      where: { userId: user.id },
    });

    await prisma.userRole.createMany({
      data: userConfig.roles.map((roleCode) => ({
        userId: user.id,
        roleId: roleMap.get(roleCode)!,
      })),
    });

    createdUsers.push({
      email: userConfig.email,
      password,
      roles: userConfig.roles,
      description: userConfig.description,
    });
  }

  return createdUsers;
}
