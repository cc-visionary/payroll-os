"use server";

// =============================================================================
// PeopleOS PH - Hiring Server Actions
// =============================================================================
// Server actions for applicant and interview management.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger, maskSensitiveFields } from "@/lib/audit";
import { headers } from "next/headers";
import { setManilaHours } from "@/lib/utils/timezone";

// =============================================================================
// Types
// =============================================================================

export interface CreateApplicantInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  email: string;
  phoneNumber?: string;
  mobileNumber?: string;
  roleScorecardId?: string;
  customJobTitle?: string;
  departmentId?: string;
  hiringEntityId?: string;
  source?: string;
  referredById?: string;
  resumePath?: string;
  resumeFileName?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  expectedStartDate?: string;
  notes?: string;
}

export interface UpdateApplicantInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  email?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  roleScorecardId?: string;
  customJobTitle?: string;
  departmentId?: string;
  hiringEntityId?: string;
  source?: string;
  referredById?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  expectedStartDate?: string;
  notes?: string;
}

export interface UpdateApplicantStatusInput {
  status: string;
  rejectionReason?: string;
  withdrawalReason?: string;
}

export interface CreateInterviewInput {
  interviewType: string;
  title?: string;
  description?: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  location?: string;
  isVirtual?: boolean;
  meetingLink?: string;
  primaryInterviewerId?: string;
  interviewerIds?: string[];
}

export interface UpdateInterviewResultInput {
  result: string;
  resultNotes?: string;
  rating?: number;
  strengths?: string;
  concerns?: string;
  recommendation?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getAuditLogger(permission: Parameters<typeof assertPermission>[0] = Permission.HIRING_VIEW) {
  const headersList = await headers();
  const auth = await assertPermission(permission);

  return {
    auth,
    audit: createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    }),
  };
}

// =============================================================================
// Applicant CRUD
// =============================================================================

/**
 * Create a new applicant.
 */
export async function createApplicant(input: CreateApplicantInput) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_CREATE);

  // Check for duplicate email
  const existing = await prisma.applicant.findFirst({
    where: {
      companyId: auth.user.companyId,
      email: input.email,
      deletedAt: null,
      status: { notIn: ["HIRED", "REJECTED", "WITHDRAWN"] },
    },
  });

  if (existing) {
    return {
      success: false,
      error: `An applicant with email ${input.email} already exists in the pipeline`,
    };
  }

  try {
    const applicant = await prisma.applicant.create({
      data: {
        companyId: auth.user.companyId,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        suffix: input.suffix,
        email: input.email,
        phoneNumber: input.phoneNumber,
        mobileNumber: input.mobileNumber,
        roleScorecardId: input.roleScorecardId || undefined,
        customJobTitle: input.customJobTitle,
        departmentId: input.departmentId || undefined,
        hiringEntityId: input.hiringEntityId || undefined,
        source: input.source,
        referredById: input.referredById || undefined,
        resumePath: input.resumePath,
        resumeFileName: input.resumeFileName,
        portfolioUrl: input.portfolioUrl,
        linkedinUrl: input.linkedinUrl,
        expectedSalaryMin: input.expectedSalaryMin,
        expectedSalaryMax: input.expectedSalaryMax,
        expectedStartDate: input.expectedStartDate ? new Date(input.expectedStartDate) : undefined,
        notes: input.notes,
        status: "NEW",
        createdById: auth.user.id,
      },
    });

    await audit.create("Applicant", applicant.id, maskSensitiveFields(input as unknown as Record<string, unknown>));

    revalidatePath("/hiring");

    return {
      success: true,
      applicantId: applicant.id,
      message: "Applicant created successfully",
    };
  } catch (error) {
    console.error("Failed to create applicant:", error);
    return { success: false, error: "Failed to create applicant" };
  }
}

/**
 * Update an applicant's information.
 */
export async function updateApplicant(applicantId: string, input: UpdateApplicantInput) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  try {
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        if (key === "expectedStartDate" && value) {
          updateData[key] = new Date(value as string);
        } else if (value === "" || value === null) {
          updateData[key] = null;
        } else {
          updateData[key] = value;
        }
      }
    }

    await prisma.applicant.update({
      where: { id: applicantId },
      data: updateData,
    });

    await audit.update("Applicant", applicantId, {}, updateData);

    revalidatePath(`/hiring/${applicantId}`);
    revalidatePath("/hiring");

    return { success: true, message: "Applicant updated successfully" };
  } catch (error) {
    console.error("Failed to update applicant:", error);
    return { success: false, error: "Failed to update applicant" };
  }
}

/**
 * Update an applicant's status.
 */
export async function updateApplicantStatus(applicantId: string, input: UpdateApplicantStatusInput) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  const validStatuses = ["NEW", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFER", "OFFER_ACCEPTED", "HIRED", "REJECTED", "WITHDRAWN"];
  if (!validStatuses.includes(input.status)) {
    return { success: false, error: "Invalid status" };
  }

  try {
    await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        status: input.status as "NEW" | "SCREENING" | "INTERVIEW" | "ASSESSMENT" | "OFFER" | "OFFER_ACCEPTED" | "HIRED" | "REJECTED" | "WITHDRAWN",
        statusChangedAt: new Date(),
        statusChangedById: auth.user.id,
        rejectionReason: input.status === "REJECTED" ? input.rejectionReason : undefined,
        withdrawalReason: input.status === "WITHDRAWN" ? input.withdrawalReason : undefined,
      },
    });

    await audit.update("Applicant", applicantId, { status: applicant.status }, { status: input.status });

    revalidatePath(`/hiring/${applicantId}`);
    revalidatePath("/hiring");

    return { success: true, message: `Status updated to ${input.status}` };
  } catch (error) {
    console.error("Failed to update applicant status:", error);
    return { success: false, error: "Failed to update status" };
  }
}

/**
 * Generate offer letter for an applicant.
 * Permission: hiring:edit
 */
export async function generateOfferLetter(applicantId: string) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      roleScorecard: {
        include: {
          department: true,
        },
      },
      department: true,
      hiringEntity: true,
    },
  });

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  // Need to be in OFFER or OFFER_ACCEPTED status
  if (!["OFFER", "OFFER_ACCEPTED"].includes(applicant.status)) {
    return { success: false, error: "Applicant must be in OFFER or OFFER_ACCEPTED status" };
  }

  try {
    const { generateDocument } = await import("@/app/actions/documents");

    // Get company info
    const company = await prisma.company.findUnique({
      where: { id: auth.user.companyId },
    });

    if (!company) {
      return { success: false, error: "Company not found" };
    }

    // Determine salary rate from role scorecard
    const dailySalaryRate = applicant.roleScorecard?.baseSalary
      ? Number(applicant.roleScorecard.baseSalary) / 22  // Convert monthly to daily
      : 0;

    // Create a temporary employee record for document generation
    // We'll need to generate the offer letter using the document system
    const { generateOfferLetterPDF } = await import("@/lib/pdf/generators");

    const companyInfo = applicant.hiringEntity
      ? {
          name: applicant.hiringEntity.tradeName || applicant.hiringEntity.name,
          addressLine1: applicant.hiringEntity.addressLine1,
          addressLine2: applicant.hiringEntity.addressLine2,
          city: applicant.hiringEntity.city,
          province: applicant.hiringEntity.province,
        }
      : {
          name: company.name,
          addressLine1: company.addressLine1,
          addressLine2: company.addressLine2,
          city: company.city,
          province: company.province,
        };

    // Use expected start date or 2 weeks from now
    const targetStartDate = applicant.expectedStartDate
      ? applicant.expectedStartDate.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    const pdfBuffer = await generateOfferLetterPDF(
      {
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        middleName: applicant.middleName,
        email: applicant.email,
        phone: applicant.mobileNumber,
        presentAddressLine1: null,
        presentCity: null,
        presentProvince: null,
        hiringEntity: applicant.hiringEntity?.tradeName || applicant.hiringEntity?.name || null,
      },
      companyInfo,
      {
        jobTitle: applicant.roleScorecard?.jobTitle || applicant.customJobTitle || "Employee",
        department: applicant.department?.name || applicant.roleScorecard?.department?.name,
        employmentType: "probationary",
        dailySalaryRate,
        payFrequency: "semi_monthly",
        targetStartDate,
        probationPeriodMonths: 6,
      }
    );

    // Save the PDF to storage
    const { mkdir, writeFile } = await import("fs/promises");
    const { join, dirname } = await import("path");

    const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/documents";
    const fileName = `offer_letter_${applicant.firstName}_${applicant.lastName}_${Date.now()}.pdf`;
    const relativePath = `applicants/${applicantId}/${fileName}`;
    const absolutePath = join(DOCUMENT_STORAGE_PATH, relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, pdfBuffer);

    // Store reference in offerLetterPath field
    await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        offerLetterPath: relativePath,
      },
    });

    await audit.update("Applicant", applicantId, {}, {
      action: "generate_offer_letter",
      fileName,
    });

    revalidatePath(`/hiring/${applicantId}`);

    return {
      success: true,
      fileName,
      downloadPath: relativePath,
      message: "Offer letter generated successfully",
    };
  } catch (error) {
    console.error("Failed to generate offer letter:", error);
    return { success: false, error: "Failed to generate offer letter" };
  }
}

/**
 * Convert an applicant to an employee.
 * Employee number is auto-generated.
 */
export async function convertApplicantToEmployee(
  applicantId: string,
  employeeData: {
    employmentType: string;
    hireDate: string;
  }
) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_CONVERT);

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
      status: "OFFER_ACCEPTED",
    },
    include: {
      roleScorecard: true,
    },
  });

  if (!applicant) {
    return { success: false, error: "Applicant not found or not in OFFER_ACCEPTED status" };
  }

  try {
    // Auto-generate employee number
    const { generateEmployeeNumber } = await import("@/app/actions/employees");
    const employeeNumber = await generateEmployeeNumber(auth.user.companyId);

    const result = await prisma.$transaction(async (tx) => {
      // Create employee from applicant
      const employee = await tx.employee.create({
        data: {
          companyId: auth.user.companyId,
          employeeNumber,
          firstName: applicant.firstName,
          middleName: applicant.middleName,
          lastName: applicant.lastName,
          suffix: applicant.suffix,
          personalEmail: applicant.email,
          mobileNumber: applicant.mobileNumber,
          phoneNumber: applicant.phoneNumber,
          departmentId: applicant.departmentId,
          roleScorecardId: applicant.roleScorecardId,
          jobTitle: applicant.roleScorecard?.jobTitle || applicant.customJobTitle,
          hiringEntityId: applicant.hiringEntityId,
          employmentType: employeeData.employmentType as "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "CONSULTANT" | "INTERN",
          employmentStatus: "ACTIVE",
          hireDate: new Date(employeeData.hireDate),
        },
      });

      // Update applicant status
      await tx.applicant.update({
        where: { id: applicantId },
        data: {
          status: "HIRED",
          statusChangedAt: new Date(),
          statusChangedById: auth.user.id,
          convertedToEmployeeId: employee.id,
          convertedAt: new Date(),
        },
      });

      // Create HIRE employment event
      await tx.employmentEvent.create({
        data: {
          employeeId: employee.id,
          eventType: "HIRE",
          eventDate: new Date(employeeData.hireDate),
          status: "APPROVED",
          payload: {
            employmentType: employeeData.employmentType,
            roleScorecardId: applicant.roleScorecardId,
            jobTitle: applicant.roleScorecard?.jobTitle || applicant.customJobTitle,
            departmentId: applicant.departmentId,
            applicantId: applicantId,
          },
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });

      return employee;
    });

    await audit.create("Employee", result.id, {
      source: "applicant_conversion",
      applicantId: applicantId,
    });

    revalidatePath(`/hiring/${applicantId}`);
    revalidatePath("/hiring");
    revalidatePath("/employees");

    return {
      success: true,
      employeeId: result.id,
      message: "Applicant successfully converted to employee",
    };
  } catch (error) {
    console.error("Failed to convert applicant:", error);
    return { success: false, error: "Failed to convert applicant to employee" };
  }
}

/**
 * Delete (soft) an applicant.
 */
export async function deleteApplicant(applicantId: string) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  try {
    await prisma.applicant.update({
      where: { id: applicantId },
      data: { deletedAt: new Date() },
    });

    await audit.delete("Applicant", applicantId, {
      name: `${applicant.firstName} ${applicant.lastName}`,
      email: applicant.email,
    });

    revalidatePath("/hiring");

    return { success: true, message: "Applicant deleted successfully" };
  } catch (error) {
    console.error("Failed to delete applicant:", error);
    return { success: false, error: "Failed to delete applicant" };
  }
}

// =============================================================================
// Interview CRUD
// =============================================================================

/**
 * Create a new interview for an applicant.
 */
export async function createInterview(applicantId: string, input: CreateInterviewInput) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
  });

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  // Parse time strings to Date objects for Time fields (Manila timezone)
  const parseTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return setManilaHours(new Date(), hours, minutes);
  };

  try {
    const interview = await prisma.interview.create({
      data: {
        applicantId,
        interviewType: input.interviewType as "PHONE_SCREEN" | "TECHNICAL" | "BEHAVIORAL" | "PANEL" | "FINAL",
        title: input.title,
        description: input.description,
        scheduledDate: new Date(input.scheduledDate),
        scheduledStartTime: parseTime(input.scheduledStartTime),
        scheduledEndTime: parseTime(input.scheduledEndTime),
        location: input.location,
        isVirtual: input.isVirtual || false,
        meetingLink: input.meetingLink,
        primaryInterviewerId: input.primaryInterviewerId || undefined,
        interviewerIds: input.interviewerIds || [],
        result: "PENDING",
        createdById: auth.user.id,
      },
    });

    // Update applicant status to INTERVIEW if not already past that stage
    if (applicant.status === "NEW" || applicant.status === "SCREENING") {
      await prisma.applicant.update({
        where: { id: applicantId },
        data: {
          status: "INTERVIEW",
          statusChangedAt: new Date(),
          statusChangedById: auth.user.id,
        },
      });
    }

    await audit.create("Interview", interview.id, {
      applicantId,
      interviewType: input.interviewType,
      scheduledDate: input.scheduledDate,
    });

    revalidatePath(`/hiring/${applicantId}`);
    revalidatePath("/hiring");

    return {
      success: true,
      interviewId: interview.id,
      message: "Interview scheduled successfully",
    };
  } catch (error) {
    console.error("Failed to create interview:", error);
    return { success: false, error: "Failed to schedule interview" };
  }
}

/**
 * Update interview result.
 */
export async function updateInterviewResult(interviewId: string, input: UpdateInterviewResultInput) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId },
    include: {
      applicant: {
        select: { companyId: true },
      },
    },
  });

  if (!interview || interview.applicant.companyId !== auth.user.companyId) {
    return { success: false, error: "Interview not found" };
  }

  const validResults = ["PENDING", "PASSED", "FAILED", "NO_SHOW", "RESCHEDULED"];
  if (!validResults.includes(input.result)) {
    return { success: false, error: "Invalid result" };
  }

  try {
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        result: input.result as "PENDING" | "PASSED" | "FAILED" | "NO_SHOW" | "RESCHEDULED",
        resultNotes: input.resultNotes,
        rating: input.rating,
        strengths: input.strengths,
        concerns: input.concerns,
        recommendation: input.recommendation,
      },
    });

    await audit.update("Interview", interviewId, { result: interview.result }, { result: input.result });

    revalidatePath(`/hiring/${interview.applicantId}`);

    return { success: true, message: "Interview result updated" };
  } catch (error) {
    console.error("Failed to update interview result:", error);
    return { success: false, error: "Failed to update interview result" };
  }
}

/**
 * Reschedule an interview.
 */
export async function rescheduleInterview(
  interviewId: string,
  input: {
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    location?: string;
    meetingLink?: string;
  }
) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId },
    include: {
      applicant: {
        select: { companyId: true },
      },
    },
  });

  if (!interview || interview.applicant.companyId !== auth.user.companyId) {
    return { success: false, error: "Interview not found" };
  }

  const parseTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  try {
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        scheduledDate: new Date(input.scheduledDate),
        scheduledStartTime: parseTime(input.scheduledStartTime),
        scheduledEndTime: parseTime(input.scheduledEndTime),
        location: input.location,
        meetingLink: input.meetingLink,
        result: "PENDING", // Reset result when rescheduling
      },
    });

    await audit.update("Interview", interviewId, {}, { rescheduled: true, newDate: input.scheduledDate });

    revalidatePath(`/hiring/${interview.applicantId}`);

    return { success: true, message: "Interview rescheduled" };
  } catch (error) {
    console.error("Failed to reschedule interview:", error);
    return { success: false, error: "Failed to reschedule interview" };
  }
}

/**
 * Delete an interview.
 */
export async function deleteInterview(interviewId: string) {
  const { auth, audit } = await getAuditLogger(Permission.HIRING_EDIT);

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId },
    include: {
      applicant: {
        select: { companyId: true, id: true },
      },
    },
  });

  if (!interview || interview.applicant.companyId !== auth.user.companyId) {
    return { success: false, error: "Interview not found" };
  }

  try {
    await prisma.interview.delete({
      where: { id: interviewId },
    });

    await audit.delete("Interview", interviewId, {
      applicantId: interview.applicantId,
      interviewType: interview.interviewType,
    });

    revalidatePath(`/hiring/${interview.applicant.id}`);
    revalidatePath("/hiring");

    return { success: true, message: "Interview deleted" };
  } catch (error) {
    console.error("Failed to delete interview:", error);
    return { success: false, error: "Failed to delete interview" };
  }
}
