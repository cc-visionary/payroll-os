"use server";

// =============================================================================
// PeopleOS PH - Export Server Actions
// =============================================================================
// Server actions for generating and storing payroll export artifacts.
// Exports are stored immutably with data snapshots for reproducibility.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { getAuthContext } from "@/lib/auth";
import { headers } from "next/headers";
import {
  generatePayrollRegisterCSV,
  generateBankDisbursementCSV,
  generateSSSContributionsCSV,
  generatePhilHealthContributionsCSV,
  generatePagIBIGContributionsCSV,
} from "@/lib/exports/generators";
import {
  storeExportArtifact,
  getExportHistory,
  findExistingExport,
} from "@/lib/exports/storage";
import type {
  PayrollRegisterRow,
  BankDisbursementRow,
  SSSContributionRow,
  PhilHealthContributionRow,
  PagIBIGContributionRow,
  ExportMetadata,
  ExportHistoryItem,
} from "@/lib/exports/types";
import type { ExportType } from "@/app/generated/prisma";
import {
  extractTimeComponents,
  calculateAttendanceTimes,
  setManilaHours,
} from "@/lib/utils/timezone";

// =============================================================================
// Helper: Get export metadata
// =============================================================================

async function getExportMetadata(
  payrollRunId: string,
  companyId: string,
  userEmail: string
): Promise<{
  metadata: ExportMetadata;
  payrollRun: any;
} | null> {
  const payrollRun = await prisma.payrollRun.findFirst({
    where: {
      id: payrollRunId,
      payPeriod: { calendar: { companyId } },
    },
    include: {
      payPeriod: {
        include: {
          calendar: {
            include: { company: true },
          },
        },
      },
      payslips: {
        include: {
          employee: {
            include: {
              department: { select: { name: true } },
              bankAccounts: {
                where: { isPrimary: true, deletedAt: null },
                take: 1,
              },
            },
          },
          lines: true,
        },
        orderBy: { employee: { lastName: "asc" } },
      },
    },
  });

  if (!payrollRun) return null;

  const totalNetPay = payrollRun.payslips.reduce(
    (sum: number, ps: any) => sum + Number(ps.netPay),
    0
  );

  return {
    metadata: {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      companyName: payrollRun.payPeriod.calendar.company.name,
      generatedAt: new Date(),
      generatedBy: userEmail,
      recordCount: payrollRun.payslips.length,
      totalAmount: totalNetPay,
    },
    payrollRun,
  };
}

// =============================================================================
// Export Payroll Register
// =============================================================================

export async function generatePayrollRegisterExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_PAYROLL_REGISTER);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll data
    const data = await getExportMetadata(
      payrollRunId,
      auth.user.companyId,
      auth.user.email
    );

    if (!data) {
      return { success: false, error: "Payroll run not found" };
    }

    const { metadata, payrollRun } = data;

    // Check if payroll is approved/released
    if (!["APPROVED", "RELEASED"].includes(payrollRun.status)) {
      return {
        success: false,
        error: "Payroll must be approved to export register",
      };
    }

    // Transform payslips to register rows
    const rows: PayrollRegisterRow[] = payrollRun.payslips.map((ps: any) => {
      const linesByCategory = ps.lines.reduce(
        (acc: Record<string, number>, line: any) => {
          acc[line.category] = (acc[line.category] || 0) + Number(line.amount);
          return acc;
        },
        {} as Record<string, number>
      );

      const bankAccount = ps.employee.bankAccounts[0];

      return {
        employeeNumber: ps.employee.employeeNumber,
        employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
        department: ps.employee.department?.name || "",
        position: ps.employee.position?.name || "",
        wageType: ps.employee.wageType || "MONTHLY",
        baseRate: Number(ps.employee.baseRate || 0),
        basicPay: linesByCategory["BASIC_PAY"] || 0,
        overtime:
          (linesByCategory["OVERTIME_REGULAR"] || 0) +
          (linesByCategory["OVERTIME_REST_DAY"] || 0) +
          (linesByCategory["OVERTIME_HOLIDAY"] || 0),
        nightDiff: linesByCategory["NIGHT_DIFFERENTIAL"] || 0,
        holidayPay: linesByCategory["HOLIDAY_PAY"] || 0,
        restDayPay: linesByCategory["REST_DAY_PAY"] || 0,
        allowances: linesByCategory["ALLOWANCE"] || 0,
        reimbursements: linesByCategory["REIMBURSEMENT"] || 0,
        adjustmentsAdd: linesByCategory["ADJUSTMENT_ADD"] || 0,
        grossPay: Number(ps.grossPay),
        lateDeduction: linesByCategory["LATE_DEDUCTION"] || 0,
        undertimeDeduction: linesByCategory["UNDERTIME_DEDUCTION"] || 0,
        absentDeduction: linesByCategory["ABSENT_DEDUCTION"] || 0,
        sssEe: Number(ps.sssEe),
        philhealthEe: Number(ps.philhealthEe),
        pagibigEe: Number(ps.pagibigEe),
        withholdingTax: Number(ps.withholdingTax),
        cashAdvanceDeduction: linesByCategory["CASH_ADVANCE_DEDUCTION"] || 0,
        loanDeduction: linesByCategory["LOAN_DEDUCTION"] || 0,
        adjustmentsDeduct: linesByCategory["ADJUSTMENT_DEDUCT"] || 0,
        otherDeductions: linesByCategory["OTHER_DEDUCTION"] || 0,
        totalDeductions: Number(ps.totalDeductions),
        netPay: Number(ps.netPay),
        bankName: bankAccount?.bankName || "",
        bankAccountNumber: bankAccount?.accountNumber || "",
      };
    });

    // Generate CSV
    const exportResult = generatePayrollRegisterCSV(rows, metadata);

    // Check for existing export with same content hash
    const existing = await findExistingExport(
      payrollRunId,
      "PAYROLL_REGISTER",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    // Store new artifact
    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "PAYROLL_REGISTER",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    // Audit log
    await audit.export("PayrollRegister", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount?.toString(),
      contentHash: exportResult.contentHash,
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate payroll register export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Export Bank Disbursement
// =============================================================================

export async function generateBankDisbursementExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_BANK_FILE);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll data
    const data = await getExportMetadata(
      payrollRunId,
      auth.user.companyId,
      auth.user.email
    );

    if (!data) {
      return { success: false, error: "Payroll run not found" };
    }

    const { metadata, payrollRun } = data;

    // Check if payroll is approved/released
    if (!["APPROVED", "RELEASED"].includes(payrollRun.status)) {
      return {
        success: false,
        error: "Payroll must be approved to export bank file",
      };
    }

    // Transform to bank disbursement rows
    const rows: BankDisbursementRow[] = payrollRun.payslips
      .filter((ps: any) => ps.employee.bankAccounts.length > 0)
      .map((ps: any, index: number) => {
        const bankAccount = ps.employee.bankAccounts[0];
        return {
          sequenceNumber: index + 1,
          employeeNumber: ps.employee.employeeNumber,
          employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
          bankCode: bankAccount?.bankCode || "",
          bankName: bankAccount?.bankName || "",
          accountNumber: bankAccount?.accountNumber || "",
          accountType: bankAccount?.accountType || "SAVINGS",
          amount: Number(ps.netPay),
          remarks: `Payroll ${metadata.payPeriodCode}`,
        };
      });

    // Generate CSV
    const exportResult = generateBankDisbursementCSV(rows, {
      ...metadata,
      recordCount: rows.length,
      totalAmount: rows.reduce((sum, r) => sum + r.amount, 0),
    });

    // Check for existing export with same content hash
    const existing = await findExistingExport(
      payrollRunId,
      "BANK_DISBURSEMENT",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    // Store new artifact
    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "BANK_DISBURSEMENT",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    // Audit log
    await audit.export("BankDisbursement", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount?.toString(),
      contentHash: exportResult.contentHash,
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate bank disbursement export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Export SSS Contributions
// =============================================================================

export async function generateSSSContributionsExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_STATUTORY);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll data with SSS numbers
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: {
          include: {
            calendar: { include: { company: true } },
          },
        },
        payslips: {
          include: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
                statutoryIds: {
                  where: { idType: "sss" },
                  take: 1,
                  select: { idNumber: true },
                },
                roleScorecard: {
                  select: { baseSalary: true, wageType: true },
                },
              },
            },
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
        error: "Payroll must be approved to export",
      };
    }

    // Transform to SSS rows
    const rows: SSSContributionRow[] = payrollRun.payslips.map((ps: any) => ({
      employeeNumber: ps.employee.employeeNumber,
      employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
      sssNumber: ps.employee.sssNumber || "",
      monthlyBasicSalary: Number(ps.employee.baseRate || 0),
      employeeShare: Number(ps.sssEe),
      employerShare: Number(ps.sssEr),
      ecContribution: 0, // EC is included in employer share
      totalContribution: Number(ps.sssEe) + Number(ps.sssEr),
    }));

    const metadata: ExportMetadata = {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      companyName: payrollRun.payPeriod.calendar.company.name,
      generatedAt: new Date(),
      generatedBy: auth.user.email,
      recordCount: rows.length,
      totalAmount: rows.reduce((sum, r) => sum + r.totalContribution, 0),
    };

    // Generate CSV
    const exportResult = generateSSSContributionsCSV(rows, metadata);

    // Check for existing export
    const existing = await findExistingExport(
      payrollRunId,
      "SSS_CONTRIBUTIONS",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    // Store artifact
    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "SSS_CONTRIBUTIONS",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    await audit.export("SSSContributions", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate SSS export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Export PhilHealth Contributions
// =============================================================================

export async function generatePhilHealthContributionsExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_STATUTORY);

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
        payPeriod: {
          include: {
            calendar: { include: { company: true } },
          },
        },
        payslips: {
          include: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
                statutoryIds: {
                  where: { idType: "philhealth" },
                  take: 1,
                  select: { idNumber: true },
                },
                roleScorecard: {
                  select: { baseSalary: true, wageType: true },
                },
              },
            },
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
        error: "Payroll must be approved to export",
      };
    }

    const rows: PhilHealthContributionRow[] = payrollRun.payslips.map((ps: any) => ({
      employeeNumber: ps.employee.employeeNumber,
      employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
      philhealthNumber: ps.employee.philhealthNumber || "",
      monthlyBasicSalary: Number(ps.employee.roleScorecard?.baseSalary || 0),
      employeeShare: Number(ps.philhealthEe),
      employerShare: Number(ps.philhealthEr),
      totalContribution: Number(ps.philhealthEe) + Number(ps.philhealthEr),
    }));

    const metadata: ExportMetadata = {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      companyName: payrollRun.payPeriod.calendar.company.name,
      generatedAt: new Date(),
      generatedBy: auth.user.email,
      recordCount: rows.length,
      totalAmount: rows.reduce((sum, r) => sum + r.totalContribution, 0),
    };

    const exportResult = generatePhilHealthContributionsCSV(rows, metadata);

    const existing = await findExistingExport(
      payrollRunId,
      "PHILHEALTH_CONTRIBUTIONS",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "PHILHEALTH_CONTRIBUTIONS",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    await audit.export("PhilHealthContributions", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate PhilHealth export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Export Pag-IBIG Contributions
// =============================================================================

export async function generatePagIBIGContributionsExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_STATUTORY);

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
        payPeriod: {
          include: {
            calendar: { include: { company: true } },
          },
        },
        payslips: {
          include: {
            employee: {
              select: {
                employeeNumber: true,
                firstName: true,
                lastName: true,
                statutoryIds: {
                  where: { idType: "pagibig" },
                  take: 1,
                  select: { idNumber: true },
                },
                roleScorecard: {
                  select: { baseSalary: true, wageType: true },
                },
              },
            },
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
        error: "Payroll must be approved to export",
      };
    }

    const rows: PagIBIGContributionRow[] = payrollRun.payslips.map((ps: any) => ({
      employeeNumber: ps.employee.employeeNumber,
      employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
      pagibigNumber: ps.employee.pagibigNumber || "",
      monthlyBasicSalary: Number(ps.employee.roleScorecard?.baseSalary || 0),
      employeeShare: Number(ps.pagibigEe),
      employerShare: Number(ps.pagibigEr),
      totalContribution: Number(ps.pagibigEe) + Number(ps.pagibigEr),
    }));

    const metadata: ExportMetadata = {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      companyName: payrollRun.payPeriod.calendar.company.name,
      generatedAt: new Date(),
      generatedBy: auth.user.email,
      recordCount: rows.length,
      totalAmount: rows.reduce((sum, r) => sum + r.totalContribution, 0),
    };

    const exportResult = generatePagIBIGContributionsCSV(rows, metadata);

    const existing = await findExistingExport(
      payrollRunId,
      "PAGIBIG_CONTRIBUTIONS",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "PAGIBIG_CONTRIBUTIONS",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    await audit.export("PagIBIGContributions", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate Pag-IBIG export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Get Export History
// =============================================================================

export async function getPayrollExportHistory(payrollRunId: string): Promise<{
  success: boolean;
  history?: ExportHistoryItem[];
  error?: string;
}> {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return { success: false, error: "Not authenticated" };
    }

    const history = await getExportHistory(payrollRunId, auth.user.companyId);

    return {
      success: true,
      history,
    };
  } catch (error) {
    console.error("Failed to get export history:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get export history",
    };
  }
}

// =============================================================================
// Export Detailed Payroll with Breakdowns
// =============================================================================

import {
  generateDetailedPayrollCSV,
  generateAttendanceDetailCSV,
} from "@/lib/exports/generators";
import type {
  DetailedPayrollRow,
  AttendanceDetailRow,
} from "@/lib/exports/types";

export async function generateDetailedPayrollExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_PAYROLL_REGISTER);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll data with attendance and detailed breakdowns
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: {
          include: {
            calendar: { include: { company: true } },
          },
        },
        payslips: {
          include: {
            employee: {
              include: {
                department: { select: { name: true } },
                roleScorecard: { select: { jobTitle: true } },
                hiringEntity: { select: { name: true } },
                bankAccounts: {
                  where: { isPrimary: true, deletedAt: null },
                  take: 1,
                },
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
        error: "Payroll must be approved to export",
      };
    }

    // Get attendance records for calculating metrics on the fly
    const attendanceRecords = await prisma.attendanceDayRecord.findMany({
      where: {
        attendanceDate: {
          gte: payrollRun.payPeriod.startDate,
          lte: payrollRun.payPeriod.endDate,
        },
        employee: {
          companyId: auth.user.companyId,
        },
      },
      select: {
        employeeId: true,
        attendanceDate: true,
        actualTimeIn: true,
        actualTimeOut: true,
        earlyInApproved: true,
        lateOutApproved: true,
        lateInApproved: true,
        earlyOutApproved: true,
        breakMinutesApplied: true,
        shiftTemplate: {
          select: {
            startTime: true,
            endTime: true,
            breakMinutes: true,
            breakStartTime: true,
            breakEndTime: true,
            isOvernight: true,
          },
        },
      },
    });

    // Helper to calculate attendance metrics using shared utilities (per SPEC_V1.md)
    const calculateMetrics = (
      actualTimeIn: Date | null,
      actualTimeOut: Date | null,
      scheduledStartTime: Date | string | null,
      scheduledEndTime: Date | string | null,
      breakMinutes: number,
      earlyInApproved: boolean,
      lateOutApproved: boolean,
      lateInApproved: boolean,
      earlyOutApproved: boolean,
      isOvernight: boolean,
      attendanceDate?: Date,
      shiftBreakMinutes?: number,
      breakMinutesApplied?: number | null,
      breakStartTime?: Date | string | null,
      breakEndTime?: Date | string | null
    ) => {
      if (!actualTimeIn || !actualTimeOut) {
        return { workedMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, otEarlyInMinutes: 0, otLateOutMinutes: 0, nightDiffMinutes: 0 };
      }

      const clockIn = new Date(actualTimeIn);
      const clockOut = new Date(actualTimeOut);
      const baseDate = attendanceDate ?? clockIn;

      // Use shared canonical utility for late/undertime/OT (per SPEC_V1.md)
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

      // Extract schedule times using shared utility
      const startTime = extractTimeComponents(scheduledStartTime);
      const endTime = extractTimeComponents(scheduledEndTime);

      // Calculate gross worked minutes
      // Convert UTC times to Philippines time (UTC+8) for ND calculation
      const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
      const clockInPHT = new Date(clockIn.getTime() + PHT_OFFSET_MS);
      const clockOutPHT = new Date(clockOut.getTime() + PHT_OFFSET_MS);
      const actualInMin = clockInPHT.getUTCHours() * 60 + clockInPHT.getUTCMinutes();
      const actualOutMin = clockOutPHT.getUTCHours() * 60 + clockOutPHT.getUTCMinutes();

      let workedMinutes = 0;
      // Effective clock times: bounded by schedule unless OT approved (used for ND calc too)
      let effectiveClockIn = clockIn;
      let effectiveClockOut = clockOut;
      if (startTime && endTime) {
        // Build schedule times using Manila timezone utility
        const schedStart = setManilaHours(new Date(baseDate), startTime.hours, startTime.minutes);
        const schedEnd = setManilaHours(new Date(baseDate), endTime.hours, endTime.minutes);

        // Handle overnight shifts
        if (endTime.hours < startTime.hours || isOvernight) {
          schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
        }

        // Calculate effective clock times (schedule-bounded unless OT approved)
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
        // No schedule - calculate raw worked time
        let rawWorked = actualOutMin - actualInMin;
        if (rawWorked < 0) rawWorked += 1440;
        workedMinutes = Math.max(0, rawWorked - breakMinutes);
      }

      // Calculate night diff on effective (schedule-bounded) times (10pm-6am)
      // ND only applies to approved work time, not unapproved OT
      const effectiveInPHT = new Date(effectiveClockIn.getTime() + PHT_OFFSET_MS);
      const effectiveOutPHT = new Date(effectiveClockOut.getTime() + PHT_OFFSET_MS);
      const effectiveInMin = effectiveInPHT.getUTCHours() * 60 + effectiveInPHT.getUTCMinutes();
      const effectiveOutMin = effectiveOutPHT.getUTCHours() * 60 + effectiveOutPHT.getUTCMinutes();

      let nightDiffMinutes = 0;
      const nightStart = 22 * 60;
      const nightEnd = 6 * 60;
      const overlapMinutes = (start: number, end: number, rangeStart: number, rangeEnd: number): number => {
        const overlapStart = Math.max(start, rangeStart);
        const overlapEnd = Math.min(end, rangeEnd);
        return Math.max(0, overlapEnd - overlapStart);
      };

      if (effectiveOutMin > effectiveInMin) {
        nightDiffMinutes += overlapMinutes(effectiveInMin, effectiveOutMin, nightStart, 1440);
        nightDiffMinutes += overlapMinutes(effectiveInMin, effectiveOutMin, 0, nightEnd);
      } else {
        nightDiffMinutes += overlapMinutes(effectiveInMin, 1440, nightStart, 1440);
        nightDiffMinutes += overlapMinutes(0, effectiveOutMin, 0, nightEnd);
      }

      return {
        workedMinutes,
        lateMinutes,
        undertimeMinutes,
        otEarlyInMinutes: earlyInApproved ? calc.otEarlyInMinutes : 0,
        otLateOutMinutes: lateOutApproved ? calc.otLateOutMinutes : 0,
        nightDiffMinutes,
      };
    };

    // Aggregate attendance metrics by employee
    const attendanceByEmployee = new Map<string, {
      _count: { id: number };
      _sum: {
        workedMinutes: number;
        lateMinutes: number;
        undertimeMinutes: number;
        otEarlyInMinutes: number;
        otLateOutMinutes: number;
        nightDiffMinutes: number;
      };
    }>();

    for (const rec of attendanceRecords) {
      const shiftBreakMin = rec.shiftTemplate?.breakMinutes ?? 60;
      const breakMin = rec.breakMinutesApplied ?? shiftBreakMin;
      const isOvernight = rec.shiftTemplate?.isOvernight ?? false;
      const schedStart = rec.shiftTemplate?.startTime ?? null;
      const schedEnd = rec.shiftTemplate?.endTime ?? null;
      const breakStartTime = rec.shiftTemplate?.breakStartTime ?? null;
      const breakEndTime = rec.shiftTemplate?.breakEndTime ?? null;

      const metrics = calculateMetrics(
        rec.actualTimeIn,
        rec.actualTimeOut,
        schedStart,
        schedEnd,
        breakMin,
        rec.earlyInApproved ?? false,
        rec.lateOutApproved ?? false,
        rec.lateInApproved ?? false,
        rec.earlyOutApproved ?? false,
        isOvernight,
        rec.attendanceDate,
        shiftBreakMin,
        rec.breakMinutesApplied,
        breakStartTime,
        breakEndTime
      );

      const existing = attendanceByEmployee.get(rec.employeeId);
      if (existing) {
        existing._count.id += 1;
        existing._sum.workedMinutes += metrics.workedMinutes;
        existing._sum.lateMinutes += metrics.lateMinutes;
        existing._sum.undertimeMinutes += metrics.undertimeMinutes;
        existing._sum.otEarlyInMinutes += metrics.otEarlyInMinutes;
        existing._sum.otLateOutMinutes += metrics.otLateOutMinutes;
        existing._sum.nightDiffMinutes += metrics.nightDiffMinutes;
      } else {
        attendanceByEmployee.set(rec.employeeId, {
          _count: { id: 1 },
          _sum: {
            workedMinutes: metrics.workedMinutes,
            lateMinutes: metrics.lateMinutes,
            undertimeMinutes: metrics.undertimeMinutes,
            otEarlyInMinutes: metrics.otEarlyInMinutes,
            otLateOutMinutes: metrics.otLateOutMinutes,
            nightDiffMinutes: metrics.nightDiffMinutes,
          },
        });
      }
    }

    // Transform payslips to detailed rows
    const rows: DetailedPayrollRow[] = payrollRun.payslips.map((ps: any) => {
      const linesByCategory = ps.lines.reduce(
        (acc: Record<string, number>, line: any) => {
          acc[line.category] = (acc[line.category] || 0) + Number(line.amount);
          return acc;
        },
        {} as Record<string, number>
      );

      const bankAccount = ps.employee.bankAccounts[0];
      const attendance = attendanceByEmployee.get(ps.employee.id);

      // Calculate working days in the pay period
      const startDate = new Date(payrollRun.payPeriod.startDate);
      const endDate = new Date(payrollRun.payPeriod.endDate);
      let workingDays = 0;
      const tempDate = new Date(startDate);
      while (tempDate <= endDate) {
        const dayOfWeek = tempDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }

      const daysWorked = attendance?._count?.id || 0;
      const daysAbsent = Math.max(0, workingDays - daysWorked);

      return {
        // Employee Info
        employeeNumber: ps.employee.employeeNumber,
        employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
        department: ps.employee.department?.name || "",
        position: ps.employee.roleScorecard?.jobTitle || "",
        hiringEntity: ps.employee.hiringEntity?.name || "",
        wageType: ps.employee.wageType || "MONTHLY",
        baseRate: Number(ps.employee.baseRate || 0),

        // Attendance Summary
        workingDays,
        daysWorked,
        daysAbsent,
        regularHours: Number(attendance?._sum?.workedMinutes || 0) / 60,
        lateMinutes: Number(attendance?._sum?.lateMinutes || 0),
        undertimeMinutes: Number(attendance?._sum?.undertimeMinutes || 0),
        overtimeHours: (Number(attendance?._sum?.otEarlyInMinutes || 0) + Number(attendance?._sum?.otLateOutMinutes || 0)) / 60,
        nightDiffHours: Number(attendance?._sum?.nightDiffMinutes || 0) / 60,

        // Holiday Work
        regularHolidayDays: 0, // Would need to count from attendance records
        regularHolidayPay: linesByCategory["REGULAR_HOLIDAY_PAY"] || 0,
        specialHolidayDays: 0,
        specialHolidayPay: linesByCategory["SPECIAL_HOLIDAY_PAY"] || 0,

        // Rest Day Work
        restDayDays: 0,
        restDayPay: linesByCategory["REST_DAY_PAY"] || 0,

        // Earnings Breakdown
        basicPay: linesByCategory["BASIC_PAY"] || 0,
        overtimePay:
          (linesByCategory["OVERTIME_REGULAR"] || 0) +
          (linesByCategory["OVERTIME_REST_DAY"] || 0) +
          (linesByCategory["OVERTIME_HOLIDAY"] || 0),
        nightDiffPay: linesByCategory["NIGHT_DIFFERENTIAL"] || 0,
        holidayPay:
          (linesByCategory["REGULAR_HOLIDAY_PAY"] || 0) +
          (linesByCategory["SPECIAL_HOLIDAY_PAY"] || 0) +
          (linesByCategory["HOLIDAY_PAY"] || 0),
        allowances: linesByCategory["ALLOWANCE"] || 0,
        reimbursements: linesByCategory["REIMBURSEMENT"] || 0,
        adjustmentsAdd: linesByCategory["ADJUSTMENT_ADD"] || 0,
        grossPay: Number(ps.grossPay),

        // Deductions Breakdown
        lateDeduction: linesByCategory["LATE_DEDUCTION"] || 0,
        undertimeDeduction: linesByCategory["UNDERTIME_DEDUCTION"] || 0,
        absentDeduction: linesByCategory["ABSENT_DEDUCTION"] || 0,
        sssEe: Number(ps.sssEe),
        sssEr: Number(ps.sssEr),
        philhealthEe: Number(ps.philhealthEe),
        philhealthEr: Number(ps.philhealthEr),
        pagibigEe: Number(ps.pagibigEe),
        pagibigEr: Number(ps.pagibigEr),
        withholdingTax: Number(ps.withholdingTax),
        cashAdvanceDeduction: linesByCategory["CASH_ADVANCE_DEDUCTION"] || 0,
        loanDeduction: linesByCategory["LOAN_DEDUCTION"] || 0,
        adjustmentsDeduct: linesByCategory["ADJUSTMENT_DEDUCT"] || 0,
        otherDeductions: linesByCategory["OTHER_DEDUCTION"] || 0,
        totalDeductions: Number(ps.totalDeductions),

        // Net Pay
        netPay: Number(ps.netPay),

        // Bank Info
        bankName: bankAccount?.bankName || "",
        bankAccountNumber: bankAccount?.accountNumber || "",
      };
    });

    const totalNetPay = rows.reduce((sum, r) => sum + r.netPay, 0);

    const metadata: ExportMetadata = {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      companyName: payrollRun.payPeriod.calendar.company.name,
      generatedAt: new Date(),
      generatedBy: auth.user.email,
      recordCount: rows.length,
      totalAmount: totalNetPay,
    };

    // Generate CSV
    const exportResult = generateDetailedPayrollCSV(rows, metadata);

    // Check for existing export
    const existing = await findExistingExport(
      payrollRunId,
      "PAYROLL_REGISTER",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    // Store artifact
    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "PAYROLL_REGISTER",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    await audit.export("DetailedPayrollRegister", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
      totalAmount: exportResult.totalAmount?.toString(),
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate detailed payroll export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Export Attendance Detail
// =============================================================================

export async function generateAttendanceDetailExport(payrollRunId: string): Promise<{
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  fileName?: string;
  cached?: boolean;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.EXPORT_PAYROLL_REGISTER);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Get payroll run details
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: {
          include: {
            calendar: { include: { company: true } },
          },
        },
        payslips: {
          select: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
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
        error: "Payroll must be approved to export",
      };
    }

    // Get employee IDs from payslips
    const employeeIds = payrollRun.payslips.map((ps: any) => ps.employee.id);
    const employeeMap = new Map(
      payrollRun.payslips.map((ps: any) => [
        ps.employee.id,
        {
          employeeNumber: ps.employee.employeeNumber,
          employeeName: `${ps.employee.lastName}, ${ps.employee.firstName}`,
        },
      ])
    );

    // Get holidays for the period
    const holidays = await prisma.calendarEvent.findMany({
      where: {
        calendar: {
          companyId: auth.user.companyId,
        },
        date: {
          gte: payrollRun.payPeriod.startDate,
          lte: payrollRun.payPeriod.endDate,
        },
      },
      select: {
        date: true,
        name: true,
        dayType: true,
      },
    });

    const holidayMap = new Map(
      holidays.map((h) => [h.date.toISOString().split("T")[0], h])
    );

    // Get all attendance records for the pay period
    const attendanceRecords = await prisma.attendanceDayRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        attendanceDate: {
          gte: payrollRun.payPeriod.startDate,
          lte: payrollRun.payPeriod.endDate,
        },
      },
      include: {
        shiftTemplate: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
        holiday: {
          select: {
            name: true,
            dayType: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: "asc" } }, { attendanceDate: "asc" }],
    });

    // Day of week names
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Transform to attendance detail rows
    const rows: AttendanceDetailRow[] = attendanceRecords.map((record: any) => {
      const employee = employeeMap.get(record.employeeId);
      const dateStr = record.attendanceDate.toISOString().split("T")[0];
      const dayOfWeek = record.attendanceDate.getDay();

      // Get day type from record or determine from holiday
      let dayTypeDisplay = record.dayType || "REGULAR_WORKING_DAY";

      // Map status from attendanceStatus field
      let status = record.attendanceStatus || "PRESENT";
      if (record.leaveTypeCode) {
        status = "ON_LEAVE";
      }

      // Format scheduled times from shift template
      const scheduledIn = record.shiftTemplate?.startTime
        ? new Date(record.shiftTemplate.startTime).toLocaleTimeString("en-PH", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : null;
      const scheduledOut = record.shiftTemplate?.endTime
        ? new Date(record.shiftTemplate.endTime).toLocaleTimeString("en-PH", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })
        : null;

      return {
        employeeNumber: employee?.employeeNumber || "",
        employeeName: employee?.employeeName || "",
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeek],
        dayType: dayTypeDisplay,
        holidayName: record.holiday?.name || null,
        scheduledIn,
        scheduledOut,
        actualIn: record.actualTimeIn
          ? new Date(record.actualTimeIn).toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Manila",
            })
          : null,
        actualOut: record.actualTimeOut
          ? new Date(record.actualTimeOut).toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Manila",
            })
          : null,
        hoursWorked: Number(record.workedMinutes || 0) / 60,
        lateMinutes: Number(record.lateMinutes || 0),
        undertimeMinutes: Number(record.undertimeMinutes || 0),
        overtimeMinutes: Number(record.otEarlyInMinutes || 0) + Number(record.otLateOutMinutes || 0),
        nightDiffMinutes: Number(record.nightDiffMinutes || 0),
        status,
        remarks: null, // No remarks field in AttendanceDayRecord
      };
    });

    const metadata: ExportMetadata = {
      payrollRunId,
      payPeriodCode: payrollRun.payPeriod.code,
      companyName: payrollRun.payPeriod.calendar.company.name,
      generatedAt: new Date(),
      generatedBy: auth.user.email,
      recordCount: rows.length,
    };

    // Generate CSV
    const exportResult = generateAttendanceDetailCSV(rows, metadata);

    // Check for existing export
    const existing = await findExistingExport(
      payrollRunId,
      "PAYROLL_REGISTER",
      exportResult.contentHash
    );

    if (existing) {
      return {
        success: true,
        artifactId: existing.id,
        downloadUrl: `/api/exports/${existing.id}/download`,
        fileName: existing.fileName,
        cached: true,
      };
    }

    // Store artifact
    const artifact = await storeExportArtifact({
      companyId: auth.user.companyId,
      payrollRunId,
      exportType: "PAYROLL_REGISTER",
      fileName: exportResult.fileName,
      mimeType: exportResult.mimeType,
      content: exportResult.content,
      contentHash: exportResult.contentHash,
      recordCount: exportResult.recordCount,
      dataSnapshot: exportResult.dataSnapshot,
      generatedById: auth.user.id,
    });

    await audit.export("AttendanceDetail", {
      payrollRunId,
      payPeriodCode: metadata.payPeriodCode,
      artifactId: artifact.id,
      fileName: exportResult.fileName,
      recordCount: exportResult.recordCount,
    });

    revalidatePath(`/payroll/${payrollRunId}/export`);

    return {
      success: true,
      artifactId: artifact.id,
      downloadUrl: artifact.downloadUrl,
      fileName: exportResult.fileName,
      cached: false,
    };
  } catch (error) {
    console.error("Failed to generate attendance detail export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}

// =============================================================================
// Export Payslip PDFs as ZIP
// =============================================================================

import archiver from "archiver";
import { generatePayslipPDF } from "@/lib/pdf/generators/payslip";

export async function generatePayslipPDFZipExport(payrollRunId: string): Promise<{
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}> {
  try {
    const auth = await assertPermission(Permission.PAYSLIP_GENERATE);

    // Get payroll run with full payslip and employee data
    const payrollRun = await prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        payPeriod: { calendar: { companyId: auth.user.companyId } },
      },
      include: {
        payPeriod: {
          include: {
            calendar: {
              include: {
                company: {
                  select: {
                    name: true,
                    addressLine1: true,
                    city: true,
                    province: true,
                  },
                },
              },
            },
          },
        },
        payslips: {
          include: {
            employee: {
              include: {
                department: { select: { name: true } },
                hiringEntity: {
                  select: {
                    name: true,
                    tradeName: true,
                    addressLine1: true,
                    city: true,
                    province: true,
                  },
                },
              },
            },
            lines: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { employee: { lastName: "asc" } },
        },
      },
    });

    if (!payrollRun) {
      return { success: false, error: "Payroll run not found" };
    }

    // Check if payroll is approved/released
    if (!["APPROVED", "RELEASED"].includes(payrollRun.status)) {
      return {
        success: false,
        error: "Payroll must be approved to export payslip PDFs",
      };
    }

    const payPeriodCode = payrollRun.payPeriod.code;
    const company = payrollRun.payPeriod.calendar.company;
    const periodStartDate = payrollRun.payPeriod.startDate;
    const periodEndDate = payrollRun.payPeriod.endDate;

    // Helper to convert Decimal to number
    const toNum = (val: unknown) =>
      typeof val === "object" && val !== null && "toNumber" in val
        ? (val as { toNumber: () => number }).toNumber()
        : Number(val);

    // Helper to format time - for Prisma TIME fields, values are stored as UTC
    // but represent Manila local time, so extract UTC hours/minutes directly
    const formatTimeOnly = (time: Date | string | null | undefined): string => {
      if (!time) return "";
      if (typeof time === "string") {
        const parts = time.split(":");
        return parts.length >= 2 ? `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}` : time;
      }
      const d = new Date(time);
      const hours = d.getUTCHours().toString().padStart(2, "0");
      const minutes = d.getUTCMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    // Generate PDFs in memory for each payslip
    const filesToAdd: Array<{ content: Buffer; fileName: string }> = [];

    for (const payslip of payrollRun.payslips) {
      // Use hiring entity info for payslip header when available
      const payslipCompany = payslip.employee.hiringEntity
        ? {
            name: payslip.employee.hiringEntity.tradeName || payslip.employee.hiringEntity.name,
            addressLine1: payslip.employee.hiringEntity.addressLine1,
            city: payslip.employee.hiringEntity.city,
            province: payslip.employee.hiringEntity.province,
          }
        : company;

      // Fetch attendance records for this employee
      const attendanceRecords = await prisma.attendanceDayRecord.findMany({
        where: {
          employeeId: payslip.employeeId,
          attendanceDate: {
            gte: periodStartDate,
            lte: periodEndDate,
          },
        },
        include: {
          shiftTemplate: {
            select: {
              code: true,
              startTime: true,
              endTime: true,
              breakMinutes: true,
              breakStartTime: true,
              breakEndTime: true,
              isOvernight: true,
            },
          },
          holiday: {
            select: {
              name: true,
              dayType: true,
            },
          },
        },
        orderBy: { attendanceDate: "desc" },
      });

      // Fetch approved leave requests for this employee during the pay period
      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId: payslip.employeeId,
          status: "APPROVED",
          startDate: { lte: periodEndDate },
          endDate: { gte: periodStartDate },
        },
        include: {
          leaveType: { select: { name: true } },
        },
      });

      // Index leaves by date
      const leavesByDate = new Map<string, { leaveTypeName: string }>();
      for (const leave of approvedLeaves) {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateKey = d.toISOString().split("T")[0];
          leavesByDate.set(dateKey, {
            leaveTypeName: leave.leaveType?.name || "Leave",
          });
        }
      }

      // Get holidays from calendar for the period
      // Normalize date range to avoid timezone issues (calendar events stored at noon UTC)
      const holidayRangeStart = new Date(periodStartDate);
      holidayRangeStart.setUTCHours(0, 0, 0, 0);
      const holidayRangeEnd = new Date(periodEndDate);
      holidayRangeEnd.setUTCHours(23, 59, 59, 999);

      const calendarHolidays = await prisma.calendarEvent.findMany({
        where: {
          calendar: { companyId: auth.user.companyId, isActive: true },
          date: { gte: holidayRangeStart, lte: holidayRangeEnd },
        },
        select: { date: true, name: true, dayType: true },
      });

      const holidaysByDate = new Map<string, { name: string; dayType: string }>();
      for (const holiday of calendarHolidays) {
        holidaysByDate.set(holiday.date.toISOString().split("T")[0], {
          name: holiday.name,
          dayType: holiday.dayType,
        });
      }

      // Helper to calculate attendance metrics using shared utilities (per SPEC_V1.md)
      const calcMetricsForPdf = (
        actualTimeIn: Date | null,
        actualTimeOut: Date | null,
        scheduledStartTime: Date | string | null,
        scheduledEndTime: Date | string | null,
        breakMinutes: number,
        earlyInApproved: boolean,
        lateOutApproved: boolean,
        lateInApproved: boolean,
        earlyOutApproved: boolean,
        isOvernight: boolean,
        dayType: string,
        attendanceDate: Date,
        shiftBreakMinutes?: number,
        breakMinutesApplied?: number | null,
        breakStartTime?: Date | string | null,
        breakEndTime?: Date | string | null
      ) => {
        if (!actualTimeIn || !actualTimeOut) {
          return { workedMinutes: 0, lateMinutes: 0, undertimeMinutes: 0, otEarlyInMinutes: 0, otLateOutMinutes: 0, otBreakMinutes: 0, overtimeRestDayMinutes: 0, overtimeHolidayMinutes: 0, nightDiffMinutes: 0 };
        }

        const clockIn = new Date(actualTimeIn);
        const clockOut = new Date(actualTimeOut);

        // Use shared canonical utility for late/undertime/OT (per SPEC_V1.md)
        const calc = calculateAttendanceTimes(
          actualTimeIn,
          actualTimeOut,
          scheduledStartTime,
          scheduledEndTime,
          attendanceDate,
          earlyInApproved,
          lateOutApproved,
          shiftBreakMinutes,
          breakMinutesApplied,
          breakStartTime,
          breakEndTime
        );

        // Apply excusal flags
        const lateMinutes = lateInApproved ? 0 : calc.lateMinutes;
        const undertimeMinutes = earlyOutApproved ? 0 : calc.undertimeMinutes;

        // Extract schedule times using shared utility
        const startTime = extractTimeComponents(scheduledStartTime);
        const endTime = extractTimeComponents(scheduledEndTime);

        // Calculate worked minutes
        // Convert UTC times to Philippines time (UTC+8) for ND calculation
        const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
        const clockInPHT = new Date(clockIn.getTime() + PHT_OFFSET_MS);
        const clockOutPHT = new Date(clockOut.getTime() + PHT_OFFSET_MS);
        const actualInMin = clockInPHT.getUTCHours() * 60 + clockInPHT.getUTCMinutes();
        const actualOutMin = clockOutPHT.getUTCHours() * 60 + clockOutPHT.getUTCMinutes();

        let workedMinutes = 0;
        // Effective clock times: bounded by schedule unless OT approved (used for ND calc too)
        let effectiveClockIn = clockIn;
        let effectiveClockOut = clockOut;
        if (startTime && endTime) {
          // Build schedule times using Manila timezone utility
          const schedStart = setManilaHours(new Date(attendanceDate), startTime.hours, startTime.minutes);
          const schedEnd = setManilaHours(new Date(attendanceDate), endTime.hours, endTime.minutes);

          // Handle overnight shifts
          if (endTime.hours < startTime.hours || isOvernight) {
            schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
          }

          // Calculate effective clock times (schedule-bounded unless OT approved)
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
          // No schedule - calculate raw worked time
          let rawWorked = actualOutMin - actualInMin;
          if (rawWorked < 0 || isOvernight) rawWorked += 1440;
          workedMinutes = Math.max(0, rawWorked - breakMinutes);
        }

        // Rest day/holiday OT
        const isRestDay = dayType === "REST_DAY";
        const isHoliday = dayType === "REGULAR_HOLIDAY" || dayType === "SPECIAL_HOLIDAY";
        const overtimeRestDayMinutes = isRestDay && workedMinutes > 0 ? workedMinutes : 0;
        const overtimeHolidayMinutes = isHoliday && workedMinutes > 0 ? workedMinutes : 0;

        // Calculate night diff on effective (schedule-bounded) times (10pm-6am)
        // ND only applies to approved work time, not unapproved OT
        const effectiveInPHT = new Date(effectiveClockIn.getTime() + PHT_OFFSET_MS);
        const effectiveOutPHT = new Date(effectiveClockOut.getTime() + PHT_OFFSET_MS);
        const effectiveInMin = effectiveInPHT.getUTCHours() * 60 + effectiveInPHT.getUTCMinutes();
        const effectiveOutMin = effectiveOutPHT.getUTCHours() * 60 + effectiveOutPHT.getUTCMinutes();

        let nightDiffMinutes = 0;
        const nightStart = 22 * 60;
        const nightEnd = 6 * 60;
        const overlapMinutes = (start: number, end: number, rangeStart: number, rangeEnd: number): number => {
          const overlapStart = Math.max(start, rangeStart);
          const overlapEnd = Math.min(end, rangeEnd);
          return Math.max(0, overlapEnd - overlapStart);
        };

        if (effectiveOutMin > effectiveInMin) {
          nightDiffMinutes += overlapMinutes(effectiveInMin, effectiveOutMin, nightStart, 1440);
          nightDiffMinutes += overlapMinutes(effectiveInMin, effectiveOutMin, 0, nightEnd);
        } else {
          nightDiffMinutes += overlapMinutes(effectiveInMin, 1440, nightStart, 1440);
          nightDiffMinutes += overlapMinutes(0, effectiveOutMin, 0, nightEnd);
        }

        return {
          workedMinutes,
          lateMinutes,
          undertimeMinutes,
          otEarlyInMinutes: calc.otEarlyInMinutes,
          otLateOutMinutes: calc.otLateOutMinutes,
          otBreakMinutes: calc.otBreakMinutes,
          overtimeRestDayMinutes,
          overtimeHolidayMinutes,
          nightDiffMinutes,
        };
      };

      // Pre-calculate metrics for all attendance records
      const attendanceWithCalc = attendanceRecords.map((record) => {
        const shiftBreakMin = record.shiftTemplate?.breakMinutes ?? 60;
        const breakMin = record.breakMinutesApplied ?? shiftBreakMin;
        const isOvernight = record.shiftTemplate?.isOvernight ?? false;
        const schedStart = record.shiftTemplate?.startTime ?? null;
        const schedEnd = record.shiftTemplate?.endTime ?? null;
        const breakStartTime = record.shiftTemplate?.breakStartTime ?? null;
        const breakEndTime = record.shiftTemplate?.breakEndTime ?? null;

        const calc = calcMetricsForPdf(
          record.actualTimeIn,
          record.actualTimeOut,
          schedStart,
          schedEnd,
          breakMin,
          record.earlyInApproved ?? false,
          record.lateOutApproved ?? false,
          record.lateInApproved ?? false,
          record.earlyOutApproved ?? false,
          isOvernight,
          record.dayType,
          record.attendanceDate,
          shiftBreakMin,
          record.breakMinutesApplied,
          breakStartTime,
          breakEndTime
        );

        return { record, calc };
      });

      // Extract rates from payProfileSnapshot
      const payProfile = payslip.payProfileSnapshot as {
        baseSalary?: number;
        wageType?: string;
        derivedRates?: {
          dailyRate?: number;
          hourlyRate?: number;
          minuteRate?: number;
          monthlyRate?: number;
        };
      } | null;

      const rates = {
        dailyRate: payProfile?.derivedRates?.dailyRate ?? 0,
        hourlyRate: payProfile?.derivedRates?.hourlyRate ?? 0,
        minuteRate: payProfile?.derivedRates?.minuteRate ?? 0,
        monthlyRate: payProfile?.derivedRates?.monthlyRate,
        wageType: (payProfile?.wageType || "DAILY") as "MONTHLY" | "DAILY" | "HOURLY",
      };

      // Build attendance summary using calculated values (matching UI format)
      const workDayRecords = attendanceWithCalc.filter(({ record }) => record.dayType === "WORKDAY");
      const restDayRecords = attendanceWithCalc.filter(({ record }) => record.dayType === "REST_DAY");
      const regularHolidayRecords = attendanceWithCalc.filter(({ record }) => record.dayType === "REGULAR_HOLIDAY");
      const specialHolidayRecords = attendanceWithCalc.filter(({ record }) => record.dayType === "SPECIAL_HOLIDAY");

      // Count days with actual work
      const presentWorkDays = workDayRecords.filter(({ calc }) => calc.workedMinutes > 0).length;
      const absentWorkDays = workDayRecords.filter(({ calc }) => calc.workedMinutes === 0).length;
      const restDaysWorked = restDayRecords.filter(({ calc }) => calc.workedMinutes > 0).length;
      const regularHolidaysWorked = regularHolidayRecords.filter(({ calc }) => calc.workedMinutes > 0).length;
      const specialHolidaysWorked = specialHolidayRecords.filter(({ calc }) => calc.workedMinutes > 0).length;

      const attendanceSummary = {
        // Day counts
        workDays: workDayRecords.length,
        presentDays: presentWorkDays,
        absentDays: absentWorkDays,
        restDays: restDayRecords.length,
        restDaysWorked,
        regularHolidays: regularHolidayRecords.length,
        regularHolidaysWorked,
        specialHolidays: specialHolidayRecords.length,
        specialHolidaysWorked,
        // Time metrics
        totalLateMins: attendanceWithCalc.reduce((sum, { record, calc }) => sum + (record.lateInApproved ? 0 : calc.lateMinutes), 0),
        totalUndertimeMins: attendanceWithCalc.reduce((sum, { record, calc }) => sum + (record.earlyOutApproved ? 0 : calc.undertimeMinutes), 0),
        regularOtMins: attendanceWithCalc.reduce(
          (sum, { record, calc }) =>
            sum +
            (record.lateOutApproved ? calc.otLateOutMinutes : 0) +
            (record.earlyInApproved ? calc.otEarlyInMinutes : 0),
          0
        ),
        restDayOtMins: attendanceWithCalc.reduce((sum, { calc }) => sum + calc.overtimeRestDayMinutes, 0),
        holidayOtMins: attendanceWithCalc.reduce((sum, { calc }) => sum + calc.overtimeHolidayMinutes, 0),
        totalNdMins: attendanceWithCalc.reduce((sum, { calc }) => sum + calc.nightDiffMinutes, 0),
        // Legacy fields for backward compatibility
        expectedWorkDays: workDayRecords.length,
        daysAttended: presentWorkDays,
        absences: absentWorkDays,
        totalRegularMins: attendanceWithCalc.reduce((sum, { calc }) => sum + calc.workedMinutes, 0),
        totalOtMins: attendanceWithCalc.reduce(
          (sum, { record, calc }) =>
            sum +
            (record.lateOutApproved ? calc.otLateOutMinutes : 0) +
            (record.earlyInApproved ? calc.otEarlyInMinutes : 0) +
            calc.overtimeRestDayMinutes +
            calc.overtimeHolidayMinutes,
          0
        ),
      };

      // Map attendance records for PDF using calculated values (matching UI format)
      const attendanceRecordsForPdf = attendanceWithCalc.map(({ record, calc }) => {
        const shiftTime = record.shiftTemplate
          ? `${formatTimeOnly(record.shiftTemplate.startTime)} - ${formatTimeOnly(record.shiftTemplate.endTime)}`
          : undefined;

        const dateKey = record.attendanceDate.toISOString().split("T")[0];
        const calendarHoliday = holidaysByDate.get(dateKey);
        const approvedLeave = leavesByDate.get(dateKey);

        // Get holiday info - prefer calendar holiday, fallback to record's holiday relation
        const finalHolidayName = record.holiday?.name || calendarHoliday?.name || null;
        let finalHolidayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | null = null;
        if (record.holiday?.dayType === "REGULAR_HOLIDAY" || calendarHoliday?.dayType === "REGULAR_HOLIDAY" || record.dayType === "REGULAR_HOLIDAY") {
          finalHolidayType = "REGULAR_HOLIDAY";
        } else if (record.holiday?.dayType === "SPECIAL_HOLIDAY" || calendarHoliday?.dayType === "SPECIAL_HOLIDAY" || record.dayType === "SPECIAL_HOLIDAY") {
          finalHolidayType = "SPECIAL_HOLIDAY";
        }

        // Determine effective attendance status using priority logic
        // Priority: Time logs > Approved Leave > Holiday > Record dayType > Default
        let effectiveAttendanceStatus: string;
        const hasClockData = record.actualTimeIn || record.actualTimeOut;

        if (hasClockData) {
          // Has actual attendance = PRESENT (even on holidays/leaves, if they worked)
          effectiveAttendanceStatus = calc.workedMinutes > 0 ? "PRESENT" : (record.attendanceStatus || "ABSENT");
        } else if (approvedLeave) {
          // Has an approved leave request - mark as ON_LEAVE
          effectiveAttendanceStatus = "ON_LEAVE";
        } else if (calendarHoliday || record.holiday) {
          // Date is a holiday and didn't work - use specific holiday type
          effectiveAttendanceStatus = finalHolidayType || "SPECIAL_HOLIDAY";
        } else if (record.dayType === "REST_DAY") {
          effectiveAttendanceStatus = "REST_DAY";
        } else if (record.attendanceStatus) {
          effectiveAttendanceStatus = record.attendanceStatus;
        } else {
          effectiveAttendanceStatus = "ABSENT";
        }

        // Determine effective day type
        let effectiveDayType = record.dayType;
        if (calendarHoliday && (!effectiveDayType || effectiveDayType === "WORKDAY")) {
          effectiveDayType = calendarHoliday.dayType as typeof record.dayType;
        }

        return {
          date: record.attendanceDate,
          dayType: effectiveDayType,
          attendanceStatus: effectiveAttendanceStatus,
          shiftCode: record.shiftTemplate?.code,
          shiftTime,
          timeIn: record.actualTimeIn,
          timeOut: record.actualTimeOut,
          breakMinutes: record.breakMinutesApplied ?? record.shiftTemplate?.breakMinutes ?? 60,
          // Show effective late minutes (0 if excused)
          lateMinutes: record.lateInApproved ? 0 : calc.lateMinutes,
          // Show effective undertime (0 if excused)
          undertimeMinutes: record.earlyOutApproved ? 0 : calc.undertimeMinutes,
          workedMinutes: calc.workedMinutes,
          // OT breakdown (for new PDF format)
          otEarlyInMinutes: record.earlyInApproved ? calc.otEarlyInMinutes : 0,
          otLateOutMinutes: record.lateOutApproved ? calc.otLateOutMinutes : 0,
          otRestDayMinutes: calc.overtimeRestDayMinutes,
          otBreakMinutes: calc.otBreakMinutes,
          otHolidayMinutes: calc.overtimeHolidayMinutes,
          ndMinutes: calc.nightDiffMinutes,
          // OT approval flags
          earlyInApproved: record.earlyInApproved,
          lateOutApproved: record.lateOutApproved,
          // Late/undertime approval flags (excuses the deduction)
          lateInApproved: record.lateInApproved,
          earlyOutApproved: record.earlyOutApproved,
          holidayName: finalHolidayName,
          holidayType: finalHolidayType,
          leaveTypeName: approvedLeave?.leaveTypeName || null,
          notes: record.overrideReason,
        };
      });

      // Generate PDF in memory
      const pdfContent = await generatePayslipPDF(
        {
          firstName: payslip.employee.firstName,
          lastName: payslip.employee.lastName,
          middleName: payslip.employee.middleName,
          employeeNumber: payslip.employee.employeeNumber,
          department: payslip.employee.department?.name,
          jobTitle: (payslip.employee as { jobTitle?: string | null }).jobTitle,
        },
        payslipCompany,
        {
          code: payrollRun.payPeriod.code,
          startDate: payrollRun.payPeriod.startDate,
          endDate: payrollRun.payPeriod.endDate,
          payDate: payrollRun.payPeriod.payDate,
        },
        {
          grossPay: toNum(payslip.grossPay),
          totalEarnings: toNum(payslip.totalEarnings),
          totalDeductions: toNum(payslip.totalDeductions),
          netPay: toNum(payslip.netPay),
          sssEe: toNum(payslip.sssEe),
          sssEr: toNum(payslip.sssEr),
          philhealthEe: toNum(payslip.philhealthEe),
          philhealthEr: toNum(payslip.philhealthEr),
          pagibigEe: toNum(payslip.pagibigEe),
          pagibigEr: toNum(payslip.pagibigEr),
          withholdingTax: toNum(payslip.withholdingTax),
          ytdGrossPay: toNum(payslip.ytdGrossPay),
          ytdTaxWithheld: toNum(payslip.ytdTaxWithheld),
          lines: payslip.lines.map((line) => ({
            category: line.category,
            description: line.description,
            amount: toNum(line.amount),
            quantity: line.quantity ? toNum(line.quantity) : null,
            rate: line.rate ? toNum(line.rate) : null,
            multiplier: line.multiplier ? toNum(line.multiplier) : null,
          })),
          rates,
          attendanceSummary,
          attendanceRecords: attendanceRecordsForPdf,
        }
      );

      const employeeName = `${payslip.employee.lastName}_${payslip.employee.firstName}`;
      const fileName = `${payslip.employee.employeeNumber}_${employeeName}_${payPeriodCode}.pdf`;

      filesToAdd.push({ content: pdfContent, fileName });
    }

    if (filesToAdd.length === 0) {
      return {
        success: false,
        error: "No payslips available for export",
      };
    }

    // Create ZIP archive in memory - set up event handlers BEFORE adding files
    const archive = archiver("zip", { zlib: { level: 9 } });

    // Set up the promise to collect all data BEFORE adding anything
    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      archive.on("warning", (err: Error & { code?: string }) => {
        if (err.code !== "ENOENT") reject(err);
      });
    });

    // Add all files to the archive
    for (const file of filesToAdd) {
      archive.append(file.content, { name: file.fileName });
    }

    // Finalize and wait for completion
    archive.finalize();
    const zipContent = await archivePromise;

    // Generate filename
    const companyName = payrollRun.payPeriod.calendar.company.name.replace(/[^a-zA-Z0-9]/g, "_");
    const zipFileName = `Payslips_${companyName}_${payPeriodCode}.zip`;

    // Return as base64 data URL for direct download
    const base64Content = zipContent.toString("base64");
    const downloadUrl = `data:application/zip;base64,${base64Content}`;

    return {
      success: true,
      downloadUrl,
      fileName: zipFileName,
    };
  } catch (error) {
    console.error("Failed to generate payslip PDF ZIP export:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate export",
    };
  }
}
