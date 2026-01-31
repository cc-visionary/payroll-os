"use server";

// =============================================================================
// PeopleOS PH - Payroll Server Actions
// =============================================================================
// Server actions for payroll operations with RBAC and audit logging.
// Implements the full payroll run lifecycle:
// DRAFT -> COMPUTING -> REVIEW -> APPROVED -> RELEASED
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth";
import { headers } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import type { PayrollRunStatus, PayslipLineCategory } from "@/app/generated/prisma";
import { calculateDerivedRates, type DerivedRates, type PayProfileInput } from "@/lib/payroll";
import {
  setManilaHours,
  calculateAttendanceTimes,
  extractTimeComponents,
} from "@/lib/utils/timezone";

const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/documents";

/**
 * Create a new payroll run (draft).
 * Permission: payroll:run
 */
export async function createPayrollRun(payPeriodId: string) {
  const auth = await assertPermission(Permission.PAYROLL_RUN);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Verify pay period exists
  const payPeriod = await prisma.payPeriod.findUnique({
    where: { id: payPeriodId },
    include: { calendar: true },
  });

  if (!payPeriod) {
    return { success: false, error: "Pay period not found" };
  }

  // Check for existing payroll run for this period
  const existingRun = await prisma.payrollRun.findFirst({
    where: {
      payPeriodId,
      status: { notIn: ["CANCELLED"] },
    },
  });

  if (existingRun) {
    return {
      success: false,
      error: "A payroll run already exists for this period",
      existingRunId: existingRun.id,
    };
  }

  try {
    const payrollRun = await prisma.payrollRun.create({
      data: {
        payPeriodId,
        status: "DRAFT",
        createdById: auth.user.id,
      },
    });

    await audit.create("PayrollRun", payrollRun.id, {
      payPeriodId,
      payPeriodCode: payPeriod.code,
      startDate: payPeriod.startDate,
      endDate: payPeriod.endDate,
    });

    revalidatePath("/payroll");

    return {
      success: true,
      payrollRunId: payrollRun.id,
      message: "Payroll run created in draft status",
    };
  } catch (error) {
    console.error("Failed to create payroll run:", error);
    return { success: false, error: "Failed to create payroll run" };
  }
}

/**
 * Compute payroll for a run.
 * This function:
 * 1. Gets all active employees with pay profiles
 * 2. Creates payslips for each employee
 * 3. Calculates basic pay, statutory deductions, and net pay
 * Permission: payroll:run
 */
export async function computePayroll(payrollRunId: string) {
  const auth = await assertPermission(Permission.PAYROLL_RUN);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const payrollRun = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
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

  try {
    // Update status to computing
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "COMPUTING" },
    });

    // Log the computation start
    await audit.update(
      "PayrollRun",
      payrollRunId,
      { status: payrollRun.status },
      { status: "COMPUTING" },
      "Started payroll computation"
    );

    // Get company ID from the payroll calendar
    const companyId = payrollRun.payPeriod.calendar.companyId;

    // Get all active employees with role scorecards (which contain salary info)
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        employmentStatus: "ACTIVE",
        // Must have been hired before or on the pay period end date
        hireDate: { lte: payrollRun.payPeriod.endDate },
        // Must have a role scorecard with salary info
        roleScorecardId: { not: null },
      },
      include: {
        roleScorecard: true,
        department: { select: { name: true } },
      },
    });

    // Filter to only employees with role scorecards that have salary defined
    const employeesWithPay = employees.filter((e) => e.roleScorecard?.baseSalary);

    // Delete existing payslips for this run (in case of re-computation)
    await prisma.payslip.deleteMany({
      where: { payrollRunId },
    });

    // Calculate pay period factor (semi-monthly = 2 periods per month)
    const payFrequency = payrollRun.payPeriod.calendar.payFrequency;
    const periodsPerMonth = payFrequency === "SEMI_MONTHLY" ? 2 : payFrequency === "WEEKLY" ? 4 : 1;

    // Create payslips for each employee
    const payslipPromises = employeesWithPay.map(async (employee) => {
      const roleScorecard = employee.roleScorecard!;
      const monthlyRate = Number(roleScorecard.baseSalary);

      // Calculate basic pay for this period
      // For semi-monthly: divide monthly rate by 2
      // For daily wage: multiply by working days
      let basicPay: number;
      if (roleScorecard.wageType === "MONTHLY") {
        basicPay = monthlyRate / periodsPerMonth;
      } else {
        // Daily rate - use standard work days per month / periods per month
        // Default to 26 work days per month if not specified
        const workDaysPerPeriod = 26 / periodsPerMonth;
        basicPay = monthlyRate * workDaysPerPeriod;
      }

      // Allowances are no longer stored in PayProfile
      // They would need to come from a separate allowance configuration
      // For now, we set them to 0 - allowances should be configured separately
      const totalAllowances = 0;

      const grossPay = basicPay + totalAllowances;

      // Calculate statutory deductions (simplified - actual rates should come from rules)
      // Calculate statutory deductions for all regular employees
      // (Benefits eligibility is now assumed for all employees with role scorecards)
      let sssEe = 0, sssEr = 0;
      let philhealthEe = 0, philhealthEr = 0;
      let pagibigEe = 0, pagibigEr = 0;
      let withholdingTax = 0;

      // SSS (simplified: ~4.5% EE, ~9.5% ER of monthly salary credit)
      const monthlyCredit = Math.min(monthlyRate, 30000); // Max MSC
      sssEe = Math.round((monthlyCredit * 0.045) / periodsPerMonth * 100) / 100;
      sssEr = Math.round((monthlyCredit * 0.095) / periodsPerMonth * 100) / 100;

      // PhilHealth (5% total, split 50/50)
      const philhealthBase = Math.min(Math.max(monthlyRate, 10000), 100000);
      philhealthEe = Math.round((philhealthBase * 0.025) / periodsPerMonth * 100) / 100;
      philhealthEr = philhealthEe;

      // Pag-IBIG (2% EE, 2% ER, max ₱100 each)
      pagibigEe = Math.min(Math.round((monthlyRate * 0.02) / periodsPerMonth * 100) / 100, 100 / periodsPerMonth);
      pagibigEr = pagibigEe;

      // Withholding tax (simplified progressive - actual should use BIR table)
      const annualTaxable = (grossPay - sssEe - philhealthEe - pagibigEe) * periodsPerMonth * 12;
      let annualTax = 0;
      if (annualTaxable > 8000000) {
        annualTax = 2202500 + (annualTaxable - 8000000) * 0.35;
      } else if (annualTaxable > 2000000) {
        annualTax = 402500 + (annualTaxable - 2000000) * 0.30;
      } else if (annualTaxable > 800000) {
        annualTax = 102500 + (annualTaxable - 800000) * 0.25;
      } else if (annualTaxable > 400000) {
        annualTax = 22500 + (annualTaxable - 400000) * 0.20;
      } else if (annualTaxable > 250000) {
        annualTax = (annualTaxable - 250000) * 0.15;
      }
      withholdingTax = Math.round(annualTax / 12 / periodsPerMonth * 100) / 100;

      const totalDeductions = sssEe + philhealthEe + pagibigEe + withholdingTax;
      const netPay = grossPay - totalDeductions;

      // Create payslip with lines
      const payslip = await prisma.payslip.create({
        data: {
          payrollRunId,
          employeeId: employee.id,
          grossPay,
          totalEarnings: grossPay,
          totalDeductions,
          netPay,
          sssEe,
          sssEr,
          philhealthEe,
          philhealthEr,
          pagibigEe,
          pagibigEr,
          withholdingTax,
          ytdGrossPay: grossPay, // TODO: Calculate actual YTD
          ytdTaxableIncome: grossPay - sssEe - philhealthEe - pagibigEe,
          ytdTaxWithheld: withholdingTax,
          payProfileSnapshot: {
            roleScorecardId: roleScorecard.id,
            wageType: roleScorecard.wageType,
            baseRate: Number(roleScorecard.baseSalary),
            payFrequency: payFrequency,
          },
          lines: {
            create: [
              // Earnings
              {
                category: "BASIC_PAY",
                description: "Basic Pay",
                amount: basicPay,
                sortOrder: 1,
              },
              // Deductions
              ...(sssEe > 0 ? [{
                category: "SSS_EE" as const,
                description: "SSS Contribution (EE)",
                amount: -sssEe,
                sortOrder: 50,
              }] : []),
              ...(philhealthEe > 0 ? [{
                category: "PHILHEALTH_EE" as const,
                description: "PhilHealth Contribution (EE)",
                amount: -philhealthEe,
                sortOrder: 51,
              }] : []),
              ...(pagibigEe > 0 ? [{
                category: "PAGIBIG_EE" as const,
                description: "Pag-IBIG Contribution (EE)",
                amount: -pagibigEe,
                sortOrder: 52,
              }] : []),
              ...(withholdingTax > 0 ? [{
                category: "TAX_WITHHOLDING" as const,
                description: "Withholding Tax",
                amount: -withholdingTax,
                sortOrder: 60,
              }] : []),
            ],
          },
        },
      });

      return payslip;
    });

    const payslips = await Promise.all(payslipPromises);

    // Update payroll run to REVIEW status
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "REVIEW" },
    });

    await audit.update(
      "PayrollRun",
      payrollRunId,
      { status: "COMPUTING" },
      { status: "REVIEW", employeeCount: payslips.length },
      `Computed payroll for ${payslips.length} employees`
    );

    revalidatePath(`/payroll/${payrollRunId}`);

    return {
      success: true,
      message: `Payroll computed for ${payslips.length} employees`,
      employeeCount: payslips.length,
    };
  } catch (error) {
    console.error("Failed to compute payroll:", error);

    // Reset status back to DRAFT on error
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: "DRAFT" },
    });

    return { success: false, error: "Failed to compute payroll" };
  }
}

/**
 * Approve a payroll run.
 * Permission: payroll:approve
 */
export async function approvePayroll(payrollRunId: string) {
  const auth = await assertPermission(Permission.PAYROLL_APPROVE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const payrollRun = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      payPeriod: true,
      _count: { select: { payslips: true } },
    },
  });

  if (!payrollRun) {
    return { success: false, error: "Payroll run not found" };
  }

  if (payrollRun.status !== "REVIEW") {
    return {
      success: false,
      error: "Payroll must be in REVIEW status to approve",
    };
  }

  // Cannot approve own payroll run (unless SUPER_ADMIN)
  const isSuperAdmin = auth.user.roles.includes("SUPER_ADMIN");
  if (payrollRun.createdById === auth.user.id && !isSuperAdmin) {
    return {
      success: false,
      error: "Cannot approve your own payroll run",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update payroll run status
      await tx.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: "APPROVED",
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });

      // Lock all attendance records for this period
      await tx.attendanceDayRecord.updateMany({
        where: {
          employeeId: {
            in: await tx.payslip
              .findMany({
                where: { payrollRunId },
                select: { employeeId: true },
              })
              .then((p) => p.map((x) => x.employeeId)),
          },
          attendanceDate: {
            gte: payrollRun.payPeriod.startDate,
            lte: payrollRun.payPeriod.endDate,
          },
        },
        data: {
          isLocked: true,
          lockedByPayrollRunId: payrollRunId,
          lockedAt: new Date(),
        },
      });
    });

    await audit.approve("PayrollRun", payrollRunId, {
      payPeriodCode: payrollRun.payPeriod.code,
      totalGrossPay: payrollRun.totalGrossPay,
      totalNetPay: payrollRun.totalNetPay,
      employeeCount: payrollRun.employeeCount,
      payslipCount: payrollRun._count.payslips,
    });

    // Auto-generate payslip PDFs upon approval
    try {
      const { generatePayslipsInternal } = await import("@/app/actions/documents");
      await generatePayslipsInternal(payrollRunId, auth.user.id);
    } catch (pdfError) {
      console.error("Failed to auto-generate payslips (non-blocking):", pdfError);
      // Don't fail the approval - PDFs can be regenerated manually
    }

    revalidatePath(`/payroll/${payrollRunId}`);
    revalidatePath("/payroll");

    return {
      success: true,
      message: "Payroll approved successfully",
    };
  } catch (error) {
    console.error("Failed to approve payroll:", error);
    return { success: false, error: "Failed to approve payroll" };
  }
}

/**
 * Release payroll (mark as disbursed).
 * Permission: payroll:release
 */
export async function releasePayroll(payrollRunId: string) {
  const auth = await assertPermission(Permission.PAYROLL_RELEASE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const payrollRun = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: { payPeriod: true },
  });

  if (!payrollRun) {
    return { success: false, error: "Payroll run not found" };
  }

  if (payrollRun.status !== "APPROVED") {
    return {
      success: false,
      error: "Payroll must be APPROVED to release",
    };
  }

  try {
    await prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: "RELEASED",
        releasedAt: new Date(),
      },
    });

    await audit.update(
      "PayrollRun",
      payrollRunId,
      { status: "APPROVED" },
      { status: "RELEASED", releasedAt: new Date() },
      "Payroll released for disbursement"
    );

    revalidatePath(`/payroll/${payrollRunId}`);
    revalidatePath("/payroll");

    return {
      success: true,
      message: "Payroll released for disbursement",
    };
  } catch (error) {
    console.error("Failed to release payroll:", error);
    return { success: false, error: "Failed to release payroll" };
  }
}

/**
 * Export bank disbursement file.
 * Permission: export:bank_file
 */
export async function exportBankFile(payrollRunId: string) {
  const auth = await assertPermission(Permission.EXPORT_BANK_FILE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const payrollRun = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: {
      payPeriod: true,
      payslips: {
        include: {
          employee: {
            include: {
              bankAccounts: {
                where: { isPrimary: true, deletedAt: null },
              },
            },
          },
        },
      },
    },
  });

  if (!payrollRun) {
    return { success: false, error: "Payroll run not found" };
  }

  if (!["APPROVED", "RELEASED"].includes(payrollRun.status)) {
    return {
      success: false,
      error: "Payroll must be approved to export bank file",
    };
  }

  try {
    const fileName = `PAYROLL_${payrollRun.payPeriod.code}_${Date.now()}.txt`;
    const relativePath = `exports/bank/${fileName}`;
    const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

    // Generate the Metrobank fixed-width bank file
    const fileContent = generateMetrobankFile(
      payrollRun.payslips.map(ps => ({
        accountNumber: ps.employee.bankAccounts[0]?.accountNumber || "",
        accountName: ps.employee.bankAccounts[0]?.accountName ||
          `${ps.employee.lastName}, ${ps.employee.firstName}`,
        amount: typeof ps.netPay === "object" && "toNumber" in ps.netPay
          ? (ps.netPay as { toNumber: () => number }).toNumber()
          : Number(ps.netPay),
        employeeNumber: ps.employee.employeeNumber,
      })),
      payrollRun.payPeriod.code
    );

    // Calculate checksum
    const checksum = createHash("sha256").update(fileContent).digest("hex");

    // Ensure directory exists
    await mkdir(dirname(absolutePath), { recursive: true });

    // Write file
    await writeFile(absolutePath, fileContent, "utf-8");

    // Create bank file record
    const bankFile = await prisma.bankFile.create({
      data: {
        payrollRunId,
        bankCode: "MBTC", // Metrobank
        fileName,
        filePath: relativePath,
        fileFormat: "METROBANK_FIXED",
        recordCount: payrollRun.payslips.length,
        totalAmount: payrollRun.totalNetPay,
        checksum,
      },
    });

    await audit.export("BankFile", {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      bankFileId: bankFile.id,
      fileName,
      recordCount: payrollRun.payslips.length,
      totalAmount: payrollRun.totalNetPay.toString(),
    });

    return {
      success: true,
      bankFileId: bankFile.id,
      fileName,
      downloadUrl: `/api/exports/bank/${bankFile.id}`,
    };
  } catch (error) {
    console.error("Failed to export bank file:", error);
    return { success: false, error: "Failed to generate bank file" };
  }
}

/**
 * Generate a Metrobank-format fixed-width bank file.
 * This is a simplified format for demonstration - actual Metrobank specs may vary.
 *
 * Format (per line, 120 characters total):
 * - Record Type (1 char): D for detail
 * - Account Number (16 chars, right-padded)
 * - Account Name (40 chars, right-padded)
 * - Amount (15 chars, right-aligned, 2 decimal places without decimal point)
 * - Reference (20 chars, right-padded) - employee number
 * - Filler (28 chars, spaces)
 */
function generateMetrobankFile(
  records: Array<{
    accountNumber: string;
    accountName: string;
    amount: number;
    employeeNumber: string;
  }>,
  batchReference: string
): string {
  const lines: string[] = [];
  let totalAmount = 0;
  let recordCount = 0;

  // Header record
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const headerLine = [
    "H", // Record type
    batchReference.padEnd(20, " ").slice(0, 20), // Batch reference
    dateStr, // Date YYYYMMDD
    "PAYROLL".padEnd(10, " "), // Transaction type
    " ".repeat(81), // Filler
  ].join("");
  lines.push(headerLine);

  // Detail records
  for (const record of records) {
    if (!record.accountNumber) {
      // Skip employees without bank accounts
      continue;
    }

    const amountCents = Math.round(record.amount * 100);
    const amountStr = amountCents.toString().padStart(15, "0");

    const detailLine = [
      "D", // Record type
      record.accountNumber.padEnd(16, " ").slice(0, 16), // Account number
      record.accountName.toUpperCase().padEnd(40, " ").slice(0, 40), // Account name
      amountStr, // Amount (in centavos)
      record.employeeNumber.padEnd(20, " ").slice(0, 20), // Reference
      " ".repeat(28), // Filler
    ].join("");

    lines.push(detailLine);
    totalAmount += record.amount;
    recordCount++;
  }

  // Trailer record
  const totalAmountCents = Math.round(totalAmount * 100);
  const trailerLine = [
    "T", // Record type
    recordCount.toString().padStart(10, "0"), // Record count
    totalAmountCents.toString().padStart(17, "0"), // Total amount
    " ".repeat(92), // Filler
  ].join("");
  lines.push(trailerLine);

  return lines.join("\r\n");
}

// =============================================================================
// Payroll Run Listing & Details
// =============================================================================

export interface PayrollRunListItem {
  id: string;
  payPeriodId: string;
  payPeriodCode: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  status: PayrollRunStatus;
  totalGrossPay: number;
  totalNetPay: number;
  employeeCount: number;
  payslipCount: number;
  createdAt: Date;
  createdBy: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  releasedAt: Date | null;
}

/**
 * Get list of payroll runs with optional filters.
 * Permission: payroll:view
 */
export async function getPayrollRuns(filters?: {
  status?: PayrollRunStatus | PayrollRunStatus[];
  year?: number;
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; runs?: PayrollRunListItem[]; total?: number; error?: string }> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Build where clause
    const where: any = {
      payPeriod: {
        calendar: { companyId: auth.user.companyId },
      },
    };

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters?.year) {
      where.payPeriod = {
        ...where.payPeriod,
        payDate: {
          gte: new Date(`${filters.year}-01-01`),
          lt: new Date(`${filters.year + 1}-01-01`),
        },
      };
    }

    const [runs, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        include: {
          payPeriod: true,
          createdBy: { select: { email: true } },
          approvedBy: { select: { email: true } },
        },
        orderBy: [
          { payPeriod: { startDate: "desc" } },
          { createdAt: "desc" },
        ],
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      prisma.payrollRun.count({ where }),
    ]);

    return {
      success: true,
      runs: runs.map((run) => ({
        id: run.id,
        payPeriodId: run.payPeriodId,
        payPeriodCode: run.payPeriod.code,
        startDate: run.payPeriod.startDate,
        endDate: run.payPeriod.endDate,
        payDate: run.payPeriod.payDate,
        status: run.status,
        totalGrossPay: Number(run.totalGrossPay),
        totalNetPay: Number(run.totalNetPay),
        employeeCount: run.employeeCount,
        payslipCount: run.payslipCount,
        createdAt: run.createdAt,
        createdBy: run.createdBy?.email || null,
        approvedAt: run.approvedAt,
        approvedBy: run.approvedBy?.email || null,
        releasedAt: run.releasedAt,
      })),
      total,
    };
  } catch (error) {
    console.error("Failed to get payroll runs:", error);
    return { success: false, error: "Failed to get payroll runs" };
  }
}

export interface PayrollRunDetail {
  id: string;
  status: PayrollRunStatus;
  payPeriod: {
    id: string;
    code: string;
    startDate: Date;
    endDate: Date;
    cutoffDate: Date;
    payDate: Date;
    periodNumber: number;
  };
  totals: {
    grossPay: number;
    deductions: number;
    netPay: number;
    employeeCount: number;
    payslipCount: number;
  };
  statutory: {
    totalSssEe: number;
    totalSssEr: number;
    totalPhilhealthEe: number;
    totalPhilhealthEr: number;
    totalPagibigEe: number;
    totalPagibigEr: number;
    totalWithholdingTax: number;
  };
  workflow: {
    createdAt: Date;
    createdBy: string | null;
    approvedAt: Date | null;
    approvedBy: string | null;
    releasedAt: Date | null;
  };
  remarks: string | null;
  canEdit: boolean;
  canApprove: boolean;
  canRelease: boolean;
  isCreator: boolean;  // True if current user created this payroll run
}

/**
 * Get detailed payroll run information.
 * Permission: payroll:view
 */
export async function getPayrollRunDetail(payrollRunId: string): Promise<{
  success: boolean;
  detail?: PayrollRunDetail;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: true,
        createdBy: { select: { email: true } },
        approvedBy: { select: { email: true } },
        payslips: {
          select: {
            sssEe: true,
            sssEr: true,
            philhealthEe: true,
            philhealthEr: true,
            pagibigEe: true,
            pagibigEr: true,
            withholdingTax: true,
          },
        },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    // Calculate statutory totals
    const statutory = payrollRun.payslips.reduce(
      (acc, ps) => ({
        totalSssEe: acc.totalSssEe + Number(ps.sssEe),
        totalSssEr: acc.totalSssEr + Number(ps.sssEr),
        totalPhilhealthEe: acc.totalPhilhealthEe + Number(ps.philhealthEe),
        totalPhilhealthEr: acc.totalPhilhealthEr + Number(ps.philhealthEr),
        totalPagibigEe: acc.totalPagibigEe + Number(ps.pagibigEe),
        totalPagibigEr: acc.totalPagibigEr + Number(ps.pagibigEr),
        totalWithholdingTax: acc.totalWithholdingTax + Number(ps.withholdingTax),
      }),
      {
        totalSssEe: 0,
        totalSssEr: 0,
        totalPhilhealthEe: 0,
        totalPhilhealthEr: 0,
        totalPagibigEe: 0,
        totalPagibigEr: 0,
        totalWithholdingTax: 0,
      }
    );

    // Check permissions for workflow actions
    const canEdit =
      ["DRAFT", "REVIEW"].includes(payrollRun.status) &&
      auth.hasPermission(Permission.PAYROLL_EDIT);

    // Self-approval is blocked unless user is SUPER_ADMIN
    const isSuperAdmin = auth.user.roles.includes("SUPER_ADMIN");
    const isCreator = payrollRun.createdById === auth.user.id;
    const canApprove =
      payrollRun.status === "REVIEW" &&
      auth.hasPermission(Permission.PAYROLL_APPROVE) &&
      (!isCreator || isSuperAdmin);  // SUPER_ADMIN can self-approve

    const canRelease =
      payrollRun.status === "APPROVED" &&
      auth.hasPermission(Permission.PAYROLL_RELEASE);

    return {
      success: true,
      detail: {
        id: payrollRun.id,
        status: payrollRun.status,
        payPeriod: {
          id: payrollRun.payPeriod.id,
          code: payrollRun.payPeriod.code,
          startDate: payrollRun.payPeriod.startDate,
          endDate: payrollRun.payPeriod.endDate,
          cutoffDate: payrollRun.payPeriod.cutoffDate,
          payDate: payrollRun.payPeriod.payDate,
          periodNumber: payrollRun.payPeriod.periodNumber,
        },
        totals: {
          grossPay: Number(payrollRun.totalGrossPay),
          deductions: Number(payrollRun.totalDeductions),
          netPay: Number(payrollRun.totalNetPay),
          employeeCount: payrollRun.employeeCount,
          payslipCount: payrollRun.payslipCount,
        },
        statutory,
        workflow: {
          createdAt: payrollRun.createdAt,
          createdBy: payrollRun.createdBy?.email || null,
          approvedAt: payrollRun.approvedAt,
          approvedBy: payrollRun.approvedBy?.email || null,
          releasedAt: payrollRun.releasedAt,
        },
        remarks: payrollRun.remarks,
        canEdit,
        canApprove,
        canRelease,
        isCreator,
      },
    };
  } catch (error) {
    console.error("Failed to get payroll run detail:", error);
    return { success: false, error: "Failed to get payroll run detail" };
  }
}

// =============================================================================
// Payslip Listing for Payroll Run
// =============================================================================

export interface PayslipListItem {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department: string | null;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  sssEe: number;
  philhealthEe: number;
  pagibigEe: number;
  withholdingTax: number;
}

/**
 * Get payslips for a payroll run.
 * Permission: payslip:view_all
 */
export async function getPayrollRunPayslips(
  payrollRunId: string,
  options?: {
    search?: string;
    departmentId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  success: boolean;
  payslips?: PayslipListItem[];
  total?: number;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Build where clause
    const where: any = {
      payrollRunId,
      payrollRun: {
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
    };

    if (options?.search) {
      where.employee = {
        OR: [
          { firstName: { contains: options.search, mode: "insensitive" } },
          { lastName: { contains: options.search, mode: "insensitive" } },
          { employeeNumber: { contains: options.search, mode: "insensitive" } },
        ],
      };
    }

    if (options?.departmentId) {
      where.employee = {
        ...where.employee,
        departmentId: options.departmentId,
      };
    }

    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { employee: { lastName: "asc" } },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.payslip.count({ where }),
    ]);

    return {
      success: true,
      payslips: payslips.map((ps) => ({
        id: ps.id,
        employeeId: ps.employeeId,
        employeeNumber: ps.employee.employeeNumber,
        employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
        department: ps.employee.department?.name || null,
        grossPay: Number(ps.grossPay),
        totalDeductions: Number(ps.totalDeductions),
        netPay: Number(ps.netPay),
        sssEe: Number(ps.sssEe),
        philhealthEe: Number(ps.philhealthEe),
        pagibigEe: Number(ps.pagibigEe),
        withholdingTax: Number(ps.withholdingTax),
      })),
      total,
    };
  } catch (error) {
    console.error("Failed to get payslips:", error);
    return { success: false, error: "Failed to get payslips" };
  }
}

// =============================================================================
// Payroll Run Diff Comparison
// =============================================================================

export interface PayrollDiffSummary {
  previousRun: {
    id: string;
    payPeriodCode: string;
    startDate: Date;
    endDate: Date;
  } | null;
  changes: {
    newEmployees: number;
    removedEmployees: number;
    changedEmployees: number;
  };
  totals: {
    currentGrossPay: number;
    previousGrossPay: number;
    grossPayDiff: number;
    grossPayDiffPercent: number;
    currentNetPay: number;
    previousNetPay: number;
    netPayDiff: number;
    netPayDiffPercent: number;
  };
  flags: {
    hasLargeIncrease: boolean; // >10% increase from previous
    hasLargeDecrease: boolean; // >10% decrease from previous
    hasNewEmployees: boolean;
    hasRemovedEmployees: boolean;
    hasMissingAttendance: boolean;
  };
}

/**
 * Compare payroll run with previous period.
 * Permission: payroll:view
 */
export async function getPayrollRunDiff(payrollRunId: string): Promise<{
  success: boolean;
  diff?: PayrollDiffSummary;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Get current payroll run
    const currentRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: true,
        payslips: {
          select: {
            employeeId: true,
            grossPay: true,
            netPay: true,
          },
        },
      },
    });

    if (!currentRun) {
      return { success: false, error: "Payroll run not found" };
    }

    // Find previous released payroll run
    const previousRun = await prisma.payrollRun.findFirst({
      where: {
        status: "RELEASED",
        payPeriod: {
          calendar: { companyId: auth.user.companyId },
          endDate: { lt: currentRun.payPeriod.startDate },
        },
      },
      include: {
        payPeriod: true,
        payslips: {
          select: {
            employeeId: true,
            grossPay: true,
            netPay: true,
          },
        },
      },
      orderBy: { payPeriod: { endDate: "desc" } },
    });

    // Calculate differences
    const currentEmployees = new Set(currentRun.payslips.map((p) => p.employeeId));
    const previousEmployees = previousRun
      ? new Set(previousRun.payslips.map((p) => p.employeeId))
      : new Set<string>();

    const newEmployees = [...currentEmployees].filter(
      (id) => !previousEmployees.has(id)
    ).length;
    const removedEmployees = [...previousEmployees].filter(
      (id) => !currentEmployees.has(id)
    ).length;

    // Count employees with changed pay (>5% difference)
    let changedEmployees = 0;
    if (previousRun) {
      const previousPayMap = new Map(
        previousRun.payslips.map((p) => [p.employeeId, Number(p.grossPay)])
      );
      for (const ps of currentRun.payslips) {
        const prevPay = previousPayMap.get(ps.employeeId);
        if (prevPay !== undefined) {
          const diff = Math.abs(Number(ps.grossPay) - prevPay) / prevPay;
          if (diff > 0.05) changedEmployees++;
        }
      }
    }

    const currentGrossPay = Number(currentRun.totalGrossPay);
    const currentNetPay = Number(currentRun.totalNetPay);
    const previousGrossPay = previousRun ? Number(previousRun.totalGrossPay) : 0;
    const previousNetPay = previousRun ? Number(previousRun.totalNetPay) : 0;

    const grossPayDiff = currentGrossPay - previousGrossPay;
    const netPayDiff = currentNetPay - previousNetPay;
    const grossPayDiffPercent = previousGrossPay > 0
      ? (grossPayDiff / previousGrossPay) * 100
      : 0;
    const netPayDiffPercent = previousNetPay > 0
      ? (netPayDiff / previousNetPay) * 100
      : 0;

    // Check for missing attendance
    const employeesWithAttendance = await prisma.attendanceDayRecord.groupBy({
      by: ["employeeId"],
      where: {
        attendanceDate: {
          gte: currentRun.payPeriod.startDate,
          lte: currentRun.payPeriod.endDate,
        },
        employee: { companyId: auth.user.companyId },
      },
    });
    const employeesWithAttendanceSet = new Set(
      employeesWithAttendance.map((e) => e.employeeId)
    );
    const hasMissingAttendance = [...currentEmployees].some(
      (id) => !employeesWithAttendanceSet.has(id)
    );

    return {
      success: true,
      diff: {
        previousRun: previousRun
          ? {
              id: previousRun.id,
              payPeriodCode: previousRun.payPeriod.code,
              startDate: previousRun.payPeriod.startDate,
              endDate: previousRun.payPeriod.endDate,
            }
          : null,
        changes: {
          newEmployees,
          removedEmployees,
          changedEmployees,
        },
        totals: {
          currentGrossPay,
          previousGrossPay,
          grossPayDiff,
          grossPayDiffPercent: Math.round(grossPayDiffPercent * 100) / 100,
          currentNetPay,
          previousNetPay,
          netPayDiff,
          netPayDiffPercent: Math.round(netPayDiffPercent * 100) / 100,
        },
        flags: {
          hasLargeIncrease: grossPayDiffPercent > 10,
          hasLargeDecrease: grossPayDiffPercent < -10,
          hasNewEmployees: newEmployees > 0,
          hasRemovedEmployees: removedEmployees > 0,
          hasMissingAttendance,
        },
      },
    };
  } catch (error) {
    console.error("Failed to get payroll diff:", error);
    return { success: false, error: "Failed to get payroll diff" };
  }
}

// =============================================================================
// Employee Payslip Diff
// =============================================================================

export interface EmployeePayslipDiff {
  employeeId: string;
  employeeName: string;
  current: {
    grossPay: number;
    netPay: number;
    basicPay: number;
    overtime: number;
    deductions: number;
  };
  previous: {
    grossPay: number;
    netPay: number;
    basicPay: number;
    overtime: number;
    deductions: number;
  } | null;
  diff: {
    grossPayDiff: number;
    grossPayDiffPercent: number;
    netPayDiff: number;
    netPayDiffPercent: number;
  };
  flags: string[];
}

/**
 * Get detailed employee-level comparison.
 * Permission: payroll:view
 */
export async function getEmployeePayslipDiffs(
  payrollRunId: string,
  options?: { onlyChanged?: boolean; limit?: number; offset?: number }
): Promise<{
  success: boolean;
  diffs?: EmployeePayslipDiff[];
  total?: number;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    const currentRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: true,
        payslips: {
          include: {
            employee: {
              select: { firstName: true, lastName: true },
            },
            lines: {
              select: { category: true, amount: true },
            },
          },
        },
      },
    });

    if (!currentRun) {
      return { success: false, error: "Payroll run not found" };
    }

    // Find previous run
    const previousRun = await prisma.payrollRun.findFirst({
      where: {
        status: "RELEASED",
        payPeriod: {
          calendar: { companyId: auth.user.companyId },
          endDate: { lt: currentRun.payPeriod.startDate },
        },
      },
      include: {
        payslips: {
          include: {
            lines: {
              select: { category: true, amount: true },
            },
          },
        },
      },
      orderBy: { payPeriod: { endDate: "desc" } },
    });

    // Build previous payslip map
    const previousMap = new Map<
      string,
      {
        grossPay: number;
        netPay: number;
        basicPay: number;
        overtime: number;
        deductions: number;
      }
    >();

    if (previousRun) {
      for (const ps of previousRun.payslips) {
        const basicPay =
          ps.lines
            .filter((l) => l.category === "BASIC_PAY")
            .reduce((sum, l) => sum + Number(l.amount), 0);
        const overtime =
          ps.lines
            .filter((l) =>
              ["OVERTIME_REGULAR", "OVERTIME_REST_DAY", "OVERTIME_HOLIDAY"].includes(
                l.category
              )
            )
            .reduce((sum, l) => sum + Number(l.amount), 0);
        const deductions =
          ps.lines
            .filter((l) =>
              [
                "LATE_DEDUCTION",
                "UNDERTIME_DEDUCTION",
                "ABSENT_DEDUCTION",
                "SSS_EE",
                "PHILHEALTH_EE",
                "PAGIBIG_EE",
                "TAX_WITHHOLDING",
              ].includes(l.category)
            )
            .reduce((sum, l) => sum + Number(l.amount), 0);

        previousMap.set(ps.employeeId, {
          grossPay: Number(ps.grossPay),
          netPay: Number(ps.netPay),
          basicPay,
          overtime,
          deductions,
        });
      }
    }

    // Calculate diffs
    let diffs: EmployeePayslipDiff[] = currentRun.payslips.map((ps) => {
      const basicPay =
        ps.lines
          .filter((l) => l.category === "BASIC_PAY")
          .reduce((sum, l) => sum + Number(l.amount), 0);
      const overtime =
        ps.lines
          .filter((l) =>
            ["OVERTIME_REGULAR", "OVERTIME_REST_DAY", "OVERTIME_HOLIDAY"].includes(
              l.category
            )
          )
          .reduce((sum, l) => sum + Number(l.amount), 0);
      const deductions =
        ps.lines
          .filter((l) =>
            [
              "LATE_DEDUCTION",
              "UNDERTIME_DEDUCTION",
              "ABSENT_DEDUCTION",
              "SSS_EE",
              "PHILHEALTH_EE",
              "PAGIBIG_EE",
              "TAX_WITHHOLDING",
            ].includes(l.category)
          )
          .reduce((sum, l) => sum + Number(l.amount), 0);

      const current = {
        grossPay: Number(ps.grossPay),
        netPay: Number(ps.netPay),
        basicPay,
        overtime,
        deductions,
      };

      const previous = previousMap.get(ps.employeeId) || null;

      const grossPayDiff = previous ? current.grossPay - previous.grossPay : 0;
      const netPayDiff = previous ? current.netPay - previous.netPay : 0;
      const grossPayDiffPercent =
        previous && previous.grossPay > 0
          ? Math.round((grossPayDiff / previous.grossPay) * 10000) / 100
          : 0;
      const netPayDiffPercent =
        previous && previous.netPay > 0
          ? Math.round((netPayDiff / previous.netPay) * 10000) / 100
          : 0;

      // Generate flags
      const flags: string[] = [];
      if (!previous) flags.push("NEW");
      if (Math.abs(grossPayDiffPercent) > 20) flags.push("LARGE_CHANGE");
      if (grossPayDiff < 0) flags.push("DECREASED");
      if (overtime > basicPay * 0.5) flags.push("HIGH_OT");

      return {
        employeeId: ps.employeeId,
        employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
        current,
        previous,
        diff: {
          grossPayDiff,
          grossPayDiffPercent,
          netPayDiff,
          netPayDiffPercent,
        },
        flags,
      };
    });

    // Filter if only changed
    if (options?.onlyChanged) {
      diffs = diffs.filter(
        (d) => d.flags.length > 0 || Math.abs(d.diff.grossPayDiffPercent) > 5
      );
    }

    const total = diffs.length;

    // Apply pagination
    if (options?.limit) {
      const offset = options.offset || 0;
      diffs = diffs.slice(offset, offset + options.limit);
    }

    return { success: true, diffs, total };
  } catch (error) {
    console.error("Failed to get employee diffs:", error);
    return { success: false, error: "Failed to get employee diffs" };
  }
}

// =============================================================================
// Preview Employees for Payroll Run
// =============================================================================

export interface PayrollEmployeePreview {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  attendanceDays: number;
}

/**
 * Get employees for payroll preview.
 * Shows all active employees with their attendance count in the date range.
 * Permission: payroll:view
 */
export async function getPayrollEmployeePreview(
  startDate: string,
  endDate: string
): Promise<{
  success: boolean;
  employees?: PayrollEmployeePreview[];
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return { success: false, error: "End date must be after start date" };
    }

    // Get ALL active employees (not just those with attendance)
    // This allows including employees who may not have clocked in yet
    const employees = await prisma.employee.findMany({
      where: {
        companyId: auth.user.companyId,
        employmentStatus: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        // Count attendance records for the date range
        attendanceRecords: {
          where: {
            attendanceDate: {
              gte: start,
              lte: end,
            },
          },
          select: { attendanceDate: true },
        },
      },
      orderBy: { lastName: "asc" },
    });

    return {
      success: true,
      employees: employees.map((emp) => ({
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        attendanceDays: emp.attendanceRecords.length,
      })),
    };
  } catch (error) {
    console.error("Failed to get payroll employee preview:", error);
    return { success: false, error: "Failed to get employee preview" };
  }
}

// =============================================================================
// Create Payroll Run with Selected Employees
// =============================================================================

/**
 * Create a payroll run with specific employees.
 * Creates pay period, payroll run, and computes payslips for selected employees.
 * Permission: payroll:run
 */
export async function createPayrollRunWithEmployees(data: {
  startDate: string;
  endDate: string;
  payDate: string;
  payFrequency: "WEEKLY" | "SEMI_MONTHLY" | "MONTHLY";
  employeeIds: string[];
}): Promise<{
  success: boolean;
  payrollRunId?: string;
  employeeCount?: number;
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

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const payDate = new Date(data.payDate);

    if (endDate < startDate) {
      return { success: false, error: "End date must be after start date" };
    }

    if (data.employeeIds.length === 0) {
      return { success: false, error: "Please select at least one employee" };
    }

    const year = startDate.getFullYear();

    // Find or create calendar for this year with the selected pay frequency
    let calendar = await prisma.payrollCalendar.findFirst({
      where: {
        companyId: auth.user.companyId,
        year,
        payFrequency: data.payFrequency,
      },
    });

    if (!calendar) {
      calendar = await prisma.payrollCalendar.create({
        data: {
          companyId: auth.user.companyId,
          year,
          payFrequency: data.payFrequency,
        },
      });
    }

    // Generate code from dates (format: YYYY-MM-DD - YYYY-MM-DD)
    const code = `${data.startDate} - ${data.endDate}`;

    // Check for duplicate code
    const existingPeriod = await prisma.payPeriod.findFirst({
      where: {
        calendarId: calendar.id,
        code,
      },
    });

    if (existingPeriod) {
      return { success: false, error: `A pay period for these dates already exists` };
    }

    // Get the next period number
    const lastPeriod = await prisma.payPeriod.findFirst({
      where: { calendarId: calendar.id },
      orderBy: { periodNumber: "desc" },
    });

    const periodNumber = (lastPeriod?.periodNumber || 0) + 1;

    // Create pay period, payroll run in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create pay period
      const payPeriod = await tx.payPeriod.create({
        data: {
          calendarId: calendar!.id,
          code,
          startDate,
          endDate,
          cutoffDate: endDate,
          payDate,
          periodNumber,
        },
      });

      // Create payroll run
      const payrollRun = await tx.payrollRun.create({
        data: {
          payPeriodId: payPeriod.id,
          status: "DRAFT",
          createdById: auth.user.id,
        },
      });

      return { payPeriod, payrollRun };
    });

    await audit.create("PayrollRun", result.payrollRun.id, {
      payPeriodCode: code,
      startDate: data.startDate,
      endDate: data.endDate,
      selectedEmployees: data.employeeIds.length,
    });

    // Now compute payroll for the selected employees
    const { computePayrollForEmployees } = await import("@/app/actions/payroll-compute");
    const computeResult = await computePayrollForEmployees(
      result.payrollRun.id,
      data.employeeIds
    );

    if (!computeResult.success) {
      // If computation fails, still return the run ID so user can retry
      return {
        success: true,
        payrollRunId: result.payrollRun.id,
        employeeCount: 0,
        error: computeResult.error,
      };
    }

    revalidatePath("/payroll");

    return {
      success: true,
      payrollRunId: result.payrollRun.id,
      employeeCount: computeResult.employeeCount,
    };
  } catch (error) {
    console.error("Failed to create payroll run:", error);
    return { success: false, error: "Failed to create payroll run" };
  }
}

// =============================================================================
// Delete Payroll Run
// =============================================================================

/**
 * Delete a payroll run and all its payslips.
 * Only allows deletion of DRAFT, REVIEW, or CANCELLED runs.
 * Permission: payroll:run
 */
export async function deletePayrollRun(payrollRunId: string): Promise<{
  success: boolean;
  deletedPayslips?: number;
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

    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: true,
        _count: { select: { payslips: true } },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Pay period not found" };
    }

    // Only allow deletion of non-finalized pay periods
    if (payrollRun.status === "APPROVED" || payrollRun.status === "RELEASED") {
      return {
        success: false,
        error: `Cannot delete ${payrollRun.status.toLowerCase()} pay periods. They contain finalized payroll data.`,
      };
    }

    const payslipCount = payrollRun._count.payslips;
    const payPeriodId = payrollRun.payPeriod.id;
    const payPeriodCode = payrollRun.payPeriod.code;

    // Delete the payroll run (cascade will delete payslips and lines)
    await prisma.payrollRun.delete({
      where: { id: payrollRunId },
    });

    // Also delete the associated pay period so the dates can be reused
    await prisma.payPeriod.delete({
      where: { id: payPeriodId },
    });

    await audit.delete("PayPeriod", payPeriodId, {
      payPeriodCode,
      status: payrollRun.status,
      deletedPayslips: payslipCount,
    });

    revalidatePath("/payroll");

    return {
      success: true,
      deletedPayslips: payslipCount,
    };
  } catch (error) {
    console.error("Failed to delete pay period:", error);
    return { success: false, error: "Failed to delete pay period" };
  }
}

// =============================================================================
// Cancel Pay Period
// =============================================================================

/**
 * Cancel a payroll run (only DRAFT or REVIEW status).
 * Permission: payroll:run
 */
export async function cancelPayrollRun(
  payrollRunId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await assertPermission(Permission.PAYROLL_RUN);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: { payPeriod: true },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["DRAFT", "REVIEW"].includes(payrollRun.status)) {
      return {
        success: false,
        error: `Cannot cancel payroll in ${payrollRun.status} status`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // Delete payslips (cascade will handle lines)
      await tx.payslip.deleteMany({ where: { payrollRunId } });

      // Update status
      await tx.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: "CANCELLED",
          remarks: reason || "Cancelled by user",
        },
      });
    });

    await audit.update(
      "PayrollRun",
      payrollRunId,
      { status: payrollRun.status },
      { status: "CANCELLED", remarks: reason },
      "Payroll run cancelled"
    );

    revalidatePath("/payroll");
    revalidatePath(`/payroll/${payrollRunId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to cancel payroll run:", error);
    return { success: false, error: "Failed to cancel payroll run" };
  }
}

// =============================================================================
// Get Pay Periods for Selection
// =============================================================================

export interface PayPeriodOption {
  id: string;
  code: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  periodNumber: number;
  hasPayrollRun: boolean;
  payrollRunStatus: PayrollRunStatus | null;
}

/**
 * Get available pay periods for creating new payroll runs.
 * Permission: payroll:view
 */
export async function getPayPeriodsForSelection(year?: number | "all"): Promise<{
  success: boolean;
  periods?: PayPeriodOption[];
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Build where clause - if "all", get all years
    const where: any = {
      calendar: { companyId: auth.user.companyId },
    };

    if (year && year !== "all") {
      where.calendar.year = year;
    }

    const periods = await prisma.payPeriod.findMany({
      where,
      include: {
        calendar: { select: { year: true } },
        payrollRuns: {
          where: { status: { not: "CANCELLED" } },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: [
        { calendar: { year: "desc" } },
        { startDate: "desc" },
      ],
    });

    return {
      success: true,
      periods: periods.map((p) => ({
        id: p.id,
        code: p.code,
        startDate: p.startDate,
        endDate: p.endDate,
        payDate: p.payDate,
        periodNumber: p.periodNumber,
        hasPayrollRun: p.payrollRuns.length > 0,
        payrollRunStatus: p.payrollRuns[0]?.status || null,
      })),
    };
  } catch (error) {
    console.error("Failed to get pay periods:", error);
    return { success: false, error: "Failed to get pay periods" };
  }
}

// =============================================================================
// Create Custom Pay Period
// =============================================================================

export interface CreateCustomPayPeriodData {
  code: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  cutoffDate: string; // ISO date string
  payDate: string; // ISO date string
}

/**
 * Create a custom (ad-hoc) pay period with user-defined dates.
 * Permission: payroll:run
 */
export async function createCustomPayPeriod(data: CreateCustomPayPeriodData): Promise<{
  success: boolean;
  payPeriodId?: string;
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

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const cutoffDate = new Date(data.cutoffDate);
    const payDate = new Date(data.payDate);

    if (endDate < startDate) {
      return { success: false, error: "End date must be after start date" };
    }

    if (cutoffDate > endDate) {
      return { success: false, error: "Cutoff date must be on or before end date" };
    }

    if (payDate < endDate) {
      return { success: false, error: "Pay date must be on or after end date" };
    }

    // Check for code uniqueness within the year
    const year = startDate.getFullYear();

    // Find or create calendar for this year
    let calendar = await prisma.payrollCalendar.findFirst({
      where: {
        companyId: auth.user.companyId,
        year,
      },
    });

    if (!calendar) {
      // Create calendar for this year
      calendar = await prisma.payrollCalendar.create({
        data: {
          companyId: auth.user.companyId,
          year,
          payFrequency: "SEMI_MONTHLY", // Default, but custom periods can vary
        },
      });
    }

    // Check for duplicate code
    const existingPeriod = await prisma.payPeriod.findFirst({
      where: {
        calendarId: calendar.id,
        code: data.code,
      },
    });

    if (existingPeriod) {
      return { success: false, error: `A pay period with code "${data.code}" already exists for ${year}` };
    }

    // Get the next period number
    const lastPeriod = await prisma.payPeriod.findFirst({
      where: { calendarId: calendar.id },
      orderBy: { periodNumber: "desc" },
    });

    const periodNumber = (lastPeriod?.periodNumber || 0) + 1;

    // Create the custom pay period
    const payPeriod = await prisma.payPeriod.create({
      data: {
        calendarId: calendar.id,
        code: data.code,
        startDate,
        endDate,
        cutoffDate,
        payDate,
        periodNumber,
      },
    });

    await audit.create("PayPeriod", payPeriod.id, {
      code: data.code,
      startDate: data.startDate,
      endDate: data.endDate,
      cutoffDate: data.cutoffDate,
      payDate: data.payDate,
      isCustom: true,
    });

    revalidatePath("/payroll");

    return {
      success: true,
      payPeriodId: payPeriod.id,
    };
  } catch (error) {
    console.error("Failed to create custom pay period:", error);
    return { success: false, error: "Failed to create custom pay period" };
  }
}

/**
 * Create a payroll run with custom dates (creates pay period + payroll run in one step).
 * Permission: payroll:run
 */
export async function createPayrollRunWithCustomDates(data: {
  code: string;
  startDate: string;
  endDate: string;
  cutoffDate: string;
  payDate: string;
}): Promise<{
  success: boolean;
  payrollRunId?: string;
  payPeriodId?: string;
  error?: string;
}> {
  // First create the custom pay period
  const periodResult = await createCustomPayPeriod(data);

  if (!periodResult.success || !periodResult.payPeriodId) {
    return { success: false, error: periodResult.error };
  }

  // Then create the payroll run
  const runResult = await createPayrollRun(periodResult.payPeriodId);

  if (!runResult.success) {
    return { success: false, error: runResult.error };
  }

  return {
    success: true,
    payrollRunId: runResult.payrollRunId,
    payPeriodId: periodResult.payPeriodId,
  };
}

// =============================================================================
// Delete Pay Period
// =============================================================================

/**
 * Delete a pay period and all associated payroll runs and payslips.
 * Permission: payroll:run
 *
 * WARNING: This is a destructive operation that cannot be undone.
 * It will delete:
 * - The pay period
 * - All payroll runs for that period
 * - All payslips for those payroll runs
 * - All payslip lines
 * - All related export artifacts and bank files
 */
export async function deletePayPeriod(payPeriodId: string): Promise<{
  success: boolean;
  deletedPayrollRuns?: number;
  deletedPayslips?: number;
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

    // Get the pay period with its calendar (to verify company ownership)
    const payPeriod = await prisma.payPeriod.findFirst({
      where: {
        id: payPeriodId,
        calendar: { companyId: auth.user.companyId },
      },
      include: {
        payrollRuns: {
          include: {
            _count: { select: { payslips: true } },
          },
        },
      },
    });

    if (!payPeriod) {
      return { success: false, error: "Pay period not found" };
    }

    // Check if any payroll run is in a protected state (APPROVED or RELEASED)
    const protectedRuns = payPeriod.payrollRuns.filter(
      (run) => run.status === "APPROVED" || run.status === "RELEASED"
    );

    if (protectedRuns.length > 0) {
      return {
        success: false,
        error: "Cannot delete pay period with approved or released payroll runs. Cancel the payroll runs first.",
      };
    }

    // Count what will be deleted
    const payrollRunCount = payPeriod.payrollRuns.length;
    const payslipCount = payPeriod.payrollRuns.reduce(
      (sum, run) => sum + run._count.payslips,
      0
    );

    // Delete the pay period (cascade will delete payroll runs, payslips, etc.)
    await prisma.payPeriod.delete({
      where: { id: payPeriodId },
    });

    await audit.delete("PayPeriod", payPeriodId, {
      code: payPeriod.code,
      startDate: payPeriod.startDate.toISOString(),
      endDate: payPeriod.endDate.toISOString(),
      deletedPayrollRuns: payrollRunCount,
      deletedPayslips: payslipCount,
    });

    revalidatePath("/payroll");

    return {
      success: true,
      deletedPayrollRuns: payrollRunCount,
      deletedPayslips: payslipCount,
    };
  } catch (error) {
    console.error("Failed to delete pay period:", error);
    return { success: false, error: "Failed to delete pay period" };
  }
}

// =============================================================================
// Export Payroll Register (CSV)
// =============================================================================

export interface PayrollRegisterRow {
  employeeNumber: string;
  employeeName: string;
  department: string;
  basicPay: number;
  overtime: number;
  nightDiff: number;
  holidayPay: number;
  allowances: number;
  grossPay: number;
  sssEe: number;
  philhealthEe: number;
  pagibigEe: number;
  withholdingTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

/**
 * Get payroll register data for export.
 * Permission: export:payroll_register
 */
export async function getPayrollRegister(payrollRunId: string): Promise<{
  success: boolean;
  payPeriodCode?: string;
  rows?: PayrollRegisterRow[];
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_PAYROLL_REGISTER);

    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: true,
        payslips: {
          include: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
            lines: true,
          },
          orderBy: { employee: { lastName: "asc" } },
        },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    if (!["APPROVED", "RELEASED"].includes(payrollRun.status)) {
      return {
        success: false,
        error: "Payroll must be approved to export register",
      };
    }

    const rows: PayrollRegisterRow[] = payrollRun.payslips.map((ps) => {
      const linesByCategory = ps.lines.reduce(
        (acc, line) => {
          acc[line.category] = (acc[line.category] || 0) + Number(line.amount);
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        employeeNumber: ps.employee.employeeNumber,
        employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
        department: ps.employee.department?.name || "",
        basicPay: linesByCategory["BASIC_PAY"] || 0,
        overtime:
          (linesByCategory["OVERTIME_REGULAR"] || 0) +
          (linesByCategory["OVERTIME_REST_DAY"] || 0) +
          (linesByCategory["OVERTIME_HOLIDAY"] || 0),
        nightDiff: linesByCategory["NIGHT_DIFFERENTIAL"] || 0,
        holidayPay:
          (linesByCategory["HOLIDAY_PAY"] || 0) +
          (linesByCategory["REST_DAY_PAY"] || 0),
        allowances: linesByCategory["ALLOWANCE"] || 0,
        grossPay: Number(ps.grossPay),
        sssEe: Number(ps.sssEe),
        philhealthEe: Number(ps.philhealthEe),
        pagibigEe: Number(ps.pagibigEe),
        withholdingTax: Number(ps.withholdingTax),
        otherDeductions:
          (linesByCategory["LATE_DEDUCTION"] || 0) +
          (linesByCategory["UNDERTIME_DEDUCTION"] || 0) +
          (linesByCategory["ABSENT_DEDUCTION"] || 0) +
          (linesByCategory["CASH_ADVANCE_DEDUCTION"] || 0) +
          (linesByCategory["LOAN_DEDUCTION"] || 0) +
          (linesByCategory["ADJUSTMENT_DEDUCT"] || 0) +
          (linesByCategory["OTHER_DEDUCTION"] || 0),
        totalDeductions: Number(ps.totalDeductions),
        netPay: Number(ps.netPay),
      };
    });

    return {
      success: true,
      payPeriodCode: payrollRun.payPeriod.code,
      rows,
    };
  } catch (error) {
    console.error("Failed to get payroll register:", error);
    return { success: false, error: "Failed to get payroll register" };
  }
}

// =============================================================================
// Payslip Detail View
// =============================================================================

export interface PayslipLineItem {
  id: string;
  category: string;
  description: string;
  quantity: number | null;
  rate: number | null;
  multiplier: number | null;
  amount: number;
  attendanceDate: Date | null;
  sortOrder: number;
}

export interface PayslipAttendanceRecord {
  id: string;
  date: Date;
  dayType: string;
  attendanceStatus: string;
  // Scheduled times from shift
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduledWorkMinutes: number | null;
  // Actual clock times
  actualTimeIn: Date | null;
  actualTimeOut: Date | null;
  // Computed values (workedMinutes = scheduled hours, not actual)
  workedMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  // OT tracking (early in + late out requires approval)
  otEarlyInMinutes: number;
  otLateOutMinutes: number;
  otRestDayMinutes: number;
  otHolidayMinutes: number;
  isOtApproved: boolean;
  earlyInApproved: boolean;
  lateOutApproved: boolean;
  // Night differential
  nightDiffMinutes: number;
  holidayName: string | null;
  holidayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | null;
  // Leave info
  leaveTypeName: string | null;
  // Break info for edit modal
  breakMinutes: number;
  shiftBreakMinutes: number;
  breakMinutesApplied: number | null;
}

export interface ManualAdjustmentItem {
  id: string;
  type: "EARNING" | "DEDUCTION";
  description: string;
  amount: number;
  remarks: string | null;
  createdAt: Date;
}

export interface PayslipDetail {
  id: string;
  payslipNumber: string | null;
  payrollRunId: string;
  payrollRunStatus: string;
  payPeriod: {
    code: string;
    startDate: Date;
    endDate: Date;
    payDate: Date;
  };
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department: string | null;
    jobTitle: string | null;
  };
  // Summary
  grossPay: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  // Statutory
  sssEe: number;
  sssEr: number;
  philhealthEe: number;
  philhealthEr: number;
  pagibigEe: number;
  pagibigEr: number;
  withholdingTax: number;
  // YTD
  ytdGrossPay: number;
  ytdTaxableIncome: number;
  ytdTaxWithheld: number;
  // Pay profile snapshot
  payProfileSnapshot: {
    wageType: string;
    baseRate: number;
    payFrequency: string;
  } | null;
  // Derived rates for display (dailyRate, hourlyRate, minuteRate)
  derivedRates: {
    dailyRate: number;
    hourlyRate: number;
    minuteRate: number;
  } | null;
  // Line items grouped by category
  earnings: PayslipLineItem[];
  deductions: PayslipLineItem[];
  // Attendance records for the period
  attendance: PayslipAttendanceRecord[];
  // Attendance summary totals
  attendanceSummary: {
    totalWorkDays: number;
    totalLateMinutes: number;
    totalUndertimeMinutes: number;
    totalOtMinutes: number;
    totalRestDayOtMinutes: number;
    totalHolidayOtMinutes: number;
    totalNightDiffMinutes: number;
    totalRestDays: number;
    totalRegularHolidays: number;
    totalSpecialHolidays: number;
  };
  // Manual adjustments (commissions, etc.)
  manualAdjustments: ManualAdjustmentItem[];
  // Can edit (payroll not finalized)
  canEdit: boolean;
}

/**
 * Get detailed payslip with calculation breakdown and attendance records.
 * Permission: payroll:view
 */
export async function getPayslipDetail(
  payrollRunId: string,
  payslipId: string
): Promise<{
  success: boolean;
  payslip?: PayslipDetail;
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Get the payslip with all related data
    const payslip = await prisma.payslip.findFirst({
      where: {
        id: payslipId,
        payrollRunId,
        payrollRun: {
          payPeriod: { calendar: { companyId: auth.user.companyId } },
        },
      },
      include: {
        payrollRun: {
          select: {
            status: true,
            payPeriod: true,
          },
        },
        employee: {
          include: {
            department: { select: { name: true } },
            roleScorecard: { select: { jobTitle: true } },
          },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            attendanceDayRecord: {
              select: { attendanceDate: true },
            },
          },
        },
      },
    });

    if (!payslip) {
      return { success: false, error: "Payslip not found" };
    }

    // Get attendance records for the pay period
    const attendance = await prisma.attendanceDayRecord.findMany({
      where: {
        employeeId: payslip.employeeId,
        attendanceDate: {
          gte: payslip.payrollRun.payPeriod.startDate,
          lte: payslip.payrollRun.payPeriod.endDate,
        },
      },
      include: {
        holiday: { select: { name: true, dayType: true } },
        shiftTemplate: {
          select: { startTime: true, endTime: true, breakMinutes: true, isOvernight: true, scheduledWorkMinutes: true },
        },
      },
      orderBy: { attendanceDate: "asc" },
    });

    // Get holidays from the active calendar for the pay period
    // This catches holidays that might not be linked in the attendance record
    const startYear = payslip.payrollRun.payPeriod.startDate.getFullYear();
    const endYear = payslip.payrollRun.payPeriod.endDate.getFullYear();
    const activeCalendar = await prisma.holidayCalendar.findFirst({
      where: {
        companyId: auth.user.companyId,
        isActive: true,
        year: { in: startYear === endYear ? [startYear] : [startYear, endYear] },
      },
      include: {
        events: {
          where: {
            date: {
              gte: payslip.payrollRun.payPeriod.startDate,
              lte: payslip.payrollRun.payPeriod.endDate,
            },
          },
        },
      },
    });

    // Index holidays by date for quick lookup
    const holidaysByDate = new Map<string, { name: string; dayType: string }>();
    if (activeCalendar) {
      for (const event of activeCalendar.events) {
        const dateKey = event.date.toISOString().split("T")[0];
        holidaysByDate.set(dateKey, { name: event.name, dayType: event.dayType });
      }
    }

    // Get approved leave requests for the employee during the pay period
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: payslip.employeeId,
        status: "APPROVED",
        startDate: { lte: payslip.payrollRun.payPeriod.endDate },
        endDate: { gte: payslip.payrollRun.payPeriod.startDate },
      },
      include: {
        leaveType: { select: { name: true } },
      },
    });

    // Index leaves by date for quick lookup
    const leavesByDate = new Map<string, { leaveTypeName: string }>();
    for (const leave of approvedLeaves) {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      const currentLeaveDate = new Date(leaveStart);
      while (currentLeaveDate <= leaveEnd) {
        const dateKey = currentLeaveDate.toISOString().split("T")[0];
        leavesByDate.set(dateKey, { leaveTypeName: leave.leaveType.name });
        currentLeaveDate.setDate(currentLeaveDate.getDate() + 1);
      }
    }

    // Categorize line items
    const earningCategories = [
      "BASIC_PAY",
      "OVERTIME_REGULAR",
      "OVERTIME_REST_DAY",
      "OVERTIME_HOLIDAY",
      "NIGHT_DIFFERENTIAL",
      "HOLIDAY_PAY",
      "REST_DAY_PAY",
      "ALLOWANCE",
      "REIMBURSEMENT",
      "INCENTIVE",
      "ADJUSTMENT_ADD",
      "OTHER_EARNING",
    ];

    const earnings = payslip.lines
      .filter((line) => earningCategories.includes(line.category))
      .map((line) => ({
        id: line.id,
        category: line.category,
        description: line.description,
        quantity: line.quantity ? Number(line.quantity) : null,
        rate: line.rate ? Number(line.rate) : null,
        multiplier: line.multiplier ? Number(line.multiplier) : null,
        amount: Number(line.amount),
        attendanceDate: line.attendanceDayRecord?.attendanceDate || null,
        sortOrder: line.sortOrder,
      }));

    const deductions = payslip.lines
      .filter((line) => !earningCategories.includes(line.category))
      .map((line) => ({
        id: line.id,
        category: line.category,
        description: line.description,
        quantity: line.quantity ? Number(line.quantity) : null,
        rate: line.rate ? Number(line.rate) : null,
        multiplier: line.multiplier ? Number(line.multiplier) : null,
        amount: Math.abs(Number(line.amount)),
        attendanceDate: line.attendanceDayRecord?.attendanceDate || null,
        sortOrder: line.sortOrder,
      }));

    // Format attendance records with schedule-bounded worked hours calculation
    // This matches the Employee Attendance Tab logic exactly
    const attendanceRecords: PayslipAttendanceRecord[] = attendance.map((a) => {
      // Get scheduled times from shift template
      const schedStartTime = a.shiftTemplate?.startTime;
      const schedEndTime = a.shiftTemplate?.endTime;

      // Extract time components - handles both Date objects and string formats
      // (PostgreSQL TIME columns via @prisma/adapter-pg may return as strings like "09:00:00")
      const startComponents = extractTimeComponents(schedStartTime);
      const endComponents = extractTimeComponents(schedEndTime);

      // Format scheduled times for display
      const scheduledStart = startComponents
        ? `${startComponents.hours.toString().padStart(2, '0')}:${startComponents.minutes.toString().padStart(2, '0')}`
        : null;
      const scheduledEnd = endComponents
        ? `${endComponents.hours.toString().padStart(2, '0')}:${endComponents.minutes.toString().padStart(2, '0')}`
        : null;

      // Calculate schedule-bounded worked minutes
      // Rule: Base worked time is clamped to schedule window
      // Early clock-in/late clock-out only count if approved
      let calculatedWorkedMinutes = 0;
      let calculatedLateMinutes = 0;
      let calculatedUndertimeMinutes = 0;
      let calculatedOtEarlyInMinutes = 0;
      let calculatedOtLateOutMinutes = 0;
      let calculatedNightDiffMinutes = 0;
      let calculatedOtRestDayMinutes = 0;
      let calculatedOtHolidayMinutes = 0;

      // Use break override if set, otherwise use shift template's break minutes
      const shiftBreakMinutes = a.shiftTemplate?.breakMinutes ?? 60;
      const breakMinutes = a.breakMinutesApplied ?? shiftBreakMinutes;
      const isOvernight = a.shiftTemplate?.isOvernight ?? false;

      if (a.actualTimeIn && a.actualTimeOut && startComponents && endComponents) {
        const clockIn = new Date(a.actualTimeIn);
        const clockOut = new Date(a.actualTimeOut);

        // Use shared utility for late/undertime/OT calculations
        const calc = calculateAttendanceTimes(
          a.actualTimeIn,
          a.actualTimeOut,
          schedStartTime ?? null,
          schedEndTime ?? null,
          a.attendanceDate,
          a.earlyInApproved,
          a.lateOutApproved,
          shiftBreakMinutes,
          a.breakMinutesApplied
        );

        // Apply excusal flags (lateInApproved excuses late, earlyOutApproved excuses undertime)
        calculatedLateMinutes = a.lateInApproved ? 0 : calc.lateMinutes;
        calculatedUndertimeMinutes = a.earlyOutApproved ? 0 : calc.undertimeMinutes;
        calculatedOtEarlyInMinutes = calc.otEarlyInMinutes;
        calculatedOtLateOutMinutes = calc.otLateOutMinutes;

        // Build schedule dates for worked minutes calculation
        const schedStart = setManilaHours(new Date(a.attendanceDate), startComponents.hours, startComponents.minutes);
        const schedEnd = setManilaHours(new Date(a.attendanceDate), endComponents.hours, endComponents.minutes);

        // Handle overnight shifts (end time is next day)
        if (endComponents.hours < startComponents.hours || isOvernight) {
          schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
        }

        // Calculate effective clock times (schedule-bounded)
        // Cap clock in to schedule start unless early in is approved
        let effectiveClockIn = clockIn;
        if (clockIn < schedStart && !a.earlyInApproved) {
          effectiveClockIn = schedStart;
        }

        // Cap clock out to schedule end unless late out is approved
        let effectiveClockOut = clockOut;
        if (clockOut > schedEnd && !a.lateOutApproved) {
          effectiveClockOut = schedEnd;
        }

        // Calculate worked minutes from effective times (schedule-bounded)
        const effectiveDiffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime();
        const grossMinutes = Math.max(0, Math.round(effectiveDiffMs / (1000 * 60)));

        // Apply break deduction (only if worked more than ~5 hours)
        const applyBreak = grossMinutes > 300 ? breakMinutes : 0;
        calculatedWorkedMinutes = Math.max(0, grossMinutes - applyBreak);

        // Calculate night differential (10pm-6am PHT) for actual clock times
        // Convert UTC times to Philippines time (UTC+8) before calculating ND
        const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
        const clockInPHT = new Date(clockIn.getTime() + PHT_OFFSET_MS);
        const clockOutPHT = new Date(clockOut.getTime() + PHT_OFFSET_MS);
        const actualInMin = clockInPHT.getUTCHours() * 60 + clockInPHT.getUTCMinutes();
        const actualOutMin = clockOutPHT.getUTCHours() * 60 + clockOutPHT.getUTCMinutes();
        const nightStart = 22 * 60; // 10pm PHT
        const nightEnd = 6 * 60; // 6am PHT
        const overlapMinutes = (start: number, end: number, rangeStart: number, rangeEnd: number): number => {
          const overlapStart = Math.max(start, rangeStart);
          const overlapEnd = Math.min(end, rangeEnd);
          return Math.max(0, overlapEnd - overlapStart);
        };

        if (actualOutMin > actualInMin) {
          calculatedNightDiffMinutes += overlapMinutes(actualInMin, actualOutMin, nightStart, 1440);
          calculatedNightDiffMinutes += overlapMinutes(actualInMin, actualOutMin, 0, nightEnd);
        } else {
          calculatedNightDiffMinutes += overlapMinutes(actualInMin, 1440, nightStart, 1440);
          calculatedNightDiffMinutes += overlapMinutes(0, actualOutMin, 0, nightEnd);
        }

        // Rest day/holiday OT is entire worked time on those days
        const isRestDay = a.dayType === "REST_DAY";
        const isHoliday = a.dayType === "REGULAR_HOLIDAY" || a.dayType === "SPECIAL_HOLIDAY";
        if (isRestDay && calculatedWorkedMinutes > 0) {
          calculatedOtRestDayMinutes = calculatedWorkedMinutes;
        }
        if (isHoliday && calculatedWorkedMinutes > 0) {
          calculatedOtHolidayMinutes = calculatedWorkedMinutes;
        }
      }

      // Determine attendance status using priority logic (matching employee attendance tab):
      // Time logs > Approved Leave > Holiday > Record dayType > Default
      const dateKey = a.attendanceDate.toISOString().split("T")[0];
      const calendarHoliday = holidaysByDate.get(dateKey);
      const approvedLeave = leavesByDate.get(dateKey);

      // Get holiday info - prefer calendar holiday, fallback to record's holiday relation
      let finalHolidayName: string | null = a.holiday?.name || calendarHoliday?.name || null;
      let finalHolidayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | null = null;
      if (a.holiday?.dayType === "REGULAR_HOLIDAY" || calendarHoliday?.dayType === "REGULAR_HOLIDAY" || a.dayType === "REGULAR_HOLIDAY") {
        finalHolidayType = "REGULAR_HOLIDAY";
      } else if (a.holiday?.dayType === "SPECIAL_HOLIDAY" || calendarHoliday?.dayType === "SPECIAL_HOLIDAY" || a.dayType === "SPECIAL_HOLIDAY") {
        finalHolidayType = "SPECIAL_HOLIDAY";
      }

      // Determine effective attendance status
      let effectiveAttendanceStatus: string;
      const hasClockData = a.actualTimeIn || a.actualTimeOut;

      if (hasClockData) {
        // Has actual attendance = PRESENT (even on holidays/leaves, if they worked)
        effectiveAttendanceStatus = calculatedWorkedMinutes > 0 ? "PRESENT" : a.attendanceStatus;
      } else if (approvedLeave) {
        // Has an approved leave request - mark as ON_LEAVE
        effectiveAttendanceStatus = "ON_LEAVE";
      } else if (calendarHoliday || a.holiday) {
        // Date is a holiday and didn't work - use specific holiday type
        effectiveAttendanceStatus = finalHolidayType || "SPECIAL_HOLIDAY";
      } else if (a.dayType === "REST_DAY") {
        effectiveAttendanceStatus = "REST_DAY";
      } else if (a.attendanceStatus) {
        effectiveAttendanceStatus = a.attendanceStatus;
      } else {
        effectiveAttendanceStatus = "ABSENT";
      }

      // Determine effective day type
      let effectiveDayType = a.dayType;
      if (calendarHoliday && (!effectiveDayType || effectiveDayType === "WORKDAY")) {
        effectiveDayType = calendarHoliday.dayType as typeof a.dayType;
      }

      return {
        id: a.id,
        date: a.attendanceDate,
        dayType: effectiveDayType,
        attendanceStatus: effectiveAttendanceStatus,
        scheduledStart,
        scheduledEnd,
        scheduledWorkMinutes: a.shiftTemplate?.scheduledWorkMinutes ?? 480,
        // Actual clock times
        actualTimeIn: a.actualTimeIn,
        actualTimeOut: a.actualTimeOut,
        // Computed values (schedule-bounded + approval-bounded)
        workedMinutes: calculatedWorkedMinutes,
        lateMinutes: calculatedLateMinutes,
        undertimeMinutes: calculatedUndertimeMinutes,
        // OT breakdown (early in + late out requires approval)
        otEarlyInMinutes: calculatedOtEarlyInMinutes,
        otLateOutMinutes: calculatedOtLateOutMinutes,
        otRestDayMinutes: calculatedOtRestDayMinutes,
        otHolidayMinutes: calculatedOtHolidayMinutes,
        // OT is considered approved if either earlyIn or lateOut is approved
        isOtApproved: a.earlyInApproved || a.lateOutApproved,
        earlyInApproved: a.earlyInApproved,
        lateOutApproved: a.lateOutApproved,
        // Night differential
        nightDiffMinutes: calculatedNightDiffMinutes,
        holidayName: finalHolidayName,
        holidayType: finalHolidayType,
        // Leave info
        leaveTypeName: approvedLeave?.leaveTypeName || null,
        // Break info for edit modal
        breakMinutes,
        shiftBreakMinutes,
        breakMinutesApplied: a.breakMinutesApplied,
      };
    });

    // Parse pay profile snapshot and calculate derived rates
    let payProfileSnapshot = null;
    let derivedRates: { dailyRate: number; hourlyRate: number; minuteRate: number } | null = null;
    if (payslip.payProfileSnapshot) {
      const snapshot = payslip.payProfileSnapshot as Record<string, unknown>;
      payProfileSnapshot = {
        wageType: String(snapshot.wageType || "MONTHLY"),
        baseRate: Number(snapshot.baseRate || 0),
        payFrequency: String(snapshot.payFrequency || "SEMI_MONTHLY"),
      };

      // Calculate derived rates from the snapshot for display in UI
      try {
        const profileForRates: PayProfileInput = {
          employeeId: payslip.employeeId,
          wageType: payProfileSnapshot.wageType as "MONTHLY" | "DAILY" | "HOURLY",
          baseRate: payProfileSnapshot.baseRate,
          payFrequency: payProfileSnapshot.payFrequency as "MONTHLY" | "SEMI_MONTHLY" | "BI_WEEKLY" | "WEEKLY",
          standardWorkDaysPerMonth: Number(snapshot.standardWorkDaysPerMonth || 26),
          standardHoursPerDay: Number(snapshot.standardHoursPerDay || 8),
          isBenefitsEligible: true,
          isOtEligible: true,
          isNdEligible: true,
          riceSubsidy: 0,
          clothingAllowance: 0,
          laundryAllowance: 0,
          medicalAllowance: 0,
          transportationAllowance: 0,
          mealAllowance: 0,
          communicationAllowance: 0,
        };
        const rates = calculateDerivedRates(profileForRates);
        derivedRates = {
          dailyRate: rates.dailyRate,
          hourlyRate: rates.hourlyRate,
          minuteRate: rates.minuteRate,
        };
      } catch (e) {
        // If calculation fails, leave derivedRates as null
        console.error("Failed to calculate derived rates:", e);
      }
    }

    // Get manual adjustments (commissions, etc.) for this employee in this payroll run
    const manualAdjustments = await prisma.manualAdjustmentLine.findMany({
      where: {
        payrollRunId,
        employeeId: payslip.employeeId,
      },
      orderBy: { createdAt: "desc" },
    });

    // Determine if payroll can be edited (not finalized)
    // Status values: DRAFT, COMPUTING, REVIEW, APPROVED, RELEASED, CANCELLED
    const editableStatuses = ["DRAFT", "REVIEW"];
    const canEdit = editableStatuses.includes(payslip.payrollRun.status);

    // Map manual adjustments
    const manualAdjustmentItems: ManualAdjustmentItem[] = manualAdjustments.map((a) => {
      const earningCategories = ["INCENTIVE", "ADJUSTMENT_ADD", "OTHER_EARNING", "ALLOWANCE", "REIMBURSEMENT"];
      const type = earningCategories.includes(a.category) ? "EARNING" : "DEDUCTION";
      return {
        id: a.id,
        type: type as "EARNING" | "DEDUCTION",
        description: a.description,
        amount: Number(a.amount),
        remarks: a.remarks,
        createdAt: a.createdAt,
      };
    });

    // Merge manual adjustments into earnings/deductions for unified Calculation Breakdown display
    // This ensures adjustments appear in the breakdown even before payroll recomputation
    for (const adj of manualAdjustmentItems) {
      // Check if this adjustment already exists as a PayslipLine (via manualAdjustmentId)
      const alreadyInLines =
        adj.type === "EARNING"
          ? earnings.some((e) => e.id === adj.id)
          : deductions.some((d) => d.id === adj.id);

      if (!alreadyInLines) {
        const item = {
          id: adj.id,
          category: (adj.type === "EARNING" ? "ADJUSTMENT_ADD" : "ADJUSTMENT_DEDUCT") as PayslipLineCategory,
          description: adj.description,
          quantity: null,
          rate: null,
          multiplier: null,
          amount: adj.amount,
          attendanceDate: null,
          sortOrder: adj.type === "EARNING" ? 900 : 950,
        };

        if (adj.type === "EARNING") {
          earnings.push(item);
        } else {
          deductions.push(item);
        }
      }
    }

    // Re-sort arrays to maintain proper order
    earnings.sort((a, b) => a.sortOrder - b.sortOrder);
    deductions.sort((a, b) => a.sortOrder - b.sortOrder);

    // Recalculate totals to include manual adjustments that aren't yet in PayslipLine
    // This ensures the UI shows correct totals even before payroll recomputation
    const calculatedTotalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const calculatedTotalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const calculatedNetPay = calculatedTotalEarnings - calculatedTotalDeductions;

    // Calculate attendance summary totals for the payslip attendance tab
    // Uses the effective values that already account for leaves, holidays, and rest days
    const attendanceSummary = {
      totalWorkDays: attendanceRecords.filter(a =>
        a.attendanceStatus === 'PRESENT' || a.attendanceStatus === 'HALF_DAY'
      ).length,
      totalLeaveDays: attendanceRecords.filter(a => a.attendanceStatus === 'ON_LEAVE').length,
      totalAbsentDays: attendanceRecords.filter(a => a.attendanceStatus === 'ABSENT').length,
      totalLateMinutes: attendanceRecords.reduce((sum, a) => sum + (a.lateMinutes || 0), 0),
      totalUndertimeMinutes: attendanceRecords.reduce((sum, a) => sum + (a.undertimeMinutes || 0), 0),
      totalOtMinutes: attendanceRecords.reduce((sum, a) =>
        sum + (a.isOtApproved ? ((a.otEarlyInMinutes || 0) + (a.otLateOutMinutes || 0)) : 0), 0),
      totalRestDayOtMinutes: attendanceRecords.reduce((sum, a) => sum + (a.otRestDayMinutes || 0), 0),
      totalHolidayOtMinutes: attendanceRecords.reduce((sum, a) => sum + (a.otHolidayMinutes || 0), 0),
      totalNightDiffMinutes: attendanceRecords.reduce((sum, a) => sum + (a.nightDiffMinutes || 0), 0),
      totalRestDays: attendanceRecords.filter(a => a.attendanceStatus === 'REST_DAY').length,
      totalRegularHolidays: attendanceRecords.filter(a =>
        a.attendanceStatus === 'REGULAR_HOLIDAY' ||
        (a.holidayType === 'REGULAR_HOLIDAY' && a.attendanceStatus !== 'PRESENT' && a.attendanceStatus !== 'HALF_DAY')
      ).length,
      totalSpecialHolidays: attendanceRecords.filter(a =>
        a.attendanceStatus === 'SPECIAL_HOLIDAY' ||
        (a.holidayType === 'SPECIAL_HOLIDAY' && a.attendanceStatus !== 'PRESENT' && a.attendanceStatus !== 'HALF_DAY')
      ).length,
    };

    return {
      success: true,
      payslip: {
        id: payslip.id,
        payslipNumber: payslip.payslipNumber,
        payrollRunId: payslip.payrollRunId,
        payrollRunStatus: payslip.payrollRun.status,
        payPeriod: {
          code: payslip.payrollRun.payPeriod.code,
          startDate: payslip.payrollRun.payPeriod.startDate,
          endDate: payslip.payrollRun.payPeriod.endDate,
          payDate: payslip.payrollRun.payPeriod.payDate,
        },
        employee: {
          id: payslip.employee.id,
          employeeNumber: payslip.employee.employeeNumber,
          firstName: payslip.employee.firstName,
          lastName: payslip.employee.lastName,
          department: payslip.employee.department?.name || null,
          jobTitle: payslip.employee.roleScorecard?.jobTitle || payslip.employee.jobTitle || null,
        },
        grossPay: Number(payslip.grossPay),
        totalEarnings: calculatedTotalEarnings,
        totalDeductions: calculatedTotalDeductions,
        netPay: calculatedNetPay,
        sssEe: Number(payslip.sssEe),
        sssEr: Number(payslip.sssEr),
        philhealthEe: Number(payslip.philhealthEe),
        philhealthEr: Number(payslip.philhealthEr),
        pagibigEe: Number(payslip.pagibigEe),
        pagibigEr: Number(payslip.pagibigEr),
        withholdingTax: Number(payslip.withholdingTax),
        ytdGrossPay: Number(payslip.ytdGrossPay),
        ytdTaxableIncome: Number(payslip.ytdTaxableIncome),
        ytdTaxWithheld: Number(payslip.ytdTaxWithheld),
        payProfileSnapshot,
        derivedRates, // dailyRate, hourlyRate, minuteRate for display
        earnings,
        deductions,
        attendance: attendanceRecords,
        attendanceSummary,
        manualAdjustments: manualAdjustmentItems,
        canEdit,
      },
    };
  } catch (error) {
    console.error("Failed to get payslip detail:", error);
    return { success: false, error: "Failed to get payslip detail" };
  }
}
