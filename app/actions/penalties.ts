"use server";

// =============================================================================
// PeopleOS PH - Penalty Server Actions
// =============================================================================
// Server actions for managing penalty types (settings) and employee penalties
// with installment-based payroll deduction tracking.
// =============================================================================

import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// =============================================================================
// PENALTY TYPE ACTIONS (Settings)
// =============================================================================

/**
 * Get all penalty types for the company.
 */
export async function getPenaltyTypes() {
  const auth = await assertPermission(Permission.PENALTY_VIEW);

  const penaltyTypes = await prisma.penaltyType.findMany({
    where: {
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: { penalties: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return penaltyTypes.map((pt) => ({
    id: pt.id,
    code: pt.code,
    name: pt.name,
    description: pt.description,
    isActive: pt.isActive,
    penaltyCount: pt._count.penalties,
    createdAt: pt.createdAt,
  }));
}

/**
 * Create a new penalty type.
 */
export async function createPenaltyType(data: {
  code: string;
  name: string;
  description?: string;
}) {
  const auth = await assertPermission(Permission.PENALTY_TYPE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate code
  const existing = await prisma.penaltyType.findFirst({
    where: {
      companyId: auth.user.companyId,
      code: data.code,
      deletedAt: null,
    },
  });

  if (existing) {
    return { success: false, error: "A penalty type with this code already exists" };
  }

  try {
    const penaltyType = await prisma.penaltyType.create({
      data: {
        companyId: auth.user.companyId,
        code: data.code,
        name: data.name,
        description: data.description || null,
      },
    });

    await audit.create("PenaltyType", penaltyType.id, {
      code: data.code,
      name: data.name,
    });

    revalidatePath("/settings/penalty-types");

    return {
      success: true,
      data: {
        id: penaltyType.id,
        code: penaltyType.code,
        name: penaltyType.name,
        description: penaltyType.description,
        isActive: penaltyType.isActive,
        penaltyCount: 0,
        createdAt: penaltyType.createdAt,
      },
    };
  } catch (error) {
    console.error("Failed to create penalty type:", error);
    return { success: false, error: "Failed to create penalty type" };
  }
}

/**
 * Update a penalty type.
 */
export async function updatePenaltyType(
  id: string,
  data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }
) {
  const auth = await assertPermission(Permission.PENALTY_TYPE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const penaltyType = await prisma.penaltyType.findFirst({
    where: { id, companyId: auth.user.companyId, deletedAt: null },
  });

  if (!penaltyType) {
    return { success: false, error: "Penalty type not found" };
  }

  try {
    const updated = await prisma.penaltyType.update({
      where: { id },
      data: {
        name: data.name ?? penaltyType.name,
        description: data.description !== undefined ? data.description : penaltyType.description,
        isActive: data.isActive ?? penaltyType.isActive,
      },
    });

    await audit.update("PenaltyType", id, { name: penaltyType.name }, { name: updated.name });

    revalidatePath("/settings/penalty-types");

    return { success: true };
  } catch (error) {
    console.error("Failed to update penalty type:", error);
    return { success: false, error: "Failed to update penalty type" };
  }
}

/**
 * Soft delete a penalty type.
 */
export async function deletePenaltyType(id: string) {
  const auth = await assertPermission(Permission.PENALTY_TYPE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for active penalties using this type
  const activePenalties = await prisma.penalty.count({
    where: { penaltyTypeId: id, status: "ACTIVE" },
  });

  if (activePenalties > 0) {
    return {
      success: false,
      error: `Cannot delete: ${activePenalties} active penalt${activePenalties === 1 ? "y" : "ies"} use this type`,
    };
  }

  try {
    await prisma.penaltyType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await audit.delete("PenaltyType", id, { id });

    revalidatePath("/settings/penalty-types");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete penalty type:", error);
    return { success: false, error: "Failed to delete penalty type" };
  }
}

// =============================================================================
// PENALTY ACTIONS (Employee-scoped)
// =============================================================================

/**
 * Get all penalties for an employee with installment details.
 */
export async function getEmployeePenalties(employeeId: string) {
  await assertPermission(Permission.PENALTY_VIEW);

  const penalties = await prisma.penalty.findMany({
    where: { employeeId },
    include: {
      penaltyType: {
        select: { id: true, code: true, name: true },
      },
      createdBy: {
        select: { id: true, email: true },
      },
      installments: {
        orderBy: { installmentNumber: "asc" },
        select: {
          id: true,
          installmentNumber: true,
          amount: true,
          isDeducted: true,
          deductedAt: true,
          payrollRunId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return penalties.map((p) => ({
    id: p.id,
    penaltyType: p.penaltyType,
    customDescription: p.customDescription,
    totalAmount: Number(p.totalAmount),
    installmentCount: p.installmentCount,
    installmentAmount: Number(p.installmentAmount),
    status: p.status,
    effectiveDate: p.effectiveDate,
    remarks: p.remarks,
    totalDeducted: Number(p.totalDeducted),
    completedAt: p.completedAt,
    cancelledAt: p.cancelledAt,
    cancelReason: p.cancelReason,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    installments: p.installments.map((i) => ({
      id: i.id,
      installmentNumber: i.installmentNumber,
      amount: Number(i.amount),
      isDeducted: i.isDeducted,
      deductedAt: i.deductedAt,
      payrollRunId: i.payrollRunId,
    })),
  }));
}

/**
 * Create a penalty for an employee with auto-generated installment schedule.
 */
export async function createPenalty(data: {
  employeeId: string;
  penaltyTypeId?: string;
  customDescription?: string;
  totalAmount: number;
  installmentCount: number;
  effectiveDate: string;
  remarks?: string;
}) {
  const auth = await assertPermission(Permission.PENALTY_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Validation
  if (!data.penaltyTypeId && !data.customDescription) {
    return { success: false, error: "Either a penalty type or custom description is required" };
  }
  if (data.totalAmount <= 0) {
    return { success: false, error: "Total amount must be greater than 0" };
  }
  if (data.installmentCount < 1) {
    return { success: false, error: "Number of installments must be at least 1" };
  }

  // Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  // Calculate installment amounts (even split, last absorbs rounding)
  const baseAmount = Math.floor((data.totalAmount * 100) / data.installmentCount) / 100;
  const lastAmount = Math.round((data.totalAmount - baseAmount * (data.installmentCount - 1)) * 100) / 100;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create penalty
      const penalty = await tx.penalty.create({
        data: {
          employeeId: data.employeeId,
          penaltyTypeId: data.penaltyTypeId || null,
          customDescription: data.customDescription || null,
          totalAmount: data.totalAmount,
          installmentCount: data.installmentCount,
          installmentAmount: baseAmount,
          effectiveDate: new Date(data.effectiveDate),
          remarks: data.remarks || null,
          createdById: auth.user.id,
        },
      });

      // Create installments
      const installments = [];
      for (let i = 1; i <= data.installmentCount; i++) {
        installments.push({
          penaltyId: penalty.id,
          installmentNumber: i,
          amount: i === data.installmentCount ? lastAmount : baseAmount,
        });
      }

      await tx.penaltyInstallment.createMany({ data: installments });

      // Resolve penalty type name for event description
      let typeName = data.customDescription || "Other";
      if (data.penaltyTypeId) {
        const pt = await tx.penaltyType.findUnique({
          where: { id: data.penaltyTypeId },
          select: { name: true },
        });
        if (pt) typeName = pt.name;
      }

      // Create employment event
      await tx.employmentEvent.create({
        data: {
          employeeId: data.employeeId,
          eventType: "PENALTY_ISSUED",
          eventDate: new Date(data.effectiveDate),
          status: "APPROVED",
          payload: {
            penaltyId: penalty.id,
            penaltyType: typeName,
            totalAmount: data.totalAmount,
            installmentCount: data.installmentCount,
            description: data.customDescription || typeName,
          },
          remarks: data.remarks || `Penalty: ${typeName} - PHP ${data.totalAmount}`,
          requestedById: auth.user.id,
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });

      return penalty;
    });

    await audit.create("Penalty", result.id, {
      employeeId: data.employeeId,
      totalAmount: data.totalAmount,
      installmentCount: data.installmentCount,
    });

    revalidatePath(`/employees/${data.employeeId}`);

    return { success: true, data: { id: result.id } };
  } catch (error) {
    console.error("Failed to create penalty:", error);
    return { success: false, error: "Failed to create penalty" };
  }
}

/**
 * Cancel a penalty. Only ACTIVE penalties can be cancelled.
 */
export async function cancelPenalty(penaltyId: string, reason: string) {
  const auth = await assertPermission(Permission.PENALTY_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  if (!reason.trim()) {
    return { success: false, error: "Cancellation reason is required" };
  }

  const penalty = await prisma.penalty.findUnique({
    where: { id: penaltyId },
    select: { id: true, employeeId: true, status: true },
  });

  if (!penalty) {
    return { success: false, error: "Penalty not found" };
  }
  if (penalty.status !== "ACTIVE") {
    return { success: false, error: "Only active penalties can be cancelled" };
  }

  try {
    await prisma.penalty.update({
      where: { id: penaltyId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
      },
    });

    await audit.update(
      "Penalty",
      penaltyId,
      { status: "ACTIVE" },
      { status: "CANCELLED", cancelReason: reason.trim() }
    );

    revalidatePath(`/employees/${penalty.employeeId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to cancel penalty:", error);
    return { success: false, error: "Failed to cancel penalty" };
  }
}
