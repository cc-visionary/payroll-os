"use server";

// =============================================================================
// PeopleOS PH - Settings Server Actions
// =============================================================================
// Server actions for managing company settings: departments, leave types,
// shift templates, and company information.
// =============================================================================

import { prisma } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// =============================================================================
// DEPARTMENT ACTIONS
// =============================================================================

/**
 * Get all departments for the company.
 */
export async function getDepartments() {
  const auth = await assertPermission(Permission.DEPARTMENT_VIEW);

  const departments = await prisma.department.findMany({
    where: {
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      parentDepartment: {
        select: { id: true, name: true },
      },
      manager: {
        select: { id: true, firstName: true, lastName: true },
      },
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return departments.map((dept) => ({
    id: dept.id,
    code: dept.code,
    name: dept.name,
    costCenterCode: dept.costCenterCode,
    parentDepartment: dept.parentDepartment,
    manager: dept.manager
      ? {
          id: dept.manager.id,
          name: `${dept.manager.firstName} ${dept.manager.lastName}`,
        }
      : null,
    employeeCount: dept._count.employees,
    createdAt: dept.createdAt,
  }));
}

/**
 * Create a new department.
 */
export async function createDepartment(data: {
  code: string;
  name: string;
  costCenterCode?: string;
  parentDepartmentId?: string;
  managerId?: string;
}) {
  const auth = await assertPermission(Permission.DEPARTMENT_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate code
  const existing = await prisma.department.findFirst({
    where: {
      companyId: auth.user.companyId,
      code: data.code,
      deletedAt: null,
    },
  });

  if (existing) {
    return { success: false, error: "A department with this code already exists" };
  }

  try {
    const department = await prisma.department.create({
      data: {
        companyId: auth.user.companyId,
        code: data.code,
        name: data.name,
        costCenterCode: data.costCenterCode || null,
        parentDepartmentId: data.parentDepartmentId || null,
        managerId: data.managerId || null,
      },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    await audit.create("Department", department.id, {
      code: data.code,
      name: data.name,
    });

    revalidatePath("/settings/departments");

    return {
      success: true,
      departmentId: department.id,
      department: {
        id: department.id,
        code: department.code,
        name: department.name,
        costCenterCode: department.costCenterCode,
        manager: department.manager
          ? {
              id: department.manager.id,
              name: `${department.manager.firstName} ${department.manager.lastName}`,
            }
          : null,
        employeeCount: department._count.employees,
      },
    };
  } catch (error) {
    console.error("Failed to create department:", error);
    return { success: false, error: "Failed to create department" };
  }
}

/**
 * Update an existing department.
 */
export async function updateDepartment(
  departmentId: string,
  data: {
    code?: string;
    name?: string;
    costCenterCode?: string | null;
    parentDepartmentId?: string | null;
    managerId?: string | null;
  }
) {
  const auth = await assertPermission(Permission.DEPARTMENT_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!department) {
    return { success: false, error: "Department not found" };
  }

  // Check for duplicate code if changing
  if (data.code && data.code !== department.code) {
    const existing = await prisma.department.findFirst({
      where: {
        companyId: auth.user.companyId,
        code: data.code,
        deletedAt: null,
        id: { not: departmentId },
      },
    });

    if (existing) {
      return { success: false, error: "A department with this code already exists" };
    }
  }

  try {
    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: {
        code: data.code ?? department.code,
        name: data.name ?? department.name,
        costCenterCode: data.costCenterCode,
        parentDepartmentId: data.parentDepartmentId,
        managerId: data.managerId,
      },
    });

    await audit.update("Department", departmentId, department as Record<string, unknown>, data as Record<string, unknown>);

    revalidatePath("/settings/departments");

    return { success: true, department: updated };
  } catch (error) {
    console.error("Failed to update department:", error);
    return { success: false, error: "Failed to update department" };
  }
}

/**
 * Delete a department (soft delete).
 */
export async function deleteDepartment(departmentId: string) {
  const auth = await assertPermission(Permission.DEPARTMENT_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      _count: { select: { employees: true, childDepartments: true } },
    },
  });

  if (!department) {
    return { success: false, error: "Department not found" };
  }

  if (department._count.employees > 0) {
    return {
      success: false,
      error: `Cannot delete department with ${department._count.employees} active employee(s). Please reassign them first.`,
    };
  }

  if (department._count.childDepartments > 0) {
    return {
      success: false,
      error: "Cannot delete department with sub-departments. Please delete or reassign them first.",
    };
  }

  try {
    await prisma.department.update({
      where: { id: departmentId },
      data: { deletedAt: new Date() },
    });

    await audit.delete("Department", departmentId, {
      code: department.code,
      name: department.name,
    });

    revalidatePath("/settings/departments");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete department:", error);
    return { success: false, error: "Failed to delete department" };
  }
}

// =============================================================================
// LEAVE TYPE ACTIONS
// =============================================================================

/**
 * Get all leave types for the company.
 */
export async function getLeaveTypes() {
  const auth = await assertPermission(Permission.LEAVE_TYPE_VIEW);

  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      companyId: auth.user.companyId,
    },
    orderBy: { name: "asc" },
  });

  return leaveTypes.map((lt) => ({
    id: lt.id,
    code: lt.code,
    name: lt.name,
    description: lt.description,
    accrualType: lt.accrualType,
    accrualAmount: lt.accrualAmount ? Number(lt.accrualAmount) : null,
    accrualCap: lt.accrualCap ? Number(lt.accrualCap) : null,
    isPaid: lt.isPaid,
    isConvertible: lt.isConvertible,
    canCarryOver: lt.canCarryOver,
    requiresAttachment: lt.requiresAttachment,
    requiresApproval: lt.requiresApproval,
    minAdvanceDays: lt.minAdvanceDays,
    isActive: lt.isActive,
    createdAt: lt.createdAt,
  }));
}

/**
 * Create a new leave type.
 */
export async function createLeaveType(data: {
  code: string;
  name: string;
  description?: string;
  accrualType: "NONE" | "MONTHLY" | "ANNUAL" | "TENURE_BASED";
  accrualAmount?: number;
  accrualCap?: number;
  isPaid?: boolean;
  isConvertible?: boolean;
  canCarryOver?: boolean;
  requiresAttachment?: boolean;
  requiresApproval?: boolean;
  minAdvanceDays?: number;
}) {
  const auth = await assertPermission(Permission.LEAVE_TYPE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate code
  const existing = await prisma.leaveType.findFirst({
    where: {
      companyId: auth.user.companyId,
      code: data.code,
    },
  });

  if (existing) {
    return { success: false, error: "A leave type with this code already exists" };
  }

  try {
    const leaveType = await prisma.leaveType.create({
      data: {
        companyId: auth.user.companyId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        accrualType: data.accrualType,
        accrualAmount: data.accrualAmount ?? null,
        accrualCap: data.accrualCap ?? null,
        isPaid: data.isPaid ?? true,
        isConvertible: data.isConvertible ?? false,
        canCarryOver: data.canCarryOver ?? false,
        requiresAttachment: data.requiresAttachment ?? false,
        requiresApproval: data.requiresApproval ?? true,
        minAdvanceDays: data.minAdvanceDays ?? 0,
      },
    });

    await audit.create("LeaveType", leaveType.id, {
      code: data.code,
      name: data.name,
    });

    revalidatePath("/settings/leave-types");

    return { success: true, leaveTypeId: leaveType.id };
  } catch (error) {
    console.error("Failed to create leave type:", error);
    return { success: false, error: "Failed to create leave type" };
  }
}

/**
 * Update a leave type.
 */
export async function updateLeaveType(
  leaveTypeId: string,
  data: {
    code?: string;
    name?: string;
    description?: string | null;
    accrualType?: "NONE" | "MONTHLY" | "ANNUAL" | "TENURE_BASED";
    accrualAmount?: number | null;
    accrualCap?: number | null;
    isPaid?: boolean;
    isConvertible?: boolean;
    canCarryOver?: boolean;
    requiresAttachment?: boolean;
    requiresApproval?: boolean;
    minAdvanceDays?: number;
    isActive?: boolean;
  }
) {
  const auth = await assertPermission(Permission.LEAVE_TYPE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const leaveType = await prisma.leaveType.findFirst({
    where: {
      id: leaveTypeId,
      companyId: auth.user.companyId,
    },
  });

  if (!leaveType) {
    return { success: false, error: "Leave type not found" };
  }

  try {
    const updated = await prisma.leaveType.update({
      where: { id: leaveTypeId },
      data: {
        code: data.code ?? leaveType.code,
        name: data.name ?? leaveType.name,
        description: data.description,
        accrualType: data.accrualType ?? leaveType.accrualType,
        accrualAmount: data.accrualAmount,
        accrualCap: data.accrualCap,
        isPaid: data.isPaid ?? leaveType.isPaid,
        isConvertible: data.isConvertible ?? leaveType.isConvertible,
        canCarryOver: data.canCarryOver ?? leaveType.canCarryOver,
        requiresAttachment: data.requiresAttachment ?? leaveType.requiresAttachment,
        requiresApproval: data.requiresApproval ?? leaveType.requiresApproval,
        minAdvanceDays: data.minAdvanceDays ?? leaveType.minAdvanceDays,
        isActive: data.isActive ?? leaveType.isActive,
      },
    });

    await audit.update("LeaveType", leaveTypeId, leaveType as Record<string, unknown>, data as Record<string, unknown>);

    revalidatePath("/settings/leave-types");

    return { success: true, leaveType: updated };
  } catch (error) {
    console.error("Failed to update leave type:", error);
    return { success: false, error: "Failed to update leave type" };
  }
}

// =============================================================================
// SHIFT TEMPLATE ACTIONS
// =============================================================================

/**
 * Get all shift templates for the company.
 */
export async function getShiftTemplates() {
  const auth = await assertPermission(Permission.SHIFT_VIEW);

  const shifts = await prisma.shiftTemplate.findMany({
    where: {
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    orderBy: { name: "asc" },
  });

  return shifts.map((shift) => ({
    id: shift.id,
    code: shift.code,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    isOvernight: shift.isOvernight,
    breakType: shift.breakType,
    breakMinutes: shift.breakMinutes,
    breakStartTime: shift.breakStartTime,
    breakEndTime: shift.breakEndTime,
    scheduledWorkMinutes: shift.scheduledWorkMinutes,
    graceMinutesLate: shift.graceMinutesLate,
    graceMinutesEarlyOut: shift.graceMinutesEarlyOut,
    isActive: shift.isActive,
    createdAt: shift.createdAt,
  }));
}

/**
 * Create a new shift template.
 */
export async function createShiftTemplate(data: {
  code: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;
  isOvernight?: boolean;
  breakType?: "FIXED" | "AUTO_DEDUCT" | "NO_BREAK";
  breakMinutes?: number;
  breakStartTime?: string; // HH:mm format
  breakEndTime?: string;   // HH:mm format
  graceMinutesLate?: number;
  graceMinutesEarlyOut?: number;
}) {
  const auth = await assertPermission(Permission.SHIFT_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate code
  const existing = await prisma.shiftTemplate.findFirst({
    where: {
      companyId: auth.user.companyId,
      code: data.code,
      deletedAt: null,
    },
  });

  if (existing) {
    return { success: false, error: "A shift with this code already exists" };
  }

  // Parse times
  const startTime = new Date(`1970-01-01T${data.startTime}:00`);
  const endTime = new Date(`1970-01-01T${data.endTime}:00`);

  // Calculate scheduled work minutes
  let scheduledMinutes: number;
  if (data.isOvernight) {
    scheduledMinutes = (24 * 60 - startTime.getHours() * 60 - startTime.getMinutes()) +
                       (endTime.getHours() * 60 + endTime.getMinutes());
  } else {
    scheduledMinutes =
      endTime.getHours() * 60 +
      endTime.getMinutes() -
      (startTime.getHours() * 60 + startTime.getMinutes());
  }

  // Subtract break
  const breakMinutes = data.breakMinutes ?? 60;
  scheduledMinutes -= breakMinutes;

  // Parse break times if provided
  const breakStartTime = data.breakStartTime
    ? new Date(`1970-01-01T${data.breakStartTime}:00`)
    : null;
  const breakEndTime = data.breakEndTime
    ? new Date(`1970-01-01T${data.breakEndTime}:00`)
    : null;

  try {
    const shift = await prisma.shiftTemplate.create({
      data: {
        companyId: auth.user.companyId,
        code: data.code,
        name: data.name,
        startTime,
        endTime,
        isOvernight: data.isOvernight ?? false,
        breakType: data.breakType ?? "AUTO_DEDUCT",
        breakMinutes,
        breakStartTime,
        breakEndTime,
        graceMinutesLate: data.graceMinutesLate ?? 0,
        graceMinutesEarlyOut: data.graceMinutesEarlyOut ?? 0,
        scheduledWorkMinutes: scheduledMinutes,
      },
    });

    await audit.create("ShiftTemplate", shift.id, {
      code: data.code,
      name: data.name,
    });

    revalidatePath("/settings/shifts");

    return { success: true, shiftId: shift.id };
  } catch (error) {
    console.error("Failed to create shift template:", error);
    return { success: false, error: "Failed to create shift template" };
  }
}

/**
 * Update a shift template.
 */
export async function updateShiftTemplate(
  shiftId: string,
  data: {
    code?: string;
    name?: string;
    startTime?: string;
    endTime?: string;
    isOvernight?: boolean;
    breakType?: "FIXED" | "AUTO_DEDUCT" | "NO_BREAK";
    breakMinutes?: number;
    breakStartTime?: string; // HH:mm format
    breakEndTime?: string;   // HH:mm format
    graceMinutesLate?: number;
    graceMinutesEarlyOut?: number;
    isActive?: boolean;
  }
) {
  const auth = await assertPermission(Permission.SHIFT_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const shift = await prisma.shiftTemplate.findFirst({
    where: {
      id: shiftId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!shift) {
    return { success: false, error: "Shift template not found" };
  }

  // Build update data
  const updateData: Record<string, unknown> = {};

  if (data.code !== undefined) updateData.code = data.code;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.isOvernight !== undefined) updateData.isOvernight = data.isOvernight;
  if (data.breakType !== undefined) updateData.breakType = data.breakType;
  if (data.breakMinutes !== undefined) updateData.breakMinutes = data.breakMinutes;
  if (data.graceMinutesLate !== undefined) updateData.graceMinutesLate = data.graceMinutesLate;
  if (data.graceMinutesEarlyOut !== undefined) updateData.graceMinutesEarlyOut = data.graceMinutesEarlyOut;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.startTime) {
    updateData.startTime = new Date(`1970-01-01T${data.startTime}:00`);
  }
  if (data.endTime) {
    updateData.endTime = new Date(`1970-01-01T${data.endTime}:00`);
  }

  // Handle break times - set to null if breakMinutes is 0
  if (data.breakStartTime !== undefined) {
    updateData.breakStartTime = data.breakStartTime
      ? new Date(`1970-01-01T${data.breakStartTime}:00`)
      : null;
  }
  if (data.breakEndTime !== undefined) {
    updateData.breakEndTime = data.breakEndTime
      ? new Date(`1970-01-01T${data.breakEndTime}:00`)
      : null;
  }

  // Recalculate scheduled work minutes if times changed
  if (data.startTime || data.endTime || data.breakMinutes !== undefined || data.isOvernight !== undefined) {
    const startTime = data.startTime
      ? new Date(`1970-01-01T${data.startTime}:00`)
      : shift.startTime;
    const endTime = data.endTime
      ? new Date(`1970-01-01T${data.endTime}:00`)
      : shift.endTime;
    const isOvernight = data.isOvernight ?? shift.isOvernight;
    const breakMinutes = data.breakMinutes ?? shift.breakMinutes;

    let scheduledMinutes: number;
    if (isOvernight) {
      scheduledMinutes =
        24 * 60 -
        startTime.getHours() * 60 -
        startTime.getMinutes() +
        endTime.getHours() * 60 +
        endTime.getMinutes();
    } else {
      scheduledMinutes =
        endTime.getHours() * 60 +
        endTime.getMinutes() -
        (startTime.getHours() * 60 + startTime.getMinutes());
    }
    scheduledMinutes -= breakMinutes;
    updateData.scheduledWorkMinutes = scheduledMinutes;
  }

  try {
    const updated = await prisma.shiftTemplate.update({
      where: { id: shiftId },
      data: updateData,
    });

    await audit.update("ShiftTemplate", shiftId, shift as Record<string, unknown>, data as Record<string, unknown>);

    revalidatePath("/settings/shifts");

    return { success: true, shift: updated };
  } catch (error) {
    console.error("Failed to update shift template:", error);
    return { success: false, error: "Failed to update shift template" };
  }
}

/**
 * Delete a shift template (soft delete).
 */
export async function deleteShiftTemplate(shiftId: string) {
  const auth = await assertPermission(Permission.SHIFT_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const shift = await prisma.shiftTemplate.findFirst({
    where: {
      id: shiftId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!shift) {
    return { success: false, error: "Shift template not found" };
  }

  try {
    await prisma.shiftTemplate.update({
      where: { id: shiftId },
      data: { deletedAt: new Date() },
    });

    await audit.delete("ShiftTemplate", shiftId, {
      code: shift.code,
      name: shift.name,
    });

    revalidatePath("/settings/shifts");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete shift template:", error);
    return { success: false, error: "Failed to delete shift template" };
  }
}

// =============================================================================
// COMPANY SETTINGS ACTIONS
// =============================================================================

/**
 * Get company information.
 */
export async function getCompanyInfo() {
  const auth = await assertPermission(Permission.SYSTEM_SETTINGS);

  const company = await prisma.company.findUnique({
    where: { id: auth.user.companyId },
  });

  if (!company) {
    return null;
  }

  return {
    id: company.id,
    code: company.code,
    name: company.name,
    tradeName: company.tradeName,
    tin: company.tin,
    sssEmployerId: company.sssEmployerId,
    philhealthEmployerId: company.philhealthEmployerId,
    pagibigEmployerId: company.pagibigEmployerId,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    province: company.province,
    zipCode: company.zipCode,
    rdoCode: company.rdoCode,
  };
}

/**
 * Update company information.
 */
export async function updateCompanyInfo(data: {
  name?: string;
  tradeName?: string | null;
  tin?: string | null;
  sssEmployerId?: string | null;
  philhealthEmployerId?: string | null;
  pagibigEmployerId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  zipCode?: string | null;
  rdoCode?: string | null;
}) {
  const auth = await assertPermission(Permission.SYSTEM_SETTINGS);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const company = await prisma.company.findUnique({
    where: { id: auth.user.companyId },
  });

  if (!company) {
    return { success: false, error: "Company not found" };
  }

  try {
    const updated = await prisma.company.update({
      where: { id: auth.user.companyId },
      data: {
        name: data.name ?? company.name,
        tradeName: data.tradeName,
        tin: data.tin,
        sssEmployerId: data.sssEmployerId,
        philhealthEmployerId: data.philhealthEmployerId,
        pagibigEmployerId: data.pagibigEmployerId,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        province: data.province,
        zipCode: data.zipCode,
        rdoCode: data.rdoCode,
      },
    });

    await audit.update("Company", company.id, company as Record<string, unknown>, data as Record<string, unknown>);

    revalidatePath("/settings/company");

    return { success: true, company: updated };
  } catch (error) {
    console.error("Failed to update company:", error);
    return { success: false, error: "Failed to update company information" };
  }
}

// =============================================================================
// ROLE SCORECARD ACTIONS
// =============================================================================

export interface RoleScorecardResponsibility {
  area: string;
  tasks: string[];
}

export interface RoleScorecardKPI {
  metric: string;
  frequency: string;
}

/**
 * Get all role scorecards for the company.
 */
export async function getRoleScorecards() {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_VIEW);

  const scorecards = await prisma.roleScorecard.findMany({
    where: {
      companyId: auth.user.companyId,
      supersededById: null, // Only active (non-superseded) versions
    },
    include: {
      department: {
        select: { id: true, name: true, code: true },
      },
      shiftTemplate: {
        select: { id: true, name: true, code: true },
      },
      createdBy: {
        select: { id: true, email: true },
      },
      _count: {
        select: {
          employees: {
            where: { employmentStatus: "ACTIVE" },
          },
        },
      },
    },
    orderBy: [{ jobTitle: "asc" }, { effectiveDate: "desc" }],
  });

  const toNumber = (val: unknown) =>
    val && typeof val === "object" && "toNumber" in val
      ? (val as { toNumber: () => number }).toNumber()
      : val as number | null;

  return scorecards.map((sc) => ({
    id: sc.id,
    jobTitle: sc.jobTitle,
    department: sc.department,
    missionStatement: sc.missionStatement,
    keyResponsibilities: sc.keyResponsibilities as unknown as RoleScorecardResponsibility[],
    kpis: sc.kpis as unknown as RoleScorecardKPI[],
    // Compensation
    salaryRangeMin: toNumber(sc.salaryRangeMin),
    salaryRangeMax: toNumber(sc.salaryRangeMax),
    baseSalary: toNumber(sc.baseSalary),
    wageType: sc.wageType,
    // Work schedule
    shiftTemplate: sc.shiftTemplate,
    workHoursPerDay: sc.workHoursPerDay,
    workDaysPerWeek: sc.workDaysPerWeek,
    flexibleStartTime: sc.flexibleStartTime,
    flexibleEndTime: sc.flexibleEndTime,
    isActive: sc.isActive,
    effectiveDate: sc.effectiveDate,
    createdBy: sc.createdBy,
    createdAt: sc.createdAt,
    // Count of active employees assigned to this role
    assignedActiveEmployees: sc._count.employees,
  }));
}

/**
 * Get a single role scorecard by ID.
 */
export async function getRoleScorecard(id: string) {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_VIEW);

  // Validate UUID format - return null for invalid IDs like "new"
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return null;
  }

  const scorecard = await prisma.roleScorecard.findFirst({
    where: {
      id,
      companyId: auth.user.companyId,
    },
    include: {
      department: {
        select: { id: true, name: true, code: true },
      },
      shiftTemplate: {
        select: { id: true, name: true, code: true },
      },
      createdBy: {
        select: { id: true, email: true },
      },
      previousVersions: {
        select: {
          id: true,
          effectiveDate: true,
          createdAt: true,
        },
        orderBy: { effectiveDate: "desc" },
      },
    },
  });

  if (!scorecard) {
    return null;
  }

  const toNumber = (val: unknown) =>
    val && typeof val === "object" && "toNumber" in val
      ? (val as { toNumber: () => number }).toNumber()
      : val as number | null;

  return {
    id: scorecard.id,
    jobTitle: scorecard.jobTitle,
    department: scorecard.department,
    missionStatement: scorecard.missionStatement,
    keyResponsibilities: scorecard.keyResponsibilities as unknown as RoleScorecardResponsibility[],
    kpis: scorecard.kpis as unknown as RoleScorecardKPI[],
    // Compensation
    salaryRangeMin: toNumber(scorecard.salaryRangeMin),
    salaryRangeMax: toNumber(scorecard.salaryRangeMax),
    baseSalary: toNumber(scorecard.baseSalary),
    wageType: scorecard.wageType,
    // Work schedule
    shiftTemplate: scorecard.shiftTemplate,
    workHoursPerDay: scorecard.workHoursPerDay,
    workDaysPerWeek: scorecard.workDaysPerWeek,
    flexibleStartTime: scorecard.flexibleStartTime,
    flexibleEndTime: scorecard.flexibleEndTime,
    isActive: scorecard.isActive,
    effectiveDate: scorecard.effectiveDate,
    createdBy: scorecard.createdBy,
    createdAt: scorecard.createdAt,
    previousVersions: scorecard.previousVersions,
  };
}

/**
 * Create a new role scorecard.
 */
export async function createRoleScorecard(data: {
  jobTitle: string;
  departmentId?: string;
  missionStatement: string;
  keyResponsibilities: RoleScorecardResponsibility[];
  kpis: RoleScorecardKPI[];
  // Compensation
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  baseSalary?: number;
  wageType?: "MONTHLY" | "DAILY" | "HOURLY";
  // Work schedule
  shiftTemplateId?: string;
  workHoursPerDay?: number;
  workDaysPerWeek?: string;
  flexibleStartTime?: string;
  flexibleEndTime?: string;
  effectiveDate: string;
}) {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate (same job title + department + effective date)
  const existing = await prisma.roleScorecard.findFirst({
    where: {
      companyId: auth.user.companyId,
      jobTitle: data.jobTitle,
      departmentId: data.departmentId || null,
      effectiveDate: new Date(data.effectiveDate),
    },
  });

  if (existing) {
    return {
      success: false,
      error: "A role scorecard with this job title and effective date already exists",
    };
  }

  try {
    const scorecard = await prisma.roleScorecard.create({
      data: {
        companyId: auth.user.companyId,
        jobTitle: data.jobTitle,
        departmentId: data.departmentId || null,
        missionStatement: data.missionStatement,
        keyResponsibilities: data.keyResponsibilities as unknown as object,
        kpis: data.kpis as unknown as object,
        // Compensation
        salaryRangeMin: data.salaryRangeMin,
        salaryRangeMax: data.salaryRangeMax,
        baseSalary: data.baseSalary,
        wageType: data.wageType ?? "MONTHLY",
        // Work schedule
        shiftTemplateId: data.shiftTemplateId || null,
        workHoursPerDay: data.workHoursPerDay ?? 8,
        workDaysPerWeek: data.workDaysPerWeek ?? "Monday to Saturday",
        flexibleStartTime: data.flexibleStartTime || null,
        flexibleEndTime: data.flexibleEndTime || null,
        effectiveDate: new Date(data.effectiveDate),
        createdById: auth.user.id,
      },
    });

    await audit.create("RoleScorecard", scorecard.id, {
      jobTitle: data.jobTitle,
      departmentId: data.departmentId,
      baseSalary: data.baseSalary,
    });

    revalidatePath("/settings/role-scorecards");

    return { success: true, roleScorecardId: scorecard.id };
  } catch (error) {
    console.error("Failed to create role scorecard:", error);
    return { success: false, error: "Failed to create role scorecard" };
  }
}

/**
 * Update an existing role scorecard.
 * Creates a new version if substantive changes are made.
 */
export async function updateRoleScorecard(
  scorecardId: string,
  data: {
    jobTitle?: string;
    departmentId?: string | null;
    missionStatement?: string;
    keyResponsibilities?: RoleScorecardResponsibility[];
    kpis?: RoleScorecardKPI[];
    // Compensation
    salaryRangeMin?: number | null;
    salaryRangeMax?: number | null;
    baseSalary?: number | null;
    wageType?: "MONTHLY" | "DAILY" | "HOURLY";
    // Work schedule
    shiftTemplateId?: string | null;
    workHoursPerDay?: number;
    workDaysPerWeek?: string;
    flexibleStartTime?: string | null;
    flexibleEndTime?: string | null;
    isActive?: boolean;
  }
) {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const scorecard = await prisma.roleScorecard.findFirst({
    where: {
      id: scorecardId,
      companyId: auth.user.companyId,
    },
  });

  if (!scorecard) {
    return { success: false, error: "Role scorecard not found" };
  }

  try {
    const updated = await prisma.roleScorecard.update({
      where: { id: scorecardId },
      data: {
        jobTitle: data.jobTitle ?? scorecard.jobTitle,
        departmentId: data.departmentId !== undefined ? data.departmentId : scorecard.departmentId,
        missionStatement: data.missionStatement ?? scorecard.missionStatement,
        keyResponsibilities: (data.keyResponsibilities ?? scorecard.keyResponsibilities) as unknown as object,
        kpis: (data.kpis ?? scorecard.kpis) as unknown as object,
        // Compensation
        salaryRangeMin: data.salaryRangeMin !== undefined ? data.salaryRangeMin : scorecard.salaryRangeMin,
        salaryRangeMax: data.salaryRangeMax !== undefined ? data.salaryRangeMax : scorecard.salaryRangeMax,
        baseSalary: data.baseSalary !== undefined ? data.baseSalary : scorecard.baseSalary,
        wageType: data.wageType ?? scorecard.wageType,
        // Work schedule
        shiftTemplateId: data.shiftTemplateId !== undefined ? data.shiftTemplateId : scorecard.shiftTemplateId,
        workHoursPerDay: data.workHoursPerDay ?? scorecard.workHoursPerDay,
        workDaysPerWeek: data.workDaysPerWeek ?? scorecard.workDaysPerWeek,
        flexibleStartTime: data.flexibleStartTime !== undefined ? data.flexibleStartTime : scorecard.flexibleStartTime,
        flexibleEndTime: data.flexibleEndTime !== undefined ? data.flexibleEndTime : scorecard.flexibleEndTime,
        isActive: data.isActive ?? scorecard.isActive,
      },
    });

    await audit.update("RoleScorecard", scorecardId, scorecard as Record<string, unknown>, data as Record<string, unknown>);

    revalidatePath("/settings/role-scorecards");

    return { success: true, roleScorecard: updated };
  } catch (error) {
    console.error("Failed to update role scorecard:", error);
    return { success: false, error: "Failed to update role scorecard" };
  }
}

/**
 * Create a new version of an existing role scorecard.
 * The old version is marked as superseded.
 */
export async function createRoleScorecardVersion(
  existingScorecardId: string,
  data: {
    missionStatement: string;
    keyResponsibilities: RoleScorecardResponsibility[];
    kpis: RoleScorecardKPI[];
    workHoursPerDay?: number;
    workDaysPerWeek?: string;
    flexibleStartTime?: string;
    flexibleEndTime?: string;
    effectiveDate: string;
  }
) {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const existing = await prisma.roleScorecard.findFirst({
    where: {
      id: existingScorecardId,
      companyId: auth.user.companyId,
      supersededById: null,
    },
  });

  if (!existing) {
    return { success: false, error: "Role scorecard not found or already superseded" };
  }

  try {
    // Create the new version and update the old one in a transaction
    const [newScorecard] = await prisma.$transaction([
      prisma.roleScorecard.create({
        data: {
          companyId: auth.user.companyId,
          jobTitle: existing.jobTitle,
          departmentId: existing.departmentId,
          missionStatement: data.missionStatement,
          keyResponsibilities: data.keyResponsibilities as unknown as object,
          kpis: data.kpis as unknown as object,
          workHoursPerDay: data.workHoursPerDay ?? existing.workHoursPerDay,
          workDaysPerWeek: data.workDaysPerWeek ?? existing.workDaysPerWeek,
          flexibleStartTime: data.flexibleStartTime ?? existing.flexibleStartTime,
          flexibleEndTime: data.flexibleEndTime ?? existing.flexibleEndTime,
          effectiveDate: new Date(data.effectiveDate),
          createdById: auth.user.id,
        },
      }),
      prisma.roleScorecard.update({
        where: { id: existingScorecardId },
        data: {
          supersededById: existingScorecardId, // Will be updated below
          isActive: false,
        },
      }),
    ]);

    // Now update the old version to point to the new one
    await prisma.roleScorecard.update({
      where: { id: existingScorecardId },
      data: { supersededById: newScorecard.id },
    });

    await audit.create("RoleScorecard", newScorecard.id, {
      jobTitle: existing.jobTitle,
      previousVersionId: existingScorecardId,
    });

    revalidatePath("/settings/role-scorecards");

    return { success: true, roleScorecardId: newScorecard.id };
  } catch (error) {
    console.error("Failed to create role scorecard version:", error);
    return { success: false, error: "Failed to create new version" };
  }
}

/**
 * Delete a role scorecard permanently.
 */
export async function deleteRoleScorecard(scorecardId: string) {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const scorecard = await prisma.roleScorecard.findFirst({
    where: {
      id: scorecardId,
      companyId: auth.user.companyId,
    },
  });

  if (!scorecard) {
    return { success: false, error: "Role scorecard not found" };
  }

  // Check if any active employees are assigned to this role
  const assignedEmployeesCount = await prisma.employee.count({
    where: {
      roleScorecardId: scorecardId,
      employmentStatus: "ACTIVE",
    },
  });

  if (assignedEmployeesCount > 0) {
    return {
      success: false,
      error: `Cannot delete this role. ${assignedEmployeesCount} active employee(s) are still assigned to it. Please reassign or separate them first.`,
    };
  }

  try {
    // Permanently delete the role scorecard
    await prisma.roleScorecard.delete({
      where: { id: scorecardId },
    });

    await audit.delete("RoleScorecard", scorecardId, {
      jobTitle: scorecard.jobTitle,
    });

    revalidatePath("/role-scorecards");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete role scorecard:", error);
    return { success: false, error: "Failed to delete role scorecard" };
  }
}

/**
 * Clone a role scorecard with a new job title.
 */
export async function cloneRoleScorecard(scorecardId: string, newJobTitle: string) {
  const auth = await assertPermission(Permission.ROLE_SCORECARD_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Get the source scorecard
  const source = await prisma.roleScorecard.findFirst({
    where: {
      id: scorecardId,
      companyId: auth.user.companyId,
    },
  });

  if (!source) {
    return { success: false, error: "Role scorecard not found" };
  }

  // Check if job title already exists
  const existing = await prisma.roleScorecard.findFirst({
    where: {
      companyId: auth.user.companyId,
      jobTitle: { equals: newJobTitle, mode: "insensitive" },
      isActive: true,
    },
  });

  if (existing) {
    return { success: false, error: "A role scorecard with this job title already exists" };
  }

  try {
    // Create the clone
    const clone = await prisma.roleScorecard.create({
      data: {
        companyId: auth.user.companyId,
        jobTitle: newJobTitle,
        departmentId: source.departmentId,
        missionStatement: source.missionStatement,
        keyResponsibilities: source.keyResponsibilities as Prisma.InputJsonValue,
        kpis: source.kpis as Prisma.InputJsonValue,
        wageType: source.wageType,
        baseSalary: source.baseSalary,
        salaryRangeMin: source.salaryRangeMin,
        salaryRangeMax: source.salaryRangeMax,
        shiftTemplateId: source.shiftTemplateId,
        workHoursPerDay: source.workHoursPerDay,
        workDaysPerWeek: source.workDaysPerWeek,
        flexibleStartTime: source.flexibleStartTime,
        flexibleEndTime: source.flexibleEndTime,
        effectiveDate: new Date(),
        isActive: true,
        createdById: auth.user.id,
      },
    });

    await audit.create("RoleScorecard", clone.id, {
      jobTitle: newJobTitle,
      clonedFrom: source.jobTitle,
    });

    revalidatePath("/settings/role-scorecards");

    return { success: true, id: clone.id };
  } catch (error) {
    console.error("Failed to clone role scorecard:", error);
    return { success: false, error: "Failed to clone role scorecard" };
  }
}

// =============================================================================
// HIRING ENTITY ACTIONS
// =============================================================================

/**
 * Get all hiring entities for the company.
 */
export async function getHiringEntities() {
  const auth = await assertPermission(Permission.SYSTEM_SETTINGS);

  const entities = await prisma.hiringEntity.findMany({
    where: {
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: { employees: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return entities.map((entity) => ({
    id: entity.id,
    code: entity.code,
    name: entity.name,
    tradeName: entity.tradeName,
    tin: entity.tin,
    rdoCode: entity.rdoCode,
    sssEmployerId: entity.sssEmployerId,
    philhealthEmployerId: entity.philhealthEmployerId,
    pagibigEmployerId: entity.pagibigEmployerId,
    addressLine1: entity.addressLine1,
    addressLine2: entity.addressLine2,
    city: entity.city,
    province: entity.province,
    zipCode: entity.zipCode,
    phoneNumber: entity.phoneNumber,
    email: entity.email,
    isActive: entity.isActive,
    employeeCount: entity._count.employees,
    createdAt: entity.createdAt,
  }));
}

/**
 * Get hiring entities for dropdown (minimal data).
 */
export async function getHiringEntitiesDropdown() {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  const entities = await prisma.hiringEntity.findMany({
    where: {
      companyId: auth.user.companyId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      tradeName: true,
      tin: true,
    },
    orderBy: { name: "asc" },
  });

  return entities;
}

/**
 * Create a new hiring entity.
 */
export async function createHiringEntity(data: {
  code: string;
  name: string;
  tradeName?: string;
  tin?: string;
  rdoCode?: string;
  sssEmployerId?: string;
  philhealthEmployerId?: string;
  pagibigEmployerId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  phoneNumber?: string;
  email?: string;
}) {
  const auth = await assertPermission(Permission.SYSTEM_SETTINGS);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate code
  const existing = await prisma.hiringEntity.findFirst({
    where: {
      companyId: auth.user.companyId,
      code: data.code,
      deletedAt: null,
    },
  });

  if (existing) {
    return { success: false, error: "A hiring entity with this code already exists" };
  }

  try {
    const entity = await prisma.hiringEntity.create({
      data: {
        companyId: auth.user.companyId,
        code: data.code,
        name: data.name,
        tradeName: data.tradeName || null,
        tin: data.tin || null,
        rdoCode: data.rdoCode || null,
        sssEmployerId: data.sssEmployerId || null,
        philhealthEmployerId: data.philhealthEmployerId || null,
        pagibigEmployerId: data.pagibigEmployerId || null,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        province: data.province || null,
        zipCode: data.zipCode || null,
        phoneNumber: data.phoneNumber || null,
        email: data.email || null,
      },
    });

    await audit.create("HiringEntity", entity.id, {
      code: data.code,
      name: data.name,
    });

    revalidatePath("/settings/company");

    return { success: true, hiringEntityId: entity.id };
  } catch (error) {
    console.error("Failed to create hiring entity:", error);
    return { success: false, error: "Failed to create hiring entity" };
  }
}

/**
 * Update a hiring entity.
 */
export async function updateHiringEntity(
  entityId: string,
  data: {
    code?: string;
    name?: string;
    tradeName?: string | null;
    tin?: string | null;
    rdoCode?: string | null;
    sssEmployerId?: string | null;
    philhealthEmployerId?: string | null;
    pagibigEmployerId?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    province?: string | null;
    zipCode?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    isActive?: boolean;
  }
) {
  const auth = await assertPermission(Permission.SYSTEM_SETTINGS);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const entity = await prisma.hiringEntity.findFirst({
    where: {
      id: entityId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!entity) {
    return { success: false, error: "Hiring entity not found" };
  }

  // Check for duplicate code if changing
  if (data.code && data.code !== entity.code) {
    const existing = await prisma.hiringEntity.findFirst({
      where: {
        companyId: auth.user.companyId,
        code: data.code,
        deletedAt: null,
        id: { not: entityId },
      },
    });

    if (existing) {
      return { success: false, error: "A hiring entity with this code already exists" };
    }
  }

  try {
    const updated = await prisma.hiringEntity.update({
      where: { id: entityId },
      data: {
        code: data.code ?? entity.code,
        name: data.name ?? entity.name,
        tradeName: data.tradeName !== undefined ? data.tradeName : entity.tradeName,
        tin: data.tin !== undefined ? data.tin : entity.tin,
        rdoCode: data.rdoCode !== undefined ? data.rdoCode : entity.rdoCode,
        sssEmployerId: data.sssEmployerId !== undefined ? data.sssEmployerId : entity.sssEmployerId,
        philhealthEmployerId: data.philhealthEmployerId !== undefined ? data.philhealthEmployerId : entity.philhealthEmployerId,
        pagibigEmployerId: data.pagibigEmployerId !== undefined ? data.pagibigEmployerId : entity.pagibigEmployerId,
        addressLine1: data.addressLine1 !== undefined ? data.addressLine1 : entity.addressLine1,
        addressLine2: data.addressLine2 !== undefined ? data.addressLine2 : entity.addressLine2,
        city: data.city !== undefined ? data.city : entity.city,
        province: data.province !== undefined ? data.province : entity.province,
        zipCode: data.zipCode !== undefined ? data.zipCode : entity.zipCode,
        phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : entity.phoneNumber,
        email: data.email !== undefined ? data.email : entity.email,
        isActive: data.isActive ?? entity.isActive,
      },
    });

    await audit.update("HiringEntity", entityId, entity as Record<string, unknown>, data as Record<string, unknown>);

    revalidatePath("/settings/company");

    return { success: true, hiringEntity: updated };
  } catch (error) {
    console.error("Failed to update hiring entity:", error);
    return { success: false, error: "Failed to update hiring entity" };
  }
}

/**
 * Delete a hiring entity (soft delete).
 */
export async function deleteHiringEntity(entityId: string) {
  const auth = await assertPermission(Permission.SYSTEM_SETTINGS);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const entity = await prisma.hiringEntity.findFirst({
    where: {
      id: entityId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      _count: { select: { employees: true } },
    },
  });

  if (!entity) {
    return { success: false, error: "Hiring entity not found" };
  }

  if (entity._count.employees > 0) {
    return {
      success: false,
      error: `Cannot delete hiring entity with ${entity._count.employees} active employee(s). Please reassign them first.`,
    };
  }

  try {
    await prisma.hiringEntity.update({
      where: { id: entityId },
      data: { deletedAt: new Date() },
    });

    await audit.delete("HiringEntity", entityId, {
      code: entity.code,
      name: entity.name,
    });

    revalidatePath("/settings/company");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete hiring entity:", error);
    return { success: false, error: "Failed to delete hiring entity" };
  }
}
