"use server";

// =============================================================================
// PeopleOS PH - Document Server Actions
// =============================================================================
// Server actions for document generation with RBAC and audit logging.
// Uses PDFKit for professional PDF generation.
// =============================================================================

import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { revalidatePath } from "next/cache";
import { setManilaHours } from "@/lib/utils/timezone";

// Import PDF generators
import {
  generateEmploymentContractPDF,
  generateCertificateOfEmploymentPDF,
  generateSalaryChangMemoPDF,
  generateRegularizationMemoPDF,
  generateSeparationClearancePDF,
  generatePayslipPDF,
  generateDisciplinaryWarningPDF,
  generateDisciplinaryActionPDF,
  generateNoticeToExplainPDF,
  generateNoticeOfDecisionPDF,
  generateRepaymentAgreementPDF,
  generateOfferLetterPDF,
  generateQuitclaimReleasePDF,
  generateLateralTransferPDF,
  type RoleScorecardData,
  type DisciplinaryWarningOptions,
  type DisciplinaryActionOptions,
  type RepaymentAgreementOptions,
  type OfferLetterOptions,
  type QuitclaimOptions,
  type LateralTransferOptions,
} from "@/lib/pdf/generators";

// Document storage path (matches the API route)
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/documents";

export type DocumentType =
  | "salary_change_memo"
  | "regularization_memo"
  | "separation_clearance"
  | "certificate_of_employment"
  | "payslip"
  | "employment_contract"
  | "disciplinary_warning"
  | "disciplinary_action"
  | "notice_to_explain"
  | "notice_of_decision"
  | "repayment_agreement"
  | "offer_letter"
  | "quitclaim_release"
  | "lateral_transfer";

// NOTE: RoleScorecardData type is available from "@/lib/pdf/generators"
// Server actions cannot export types, so import types from the generators module

// Employment contract options
export interface EmploymentContractOptions {
  dailySalaryRate: number;
  probationStartDate: string;
  probationEndDate: string;
  workSchedule?: {
    daysPerWeek: string;
    hoursPerDay: number;
  };
  roleScorecardId?: string; // Reference to RoleScorecard entity - baseSalary will be retrieved from here
  employerRepresentative?: {
    name: string;
    title: string;
  };
  witnesses?: Array<{
    name: string;
    position: string;
  }>;
}

/**
 * Generate a document for an employee.
 * Permission: document:generate
 */
export async function generateDocument(
  employeeId: string,
  documentType: DocumentType,
  options?: Record<string, unknown>
) {
  const auth = await assertPermission(Permission.DOCUMENT_GENERATE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      employeeNumber: true,
      hireDate: true,
      jobTitle: true,
      hiringEntity: {
        select: {
          id: true,
          code: true,
          name: true,
          tradeName: true,
          tin: true,
          sssEmployerId: true,
          philhealthEmployerId: true,
          pagibigEmployerId: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
        },
      },
      presentAddressLine1: true,
      presentCity: true,
      presentProvince: true,
      company: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      roleScorecard: {
        select: {
          baseSalary: true,
          wageType: true,
        },
      },
    },
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  try {
    const fileName = `${documentType}_${employee.employeeNumber}_${Date.now()}.pdf`;
    const relativePath = `${employeeId}/${fileName}`;
    const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

    // Ensure directory exists
    await mkdir(dirname(absolutePath), { recursive: true });

    // Generate document content using PDFKit generators
    const pdfContent = await generateDocumentPDF(
      documentType,
      employee,
      options as EmploymentContractOptions | undefined
    );

    // Write file to disk
    await writeFile(absolutePath, pdfContent);

    // Create document record (store relative path)
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType,
        title: getDocumentTitle(documentType),
        description: `Generated on ${new Date().toLocaleDateString()}`,
        filePath: relativePath,
        fileName,
        fileSizeBytes: BigInt(pdfContent.length),
        mimeType: "application/pdf",
        uploadedById: auth.user.id,
        // For documents that need acknowledgment
        requiresAcknowledgment: ["salary_change_memo", "regularization_memo"].includes(
          documentType
        ),
      },
    });

    await audit.create("EmployeeDocument", document.id, {
      employeeId,
      employeeNumber: employee.employeeNumber,
      documentType,
      fileName,
      options,
    });

    // Revalidate documents tab
    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      documentId: document.id,
      downloadUrl: `/api/documents/${document.id}`,
      message: "Document generated successfully",
    };
  } catch (error) {
    console.error("Failed to generate document:", error);
    return { success: false, error: "Failed to generate document" };
  }
}

/**
 * Internal function to auto-generate documents from employment events.
 * This is called internally after event approval - no permission check needed.
 */
export async function autoGenerateEventDocument(
  employeeId: string,
  eventId: string,
  documentType: DocumentType,
  generatedByUserId: string,
  options?: Record<string, unknown>
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      deletedAt: null,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
        },
      },
      hiringEntity: {
        select: {
          id: true,
          code: true,
          name: true,
          tradeName: true,
          tin: true,
          sssEmployerId: true,
          philhealthEmployerId: true,
          pagibigEmployerId: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      roleScorecard: {
        select: {
          baseSalary: true,
          wageType: true,
        },
      },
    },
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  try {
    const fileName = `${documentType}_${employee.employeeNumber}_${Date.now()}.pdf`;
    const relativePath = `${employeeId}/${fileName}`;
    const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

    // Ensure directory exists
    await mkdir(dirname(absolutePath), { recursive: true });

    // Generate document content using PDFKit generators
    const pdfContent = await generateDocumentPDF(
      documentType,
      employee,
      options as EmploymentContractOptions | undefined
    );

    // Write file to disk
    await writeFile(absolutePath, pdfContent);

    // Create document record linked to the event
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId,
        documentType,
        title: getDocumentTitle(documentType),
        description: `Auto-generated on ${new Date().toLocaleDateString()} from employment event`,
        filePath: relativePath,
        fileName,
        fileSizeBytes: BigInt(pdfContent.length),
        mimeType: "application/pdf",
        uploadedById: generatedByUserId,
        generatedFromEventId: eventId,
        requiresAcknowledgment: ["salary_change_memo", "regularization_memo"].includes(documentType),
      },
    });

    // Revalidate documents tab
    revalidatePath(`/employees/${employeeId}`);

    return { success: true, documentId: document.id };
  } catch (error) {
    console.error(`Failed to auto-generate ${documentType}:`, error);
    return { success: false, error: `Failed to generate ${documentType}` };
  }
}

/**
 * Generate payslips for a payroll run.
 * Permission: payslip:generate
 */
export async function generatePayslips(payrollRunId: string) {
  const auth = await assertPermission(Permission.PAYSLIP_GENERATE);

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
              department: true,
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
      },
    },
  });

  // Get pay period dates for attendance query
  const periodStartDate = payrollRun?.payPeriod.startDate;
  const periodEndDate = payrollRun?.payPeriod.endDate;

  if (!payrollRun) {
    return { success: false, error: "Payroll run not found" };
  }

  if (!["APPROVED", "RELEASED"].includes(payrollRun.status)) {
    return {
      success: false,
      error: "Payslips can only be generated for approved payroll runs",
    };
  }

  const company = payrollRun.payPeriod.calendar.company;
  const payPeriod = payrollRun.payPeriod;

  try {
    const generated: string[] = [];

    for (const payslip of payrollRun.payslips) {
      const fileName = `payslip_${payslip.employee.employeeNumber}_${payPeriod.code}.pdf`;
      const relativePath = `payslips/${payrollRunId}/${fileName}`;
      const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

      // Ensure directory exists
      await mkdir(dirname(absolutePath), { recursive: true });

      // Convert Decimal values to numbers
      const toNum = (val: unknown) =>
        typeof val === "object" && val !== null && "toNumber" in val
          ? (val as { toNumber: () => number }).toNumber()
          : Number(val);

      // Use hiring entity info for payslip header when available
      const payslipCompany = payslip.employee.hiringEntity
        ? {
            name: payslip.employee.hiringEntity.tradeName || payslip.employee.hiringEntity.name,
            addressLine1: payslip.employee.hiringEntity.addressLine1,
            city: payslip.employee.hiringEntity.city,
            province: payslip.employee.hiringEntity.province,
          }
        : company;

      // Fetch attendance records for this employee for the pay period
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
            },
          },
          holiday: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { attendanceDate: "desc" },
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

      // Build attendance summary from records
      const workDayRecords = attendanceRecords.filter((r) => r.dayType === "WORKDAY");
      const attendedRecords = workDayRecords.filter(
        (r) => r.attendanceStatus === "PRESENT" || r.attendanceStatus === "HALF_DAY"
      );
      const absentRecords = workDayRecords.filter((r) => r.attendanceStatus === "ABSENT");

      // Calculate attendance summary values on the fly
      let totalRegularMins = 0;
      let totalNdMins = 0;
      let totalLateMins = 0;
      let totalUndertimeMins = 0;
      let regularOtMins = 0;
      let restDayOtMins = 0;
      let holidayOtMins = 0;

      // Count day types
      const restDayRecords = attendanceRecords.filter((r) => r.dayType === "REST_DAY");
      const regularHolidayRecords = attendanceRecords.filter((r) => r.dayType === "REGULAR_HOLIDAY");
      const specialHolidayRecords = attendanceRecords.filter((r) => r.dayType === "SPECIAL_HOLIDAY");

      const restDaysWorked = restDayRecords.filter((r) => r.actualTimeIn && r.actualTimeOut).length;
      const regularHolidaysWorked = regularHolidayRecords.filter((r) => r.actualTimeIn && r.actualTimeOut).length;
      const specialHolidaysWorked = specialHolidayRecords.filter((r) => r.actualTimeIn && r.actualTimeOut).length;

      // Helper to extract time in minutes
      const getTimeMinutes = (time: Date | string | null | undefined): number | null => {
        if (!time) return null;
        if (typeof time === 'string') {
          const parts = time.split(':').map(Number);
          return parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] * 60 + parts[1] : null;
        }
        if (time instanceof Date && !isNaN(time.getTime())) {
          return time.getUTCHours() * 60 + time.getUTCMinutes();
        }
        return null;
      };

      for (const r of attendanceRecords) {
        if (!r.actualTimeIn || !r.actualTimeOut) continue;

        const breakMins = r.breakMinutesApplied ?? r.shiftTemplate?.breakMinutes ?? 60;
        const grossWorkedMs = r.actualTimeOut.getTime() - r.actualTimeIn.getTime();
        const grossWorkedMins = Math.round(grossWorkedMs / (1000 * 60));

        const schedStartMs = getTimeMinutes(r.shiftTemplate?.startTime);
        const schedEndMs = getTimeMinutes(r.shiftTemplate?.endTime);

        // Calculate late
        if (schedStartMs !== null) {
          const clockInMs = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
          if (clockInMs > schedStartMs && !r.lateInApproved) {
            totalLateMins += clockInMs - schedStartMs;
          }
        }

        // Calculate undertime
        if (schedEndMs !== null) {
          const clockOutMs = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
          if (clockOutMs < schedEndMs && !r.earlyOutApproved) {
            totalUndertimeMins += schedEndMs - clockOutMs;
          }
        }

        // Calculate worked minutes (bounded by schedule unless OT approved)
        let effectiveWorkedMins = grossWorkedMins;
        if (schedStartMs !== null && schedEndMs !== null) {
          const scheduledMins = schedEndMs > schedStartMs ? schedEndMs - schedStartMs : schedEndMs + 1440 - schedStartMs;
          effectiveWorkedMins = Math.min(grossWorkedMins, scheduledMins);
        }
        totalRegularMins += Math.max(0, effectiveWorkedMins - breakMins);

        // Calculate OT (approved early in + late out + rest day/holiday)
        if (r.earlyInApproved && schedStartMs !== null) {
          const clockInMs = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
          if (clockInMs < schedStartMs) {
            regularOtMins += schedStartMs - clockInMs;
          }
        }
        if (r.lateOutApproved && schedEndMs !== null) {
          const clockOutMs = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
          if (clockOutMs > schedEndMs) {
            regularOtMins += clockOutMs - schedEndMs;
          }
        }
        if (r.dayType === "REST_DAY") {
          restDayOtMins += Math.max(0, grossWorkedMins - breakMins);
        } else if (r.dayType === "REGULAR_HOLIDAY" || r.dayType === "SPECIAL_HOLIDAY") {
          holidayOtMins += Math.max(0, grossWorkedMins - breakMins);
        }

        // Night differential (simplified - full calculation would check 10pm-6am)
        // For dashboard purposes, estimate based on shift times
        const ND_START = 22 * 60; // 10pm
        const ND_END = 6 * 60;    // 6am
        const clockInMins = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
        const clockOutMins = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
        if (clockInMins >= ND_START || clockOutMins <= ND_END || clockOutMins >= ND_START) {
          // Simplified: assume some ND if any part of shift is in ND hours
          totalNdMins += Math.min(60, grossWorkedMins); // Cap at 60 for estimation
        }
      }

      const attendanceSummary = {
        workDays: workDayRecords.length,
        presentDays: attendedRecords.length,
        absentDays: absentRecords.length,
        restDays: restDayRecords.length,
        restDaysWorked,
        regularHolidays: regularHolidayRecords.length,
        regularHolidaysWorked,
        specialHolidays: specialHolidayRecords.length,
        specialHolidaysWorked,
        totalLateMins,
        totalUndertimeMins,
        regularOtMins,
        restDayOtMins,
        holidayOtMins,
        totalNdMins,
      };

      // Map attendance records to payslip format
      // Calculate late/OT on the fly (same as attendance tab)
      const attendanceRecordsForPdf = attendanceRecords.map((record) => {
        const shiftTime = record.shiftTemplate
          ? `${formatTimeOnly(record.shiftTemplate.startTime)} - ${formatTimeOnly(record.shiftTemplate.endTime)}`
          : undefined;

        // Get scheduled times: record override > shift template
        let scheduledStartTime: string | null = null;
        let scheduledEndTime: string | null = null;

        // Helper to extract hours:minutes from TIME field (handles both Date and string)
        const extractTime = (time: Date | string | unknown): { h: number; m: number } | null => {
          if (!time) return null;
          if (typeof time === 'string') {
            const parts = time.split(':').map(Number);
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              return { h: parts[0], m: parts[1] };
            }
            return null;
          }
          if (time instanceof Date && !isNaN(time.getTime())) {
            return { h: time.getUTCHours(), m: time.getUTCMinutes() };
          }
          // Try to convert to Date
          const d = new Date(time as string | number | Date);
          if (!isNaN(d.getTime())) {
            return { h: d.getUTCHours(), m: d.getUTCMinutes() };
          }
          return null;
        };

        // Get scheduled times from shift template
        if (record.shiftTemplate?.startTime) {
          const startT = extractTime(record.shiftTemplate.startTime);
          if (startT) scheduledStartTime = `${startT.h.toString().padStart(2, '0')}:${startT.m.toString().padStart(2, '0')}`;
        }

        if (record.shiftTemplate?.endTime) {
          const endT = extractTime(record.shiftTemplate.endTime);
          if (endT) scheduledEndTime = `${endT.h.toString().padStart(2, '0')}:${endT.m.toString().padStart(2, '0')}`;
        }

        // Calculate late/undertime/OT on the fly
        let lateMinutes = 0;
        let undertimeMinutes = 0;
        let earlyInMinutes = 0;
        let lateOutMinutes = 0;
        let workedMinutes = 0;
        const breakMinutes = record.breakMinutesApplied ?? record.shiftTemplate?.breakMinutes ?? 60;

        const clockIn = record.actualTimeIn;
        const clockOut = record.actualTimeOut;

        if (clockIn && clockOut && scheduledStartTime && scheduledEndTime) {
          const [startH, startM] = scheduledStartTime.split(':').map(Number);
          const [endH, endM] = scheduledEndTime.split(':').map(Number);

          const schedStart = setManilaHours(new Date(record.attendanceDate), startH, startM);
          const schedEnd = setManilaHours(new Date(record.attendanceDate), endH, endM);

          // Handle overnight shifts
          if (endH < startH) {
            schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
          }

          // Late minutes (clock in after schedule start)
          if (clockIn > schedStart && !record.lateInApproved) {
            lateMinutes = Math.round((clockIn.getTime() - schedStart.getTime()) / (1000 * 60));
          }

          // Early In OT (clock in before schedule start, only if approved)
          if (clockIn < schedStart && record.earlyInApproved) {
            earlyInMinutes = Math.round((schedStart.getTime() - clockIn.getTime()) / (1000 * 60));
          }

          // Undertime minutes (clock out before schedule end)
          if (clockOut < schedEnd && !record.earlyOutApproved) {
            undertimeMinutes = Math.round((schedEnd.getTime() - clockOut.getTime()) / (1000 * 60));
          }

          // Late Out OT (clock out after schedule end, only if approved)
          if (clockOut > schedEnd && record.lateOutApproved) {
            lateOutMinutes = Math.round((clockOut.getTime() - schedEnd.getTime()) / (1000 * 60));
          }

          // Calculate worked minutes (schedule-bounded unless OT approved)
          let effectiveClockIn = clockIn;
          let effectiveClockOut = clockOut;

          if (clockIn < schedStart && !record.earlyInApproved) {
            effectiveClockIn = schedStart;
          }
          if (clockOut > schedEnd && !record.lateOutApproved) {
            effectiveClockOut = schedEnd;
          }

          const effectiveDiffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime();
          const grossMinutes = Math.max(0, Math.round(effectiveDiffMs / (1000 * 60)));
          const applyBreak = grossMinutes > 300 ? breakMinutes : 0;
          workedMinutes = Math.max(0, grossMinutes - applyBreak);
        }

        // Calculate rest day/holiday OT (entire worked time on those days)
        let restDayOt = 0;
        let holidayOt = 0;
        if (record.dayType === "REST_DAY" && workedMinutes > 0) {
          restDayOt = workedMinutes;
        }
        if ((record.dayType === "REGULAR_HOLIDAY" || record.dayType === "SPECIAL_HOLIDAY") && workedMinutes > 0) {
          holidayOt = workedMinutes;
        }

        // Calculate night differential on the fly (10pm - 6am)
        let ndMinutes = 0;
        if (clockIn && clockOut) {
          const ND_START = 22 * 60; // 10pm
          const ND_END = 6 * 60 + 1440; // 6am next day
          const clockInMins = clockIn.getHours() * 60 + clockIn.getMinutes();
          let clockOutMins = clockOut.getHours() * 60 + clockOut.getMinutes();
          // Handle overnight
          if (clockOutMins < clockInMins) clockOutMins += 1440;
          // Calculate overlap with ND period
          const overlapStart = Math.max(clockInMins, ND_START);
          const overlapEnd = Math.min(clockOutMins, ND_END);
          if (overlapEnd > overlapStart) {
            ndMinutes = overlapEnd - overlapStart;
          }
        }

        // Total OT = early in + late out + rest day + holiday OT
        const totalOtMinutes = lateOutMinutes + earlyInMinutes + restDayOt + holidayOt;

        return {
          date: record.attendanceDate,
          dayType: record.dayType,
          shiftCode: record.shiftTemplate?.code,
          shiftTime,
          timeIn: record.actualTimeIn,
          timeOut: record.actualTimeOut,
          breakMinutes,
          lateMinutes,
          undertimeMinutes,
          workedMinutes,
          otMinutes: totalOtMinutes,
          otEarlyInMinutes: earlyInMinutes,
          otLateOutMinutes: lateOutMinutes,
          otRestDayMinutes: restDayOt,
          otHolidayMinutes: holidayOt,
          ndMinutes,
          earlyInApproved: record.earlyInApproved,
          lateOutApproved: record.lateOutApproved,
          lateInApproved: record.lateInApproved,
          earlyOutApproved: record.earlyOutApproved,
          holidayName: record.holiday?.name,
          notes: record.overrideReason,
        };
      });

      // Generate payslip PDF content using PDFKit
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
          code: payPeriod.code,
          startDate: payPeriod.startDate,
          endDate: payPeriod.endDate,
          payDate: payPeriod.payDate,
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

      // Write file to disk
      await writeFile(absolutePath, pdfContent);

      // Update payslip record
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: {
          pdfPath: relativePath,
          pdfGeneratedAt: new Date(),
        },
      });

      generated.push(payslip.id);
    }

    await audit.create("PayslipBatch", payrollRunId, {
      payrollRunId,
      payPeriodCode: payPeriod.code,
      count: generated.length,
    });

    // Revalidate payroll page
    revalidatePath("/payroll");

    return {
      success: true,
      count: generated.length,
      message: `Generated ${generated.length} payslips`,
    };
  } catch (error) {
    console.error("Failed to generate payslips:", error);
    return { success: false, error: "Failed to generate payslips" };
  }
}

/**
 * Internal function for auto-generating payslips (called from approvePayroll).
 * No permission check - called only from approved contexts.
 */
export async function generatePayslipsInternal(payrollRunId: string, userId: string) {
  const headersList = await headers();
  const audit = createAuditLogger({
    userId,
    userEmail: "system@payrollos.ph",
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const payrollRun = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
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
              department: true,
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
      },
    },
  });

  if (!payrollRun) {
    console.error("Payroll run not found for PDF generation:", payrollRunId);
    return { success: false, error: "Payroll run not found" };
  }

  // Get pay period dates for attendance query
  const periodStartDate = payrollRun.payPeriod.startDate;
  const periodEndDate = payrollRun.payPeriod.endDate;

  const company = payrollRun.payPeriod.calendar.company;
  const payPeriod = payrollRun.payPeriod;

  try {
    const generated: string[] = [];

    for (const payslip of payrollRun.payslips) {
      const fileName = `payslip_${payslip.employee.employeeNumber}_${payPeriod.code}.pdf`;
      const relativePath = `payslips/${payrollRunId}/${fileName}`;
      const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

      // Ensure directory exists
      await mkdir(dirname(absolutePath), { recursive: true });

      // Convert Decimal values to numbers
      const toNum = (val: unknown) =>
        typeof val === "object" && val !== null && "toNumber" in val
          ? (val as { toNumber: () => number }).toNumber()
          : Number(val);

      // Use hiring entity info for payslip header when available
      const payslipCompany = payslip.employee.hiringEntity
        ? {
            name: payslip.employee.hiringEntity.tradeName || payslip.employee.hiringEntity.name,
            addressLine1: payslip.employee.hiringEntity.addressLine1,
            city: payslip.employee.hiringEntity.city,
            province: payslip.employee.hiringEntity.province,
          }
        : company;

      // Fetch attendance records for this employee for the pay period
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
            },
          },
          holiday: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { attendanceDate: "desc" },
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

      // Build attendance summary from records
      const workDayRecords = attendanceRecords.filter((r) => r.dayType === "WORKDAY");
      const attendedRecords = workDayRecords.filter(
        (r) => r.attendanceStatus === "PRESENT" || r.attendanceStatus === "HALF_DAY"
      );
      const absentRecords = workDayRecords.filter((r) => r.attendanceStatus === "ABSENT");

      // Calculate attendance summary values on the fly
      let totalRegularMins = 0;
      let totalNdMins = 0;
      let totalLateMins = 0;
      let totalUndertimeMins = 0;
      let regularOtMins = 0;
      let restDayOtMins = 0;
      let holidayOtMins = 0;

      // Count day types
      const restDayRecords = attendanceRecords.filter((r) => r.dayType === "REST_DAY");
      const regularHolidayRecords = attendanceRecords.filter((r) => r.dayType === "REGULAR_HOLIDAY");
      const specialHolidayRecords = attendanceRecords.filter((r) => r.dayType === "SPECIAL_HOLIDAY");

      const restDaysWorked = restDayRecords.filter((r) => r.actualTimeIn && r.actualTimeOut).length;
      const regularHolidaysWorked = regularHolidayRecords.filter((r) => r.actualTimeIn && r.actualTimeOut).length;
      const specialHolidaysWorked = specialHolidayRecords.filter((r) => r.actualTimeIn && r.actualTimeOut).length;

      // Helper to extract time in minutes
      const getTimeMinutes = (time: Date | string | null | undefined): number | null => {
        if (!time) return null;
        if (typeof time === 'string') {
          const parts = time.split(':').map(Number);
          return parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts[0] * 60 + parts[1] : null;
        }
        if (time instanceof Date && !isNaN(time.getTime())) {
          return time.getUTCHours() * 60 + time.getUTCMinutes();
        }
        return null;
      };

      for (const r of attendanceRecords) {
        if (!r.actualTimeIn || !r.actualTimeOut) continue;

        const breakMins = r.breakMinutesApplied ?? r.shiftTemplate?.breakMinutes ?? 60;
        const grossWorkedMs = r.actualTimeOut.getTime() - r.actualTimeIn.getTime();
        const grossWorkedMins = Math.round(grossWorkedMs / (1000 * 60));

        const schedStartMs = getTimeMinutes(r.shiftTemplate?.startTime);
        const schedEndMs = getTimeMinutes(r.shiftTemplate?.endTime);

        // Calculate late
        if (schedStartMs !== null) {
          const clockInMs = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
          if (clockInMs > schedStartMs && !r.lateInApproved) {
            totalLateMins += clockInMs - schedStartMs;
          }
        }

        // Calculate undertime
        if (schedEndMs !== null) {
          const clockOutMs = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
          if (clockOutMs < schedEndMs && !r.earlyOutApproved) {
            totalUndertimeMins += schedEndMs - clockOutMs;
          }
        }

        // Calculate worked minutes (bounded by schedule unless OT approved)
        let effectiveWorkedMins = grossWorkedMins;
        if (schedStartMs !== null && schedEndMs !== null) {
          const scheduledMins = schedEndMs > schedStartMs ? schedEndMs - schedStartMs : schedEndMs + 1440 - schedStartMs;
          effectiveWorkedMins = Math.min(grossWorkedMins, scheduledMins);
        }
        totalRegularMins += Math.max(0, effectiveWorkedMins - breakMins);

        // Calculate OT (approved early in + late out + rest day/holiday)
        if (r.earlyInApproved && schedStartMs !== null) {
          const clockInMs = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
          if (clockInMs < schedStartMs) {
            regularOtMins += schedStartMs - clockInMs;
          }
        }
        if (r.lateOutApproved && schedEndMs !== null) {
          const clockOutMs = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
          if (clockOutMs > schedEndMs) {
            regularOtMins += clockOutMs - schedEndMs;
          }
        }
        if (r.dayType === "REST_DAY") {
          restDayOtMins += Math.max(0, grossWorkedMins - breakMins);
        } else if (r.dayType === "REGULAR_HOLIDAY" || r.dayType === "SPECIAL_HOLIDAY") {
          holidayOtMins += Math.max(0, grossWorkedMins - breakMins);
        }

        // Night differential (simplified - full calculation would check 10pm-6am)
        // For dashboard purposes, estimate based on shift times
        const ND_START = 22 * 60; // 10pm
        const ND_END = 6 * 60;    // 6am
        const clockInMins = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
        const clockOutMins = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
        if (clockInMins >= ND_START || clockOutMins <= ND_END || clockOutMins >= ND_START) {
          // Simplified: assume some ND if any part of shift is in ND hours
          totalNdMins += Math.min(60, grossWorkedMins); // Cap at 60 for estimation
        }
      }

      const attendanceSummary = {
        workDays: workDayRecords.length,
        presentDays: attendedRecords.length,
        absentDays: absentRecords.length,
        restDays: restDayRecords.length,
        restDaysWorked,
        regularHolidays: regularHolidayRecords.length,
        regularHolidaysWorked,
        specialHolidays: specialHolidayRecords.length,
        specialHolidaysWorked,
        totalLateMins,
        totalUndertimeMins,
        regularOtMins,
        restDayOtMins,
        holidayOtMins,
        totalNdMins,
      };

      // Map attendance records to payslip format
      // Calculate late/OT on the fly (same as attendance tab)
      const attendanceRecordsForPdf = attendanceRecords.map((record) => {
        const shiftTime = record.shiftTemplate
          ? `${formatTimeOnly(record.shiftTemplate.startTime)} - ${formatTimeOnly(record.shiftTemplate.endTime)}`
          : undefined;

        // Get scheduled times: record override > shift template
        let scheduledStartTime: string | null = null;
        let scheduledEndTime: string | null = null;

        // Helper to extract hours:minutes from TIME field (handles both Date and string)
        const extractTime = (time: Date | string | unknown): { h: number; m: number } | null => {
          if (!time) return null;
          if (typeof time === 'string') {
            const parts = time.split(':').map(Number);
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              return { h: parts[0], m: parts[1] };
            }
            return null;
          }
          if (time instanceof Date && !isNaN(time.getTime())) {
            return { h: time.getUTCHours(), m: time.getUTCMinutes() };
          }
          // Try to convert to Date
          const d = new Date(time as string | number | Date);
          if (!isNaN(d.getTime())) {
            return { h: d.getUTCHours(), m: d.getUTCMinutes() };
          }
          return null;
        };

        // Get scheduled times from shift template
        if (record.shiftTemplate?.startTime) {
          const startT = extractTime(record.shiftTemplate.startTime);
          if (startT) scheduledStartTime = `${startT.h.toString().padStart(2, '0')}:${startT.m.toString().padStart(2, '0')}`;
        }

        if (record.shiftTemplate?.endTime) {
          const endT = extractTime(record.shiftTemplate.endTime);
          if (endT) scheduledEndTime = `${endT.h.toString().padStart(2, '0')}:${endT.m.toString().padStart(2, '0')}`;
        }

        // Calculate late/undertime/OT on the fly
        let lateMinutes = 0;
        let undertimeMinutes = 0;
        let earlyInMinutes = 0;
        let lateOutMinutes = 0;
        let workedMinutes = 0;
        const breakMinutes = record.breakMinutesApplied ?? record.shiftTemplate?.breakMinutes ?? 60;

        const clockIn = record.actualTimeIn;
        const clockOut = record.actualTimeOut;

        if (clockIn && clockOut && scheduledStartTime && scheduledEndTime) {
          const [startH, startM] = scheduledStartTime.split(':').map(Number);
          const [endH, endM] = scheduledEndTime.split(':').map(Number);

          const schedStart = setManilaHours(new Date(record.attendanceDate), startH, startM);
          const schedEnd = setManilaHours(new Date(record.attendanceDate), endH, endM);

          // Handle overnight shifts
          if (endH < startH) {
            schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
          }

          // Late minutes (clock in after schedule start)
          if (clockIn > schedStart && !record.lateInApproved) {
            lateMinutes = Math.round((clockIn.getTime() - schedStart.getTime()) / (1000 * 60));
          }

          // Early In OT (clock in before schedule start, only if approved)
          if (clockIn < schedStart && record.earlyInApproved) {
            earlyInMinutes = Math.round((schedStart.getTime() - clockIn.getTime()) / (1000 * 60));
          }

          // Undertime minutes (clock out before schedule end)
          if (clockOut < schedEnd && !record.earlyOutApproved) {
            undertimeMinutes = Math.round((schedEnd.getTime() - clockOut.getTime()) / (1000 * 60));
          }

          // Late Out OT (clock out after schedule end, only if approved)
          if (clockOut > schedEnd && record.lateOutApproved) {
            lateOutMinutes = Math.round((clockOut.getTime() - schedEnd.getTime()) / (1000 * 60));
          }

          // Calculate worked minutes (schedule-bounded unless OT approved)
          let effectiveClockIn = clockIn;
          let effectiveClockOut = clockOut;

          if (clockIn < schedStart && !record.earlyInApproved) {
            effectiveClockIn = schedStart;
          }
          if (clockOut > schedEnd && !record.lateOutApproved) {
            effectiveClockOut = schedEnd;
          }

          const effectiveDiffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime();
          const grossMinutes = Math.max(0, Math.round(effectiveDiffMs / (1000 * 60)));
          const applyBreak = grossMinutes > 300 ? breakMinutes : 0;
          workedMinutes = Math.max(0, grossMinutes - applyBreak);
        }

        // Calculate rest day/holiday OT (entire worked time on those days)
        let restDayOt = 0;
        let holidayOt = 0;
        if (record.dayType === "REST_DAY" && workedMinutes > 0) {
          restDayOt = workedMinutes;
        }
        if ((record.dayType === "REGULAR_HOLIDAY" || record.dayType === "SPECIAL_HOLIDAY") && workedMinutes > 0) {
          holidayOt = workedMinutes;
        }

        // Calculate night differential on the fly (10pm - 6am)
        let ndMinutes = 0;
        if (clockIn && clockOut) {
          const ND_START = 22 * 60; // 10pm
          const ND_END = 6 * 60 + 1440; // 6am next day
          const clockInMins = clockIn.getHours() * 60 + clockIn.getMinutes();
          let clockOutMins = clockOut.getHours() * 60 + clockOut.getMinutes();
          // Handle overnight
          if (clockOutMins < clockInMins) clockOutMins += 1440;
          // Calculate overlap with ND period
          const overlapStart = Math.max(clockInMins, ND_START);
          const overlapEnd = Math.min(clockOutMins, ND_END);
          if (overlapEnd > overlapStart) {
            ndMinutes = overlapEnd - overlapStart;
          }
        }

        // Total OT = early in + late out + rest day + holiday OT
        const totalOtMinutes = lateOutMinutes + earlyInMinutes + restDayOt + holidayOt;

        return {
          date: record.attendanceDate,
          dayType: record.dayType,
          shiftCode: record.shiftTemplate?.code,
          shiftTime,
          timeIn: record.actualTimeIn,
          timeOut: record.actualTimeOut,
          breakMinutes,
          lateMinutes,
          undertimeMinutes,
          workedMinutes,
          otMinutes: totalOtMinutes,
          otEarlyInMinutes: earlyInMinutes,
          otLateOutMinutes: lateOutMinutes,
          otRestDayMinutes: restDayOt,
          otHolidayMinutes: holidayOt,
          ndMinutes,
          earlyInApproved: record.earlyInApproved,
          lateOutApproved: record.lateOutApproved,
          lateInApproved: record.lateInApproved,
          earlyOutApproved: record.earlyOutApproved,
          holidayName: record.holiday?.name,
          notes: record.overrideReason,
        };
      });

      // Generate payslip PDF content using PDFKit
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
          code: payPeriod.code,
          startDate: payPeriod.startDate,
          endDate: payPeriod.endDate,
          payDate: payPeriod.payDate,
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

      // Write file to disk
      await writeFile(absolutePath, pdfContent);

      // Update payslip record
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: {
          pdfPath: relativePath,
          pdfGeneratedAt: new Date(),
        },
      });

      generated.push(payslip.id);
    }

    await audit.create("PayslipBatch", payrollRunId, {
      payrollRunId,
      payPeriodCode: payPeriod.code,
      count: generated.length,
      generatedBy: "auto-approval",
    });

    // Revalidate payroll page
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${payrollRunId}`);

    return {
      success: true,
      count: generated.length,
      message: `Auto-generated ${generated.length} payslips`,
    };
  } catch (error) {
    console.error("Failed to auto-generate payslips:", error);
    return { success: false, error: "Failed to auto-generate payslips" };
  }
}

/**
 * Export statutory reports.
 * Permission: export:statutory
 */
export async function exportStatutoryReport(
  reportType: "sss_r3" | "philhealth_rf1" | "pagibig_mcrf" | "bir_1601c",
  month: number,
  year: number
) {
  const auth = await assertPermission(Permission.EXPORT_STATUTORY);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  try {
    // Get pay periods for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    // Get all payslips for the month with employee statutory IDs
    const payslips = await prisma.payslip.findMany({
      where: {
        payrollRun: {
          status: { in: ["APPROVED", "RELEASED"] },
          payPeriod: {
            startDate: { gte: startDate },
            endDate: { lte: endDate },
            calendar: {
              companyId: auth.user.companyId,
            },
          },
        },
      },
      include: {
        employee: {
          include: {
            statutoryIds: true,
          },
        },
        payrollRun: {
          include: {
            payPeriod: true,
          },
        },
      },
    });

    // Aggregate by employee (may have multiple payslips per month - semi-monthly)
    const employeeData = new Map<string, {
      employee: typeof payslips[0]["employee"];
      sssEe: number;
      sssEr: number;
      philhealthEe: number;
      philhealthEr: number;
      pagibigEe: number;
      pagibigEr: number;
      withholdingTax: number;
      grossPay: number;
    }>();

    for (const payslip of payslips) {
      const existing = employeeData.get(payslip.employeeId);
      const toNum = (val: unknown) =>
        typeof val === "object" && val !== null && "toNumber" in val
          ? (val as { toNumber: () => number }).toNumber()
          : Number(val);

      if (existing) {
        existing.sssEe += toNum(payslip.sssEe);
        existing.sssEr += toNum(payslip.sssEr);
        existing.philhealthEe += toNum(payslip.philhealthEe);
        existing.philhealthEr += toNum(payslip.philhealthEr);
        existing.pagibigEe += toNum(payslip.pagibigEe);
        existing.pagibigEr += toNum(payslip.pagibigEr);
        existing.withholdingTax += toNum(payslip.withholdingTax);
        existing.grossPay += toNum(payslip.grossPay);
      } else {
        employeeData.set(payslip.employeeId, {
          employee: payslip.employee,
          sssEe: toNum(payslip.sssEe),
          sssEr: toNum(payslip.sssEr),
          philhealthEe: toNum(payslip.philhealthEe),
          philhealthEr: toNum(payslip.philhealthEr),
          pagibigEe: toNum(payslip.pagibigEe),
          pagibigEr: toNum(payslip.pagibigEr),
          withholdingTax: toNum(payslip.withholdingTax),
          grossPay: toNum(payslip.grossPay),
        });
      }
    }

    // Generate CSV content based on report type
    let csvContent: string;
    const fileName = `${reportType}_${year}_${month.toString().padStart(2, "0")}.csv`;
    const relativePath = `exports/statutory/${fileName}`;
    const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

    switch (reportType) {
      case "sss_r3":
        csvContent = generateSssR3Report(employeeData, month, year);
        break;
      case "philhealth_rf1":
        csvContent = generatePhilhealthRf1Report(employeeData, month, year);
        break;
      case "pagibig_mcrf":
        csvContent = generatePagibigMcrfReport(employeeData, month, year);
        break;
      case "bir_1601c":
        csvContent = generateBir1601cReport(employeeData, month, year);
        break;
    }

    // Ensure directory exists
    await mkdir(dirname(absolutePath), { recursive: true });

    // Write CSV file
    await writeFile(absolutePath, csvContent, "utf-8");

    await audit.export("StatutoryReport", {
      reportType,
      month,
      year,
      fileName,
      employeeCount: employeeData.size,
    });

    // Revalidate reports page
    revalidatePath("/reports");

    return {
      success: true,
      fileName,
      downloadUrl: `/api/exports/statutory/${relativePath}`,
      message: `Report generated with ${employeeData.size} employees`,
    };
  } catch (error) {
    console.error("Failed to export statutory report:", error);
    return { success: false, error: "Failed to generate report" };
  }
}

type EmployeeReportData = Map<string, {
  employee: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    employeeNumber: string;
    birthDate: Date | null;
    statutoryIds: Array<{ idType: string; idNumber: string }>;
  };
  sssEe: number;
  sssEr: number;
  philhealthEe: number;
  philhealthEr: number;
  pagibigEe: number;
  pagibigEr: number;
  withholdingTax: number;
  grossPay: number;
}>;

function getStatutoryId(
  ids: Array<{ idType: string; idNumber: string }>,
  type: string
): string {
  return ids.find(id => id.idType === type)?.idNumber || "";
}

/**
 * Format a time-only value (Date or string) to HH:MM format.
 * For Prisma TIME fields, the values are stored as UTC but represent Manila local time,
 * so we extract UTC hours/minutes directly without timezone conversion.
 */
function formatTimeOnly(time: Date | string | null | undefined): string {
  if (!time) return "";
  // Handle Time type from Prisma which comes as string like "08:00:00"
  if (typeof time === "string") {
    const parts = time.split(":");
    return parts.length >= 2 ? `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}` : time;
  }
  // For Date objects from Prisma TIME fields, use UTC hours/minutes
  // since they already represent Manila local time stored as UTC
  const d = new Date(time);
  const hours = d.getUTCHours().toString().padStart(2, "0");
  const minutes = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function generateSssR3Report(data: EmployeeReportData, month: number, year: number): string {
  const monthName = new Date(year, month - 1).toLocaleString("en-PH", { month: "long" });

  const headers = [
    "SSS Number",
    "Last Name",
    "First Name",
    "Middle Name",
    "EE Contribution",
    "ER Contribution",
    "EC Contribution",
    "Total Contribution",
  ];

  const rows: string[][] = [];
  let totalEe = 0;
  let totalEr = 0;

  for (const [, record] of data) {
    const sssNumber = getStatutoryId(record.employee.statutoryIds, "sss");
    const eeCont = record.sssEe;
    const erCont = record.sssEr;
    const ecCont = 0; // EC is part of ER contribution in current tables
    const total = eeCont + erCont + ecCont;

    totalEe += eeCont;
    totalEr += erCont;

    rows.push([
      sssNumber,
      record.employee.lastName,
      record.employee.firstName,
      record.employee.middleName || "",
      eeCont.toFixed(2),
      erCont.toFixed(2),
      ecCont.toFixed(2),
      total.toFixed(2),
    ]);
  }

  // Add totals row
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    totalEe.toFixed(2),
    totalEr.toFixed(2),
    "0.00",
    (totalEe + totalEr).toFixed(2),
  ]);

  const csv = [
    `SSS R3 Report - ${monthName} ${year}`,
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csv;
}

function generatePhilhealthRf1Report(data: EmployeeReportData, month: number, year: number): string {
  const monthName = new Date(year, month - 1).toLocaleString("en-PH", { month: "long" });

  const headers = [
    "PhilHealth Number",
    "Last Name",
    "First Name",
    "Middle Name",
    "Birth Date",
    "EE Share",
    "ER Share",
    "Total Premium",
  ];

  const rows: string[][] = [];
  let totalEe = 0;
  let totalEr = 0;

  for (const [, record] of data) {
    const philhealthNumber = getStatutoryId(record.employee.statutoryIds, "philhealth");
    const eeCont = record.philhealthEe;
    const erCont = record.philhealthEr;
    const total = eeCont + erCont;

    totalEe += eeCont;
    totalEr += erCont;

    rows.push([
      philhealthNumber,
      record.employee.lastName,
      record.employee.firstName,
      record.employee.middleName || "",
      record.employee.birthDate?.toISOString().split("T")[0] || "",
      eeCont.toFixed(2),
      erCont.toFixed(2),
      total.toFixed(2),
    ]);
  }

  // Add totals row
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    totalEe.toFixed(2),
    totalEr.toFixed(2),
    (totalEe + totalEr).toFixed(2),
  ]);

  const csv = [
    `PhilHealth RF-1 Report - ${monthName} ${year}`,
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csv;
}

function generatePagibigMcrfReport(data: EmployeeReportData, month: number, year: number): string {
  const monthName = new Date(year, month - 1).toLocaleString("en-PH", { month: "long" });

  const headers = [
    "Pag-IBIG MID Number",
    "Last Name",
    "First Name",
    "Middle Name",
    "EE Share",
    "ER Share",
    "Total Contribution",
  ];

  const rows: string[][] = [];
  let totalEe = 0;
  let totalEr = 0;

  for (const [, record] of data) {
    const pagibigNumber = getStatutoryId(record.employee.statutoryIds, "pagibig");
    const eeCont = record.pagibigEe;
    const erCont = record.pagibigEr;
    const total = eeCont + erCont;

    totalEe += eeCont;
    totalEr += erCont;

    rows.push([
      pagibigNumber,
      record.employee.lastName,
      record.employee.firstName,
      record.employee.middleName || "",
      eeCont.toFixed(2),
      erCont.toFixed(2),
      total.toFixed(2),
    ]);
  }

  // Add totals row
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    totalEe.toFixed(2),
    totalEr.toFixed(2),
    (totalEe + totalEr).toFixed(2),
  ]);

  const csv = [
    `Pag-IBIG MCRF Report - ${monthName} ${year}`,
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csv;
}

function generateBir1601cReport(data: EmployeeReportData, month: number, year: number): string {
  const monthName = new Date(year, month - 1).toLocaleString("en-PH", { month: "long" });

  const headers = [
    "TIN",
    "Last Name",
    "First Name",
    "Middle Name",
    "Gross Compensation",
    "Tax Withheld",
  ];

  const rows: string[][] = [];
  let totalGross = 0;
  let totalTax = 0;

  for (const [, record] of data) {
    const tin = getStatutoryId(record.employee.statutoryIds, "tin");
    const gross = record.grossPay;
    const tax = record.withholdingTax;

    totalGross += gross;
    totalTax += tax;

    rows.push([
      tin,
      record.employee.lastName,
      record.employee.firstName,
      record.employee.middleName || "",
      gross.toFixed(2),
      tax.toFixed(2),
    ]);
  }

  // Add totals row
  rows.push([
    "TOTAL",
    "",
    "",
    "",
    totalGross.toFixed(2),
    totalTax.toFixed(2),
  ]);

  const csv = [
    `BIR 1601-C Report - ${monthName} ${year}`,
    "",
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csv;
}

function getDocumentTitle(documentType: DocumentType): string {
  const titles: Record<DocumentType, string> = {
    salary_change_memo: "Salary Change Memorandum",
    regularization_memo: "Regularization Memorandum",
    separation_clearance: "Separation Clearance Form",
    certificate_of_employment: "Certificate of Employment",
    payslip: "Payslip",
    employment_contract: "Employment Contract",
    disciplinary_warning: "Disciplinary Warning Letter",
    disciplinary_action: "Disciplinary Action Letter",
    notice_to_explain: "Notice to Explain",
    notice_of_decision: "Notice of Decision",
    repayment_agreement: "Employee Repayment Agreement",
    offer_letter: "Offer Letter",
    quitclaim_release: "Quitclaim and Release",
    lateral_transfer: "Notice of Lateral Transfer",
  };
  return titles[documentType];
}

/**
 * Generate document PDF using PDFKit generators.
 * Creates professional PDF documents with proper fonts and formatting.
 * Uses hiring entity info for company header when available.
 */
async function generateDocumentPDF(
  documentType: DocumentType,
  employee: {
    firstName: string;
    lastName: string;
    middleName: string | null;
    employeeNumber: string;
    hireDate: Date;
    jobTitle?: string | null;
    hiringEntity?: {
      id: string;
      code: string;
      name: string;
      tradeName: string | null;
      tin: string | null;
      sssEmployerId: string | null;
      philhealthEmployerId: string | null;
      pagibigEmployerId: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      province: string | null;
    } | null;
    presentAddressLine1?: string | null;
    presentCity?: string | null;
    presentProvince?: string | null;
    company: {
      id: string;
      name: string;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      province: string | null;
    };
    department: { id: string; name: string } | null;
    roleScorecard?: { baseSalary: unknown; wageType: string } | null;
  },
  options?: EmploymentContractOptions
): Promise<Buffer> {
  const employeeAddress = [
    employee.presentAddressLine1,
    employee.presentCity,
    employee.presentProvince,
  ]
    .filter(Boolean)
    .join(", ");

  // Use hiring entity info for documents when available, otherwise fall back to parent company
  const companyInfo = employee.hiringEntity
    ? {
        name: employee.hiringEntity.tradeName || employee.hiringEntity.name,
        addressLine1: employee.hiringEntity.addressLine1,
        addressLine2: employee.hiringEntity.addressLine2,
        city: employee.hiringEntity.city,
        province: employee.hiringEntity.province,
      }
    : employee.company;

  switch (documentType) {
    case "certificate_of_employment":
      return generateCertificateOfEmploymentPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          hireDate: employee.hireDate,
          department: employee.department?.name,
          hiringEntity: employee.hiringEntity?.tradeName || employee.hiringEntity?.name || null,
        },
        companyInfo
      );

    case "salary_change_memo":
      return generateSalaryChangMemoPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        options
          ? {
              effectiveDate: options.probationStartDate,
            }
          : undefined
      );

    case "regularization_memo":
      return generateRegularizationMemoPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        options
          ? {
              effectiveDate: options.probationEndDate,
              probationStartDate: options.probationStartDate,
            }
          : undefined
      );

    case "separation_clearance":
      return generateSeparationClearancePDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
          hireDate: employee.hireDate,
        },
        companyInfo
      );

    case "employment_contract": {
      // Fetch role scorecard from database if roleScorecardId is provided
      let roleScorecard: RoleScorecardData | undefined;

      if (options?.roleScorecardId) {
        const dbScorecard = await prisma.roleScorecard.findUnique({
          where: { id: options.roleScorecardId },
        });

        if (dbScorecard) {
          // Convert Decimal to number for baseSalary
          const baseSalaryNum = dbScorecard.baseSalary
            ? typeof dbScorecard.baseSalary === "object" && "toNumber" in dbScorecard.baseSalary
              ? (dbScorecard.baseSalary as { toNumber: () => number }).toNumber()
              : Number(dbScorecard.baseSalary)
            : undefined;

          roleScorecard = {
            missionStatement: dbScorecard.missionStatement,
            keyResponsibilities: dbScorecard.keyResponsibilities as Array<{
              area: string;
              tasks: string[];
            }>,
            kpis: dbScorecard.kpis as Array<{
              metric: string;
              frequency: string;
            }>,
            workHoursPerDay: dbScorecard.workHoursPerDay,
            workDaysPerWeek: dbScorecard.workDaysPerWeek,
            baseSalary: baseSalaryNum,
          };
        }
      } else if (employee.jobTitle && employee.department) {
        // Try to find a matching role scorecard by job title and department
        const dbScorecard = await prisma.roleScorecard.findFirst({
          where: {
            companyId: employee.company.id,
            jobTitle: employee.jobTitle,
            departmentId: employee.department.id,
            isActive: true,
            supersededById: null,
          },
          orderBy: { effectiveDate: "desc" },
        });

        if (dbScorecard) {
          // Convert Decimal to number for baseSalary
          const baseSalaryNum = dbScorecard.baseSalary
            ? typeof dbScorecard.baseSalary === "object" && "toNumber" in dbScorecard.baseSalary
              ? (dbScorecard.baseSalary as { toNumber: () => number }).toNumber()
              : Number(dbScorecard.baseSalary)
            : undefined;

          roleScorecard = {
            missionStatement: dbScorecard.missionStatement,
            keyResponsibilities: dbScorecard.keyResponsibilities as Array<{
              area: string;
              tasks: string[];
            }>,
            kpis: dbScorecard.kpis as Array<{
              metric: string;
              frequency: string;
            }>,
            workHoursPerDay: dbScorecard.workHoursPerDay,
            workDaysPerWeek: dbScorecard.workDaysPerWeek,
            baseSalary: baseSalaryNum,
          };
        }
      }

      // Validate that role scorecard is required for employment contracts
      if (!roleScorecard) {
        throw new Error(
          `Role Scorecard is required for generating an Employment Contract. ` +
          `Please create a Role Scorecard for the position "${employee.jobTitle || "this role"}" ` +
          `in the "${employee.department?.name || "employee's"}" department in Settings > Role Scorecards.`
        );
      }

      return generateEmploymentContractPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle || "Employee",
          hireDate: employee.hireDate,
          address: employeeAddress || undefined,
          hiringEntity: employee.hiringEntity?.tradeName || employee.hiringEntity?.name || null,
        },
        companyInfo,
        {
          dailySalaryRate: options?.dailySalaryRate || 0,
          probationStartDate:
            options?.probationStartDate ||
            employee.hireDate.toLocaleDateString("en-PH", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          probationEndDate:
            options?.probationEndDate || "[End of Probation Period]",
          employerRepresentative: options?.employerRepresentative || {
            name: "[Employer Representative]",
            title: "People Manager",
          },
          witnesses: options?.witnesses,
          roleScorecard,
        }
      );
    }

    case "payslip":
      // Payslips are generated separately via generatePayslips function
      throw new Error(
        "Payslips should be generated via the generatePayslips function"
      );

    case "disciplinary_warning": {
      const warningOpts = options as unknown as DisciplinaryWarningOptions;
      return generateDisciplinaryWarningPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        {
          unsatisfactoryAspects: warningOpts?.unsatisfactoryAspects || ["[Specify unsatisfactory aspects]"],
          suggestionsForImprovement: warningOpts?.suggestionsForImprovement || ["[Specify improvement requirements]"],
          improvementPeriodDays: warningOpts?.improvementPeriodDays || 30,
          improvementDeadlineDate: warningOpts?.improvementDeadlineDate,
          requiresWrittenExplanation: warningOpts?.requiresWrittenExplanation ?? true,
          hrManagerName: warningOpts?.hrManagerName || "Brixter Del Mundo",
          hrManagerTitle: warningOpts?.hrManagerTitle || "People Manager",
        }
      );
    }

    case "disciplinary_action": {
      const actionOpts = options as unknown as DisciplinaryActionOptions;
      return generateDisciplinaryActionPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        {
          violations: actionOpts?.violations || [
            { title: "[Violation Title]", description: "[Description of violation]" }
          ],
          suspensionDays: actionOpts?.suspensionDays,
          suspensionStartDate: actionOpts?.suspensionStartDate,
          suspensionEndDate: actionOpts?.suspensionEndDate,
          isUnpaid: actionOpts?.isUnpaid ?? true,
          requiredActions: actionOpts?.requiredActions || [
            "Written Explanation - Submit a written explanation addressing each violation",
            "Performance Review upon Return - Performance will be closely monitored"
          ],
          hrManagerName: actionOpts?.hrManagerName || "Brixter Del Mundo",
          hrManagerTitle: actionOpts?.hrManagerTitle || "People Manager",
        }
      );
    }

    case "notice_to_explain": {
      const nteOpts = options as {
        incidentDate?: string;
        incidentDescription?: string;
        allegedViolations?: string[];
        responseDeadline?: string;
        hrManagerName?: string;
        hrManagerTitle?: string;
      };
      return generateNoticeToExplainPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        {
          incidentDate: nteOpts?.incidentDate || "[Incident Date]",
          incidentDescription: nteOpts?.incidentDescription || "[Description of incident]",
          allegedViolations: nteOpts?.allegedViolations || ["[Alleged violation]"],
          responseDeadline: nteOpts?.responseDeadline || "48 hours from receipt of this notice",
          hrManagerName: nteOpts?.hrManagerName || "Brixter Del Mundo",
          hrManagerTitle: nteOpts?.hrManagerTitle || "People Manager",
        }
      );
    }

    case "notice_of_decision": {
      const nodOpts = options as {
        originalIncidentDate?: string;
        originalViolations?: string[];
        investigationSummary?: string;
        decision?: "warning" | "suspension" | "termination";
        decisionDetails?: string;
        effectiveDate?: string;
        suspensionDays?: number;
        hrManagerName?: string;
        hrManagerTitle?: string;
      };
      return generateNoticeOfDecisionPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        {
          originalIncidentDate: nodOpts?.originalIncidentDate || "[Original Incident Date]",
          originalViolations: nodOpts?.originalViolations || ["[Original violation]"],
          investigationSummary: nodOpts?.investigationSummary || "[Summary of investigation findings]",
          decision: nodOpts?.decision || "warning",
          decisionDetails: nodOpts?.decisionDetails || "[Details of the decision]",
          effectiveDate: nodOpts?.effectiveDate || "[Effective Date]",
          suspensionDays: nodOpts?.suspensionDays,
          hrManagerName: nodOpts?.hrManagerName || "Brixter Del Mundo",
          hrManagerTitle: nodOpts?.hrManagerTitle || "People Manager",
        }
      );
    }

    case "repayment_agreement": {
      const repaymentOpts = options as unknown as RepaymentAgreementOptions;
      return generateRepaymentAgreementPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
        },
        companyInfo,
        {
          items: repaymentOpts?.items || [
            {
              date: "[Date]",
              explanation: "[Description of loss/damage]",
              amount: 0,
            },
          ],
          totalAmount: repaymentOpts?.totalAmount || 0,
          repaymentMethod: repaymentOpts?.repaymentMethod || "salary_deduction",
          lumpSumDueDate: repaymentOpts?.lumpSumDueDate,
          installmentAmount: repaymentOpts?.installmentAmount,
          installmentStartDate: repaymentOpts?.installmentStartDate,
          authorizedSignatoryName: repaymentOpts?.authorizedSignatoryName || "Brixter Del Mundo",
          authorizedSignatoryTitle: repaymentOpts?.authorizedSignatoryTitle || "People Manager",
        }
      );
    }

    case "offer_letter": {
      const offerOpts = options as unknown as OfferLetterOptions;
      return generateOfferLetterPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          email: null,
          phone: null,
          presentAddressLine1: employee.presentAddressLine1,
          presentCity: employee.presentCity,
          presentProvince: employee.presentProvince,
          hiringEntity: employee.hiringEntity?.tradeName || employee.hiringEntity?.name || null,
        },
        companyInfo,
        {
          jobTitle: offerOpts?.jobTitle || employee.jobTitle || "Employee",
          department: offerOpts?.department || employee.department?.name,
          reportsTo: offerOpts?.reportsTo,
          employmentType: offerOpts?.employmentType || "probationary",
          dailySalaryRate: offerOpts?.dailySalaryRate || 0,
          payFrequency: offerOpts?.payFrequency || "semi_monthly",
          targetStartDate: offerOpts?.targetStartDate || employee.hireDate.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          probationPeriodMonths: offerOpts?.probationPeriodMonths || 6,
          officeLocation: offerOpts?.officeLocation,
          workSchedule: offerOpts?.workSchedule,
          benefits: offerOpts?.benefits,
          requiredDocuments: offerOpts?.requiredDocuments,
          offerValidUntil: offerOpts?.offerValidUntil,
          hrManagerName: offerOpts?.hrManagerName || "Brixter Del Mundo",
          hrManagerTitle: offerOpts?.hrManagerTitle || "People Manager",
        }
      );
    }

    case "quitclaim_release": {
      const quitclaimOpts = options as unknown as QuitclaimOptions;
      return generateQuitclaimReleasePDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          civilStatus: (employee as { civilStatus?: string }).civilStatus as "single" | "married" | "widowed" | "separated" | null,
          presentAddressLine1: employee.presentAddressLine1,
          presentCity: employee.presentCity,
          presentProvince: employee.presentProvince,
        },
        companyInfo,
        {
          lastPayAmount: quitclaimOpts?.lastPayAmount || 0,
          separationReason: quitclaimOpts?.separationReason || "resignation",
          effectiveDate: quitclaimOpts?.effectiveDate || new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          evaluationNote: quitclaimOpts?.evaluationNote,
          signingLocation: quitclaimOpts?.signingLocation,
          signingDate: quitclaimOpts?.signingDate,
          includeNotary: quitclaimOpts?.includeNotary ?? true,
        }
      );
    }

    case "lateral_transfer": {
      const transferOpts = options as unknown as LateralTransferOptions;
      return generateLateralTransferPDF(
        {
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          employeeNumber: employee.employeeNumber,
          jobTitle: employee.jobTitle,
          department: employee.department?.name,
          employmentStatus: (employee as { employmentType?: string }).employmentType as "probationary" | "regular" | "contractual" | null,
        },
        companyInfo,
        {
          effectiveDate: transferOpts?.effectiveDate || "[Effective Date]",
          oldPosition: transferOpts?.oldPosition || employee.jobTitle || "[Current Position]",
          newPosition: transferOpts?.newPosition || "[New Position]",
          newDepartment: transferOpts?.newDepartment,
          newSupervisorName: transferOpts?.newSupervisorName,
          transferReason: transferOpts?.transferReason || "operational_necessity",
          customReason: transferOpts?.customReason,
          managerName: transferOpts?.managerName || "Brixter Del Mundo",
          managerPosition: transferOpts?.managerPosition || "People Manager",
          issuanceDate: transferOpts?.issuanceDate,
        }
      );
    }

    default:
      throw new Error(`Unknown document type: ${documentType}`);
  }
}

