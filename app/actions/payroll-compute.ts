"use server";

// =============================================================================
// PeopleOS PH - Payroll Computation Server Actions
// =============================================================================
// Handles payroll computation, manual adjustments, and related operations.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import {
  computePayroll as computePayrollEngine,
  type EmployeePayrollInput,
} from "@/lib/payroll/compute-engine";
import type {
  PayPeriodInput,
  RulesetInput,
  PayProfileInput,
  AttendanceDayInput,
  ManualAdjustment,
  EmployeeRegularizationInput,
} from "@/lib/payroll/types";
import {
  setManilaHours,
  extractTimeComponents,
  calculateAttendanceTimes,
} from "@/lib/utils/timezone";
import {
  buildEventMap,
  resolveDayType,
  type DayType,
} from "@/lib/payroll/day-type-resolver";
import {
  SSS_TABLE,
  PHILHEALTH_TABLE,
  PAGIBIG_TABLE,
  TAX_TABLE,
} from "@/lib/payroll/statutory-tables";

// =============================================================================
// Helper: Calculate Attendance Metrics
// =============================================================================
// Uses shared canonical utilities from timezone.ts + adds workedMinutes and
// nightDiffMinutes calculation. Per SPEC_V1.md: "The Attendance UI and Payroll
// computation must share one canonical attendance calculator function."

interface AttendanceCalc {
  lateMinutes: number;
  undertimeMinutes: number;
  otEarlyInMinutes: number;
  otLateOutMinutes: number;
  otBreakMinutes: number;
  workedMinutes: number;
  nightDiffMinutes: number;
}

/**
 * Calculate all attendance metrics on the fly from clock times and schedule.
 * Uses shared utilities from timezone.ts for late/undertime/OT, then adds
 * workedMinutes and nightDiffMinutes calculations.
 */
function calculateAttendanceMetrics(
  actualTimeIn: Date | null,
  actualTimeOut: Date | null,
  scheduledStartTime: Date | string | null,
  scheduledEndTime: Date | string | null,
  breakMinutes: number,
  earlyInApproved: boolean,
  lateOutApproved: boolean,
  lateInApproved: boolean,
  earlyOutApproved: boolean,
  isOvernight: boolean = false,
  attendanceDate?: Date,
  // Break override info for adjusting late/undertime calculations
  shiftBreakMinutes?: number,
  breakMinutesApplied?: number | null,
  // Break window times for excluding break from late/undertime overlap
  breakStartTime?: Date | string | null,
  breakEndTime?: Date | string | null
): AttendanceCalc {
  if (!actualTimeIn || !actualTimeOut) {
    return { lateMinutes: 0, undertimeMinutes: 0, otEarlyInMinutes: 0, otLateOutMinutes: 0, otBreakMinutes: 0, workedMinutes: 0, nightDiffMinutes: 0 };
  }

  const clockIn = new Date(actualTimeIn);
  const clockOut = new Date(actualTimeOut);

  // Use shared canonical utility for late/undertime/OT (per SPEC_V1.md)
  const baseDate = attendanceDate ?? clockIn;
  const calc = calculateAttendanceTimes(
    actualTimeIn,
    actualTimeOut,
    scheduledStartTime,
    scheduledEndTime,
    baseDate,
    earlyInApproved,
    lateOutApproved,
    shiftBreakMinutes,
    breakMinutesApplied,
    breakStartTime,
    breakEndTime
  );

  // Apply excusal flags (lateInApproved excuses late, earlyOutApproved excuses undertime)
  const lateMinutes = lateInApproved ? 0 : calc.lateMinutes;
  const undertimeMinutes = earlyOutApproved ? 0 : calc.undertimeMinutes;

  // Calculate gross worked minutes
  const grossWorkedMs = clockOut.getTime() - clockIn.getTime();
  const grossWorkedMinutes = Math.max(0, Math.round(grossWorkedMs / (1000 * 60)));
  const applyBreak = grossWorkedMinutes > 300 ? breakMinutes : 0;

  // Extract schedule times using shared utility
  const startTime = extractTimeComponents(scheduledStartTime);
  const endTime = extractTimeComponents(scheduledEndTime);

  let workedMinutes = 0;
  // Effective clock times: bounded by schedule unless OT is approved
  // Used for both worked minutes and ND calculation (ND only applies to approved work time)
  let effectiveClockIn = clockIn;
  let effectiveClockOut = clockOut;

  if (startTime && endTime) {
    // Build schedule times using Manila timezone utility
    const schedStart = setManilaHours(new Date(baseDate), startTime.hours, startTime.minutes);
    const schedEnd = setManilaHours(new Date(baseDate), endTime.hours, endTime.minutes);

    // Handle overnight shifts (end time is next day)
    if (endTime.hours < startTime.hours || isOvernight) {
      schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
    }

    // Calculate worked minutes (schedule-bounded unless OT approved)
    if (clockIn < schedStart && !earlyInApproved) {
      effectiveClockIn = schedStart;
    }
    if (clockOut > schedEnd && !lateOutApproved) {
      effectiveClockOut = schedEnd;
    }

    const effectiveDiffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime();
    const effectiveGrossMinutes = Math.max(0, Math.round(effectiveDiffMs / (1000 * 60)));
    const effectiveBreak = effectiveGrossMinutes > 300 ? breakMinutes : 0;
    workedMinutes = Math.max(0, effectiveGrossMinutes - effectiveBreak);
  } else {
    // No schedule - just use gross worked minus break
    workedMinutes = Math.max(0, grossWorkedMinutes - applyBreak);
  }

  // Calculate night differential (10pm - 6am per PH Labor Code)
  // Uses effective (schedule-bounded) times so ND only applies to approved work time
  const ND_START_HOUR = 22; // 10:00 PM
  const ND_END_HOUR = 6;    // 6:00 AM

  const clockInHour = effectiveClockIn.getHours();
  const clockInMin = effectiveClockIn.getMinutes();
  let clockInTotalMins = clockInHour * 60 + clockInMin;

  const clockOutHour = effectiveClockOut.getHours();
  const clockOutMin = effectiveClockOut.getMinutes();
  let clockOutTotalMins = clockOutHour * 60 + clockOutMin;

  // Handle overnight shifts (clock out on next day)
  if (isOvernight && clockOutTotalMins < 720) {
    clockOutTotalMins += 24 * 60;
  }

  // ND period: 10pm (1320) to 6am next day (1800)
  const ndStart = ND_START_HOUR * 60;
  const ndEnd = ND_END_HOUR * 60 + 24 * 60;

  // Find overlap between work period and ND period
  const overlapStart = Math.max(clockInTotalMins, ndStart);
  const overlapEnd = Math.min(clockOutTotalMins, ndEnd);
  const nightDiffMinutes = overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;

  return {
    lateMinutes,
    undertimeMinutes,
    otEarlyInMinutes: calc.otEarlyInMinutes,
    otLateOutMinutes: calc.otLateOutMinutes,
    otBreakMinutes: calc.otBreakMinutes,
    workedMinutes,
    nightDiffMinutes,
  };
}

// =============================================================================
// Compute Payroll (Full Implementation)
// =============================================================================

export async function runPayrollComputation(payrollRunId: string): Promise<{
  success: boolean;
  result?: {
    employeeCount: number;
    totalGrossPay: number;
    totalNetPay: number;
    errors: string[];
  };
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.PAYROLL_RUN);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll run with pay period data
    // Note: Statutory tables now use constants instead of DB (see buildRulesetInput)
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: {
          include: { calendar: true },
        },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["DRAFT", "REVIEW"].includes(payrollRun.status)) {
      return {
        success: false,
        error: `Cannot compute payroll in ${payrollRun.status} status`,
      };
    }

    // Update status to computing
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "COMPUTING" },
    });

    try {
      // Load employees for payroll
      const employeeInputs = await loadEmployeeInputs(
        auth.user.companyId,
        payrollRun.payPeriod.startDate,
        payrollRun.payPeriod.endDate,
        payrollRunId,
        payrollRun.payPeriod.calendar.payFrequency
      );

      // Build pay period input
      const payPeriodInput: PayPeriodInput = {
        id: payrollRun.payPeriod.id,
        startDate: payrollRun.payPeriod.startDate,
        endDate: payrollRun.payPeriod.endDate,
        cutoffDate: payrollRun.payPeriod.cutoffDate,
        payDate: payrollRun.payPeriod.payDate,
        periodNumber: payrollRun.payPeriod.periodNumber,
        payFrequency: payrollRun.payPeriod.calendar.payFrequency as any,
      };

      // Build ruleset input
      const rulesetInput = buildRulesetInput();

      // Compute payroll
      const computationResult = computePayrollEngine(
        payPeriodInput,
        rulesetInput,
        employeeInputs
      );

      // Get employee numbers for payslip number generation
      const employeeIds = computationResult.payslips.map((ps) => ps.employeeId);
      const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, employeeNumber: true },
      });
      const employeeNumberMap = new Map(employees.map((e) => [e.id, e.employeeNumber]));

      // Add employee numbers to payslips
      const payslipsWithEmployeeNumber = computationResult.payslips.map((ps) => ({
        ...ps,
        employeeNumber: employeeNumberMap.get(ps.employeeId) || "EMP000",
      }));

      // Save payslips and lines
      await savePayslips(payrollRunId, payrollRun.payPeriod.startDate, payslipsWithEmployeeNumber);

      // Update payroll run totals and status
      await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: "REVIEW",
          totalGrossPay: computationResult.totals.grossPay,
          totalDeductions: computationResult.totals.totalDeductions,
          totalNetPay: computationResult.totals.netPay,
          employeeCount: computationResult.employeeCount,
          payslipCount: computationResult.payslips.length,
        },
      });

      await audit.update(
        "PayrollRun",
        payrollRunId,
        { status: "COMPUTING" },
        {
          status: "REVIEW",
          employeeCount: computationResult.employeeCount,
          totalGrossPay: computationResult.totals.grossPay,
        }
      );

      revalidatePath("/payroll");
      revalidatePath(`/payroll/${payrollRunId}`);

      return {
        success: true,
        result: {
          employeeCount: computationResult.employeeCount,
          totalGrossPay: computationResult.totals.grossPay,
          totalNetPay: computationResult.totals.netPay,
          errors: computationResult.errors.map(
            (e) => `${e.employeeId}: ${e.error}`
          ),
        },
      };
    } catch (computeError) {
      // Revert to DRAFT on error
      await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: { status: "DRAFT" },
      });
      throw computeError;
    }
  } catch (error) {
    console.error("Failed to compute payroll:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to compute payroll",
    };
  }
}

// =============================================================================
// Compute Payroll for Specific Employees
// =============================================================================

/**
 * Compute payroll for specific employees only.
 * Used when creating a payroll run with selected employees.
 * Permission: payroll:run
 */
export async function computePayrollForEmployees(
  payrollRunId: string,
  employeeIds: string[]
): Promise<{
  success: boolean;
  employeeCount?: number;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.PAYROLL_RUN);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll run with pay period data
    // Note: Statutory tables now use constants instead of DB (see buildRulesetInput)
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: {
          include: { calendar: true },
        },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["DRAFT", "REVIEW"].includes(payrollRun.status)) {
      return {
        success: false,
        error: `Cannot compute payroll in ${payrollRun.status} status`,
      };
    }

    // Update status to computing
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "COMPUTING" },
    });

    try {
      // Load employees for payroll - filtered by employeeIds
      const employeeInputs = await loadEmployeeInputsForSelection(
        auth.user.companyId,
        payrollRun.payPeriod.startDate,
        payrollRun.payPeriod.endDate,
        payrollRunId,
        employeeIds,
        payrollRun.payPeriod.calendar.payFrequency
      );

      if (employeeInputs.length === 0) {
        await prisma.payrollRun.update({
          where: { id: payrollRunId },
          data: { status: "DRAFT" },
        });
        return { success: false, error: "No employees with valid pay profiles found" };
      }

      // Build pay period input
      const payPeriodInput: PayPeriodInput = {
        id: payrollRun.payPeriod.id,
        startDate: payrollRun.payPeriod.startDate,
        endDate: payrollRun.payPeriod.endDate,
        cutoffDate: payrollRun.payPeriod.cutoffDate,
        payDate: payrollRun.payPeriod.payDate,
        periodNumber: payrollRun.payPeriod.periodNumber,
        payFrequency: payrollRun.payPeriod.calendar.payFrequency as any,
      };

      // Build ruleset input
      const rulesetInput = buildRulesetInput();

      // Compute payroll
      const computationResult = computePayrollEngine(
        payPeriodInput,
        rulesetInput,
        employeeInputs
      );

      // Get employee numbers for payslip number generation
      const computedEmployeeIds = computationResult.payslips.map((ps) => ps.employeeId);
      const employees = await prisma.employee.findMany({
        where: { id: { in: computedEmployeeIds } },
        select: { id: true, employeeNumber: true },
      });
      const employeeNumberMap = new Map(employees.map((e) => [e.id, e.employeeNumber]));

      // Add employee numbers to payslips
      const payslipsWithEmployeeNumber = computationResult.payslips.map((ps) => ({
        ...ps,
        employeeNumber: employeeNumberMap.get(ps.employeeId) || "EMP000",
      }));

      // Delete existing payslips (in case of recompute)
      await prisma.payslip.deleteMany({
        where: { payrollRunId },
      });

      // Save payslips and lines
      await savePayslips(payrollRunId, payrollRun.payPeriod.startDate, payslipsWithEmployeeNumber);

      // Update payroll run totals and status
      await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: "REVIEW",
          totalGrossPay: computationResult.totals.grossPay,
          totalDeductions: computationResult.totals.totalDeductions,
          totalNetPay: computationResult.totals.netPay,
          employeeCount: computationResult.employeeCount,
          payslipCount: computationResult.payslips.length,
        },
      });

      await audit.update(
        "PayrollRun",
        payrollRunId,
        { status: "COMPUTING" },
        {
          status: "REVIEW",
          employeeCount: computationResult.employeeCount,
          totalGrossPay: computationResult.totals.grossPay,
        }
      );

      revalidatePath("/payroll");
      revalidatePath(`/payroll/${payrollRunId}`);

      return {
        success: true,
        employeeCount: computationResult.employeeCount,
      };
    } catch (computeError) {
      // Revert to DRAFT on error
      await prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: { status: "DRAFT" },
      });
      throw computeError;
    }
  } catch (error) {
    console.error("Failed to compute payroll for employees:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to compute payroll",
    };
  }
}

// =============================================================================
// Manual Adjustments
// =============================================================================

/**
 * DESIGN DECISION: Manual adjustments are stored per PayrollRun + Employee.
 *
 * Justification:
 * 1. Adjustments are typically one-time corrections for a specific pay period
 * 2. Adjustments should be reviewed during payroll approval
 * 3. Once payroll is released, adjustments are locked with the payslip
 * 4. Per-payslip would require payslip to exist first; per-run allows pre-entry
 * 5. Easier to audit and report on adjustments by payroll run
 */

export async function addManualAdjustment(input: {
  payrollRunId: string;
  employeeId: string;
  type: "EARNING" | "DEDUCTION";
  description: string;
  amount: number;
  remarks?: string;
}): Promise<{ success: boolean; adjustmentId?: string; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.PAYROLL_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify payroll run is editable
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: input.payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["DRAFT", "REVIEW"].includes(payrollRun.status)) {
      return { success: false, error: "Payroll run is not editable" };
    }

    // Verify employee exists and is in the company
    const employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        companyId: auth.user.companyId,
        deletedAt: null,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Map type to category
    const category =
      input.type === "EARNING" ? "ADJUSTMENT_ADD" : "ADJUSTMENT_DEDUCT";

    // Create adjustment
    const adjustment = await prisma.manualAdjustmentLine.create({
      data: {
        payrollRunId: input.payrollRunId,
        employeeId: input.employeeId,
        category,
        description: input.description,
        amount: input.amount,
        remarks: input.remarks,
        createdById: auth.user.id,
      },
    });

    await audit.create("ManualAdjustmentLine", adjustment.id, {
      payrollRunId: input.payrollRunId,
      employeeId: input.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      type: input.type,
      description: input.description,
      amount: input.amount,
    });

    revalidatePath(`/payroll/${input.payrollRunId}`);

    return { success: true, adjustmentId: adjustment.id };
  } catch (error) {
    console.error("Failed to add manual adjustment:", error);
    return { success: false, error: "Failed to add manual adjustment" };
  }
}

export async function updateManualAdjustment(
  adjustmentId: string,
  input: {
    type?: "EARNING" | "DEDUCTION";
    description?: string;
    amount?: number;
    remarks?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.PAYROLL_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get adjustment and verify it's editable
    const adjustment = await prisma.manualAdjustmentLine.findUnique({
      where: { id: adjustmentId },
    });

    if (!adjustment) {
      return { success: false, error: "Adjustment not found" };
    }

    // Verify payroll run is editable
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: adjustment.payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["DRAFT", "REVIEW"].includes(payrollRun.status)) {
      return { success: false, error: "Payroll run is not editable" };
    }

    const oldValues = {
      category: adjustment.category,
      description: adjustment.description,
      amount: Number(adjustment.amount),
    };

    const category = input.type
      ? input.type === "EARNING"
        ? "ADJUSTMENT_ADD"
        : "ADJUSTMENT_DEDUCT"
      : undefined;

    await prisma.manualAdjustmentLine.update({
      where: { id: adjustmentId },
      data: {
        ...(category && { category }),
        ...(input.description && { description: input.description }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.remarks !== undefined && { remarks: input.remarks }),
      },
    });

    await audit.update("ManualAdjustmentLine", adjustmentId, oldValues, {
      category: category || adjustment.category,
      description: input.description || adjustment.description,
      amount: input.amount ?? Number(adjustment.amount),
    });

    revalidatePath(`/payroll/${adjustment.payrollRunId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update manual adjustment:", error);
    return { success: false, error: "Failed to update manual adjustment" };
  }
}

export async function deleteManualAdjustment(
  adjustmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    await assertPermission(Permission.PAYROLL_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get adjustment
    const adjustment = await prisma.manualAdjustmentLine.findUnique({
      where: { id: adjustmentId },
    });

    if (!adjustment) {
      return { success: false, error: "Adjustment not found" };
    }

    // Verify payroll run is editable
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: adjustment.payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["DRAFT", "REVIEW"].includes(payrollRun.status)) {
      return { success: false, error: "Cannot delete from locked payroll run" };
    }

    await prisma.manualAdjustmentLine.delete({ where: { id: adjustmentId } });

    await audit.delete("ManualAdjustmentLine", adjustmentId, {
      payrollRunId: adjustment.payrollRunId,
      employeeId: adjustment.employeeId,
      description: adjustment.description,
      amount: Number(adjustment.amount),
    });

    revalidatePath(`/payroll/${adjustment.payrollRunId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete manual adjustment:", error);
    return { success: false, error: "Failed to delete manual adjustment" };
  }
}

export async function getManualAdjustments(payrollRunId: string): Promise<{
  success: boolean;
  adjustments?: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber: string;
    type: "EARNING" | "DEDUCTION";
    description: string;
    amount: number;
    remarks: string | null;
    createdAt: Date;
    createdBy: string | null;
  }>;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Verify access to payroll run
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    const adjustments = await prisma.manualAdjustmentLine.findMany({
      where: { payrollRunId },
      orderBy: { createdAt: "desc" },
    });

    // Fetch employee and creator info
    const employeeIds = [...new Set(adjustments.map((a) => a.employeeId))];
    const creatorIds = [
      ...new Set(adjustments.map((a) => a.createdById).filter(Boolean)),
    ] as string[];

    const [employees, creators] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true },
      }),
      prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, email: true },
      }),
    ]);

    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const creatorMap = new Map(creators.map((c) => [c.id, c.email]));

    return {
      success: true,
      adjustments: adjustments.map((a) => {
        const emp = employeeMap.get(a.employeeId);
        return {
          id: a.id,
          employeeId: a.employeeId,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "Unknown",
          employeeNumber: emp?.employeeNumber || "",
          type: a.category === "ADJUSTMENT_ADD" ? "EARNING" : "DEDUCTION",
          description: a.description,
          amount: Number(a.amount),
          remarks: a.remarks,
          createdAt: a.createdAt,
          createdBy: a.createdById ? creatorMap.get(a.createdById) || null : null,
        };
      }),
    };
  } catch (error) {
    console.error("Failed to get manual adjustments:", error);
    return { success: false, error: "Failed to get manual adjustments" };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

async function loadEmployeeInputs(
  companyId: string,
  startDate: Date,
  endDate: Date,
  payrollRunId: string,
  payFrequency: string
): Promise<EmployeePayrollInput[]> {
  // Load active employees with role scorecards and attendance
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      employmentStatus: "ACTIVE",
      deletedAt: null,
      // Only include employees who have a role scorecard (for compensation)
      roleScorecardId: { not: null },
    },
    include: {
      roleScorecard: true,
      attendanceRecords: {
        where: {
          attendanceDate: { gte: startDate, lte: endDate },
        },
        include: {
          holiday: true,
          leaveRequest: { include: { leaveType: true } },
          shiftTemplate: { select: { startTime: true, endTime: true, breakMinutes: true, breakStartTime: true, breakEndTime: true, isOvernight: true, scheduledWorkMinutes: true } },
        },
      },
    },
  });

  // Load manual adjustments for this payroll run
  const adjustments = await prisma.manualAdjustmentLine.findMany({
    where: { payrollRunId },
  });

  // Load pending penalty installments for active penalties
  const penaltyInstallments = await prisma.penaltyInstallment.findMany({
    where: {
      isDeducted: false,
      penalty: {
        employee: { companyId, employmentStatus: "ACTIVE" },
        status: "ACTIVE",
        effectiveDate: { lte: endDate },
      },
    },
    include: {
      penalty: {
        include: { penaltyType: { select: { name: true } } },
      },
    },
    orderBy: [
      { penalty: { effectiveDate: "asc" } },
      { installmentNumber: "asc" },
    ],
  });

  // Load YTD from previous payslips in same year
  // Include BASIC_PAY and LATE_UT_DEDUCTION line items for accurate YTD recalculation
  const year = startDate.getFullYear();
  const ytdPayslips = await prisma.payslip.findMany({
    where: {
      employee: { companyId },
      payrollRun: {
        status: "RELEASED",
        payPeriod: {
          startDate: { gte: new Date(`${year}-01-01`) },
          endDate: { lt: startDate },
        },
      },
    },
    include: {
      lines: {
        where: { category: { in: ["BASIC_PAY", "LATE_UT_DEDUCTION"] } },
        select: { category: true, amount: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group all payslips by employee (not just latest - we recompute YTD from per-period data)
  const payslipsByEmployee = new Map<string, typeof ytdPayslips>();
  for (const ps of ytdPayslips) {
    if (!payslipsByEmployee.has(ps.employeeId)) {
      payslipsByEmployee.set(ps.employeeId, []);
    }
    payslipsByEmployee.get(ps.employeeId)!.push(ps);
  }

  // Default rest days: Saturday (6) and Sunday (0)
  // Note: Per-employee schedules removed - rest days now determined by attendance import
  const defaultRestDays = [0, 6];

  // Get calendar events (holidays) for the date range
  const eventMap = await buildEventMap(companyId, startDate, endDate);

  // Build penalty deductions map: next un-deducted installment per penalty per employee
  const penaltyByEmployee = new Map<string, Array<{ installmentId: string; penaltyId: string; description: string; amount: number }>>();
  const seenPenalties = new Set<string>();
  for (const pi of penaltyInstallments) {
    const empId = pi.penalty.employeeId;
    if (seenPenalties.has(pi.penaltyId)) continue; // Only first un-deducted per penalty
    seenPenalties.add(pi.penaltyId);
    if (!penaltyByEmployee.has(empId)) penaltyByEmployee.set(empId, []);
    penaltyByEmployee.get(empId)!.push({
      installmentId: pi.id,
      penaltyId: pi.penaltyId,
      description: `${pi.penalty.penaltyType?.name || pi.penalty.customDescription || "Penalty"} (${pi.installmentNumber}/${pi.penalty.installmentCount})`,
      amount: Number(pi.amount),
    });
  }

  // Compute periodsPerMonth from pay frequency
  const periodsPerMonth = toPeriodsPerMonth(payFrequency);

  // Transform to input format - only include employees with role scorecards
  return employees
    .filter((e) => e.roleScorecard !== null)
    .map((e) => {
      const scorecard = e.roleScorecard!;
      const empAdjustments = adjustments.filter((a) => a.employeeId === e.id);
      const ytd = computeEmployeeYtd(
        payslipsByEmployee.get(e.id) || [],
        e.taxOnFullEarnings,
        e.declaredWageOverride ? Number(e.declaredWageOverride) : null,
        (e.declaredWageType as "MONTHLY" | "DAILY" | "HOURLY") || null,
        periodsPerMonth,
      );

      // Get wage type and base salary from role scorecard
      // baseSalary meaning depends on wageType:
      // - MONTHLY: baseSalary is monthly salary
      // - DAILY: baseSalary is daily rate
      // - HOURLY: baseSalary is hourly rate
      const wageType = (scorecard.wageType || "MONTHLY") as "MONTHLY" | "DAILY" | "HOURLY";
      const baseSalary = scorecard.baseSalary ? Number(scorecard.baseSalary) : 0;
      const standardWorkDaysPerMonth = 26; // As per user specification
      const standardHoursPerDay = scorecard.workHoursPerDay || 8;

      return {
        profile: {
          employeeId: e.id,
          wageType,
          baseRate: baseSalary, // Rate interpretation depends on wageType
          payFrequency: payFrequency as any,
          standardWorkDaysPerMonth,
          standardHoursPerDay,
          isBenefitsEligible: true, // Default to true, can be made configurable
          isOtEligible: e.isOtEligible,
          isNdEligible: e.isNdEligible,
          // No allowances from role scorecard (set to 0)
          riceSubsidy: 0,
          clothingAllowance: 0,
          laundryAllowance: 0,
          medicalAllowance: 0,
          transportationAllowance: 0,
          mealAllowance: 0,
          communicationAllowance: 0,
        } as PayProfileInput,
        regularization: {
          employeeId: e.id,
          employmentType: e.employmentType as any,
          regularizationDate: e.regularizationDate || undefined,
          hireDate: e.hireDate,
        } as EmployeeRegularizationInput,
        attendance: e.attendanceRecords.map((a) => {
          // Check for calendar events (holidays) only
          const resolution = resolveDayType(
            a.attendanceDate,
            defaultRestDays,
            eventMap
          );

          // IMPORTANT: Day type logic
          // - For HOLIDAYS: Use calendar-resolved day type (ensures correct holiday pay)
          // - For NON-HOLIDAYS: Use STORED dayType from attendance record
          //   (respects the employee's actual schedule - they may work Sat/Sun as normal days)
          const isHoliday = resolution.holidayId !== null;
          const effectiveDayType = isHoliday
            ? (resolution.dayType as DayType)
            : (a.dayType as DayType);

          // Calculate all attendance metrics on the fly
          const schedStartTime = a.shiftTemplate?.startTime;
          const schedEndTime = a.shiftTemplate?.endTime;
          const shiftBreakMinutes = a.shiftTemplate?.breakMinutes ?? 60;
          // Use break override if set, otherwise use shift template's break minutes
          const breakMinutes = a.breakMinutesApplied ?? shiftBreakMinutes;
          const isOvernight = a.shiftTemplate?.isOvernight ?? false;
          const breakStartTime = a.shiftTemplate?.breakStartTime ?? null;
          const breakEndTime = a.shiftTemplate?.breakEndTime ?? null;

          const calc = calculateAttendanceMetrics(
            a.actualTimeIn,
            a.actualTimeOut,
            schedStartTime ?? null,
            schedEndTime ?? null,
            breakMinutes,
            a.earlyInApproved ?? false,
            a.lateOutApproved ?? false,
            a.lateInApproved ?? false,
            a.earlyOutApproved ?? false,
            isOvernight,
            a.attendanceDate,
            shiftBreakMinutes,
            a.breakMinutesApplied,
            breakStartTime,
            breakEndTime
          );

          const workedMinutes = calc.workedMinutes;
          const hasActualWork = workedMinutes > 0;

          // Only apply rest day premium if the STORED dayType is REST_DAY
          // (meaning it was an actual rest day for this employee, not just Sat/Sun)
          const storedDayTypeIsRestDay = a.dayType === "REST_DAY";

          // Rest day/holiday OT is the entire worked time on those days
          const overtimeRestDayMinutes = storedDayTypeIsRestDay && hasActualWork ? workedMinutes : 0;
          const isHolidayDay = effectiveDayType === "REGULAR_HOLIDAY" || effectiveDayType === "SPECIAL_HOLIDAY";
          const overtimeHolidayMinutes = isHolidayDay && hasActualWork ? workedMinutes : 0;

          return {
            id: a.id,
            attendanceDate: a.attendanceDate,
            // Use effective day type (holiday-resolved or stored)
            dayType: effectiveDayType,
            holidayName: resolution.holidayName || a.holiday?.name,
            // Base worked minutes (schedule-bounded)
            workedMinutes,
            // Deductions: calculated on the fly
            lateMinutes: hasActualWork ? calc.lateMinutes : 0,
            undertimeMinutes: hasActualWork ? calc.undertimeMinutes : 0,
            absentMinutes: !a.actualTimeIn && !a.actualTimeOut && a.dayType === "WORKDAY" ? (a.shiftTemplate?.scheduledWorkMinutes ?? 480) : 0,
            // OT/Premium minutes ONLY count if there was actual work rendered
            otEarlyInMinutes: hasActualWork ? calc.otEarlyInMinutes : 0,
            otLateOutMinutes: hasActualWork ? calc.otLateOutMinutes : 0,
            otBreakMinutes: hasActualWork ? calc.otBreakMinutes : 0,
            overtimeRestDayMinutes,
            overtimeHolidayMinutes,
            nightDiffMinutes: hasActualWork ? calc.nightDiffMinutes : 0,
            // OT Approval flags - only early in/late out requires approval
            earlyInApproved: a.earlyInApproved ?? false,
            lateOutApproved: a.lateOutApproved ?? false,
            // Holiday multiplier from calendar event
            holidayMultiplier: resolution.holidayId ? resolution.multiplier : undefined,
            // Rest day multiplier only if stored dayType is REST_DAY
            restDayMultiplier: storedDayTypeIsRestDay ? 1.3 : undefined,
            isOnLeave: a.leaveRequestId !== null,
            leaveIsPaid: a.leaveRequest?.leaveType?.isPaid ?? true,
            leaveHours: a.leaveHours ? Number(a.leaveHours) : undefined,
            // Daily rate override for this day
            dailyRateOverride: a.dailyRateOverride ? Number(a.dailyRateOverride) : undefined,
          };
        }) as AttendanceDayInput[],
        manualAdjustments: empAdjustments.map((a) => ({
          id: a.id,
          employeeId: a.employeeId,
          type:
            a.category === "ADJUSTMENT_ADD"
              ? ("EARNING" as const)
              : ("DEDUCTION" as const),
          category: a.category as any,
          description: a.description,
          amount: Number(a.amount),
          remarks: a.remarks || undefined,
        })) as ManualAdjustment[],
        // Note: Reimbursements, Cash Advances, OR Incentives removed
        // These are now added manually via ManualAdjustmentLine
        reimbursements: [],
        cashAdvanceDeductions: [],
        orIncentives: [],
        previousYtd: ytd,
        // Statutory override (SUPER_ADMIN-set declared wage for benefits/tax)
        // If set, this wage is used for SSS, PhilHealth, PagIBIG calculations
        // instead of the RoleScorecard wage. Actual payroll earnings still use RoleScorecard.
        statutoryOverride: e.declaredWageOverride && e.declaredWageType
          ? {
              baseRate: Number(e.declaredWageOverride),
              wageType: e.declaredWageType as "MONTHLY" | "DAILY" | "HOURLY",
            }
          : undefined,
        // Tax calculation mode (SUPER_ADMIN only)
        // When true: Withholding tax uses full taxable earnings
        // When false (default): Withholding tax uses only Basic Pay - Late/Undertime
        taxOnFullEarnings: e.taxOnFullEarnings,
        // Penalty deductions (auto-loaded from active penalty installments)
        penaltyDeductions: penaltyByEmployee.get(e.id) || [],
      };
    });
}

/**
 * Load employee inputs for specific employees only (used for selected employee payroll).
 * Now uses role scorecards for compensation instead of pay profiles.
 */
async function loadEmployeeInputsForSelection(
  companyId: string,
  startDate: Date,
  endDate: Date,
  payrollRunId: string,
  employeeIds: string[],
  payFrequency: string
): Promise<EmployeePayrollInput[]> {
  // Load specific employees with role scorecards and attendance
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      companyId,
      employmentStatus: "ACTIVE",
      deletedAt: null,
    },
    include: {
      roleScorecard: true,
      attendanceRecords: {
        where: {
          attendanceDate: { gte: startDate, lte: endDate },
        },
        include: {
          holiday: true,
          leaveRequest: { include: { leaveType: true } },
          shiftTemplate: { select: { startTime: true, endTime: true, breakMinutes: true, breakStartTime: true, breakEndTime: true, isOvernight: true, scheduledWorkMinutes: true } },
        },
      },
    },
  });

  // Load manual adjustments for this payroll run
  const adjustments = await prisma.manualAdjustmentLine.findMany({
    where: { payrollRunId, employeeId: { in: employeeIds } },
  });

  // Load pending penalty installments for selected employees
  const penaltyInstallmentsForSelection = await prisma.penaltyInstallment.findMany({
    where: {
      isDeducted: false,
      penalty: {
        employeeId: { in: employeeIds },
        status: "ACTIVE",
        effectiveDate: { lte: endDate },
      },
    },
    include: {
      penalty: {
        include: { penaltyType: { select: { name: true } } },
      },
    },
    orderBy: [
      { penalty: { effectiveDate: "asc" } },
      { installmentNumber: "asc" },
    ],
  });

  // Load YTD from previous payslips in same year
  // Include BASIC_PAY and LATE_UT_DEDUCTION line items for accurate YTD recalculation
  const year = startDate.getFullYear();
  const ytdPayslips = await prisma.payslip.findMany({
    where: {
      employeeId: { in: employeeIds },
      payrollRun: {
        status: "RELEASED",
        payPeriod: {
          startDate: { gte: new Date(`${year}-01-01`) },
          endDate: { lt: startDate },
        },
      },
    },
    include: {
      lines: {
        where: { category: { in: ["BASIC_PAY", "LATE_UT_DEDUCTION"] } },
        select: { category: true, amount: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group all payslips by employee (not just latest - we recompute YTD from per-period data)
  const payslipsByEmployee = new Map<string, typeof ytdPayslips>();
  for (const ps of ytdPayslips) {
    if (!payslipsByEmployee.has(ps.employeeId)) {
      payslipsByEmployee.set(ps.employeeId, []);
    }
    payslipsByEmployee.get(ps.employeeId)!.push(ps);
  }

  // Default rest days: Saturday (6) and Sunday (0)
  const defaultRestDays = [0, 6];

  // Get calendar events (holidays) for the date range
  const eventMap = await buildEventMap(companyId, startDate, endDate);

  // Build penalty deductions map for selected employees
  const penaltyByEmployeeSelection = new Map<string, Array<{ installmentId: string; penaltyId: string; description: string; amount: number }>>();
  const seenPenaltiesSelection = new Set<string>();
  for (const pi of penaltyInstallmentsForSelection) {
    const empId = pi.penalty.employeeId;
    if (seenPenaltiesSelection.has(pi.penaltyId)) continue;
    seenPenaltiesSelection.add(pi.penaltyId);
    if (!penaltyByEmployeeSelection.has(empId)) penaltyByEmployeeSelection.set(empId, []);
    penaltyByEmployeeSelection.get(empId)!.push({
      installmentId: pi.id,
      penaltyId: pi.penaltyId,
      description: `${pi.penalty.penaltyType?.name || pi.penalty.customDescription || "Penalty"} (${pi.installmentNumber}/${pi.penalty.installmentCount})`,
      amount: Number(pi.amount),
    });
  }

  // Compute periodsPerMonth from pay frequency
  const periodsPerMonth = toPeriodsPerMonth(payFrequency);

  // Transform to input format - only include employees with role scorecards
  return employees
    .filter((e) => e.roleScorecard !== null)
    .map((e) => {
      const scorecard = e.roleScorecard!;
      const empAdjustments = adjustments.filter((a) => a.employeeId === e.id);
      const ytd = computeEmployeeYtd(
        payslipsByEmployee.get(e.id) || [],
        e.taxOnFullEarnings,
        e.declaredWageOverride ? Number(e.declaredWageOverride) : null,
        (e.declaredWageType as "MONTHLY" | "DAILY" | "HOURLY") || null,
        periodsPerMonth,
      );

      // Get wage type and base salary from role scorecard
      // baseSalary meaning depends on wageType:
      // - MONTHLY: baseSalary is monthly salary
      // - DAILY: baseSalary is daily rate
      // - HOURLY: baseSalary is hourly rate
      const wageType = (scorecard.wageType || "MONTHLY") as "MONTHLY" | "DAILY" | "HOURLY";
      const baseSalary = scorecard.baseSalary ? Number(scorecard.baseSalary) : 0;
      const standardWorkDaysPerMonth = 26; // As per user specification
      const standardHoursPerDay = scorecard.workHoursPerDay || 8;

      return {
        profile: {
          employeeId: e.id,
          wageType,
          baseRate: baseSalary, // Rate interpretation depends on wageType
          payFrequency: payFrequency as any,
          standardWorkDaysPerMonth,
          standardHoursPerDay,
          isBenefitsEligible: true, // Default to true, can be made configurable
          isOtEligible: e.isOtEligible,
          isNdEligible: e.isNdEligible,
          // No allowances from role scorecard (set to 0)
          riceSubsidy: 0,
          clothingAllowance: 0,
          laundryAllowance: 0,
          medicalAllowance: 0,
          transportationAllowance: 0,
          mealAllowance: 0,
          communicationAllowance: 0,
        } as PayProfileInput,
        regularization: {
          employeeId: e.id,
          employmentType: e.employmentType as any,
          regularizationDate: e.regularizationDate || undefined,
          hireDate: e.hireDate,
        } as EmployeeRegularizationInput,
        attendance: e.attendanceRecords.map((a) => {
          // Check for calendar events (holidays) only
          const resolution = resolveDayType(
            a.attendanceDate,
            defaultRestDays,
            eventMap
          );

          // IMPORTANT: Day type logic
          // - For HOLIDAYS: Use calendar-resolved day type (ensures correct holiday pay)
          // - For NON-HOLIDAYS: Use STORED dayType from attendance record
          //   (respects the employee's actual schedule - they may work Sat/Sun as normal days)
          const isHoliday = resolution.holidayId !== null;
          const effectiveDayType = isHoliday
            ? (resolution.dayType as DayType)
            : (a.dayType as DayType);

          // Calculate all attendance metrics on the fly
          const schedStartTime = a.shiftTemplate?.startTime;
          const schedEndTime = a.shiftTemplate?.endTime;
          const shiftBreakMinutes = a.shiftTemplate?.breakMinutes ?? 60;
          // Use break override if set, otherwise use shift template's break minutes
          const breakMinutes = a.breakMinutesApplied ?? shiftBreakMinutes;
          const isOvernight = a.shiftTemplate?.isOvernight ?? false;
          const breakStartTime = a.shiftTemplate?.breakStartTime ?? null;
          const breakEndTime = a.shiftTemplate?.breakEndTime ?? null;

          const calc = calculateAttendanceMetrics(
            a.actualTimeIn,
            a.actualTimeOut,
            schedStartTime ?? null,
            schedEndTime ?? null,
            breakMinutes,
            a.earlyInApproved ?? false,
            a.lateOutApproved ?? false,
            a.lateInApproved ?? false,
            a.earlyOutApproved ?? false,
            isOvernight,
            a.attendanceDate,
            shiftBreakMinutes,
            a.breakMinutesApplied,
            breakStartTime,
            breakEndTime
          );

          const workedMinutes = calc.workedMinutes;
          const hasActualWork = workedMinutes > 0;

          // Only apply rest day premium if the STORED dayType is REST_DAY
          // (meaning it was an actual rest day for this employee, not just Sat/Sun)
          const storedDayTypeIsRestDay = a.dayType === "REST_DAY";

          // Rest day/holiday OT is the entire worked time on those days
          const overtimeRestDayMinutes = storedDayTypeIsRestDay && hasActualWork ? workedMinutes : 0;
          const isHolidayDay = effectiveDayType === "REGULAR_HOLIDAY" || effectiveDayType === "SPECIAL_HOLIDAY";
          const overtimeHolidayMinutes = isHolidayDay && hasActualWork ? workedMinutes : 0;

          return {
            id: a.id,
            attendanceDate: a.attendanceDate,
            // Use effective day type (holiday-resolved or stored)
            dayType: effectiveDayType,
            holidayName: resolution.holidayName || a.holiday?.name,
            // Base worked minutes (schedule-bounded)
            workedMinutes,
            // Deductions: calculated on the fly
            lateMinutes: hasActualWork ? calc.lateMinutes : 0,
            undertimeMinutes: hasActualWork ? calc.undertimeMinutes : 0,
            absentMinutes: !a.actualTimeIn && !a.actualTimeOut && a.dayType === "WORKDAY" ? (a.shiftTemplate?.scheduledWorkMinutes ?? 480) : 0,
            // OT/Premium minutes ONLY count if there was actual work rendered
            otEarlyInMinutes: hasActualWork ? calc.otEarlyInMinutes : 0,
            otLateOutMinutes: hasActualWork ? calc.otLateOutMinutes : 0,
            otBreakMinutes: hasActualWork ? calc.otBreakMinutes : 0,
            overtimeRestDayMinutes,
            overtimeHolidayMinutes,
            nightDiffMinutes: hasActualWork ? calc.nightDiffMinutes : 0,
            earlyInApproved: a.earlyInApproved ?? false,
            lateOutApproved: a.lateOutApproved ?? false,
            // Holiday multiplier from calendar event
            holidayMultiplier: resolution.holidayId ? resolution.multiplier : undefined,
            // Rest day multiplier only if stored dayType is REST_DAY
            restDayMultiplier: storedDayTypeIsRestDay ? 1.3 : undefined,
            isOnLeave: a.leaveRequestId !== null,
            leaveIsPaid: a.leaveRequest?.leaveType?.isPaid ?? true,
            leaveHours: a.leaveHours ? Number(a.leaveHours) : undefined,
            // Daily rate override for this day
            dailyRateOverride: a.dailyRateOverride ? Number(a.dailyRateOverride) : undefined,
          };
        }) as AttendanceDayInput[],
        manualAdjustments: empAdjustments.map((a) => ({
          id: a.id,
          employeeId: a.employeeId,
          type:
            a.category === "ADJUSTMENT_ADD"
              ? ("EARNING" as const)
              : ("DEDUCTION" as const),
          category: a.category as any,
          description: a.description,
          amount: Number(a.amount),
          remarks: a.remarks || undefined,
        })) as ManualAdjustment[],
        // Note: Reimbursements, Cash Advances, OR Incentives removed
        // These are now added manually via ManualAdjustmentLine
        reimbursements: [],
        cashAdvanceDeductions: [],
        orIncentives: [],
        previousYtd: ytd,
        // Statutory override (SUPER_ADMIN-set declared wage for benefits/tax)
        // If set, this wage is used for SSS, PhilHealth, PagIBIG calculations
        // instead of the RoleScorecard wage. Actual payroll earnings still use RoleScorecard.
        statutoryOverride: e.declaredWageOverride && e.declaredWageType
          ? {
              baseRate: Number(e.declaredWageOverride),
              wageType: e.declaredWageType as "MONTHLY" | "DAILY" | "HOURLY",
            }
          : undefined,
        // Tax calculation mode (SUPER_ADMIN only)
        // When true: Withholding tax uses full taxable earnings
        // When false (default): Withholding tax uses only Basic Pay - Late/Undertime
        taxOnFullEarnings: e.taxOnFullEarnings,
        // Penalty deductions (auto-loaded from active penalty installments)
        penaltyDeductions: penaltyByEmployeeSelection.get(e.id) || [],
      };
    });
}

function buildRulesetInput(_rulesetVersion?: any): RulesetInput {
  // Use constants for statutory tables instead of database
  // This simplifies architecture - government rates rarely change (annual updates)
  return {
    id: "ph-standard-2026",
    version: 1,
    multipliers: [], // Multipliers use PH_MULTIPLIERS constant in compute-engine
    sssTable: SSS_TABLE,
    philhealthTable: PHILHEALTH_TABLE,
    pagibigTable: PAGIBIG_TABLE,
    taxTable: TAX_TABLE,
  };
}

async function savePayslips(
  payrollRunId: string,
  payPeriodStartDate: Date,
  payslips: Array<{
    employeeId: string;
    employeeNumber: string;
    lines: any[];
    grossPay: number;
    totalEarnings: number;
    totalDeductions: number;
    netPay: number;
    sssEe: number;
    sssEr: number;
    philhealthEe: number;
    philhealthEr: number;
    pagibigEe: number;
    pagibigEr: number;
    withholdingTax: number;
    ytdGrossPay: number;
    ytdTaxableIncome: number;
    ytdTaxWithheld: number;
    payProfileSnapshot: any;
  }>
): Promise<void> {
  // Delete existing payslips (for recomputation)
  await prisma.payslip.deleteMany({ where: { payrollRunId } });

  // Generate payslip numbers: EMP#-YYYY-MM-###
  const year = payPeriodStartDate.getFullYear();
  const month = String(payPeriodStartDate.getMonth() + 1).padStart(2, "0");

  // Create payslips with lines in batches
  let index = 1;
  for (const ps of payslips) {
    // Generate payslip number: EMP001-2026-01-001
    const payslipNumber = `${ps.employeeNumber}-${year}-${month}-${String(index).padStart(3, "0")}`;

    await prisma.payslip.create({
      data: {
        payrollRunId,
        employeeId: ps.employeeId,
        payslipNumber,
        grossPay: ps.grossPay,
        totalEarnings: ps.totalEarnings,
        totalDeductions: ps.totalDeductions,
        netPay: ps.netPay,
        sssEe: ps.sssEe,
        sssEr: ps.sssEr,
        philhealthEe: ps.philhealthEe,
        philhealthEr: ps.philhealthEr,
        pagibigEe: ps.pagibigEe,
        pagibigEr: ps.pagibigEr,
        withholdingTax: ps.withholdingTax,
        ytdGrossPay: ps.ytdGrossPay,
        ytdTaxableIncome: ps.ytdTaxableIncome,
        ytdTaxWithheld: ps.ytdTaxWithheld,
        payProfileSnapshot: ps.payProfileSnapshot,
        lines: {
          create: ps.lines.map((line) => ({
            category: line.category,
            description: line.description,
            quantity: line.quantity,
            rate: line.rate,
            multiplier: line.multiplier,
            amount: line.amount,
            sortOrder: line.sortOrder,
            attendanceDayRecordId: line.attendanceDayRecordId,
            manualAdjustmentId: line.manualAdjustmentId,
            penaltyInstallmentId: line.penaltyInstallmentId,
            ruleCode: line.ruleCode,
            ruleDescription: line.ruleDescription,
          })),
        },
      },
    });
    index++;
  }
}

/** Convert pay frequency string to periods per month. */
function toPeriodsPerMonth(payFrequency: string): number {
  switch (payFrequency) {
    case "MONTHLY":
      return 1;
    case "SEMI_MONTHLY":
      return 2;
    case "BI_WEEKLY":
      return 2.17;
    case "WEEKLY":
      return 4.33;
    default:
      return 2;
  }
}

/**
 * Recompute correct YTD from per-period payslip data.
 *
 * Previously, YTD taxable income was stored as a cumulative using grossPay
 * (all earnings), which inflated YTD for "Basic Pay Only" employees. This
 * function recomputes each period's taxable income based on the employee's
 * current tax mode, producing a correct cumulative that self-heals corrupted
 * historical data.
 */
function computeEmployeeYtd(
  payslips: Array<{
    grossPay: any;
    sssEe: any;
    philhealthEe: any;
    pagibigEe: any;
    withholdingTax: any;
    lines: Array<{ category: string; amount: any }>;
  }>,
  taxOnFullEarnings: boolean,
  declaredWageOverride: number | null,
  declaredWageType: "MONTHLY" | "DAILY" | "HOURLY" | null,
  periodsPerMonth: number,
): { grossPay: number; taxableIncome: number; taxWithheld: number } {
  if (payslips.length === 0) {
    return { grossPay: 0, taxableIncome: 0, taxWithheld: 0 };
  }

  let ytdGrossPay = 0;
  let ytdTaxable = 0;
  let ytdTaxWithheld = 0;

  // Precompute override per-period wage if applicable
  let overridePerPeriod = 0;
  if (!taxOnFullEarnings && declaredWageOverride && declaredWageType) {
    const standardWorkDaysPerMonth = 26;
    const standardHoursPerDay = 8;
    const overrideMonthly =
      declaredWageType === "MONTHLY"
        ? declaredWageOverride
        : declaredWageType === "DAILY"
          ? declaredWageOverride * standardWorkDaysPerMonth
          : declaredWageOverride * standardHoursPerDay * standardWorkDaysPerMonth;
    overridePerPeriod = overrideMonthly / periodsPerMonth;
  }

  for (const ps of payslips) {
    const gross = Number(ps.grossPay);
    const sss = Number(ps.sssEe);
    const phil = Number(ps.philhealthEe);
    const pag = Number(ps.pagibigEe);

    ytdGrossPay += gross;
    ytdTaxWithheld += Number(ps.withholdingTax);

    if (taxOnFullEarnings) {
      // Full Earnings mode: taxable = grossPay - statutory deductions
      ytdTaxable += Math.max(0, gross - sss - phil - pag);
    } else if (declaredWageOverride && declaredWageType) {
      // Basic Pay Only + override: use declared wage as tax base
      ytdTaxable += Math.max(0, overridePerPeriod - sss - phil - pag);
    } else {
      // Basic Pay Only + no override: use actual basic pay from line items
      const basicPay = ps.lines
        .filter((l) => l.category === "BASIC_PAY")
        .reduce((sum, l) => sum + Number(l.amount), 0);
      const lateUt = ps.lines
        .filter((l) => l.category === "LATE_UT_DEDUCTION")
        .reduce((sum, l) => sum + Number(l.amount), 0);
      ytdTaxable += Math.max(0, basicPay - lateUt - sss - phil - pag);
    }
  }

  return { grossPay: ytdGrossPay, taxableIncome: ytdTaxable, taxWithheld: ytdTaxWithheld };
}
