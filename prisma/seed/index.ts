// =============================================================================
// PeopleOS PH - Database Seed Entry Point
// =============================================================================
// Seeds essential data for the payroll system:
// - Company and hiring entities
// - Admin roles (Super Admin, HR Admin, Payroll Admin, Finance Manager)
// - Default admin user
// - Shift templates, holidays, payroll calendar
// - Leave types and departments
// =============================================================================

import { PrismaClient } from "../../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, PoolConfig } from "pg";

import { seedCompany } from "./seeders/01-company";
import { seedRoles } from "./seeders/02-roles";
import { seedAdminUser, type CreatedUser } from "./seeders/03-admin-user";
import { seedShiftTemplates } from "./seeders/04-shifts";
import { seedHolidayCalendar } from "./seeders/05-holidays";
import { seedPayrollCalendar } from "./seeders/08-payroll-calendar";
import { seedLeaveTypes } from "./seeders/10-leave-types";
import { seedDepartments } from "./seeders/11-departments";

// Create Prisma client with adapter for Prisma 7 (Neon-compatible)
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }, // Required for Neon
};
const pool = new Pool(poolConfig);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const env = process.env.NODE_ENV || "development";
  console.log(`\n🌱 Seeding database (${env})...\n`);

  // Always run these (idempotent)
  const company = await seedCompany(prisma);
  console.log("✅ Company seeded");

  await seedRoles(prisma);
  console.log("✅ Roles seeded");

  const users = await seedAdminUser(prisma, company.id);
  console.log(`✅ Users seeded (${users.length} users)`);

  await seedShiftTemplates(prisma, company.id);
  console.log("✅ Shift templates seeded");

  await seedHolidayCalendar(prisma, company.id);
  console.log("✅ Holiday calendar seeded");

  await seedPayrollCalendar(prisma, company.id);
  console.log("✅ Payroll calendar seeded");

  const leaveTypeCount = await seedLeaveTypes(prisma, company.id);
  console.log(`✅ Leave types seeded (${leaveTypeCount} types)`);

  const deptCount = await seedDepartments(prisma, company.id);
  console.log(`✅ Departments seeded (${deptCount} departments)`);

  console.log("\n✅ Seeding complete!\n");

  // Print all user credentials
  printUserCredentials(users);
}

function printUserCredentials(users: CreatedUser[]) {
  const divider = "═".repeat(75);
  const thinDivider = "─".repeat(75);

  console.log(divider);
  console.log("  TEST USER ACCOUNTS");
  console.log(divider);
  console.log("");
  console.log("  The following test users have been created:");
  console.log("");

  for (const user of users) {
    console.log(`  📧 ${user.email}`);
    console.log(`     Password: ${user.password}`);
    console.log(`     Roles:    ${user.roles.join(", ")}`);
    console.log(`     Access:   ${user.description}`);
    console.log(thinDivider);
  }

  console.log("");
  console.log("  ⚠️  These are development credentials. Change in production!");
  console.log(divider);
  console.log("");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
