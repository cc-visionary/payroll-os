"use server";

// =============================================================================
// PeopleOS PH - Leave Management Server Actions
// =============================================================================
// Server actions for leave balance management, leave requests, and accruals.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";

// =============================================================================
// Types
// =============================================================================

export interface LeaveTypeInfo {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accrualType: string;
  accrualAmount: number | null;
  minTenureDays: number;
  isPaid: boolean;
  isConvertible: boolean;
  canCarryOver: boolean;
  isActive: boolean;
}

export interface EmployeeLeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  openingBalance: number;
  accrued: number;
  used: number;
  forfeited: number;
  converted: number;
  adjusted: number;
  carriedOverFromPrevious: number;
  currentBalance: number;
}

// =============================================================================
// Get Leave Types
// =============================================================================

/**
 * Get all active leave types for the company.
 * Permission: employee:view
 */
export async function getLeaveTypes(): Promise<{
  success: boolean;
  leaveTypes?: LeaveTypeInfo[];
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        companyId: auth.user.companyId,
        isActive: true,
      },
      orderBy: { code: "asc" },
    });

    const toNum = (val: unknown) =>
      typeof val === "object" && val !== null && "toNumber" in val
        ? (val as { toNumber: () => number }).toNumber()
        : Number(val) || 0;

    return {
      success: true,
      leaveTypes: leaveTypes.map((lt) => ({
        id: lt.id,
        code: lt.code,
        name: lt.name,
        description: lt.description,
        accrualType: lt.accrualType,
        accrualAmount: lt.accrualAmount ? toNum(lt.accrualAmount) : null,
        minTenureDays: lt.minTenureDays,
        isPaid: lt.isPaid,
        isConvertible: lt.isConvertible,
        canCarryOver: lt.canCarryOver,
        isActive: lt.isActive,
      })),
    };
  } catch (error) {
    console.error("Failed to get leave types:", error);
    return { success: false, error: "Failed to get leave types" };
  }
}

// =============================================================================
// Get Employee Leave Balances
// =============================================================================

/**
 * Get leave balances for an employee.
 * Permission: employee:view
 */
export async function getEmployeeLeaveBalances(
  employeeId: string,
  year?: number
): Promise<{
  success: boolean;
  balances?: EmployeeLeaveBalance[];
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EMPLOYEE_VIEW);
    const targetYear = year || new Date().getFullYear();

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: auth.user.companyId,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    const balances = await prisma.leaveBalance.findMany({
      where: {
        employeeId,
        year: targetYear,
      },
      include: {
        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { leaveType: { code: "asc" } },
    });

    const toNum = (val: unknown) =>
      typeof val === "object" && val !== null && "toNumber" in val
        ? (val as { toNumber: () => number }).toNumber()
        : Number(val) || 0;

    return {
      success: true,
      balances: balances.map((b) => {
        const opening = toNum(b.openingBalance);
        const accrued = toNum(b.accrued);
        const used = toNum(b.used);
        const forfeited = toNum(b.forfeited);
        const converted = toNum(b.converted);
        const adjusted = toNum(b.adjusted);
        const carriedOver = toNum(b.carriedOverFromPrevious);

        return {
          id: b.id,
          leaveTypeId: b.leaveTypeId,
          leaveTypeCode: b.leaveType.code,
          leaveTypeName: b.leaveType.name,
          year: b.year,
          openingBalance: opening,
          accrued,
          used,
          forfeited,
          converted,
          adjusted,
          carriedOverFromPrevious: carriedOver,
          currentBalance: opening + accrued + carriedOver - used - forfeited - converted + adjusted,
        };
      }),
    };
  } catch (error) {
    console.error("Failed to get employee leave balances:", error);
    return { success: false, error: "Failed to get employee leave balances" };
  }
}

// =============================================================================
// Provision Leave Balances for Year
// =============================================================================

/**
 * Provision leave balances for all eligible employees for a given year.
 * This should be run at the start of each year or when needed to grant
 * annual leave entitlements to employees who meet the eligibility criteria
 * (e.g., completed 1 year of service).
 *
 * Permission: payroll:run (admin level)
 */
export async function provisionLeaveBalancesForYear(year: number): Promise<{
  success: boolean;
  employeesProcessed: number;
  balancesCreated: number;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.PAYROLL_RUN);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get all active leave types with annual accrual
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        companyId: auth.user.companyId,
        isActive: true,
        accrualType: "ANNUAL",
        accrualAmount: { not: null },
      },
    });

    if (leaveTypes.length === 0) {
      return {
        success: true,
        employeesProcessed: 0,
        balancesCreated: 0,
      };
    }

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: {
        companyId: auth.user.companyId,
        deletedAt: null,
        employmentStatus: "ACTIVE",
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        hireDate: true,
      },
    });

    // Calculate the cutoff date for tenure eligibility
    // Employee must have been hired before this date to be eligible
    const yearStart = new Date(year, 0, 1);

    let employeesProcessed = 0;
    let balancesCreated = 0;

    const toNum = (val: unknown) =>
      typeof val === "object" && val !== null && "toNumber" in val
        ? (val as { toNumber: () => number }).toNumber()
        : Number(val) || 0;

    for (const employee of employees) {
      // Calculate tenure in days as of the start of the year
      const tenureDays = Math.floor(
        (yearStart.getTime() - employee.hireDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let employeeHasNewBalances = false;

      for (const leaveType of leaveTypes) {
        // Check if employee meets tenure requirement
        if (tenureDays < leaveType.minTenureDays) {
          continue; // Employee not eligible yet
        }

        // Check if balance already exists for this year
        const existingBalance = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year,
            },
          },
        });

        if (existingBalance) {
          continue; // Balance already exists, skip
        }

        // Get previous year's balance for carry over calculation
        let carriedOver = 0;
        if (leaveType.canCarryOver) {
          const previousYearBalance = await prisma.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                year: year - 1,
              },
            },
          });

          if (previousYearBalance) {
            const prevBalance =
              toNum(previousYearBalance.openingBalance) +
              toNum(previousYearBalance.accrued) +
              toNum(previousYearBalance.carriedOverFromPrevious) -
              toNum(previousYearBalance.used) -
              toNum(previousYearBalance.forfeited) -
              toNum(previousYearBalance.converted) +
              toNum(previousYearBalance.adjusted);

            const carryOverCap = leaveType.carryOverCap
              ? toNum(leaveType.carryOverCap)
              : Infinity;
            carriedOver = Math.min(Math.max(0, prevBalance), carryOverCap);
          }
        }

        // Create the leave balance
        const accrualAmount = toNum(leaveType.accrualAmount);
        const newBalance = await prisma.leaveBalance.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year,
            openingBalance: accrualAmount, // Grant the annual entitlement
            accrued: 0,
            used: 0,
            forfeited: 0,
            converted: 0,
            adjusted: 0,
            carriedOverFromPrevious: carriedOver,
            carryOverExpiryDate: leaveType.carryOverExpiryMonths
              ? new Date(year, leaveType.carryOverExpiryMonths - 1, 1)
              : null,
          },
        });

        await audit.create("LeaveBalance", newBalance.id, {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          leaveTypeCode: leaveType.code,
          year,
          openingBalance: accrualAmount,
          carriedOver,
          reason: "Annual leave provisioning",
        });

        balancesCreated++;
        employeeHasNewBalances = true;
      }

      if (employeeHasNewBalances) {
        employeesProcessed++;
      }
    }

    revalidatePath("/employees");

    return {
      success: true,
      employeesProcessed,
      balancesCreated,
    };
  } catch (error) {
    console.error("Failed to provision leave balances:", error);
    return {
      success: false,
      employeesProcessed: 0,
      balancesCreated: 0,
      error: error instanceof Error ? error.message : "Failed to provision leave balances",
    };
  }
}

// =============================================================================
// Provision Leave Balance for Single Employee
// =============================================================================

/**
 * Provision leave balances for a single employee.
 * Useful when an employee becomes eligible mid-year.
 *
 * Permission: employee:edit
 */
export async function provisionEmployeeLeaveBalance(
  employeeId: string,
  year?: number
): Promise<{
  success: boolean;
  balancesCreated: number;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EMPLOYEE_EDIT);
    const targetYear = year || new Date().getFullYear();

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        hireDate: true,
      },
    });

    if (!employee) {
      return { success: false, balancesCreated: 0, error: "Employee not found" };
    }

    // Get all active leave types with annual accrual
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        companyId: auth.user.companyId,
        isActive: true,
        accrualType: "ANNUAL",
        accrualAmount: { not: null },
      },
    });

    // Calculate tenure in days as of today (for mid-year eligibility)
    const now = new Date();
    const tenureDays = Math.floor(
      (now.getTime() - employee.hireDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let balancesCreated = 0;

    const toNum = (val: unknown) =>
      typeof val === "object" && val !== null && "toNumber" in val
        ? (val as { toNumber: () => number }).toNumber()
        : Number(val) || 0;

    for (const leaveType of leaveTypes) {
      // Check if employee meets tenure requirement
      if (tenureDays < leaveType.minTenureDays) {
        continue; // Employee not eligible yet
      }

      // Check if balance already exists
      const existingBalance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: leaveType.id,
            year: targetYear,
          },
        },
      });

      if (existingBalance) {
        continue; // Balance already exists
      }

      // Create the leave balance
      const accrualAmount = toNum(leaveType.accrualAmount);
      const newBalance = await prisma.leaveBalance.create({
        data: {
          employeeId,
          leaveTypeId: leaveType.id,
          year: targetYear,
          openingBalance: accrualAmount,
          accrued: 0,
          used: 0,
          forfeited: 0,
          converted: 0,
          adjusted: 0,
          carriedOverFromPrevious: 0,
        },
      });

      await audit.create("LeaveBalance", newBalance.id, {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        leaveTypeCode: leaveType.code,
        year: targetYear,
        openingBalance: accrualAmount,
        reason: "Employee became eligible for leave",
      });

      balancesCreated++;
    }

    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      balancesCreated,
    };
  } catch (error) {
    console.error("Failed to provision employee leave balance:", error);
    return {
      success: false,
      balancesCreated: 0,
      error: error instanceof Error ? error.message : "Failed to provision leave balance",
    };
  }
}

// =============================================================================
// Adjust Leave Balance
// =============================================================================

/**
 * Manually adjust an employee's leave balance.
 * Permission: employee:edit
 */
export async function adjustLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  adjustment: number,
  reason: string
): Promise<{
  success: boolean;
  newBalance?: number;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: auth.user.companyId,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Get or create the balance
    let balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId,
          year,
        },
      },
    });

    const toNum = (val: unknown) =>
      typeof val === "object" && val !== null && "toNumber" in val
        ? (val as { toNumber: () => number }).toNumber()
        : Number(val) || 0;

    if (!balance) {
      // Create a new balance with the adjustment
      balance = await prisma.leaveBalance.create({
        data: {
          employeeId,
          leaveTypeId,
          year,
          openingBalance: 0,
          accrued: 0,
          used: 0,
          forfeited: 0,
          converted: 0,
          adjusted: adjustment,
          carriedOverFromPrevious: 0,
        },
      });
    } else {
      // Update existing balance
      const currentAdjusted = toNum(balance.adjusted);
      balance = await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          adjusted: currentAdjusted + adjustment,
        },
      });
    }

    const newBalance =
      toNum(balance.openingBalance) +
      toNum(balance.accrued) +
      toNum(balance.carriedOverFromPrevious) -
      toNum(balance.used) -
      toNum(balance.forfeited) -
      toNum(balance.converted) +
      toNum(balance.adjusted);

    await audit.update(
      "LeaveBalance",
      balance.id,
      { adjusted: toNum(balance.adjusted) - adjustment },
      { adjusted: toNum(balance.adjusted), reason, newBalance }
    );

    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      newBalance,
    };
  } catch (error) {
    console.error("Failed to adjust leave balance:", error);
    return { success: false, error: "Failed to adjust leave balance" };
  }
}
