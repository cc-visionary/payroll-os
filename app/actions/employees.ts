"use server";

// =============================================================================
// PeopleOS PH - Employee Server Actions
// =============================================================================
// Server actions for employee management with RBAC and audit logging.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger, maskSensitiveFields, computeChanges } from "@/lib/audit";
import { headers } from "next/headers";
import { autoGenerateEventDocument } from "./documents";

// =============================================================================
// Types
// =============================================================================

export interface CreateEmployeeInput {
  employeeNumber?: string; // Optional - will be auto-generated if not provided
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  birthDate?: string;
  gender?: string;
  civilStatus?: string;
  personalEmail?: string;
  mobileNumber?: string;
  departmentId?: string;
  roleScorecardId?: string;  // Links to position/role scorecard
  jobTitle?: string;         // Custom job title (used if no roleScorecard)
  hiringEntityId?: string;   // Links to the legal entity that hired this employee
  employmentType: string;
  hireDate: string;
}

export interface UpdateEmployeeInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  birthDate?: string;
  gender?: string;
  civilStatus?: string;
  personalEmail?: string;
  workEmail?: string;
  mobileNumber?: string;
  phoneNumber?: string;
  presentAddressLine1?: string;
  presentAddressLine2?: string;
  presentCity?: string;
  presentProvince?: string;
  presentZipCode?: string;
  permanentAddressLine1?: string;
  permanentAddressLine2?: string;
  permanentCity?: string;
  permanentProvince?: string;
  permanentZipCode?: string;
  roleScorecardId?: string;       // Links to role scorecard (determines job title and department)
  reportsToId?: string | null;    // Allow null to clear the manager
  hiringEntityId?: string;        // Links to the legal entity that hired this employee
}

export interface CreateEmploymentEventInput {
  eventType: string;
  eventDate: string;
  payload: Record<string, unknown>;
  remarks?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate the next employee number for a company.
 * Format: EMP001, EMP002, etc.
 */
export async function generateEmployeeNumber(companyId: string): Promise<string> {
  // Get the highest employee number for this company
  const lastEmployee = await prisma.employee.findFirst({
    where: { companyId },
    orderBy: { employeeNumber: "desc" },
    select: { employeeNumber: true },
  });

  if (!lastEmployee) {
    return "EMP001";
  }

  // Extract the numeric part and increment
  const match = lastEmployee.employeeNumber.match(/^EMP(\d+)$/i);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `EMP${String(nextNum).padStart(3, "0")}`;
  }

  // If format doesn't match, count all employees and add 1
  const count = await prisma.employee.count({ where: { companyId } });
  return `EMP${String(count + 1).padStart(3, "0")}`;
}

async function getAuditLogger() {
  const headersList = await headers();
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

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
// Employee CRUD
// =============================================================================

/**
 * Create a new employee.
 * Permission: employee:create
 */
export async function createEmployee(input: CreateEmployeeInput) {
  const auth = await assertPermission(Permission.EMPLOYEE_CREATE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Auto-generate employee number if not provided
  const employeeNumber = input.employeeNumber || await generateEmployeeNumber(auth.user.companyId);

  // Validate employee number uniqueness (only if manually provided)
  if (input.employeeNumber) {
    const existing = await prisma.employee.findFirst({
      where: {
        companyId: auth.user.companyId,
        employeeNumber: employeeNumber,
        deletedAt: null,
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Employee number ${employeeNumber} already exists`,
      };
    }
  }

  try {
    // If roleScorecardId is provided, fetch the job title from the role scorecard
    let derivedJobTitle = input.jobTitle;
    if (input.roleScorecardId) {
      const roleScorecard = await prisma.roleScorecard.findUnique({
        where: { id: input.roleScorecardId },
        select: { jobTitle: true },
      });
      if (roleScorecard) {
        derivedJobTitle = roleScorecard.jobTitle;
      }
    }

    const employee = await prisma.employee.create({
      data: {
        companyId: auth.user.companyId,
        employeeNumber: employeeNumber,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        suffix: input.suffix,
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        gender: input.gender,
        civilStatus: input.civilStatus,
        personalEmail: input.personalEmail,
        mobileNumber: input.mobileNumber,
        departmentId: input.departmentId || undefined,
        roleScorecardId: input.roleScorecardId || undefined,
        jobTitle: derivedJobTitle,
        hiringEntityId: input.hiringEntityId || undefined,
        employmentType: input.employmentType as "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "CONSULTANT" | "INTERN",
        employmentStatus: "ACTIVE",
        hireDate: new Date(input.hireDate),
      },
    });

    // Log creation
    await audit.create("Employee", employee.id, maskSensitiveFields(input as unknown as Record<string, unknown>));

    // Create HIRE employment event
    await prisma.employmentEvent.create({
      data: {
        employeeId: employee.id,
        eventType: "HIRE",
        eventDate: new Date(input.hireDate),
        status: "APPROVED",
        payload: {
          employmentType: input.employmentType,
          roleScorecardId: input.roleScorecardId,
          jobTitle: derivedJobTitle,
          departmentId: input.departmentId,
        },
        approvedById: auth.user.id,
        approvedAt: new Date(),
      },
    });

    revalidatePath("/employees");

    return {
      success: true,
      employeeId: employee.id,
      message: "Employee created successfully",
    };
  } catch (error) {
    console.error("Failed to create employee:", error);
    return { success: false, error: "Failed to create employee" };
  }
}

// Return type for updateEmployee with role change info
export interface RoleChangeInfo {
  type: "lateral_transfer" | "salary_adjustment" | "role_assignment" | null;
  oldRole: string | null;
  newRole: string | null;
  oldDepartment: string | null;
  newDepartment: string | null;
  suggestedDocument: "lateral_transfer" | "salary_change_memo" | null;
}

/**
 * Update an employee's basic information.
 * Permission: employee:edit
 *
 * When roleScorecardId is provided, job title and department are automatically
 * derived from the role scorecard.
 */
export async function updateEmployee(employeeId: string, input: UpdateEmployeeInput) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Fetch employee with current department info
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      department: true,
    },
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  try {
    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};

    // If roleScorecardId is provided, derive job title and department from it
    if (input.roleScorecardId) {
      const roleScorecard = await prisma.roleScorecard.findUnique({
        where: { id: input.roleScorecardId },
        select: { jobTitle: true, departmentId: true },
      });
      if (roleScorecard) {
        updateData.roleScorecardId = input.roleScorecardId;
        updateData.jobTitle = roleScorecard.jobTitle;
        updateData.departmentId = roleScorecard.departmentId;
      }
    } else if (input.roleScorecardId === "") {
      // Clearing the role scorecard - also clear job title and department
      updateData.roleScorecardId = null;
      updateData.jobTitle = null;
      updateData.departmentId = null;
    }

    for (const [key, value] of Object.entries(input)) {
      // Skip roleScorecardId as it's handled above
      if (key === "roleScorecardId") continue;

      if (value !== undefined) {
        if (key === "birthDate" && value) {
          updateData[key] = new Date(value as string);
        } else if (value === null || value === "") {
          updateData[key] = null;
        } else {
          updateData[key] = value;
        }
      }
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
    });

    // Compute what changed for audit
    const { oldValues, newValues } = computeChanges(
      employee as unknown as Record<string, unknown>,
      updatedEmployee as unknown as Record<string, unknown>
    );

    if (Object.keys(newValues).length > 0) {
      await audit.update(
        "Employee",
        employeeId,
        maskSensitiveFields(oldValues),
        maskSensitiveFields(newValues)
      );
    }

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees");

    return {
      success: true,
      message: "Employee updated successfully",
    };
  } catch (error) {
    console.error("Failed to update employee:", error);
    return { success: false, error: "Failed to update employee" };
  }
}

/**
 * Soft delete an employee.
 * Permission: employee:delete
 */
export async function deleteEmployee(employeeId: string, reason: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_DELETE);

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
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        deletedAt: new Date(),
        employmentStatus: "TERMINATED",
        separationDate: new Date(),
        separationReason: reason,
      },
    });

    await audit.delete("Employee", employeeId, {
      employeeNumber: employee.employeeNumber,
      name: `${employee.firstName} ${employee.lastName}`,
      reason,
    });

    revalidatePath("/employees");

    return { success: true, message: "Employee deleted successfully" };
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return { success: false, error: "Failed to delete employee" };
  }
}

/**
 * Separate an employee (change status without soft delete).
 * Permission: employee:delete
 */
export async function separateEmployee(
  employeeId: string,
  input: {
    separationType: string;
    separationReason: string;
    separationDate: string;
  }
) {
  const auth = await assertPermission(Permission.EMPLOYEE_DELETE);

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
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  // Map separation type to employment status
  const statusMap: Record<string, "RESIGNED" | "TERMINATED" | "AWOL" | "DECEASED" | "END_OF_CONTRACT" | "RETIRED"> = {
    RESIGNED: "RESIGNED",
    TERMINATED: "TERMINATED",
    END_OF_CONTRACT: "END_OF_CONTRACT",
    AWOL: "AWOL",
    REDUNDANCY: "TERMINATED",
    RETIREMENT: "RETIRED",
    DEATH: "DECEASED",
    OTHER: "RESIGNED",
  };

  const employmentStatus = statusMap[input.separationType] || "RESIGNED";

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employmentStatus,
        separationDate: new Date(input.separationDate),
        separationReason: input.separationReason,
      },
    });

    await audit.update(
      "Employee",
      employeeId,
      { employmentStatus: employee.employmentStatus },
      {
        employmentStatus,
        separationDate: input.separationDate,
        separationReason: input.separationReason,
        separationType: input.separationType,
      }
    );

    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);

    return { success: true, message: "Employee separated successfully" };
  } catch (error) {
    console.error("Failed to separate employee:", error);
    return { success: false, error: "Failed to separate employee" };
  }
}

// =============================================================================
// Pay Profile
// =============================================================================

// =============================================================================
// Role Management
// =============================================================================

export interface UpdateEmployeeRoleInput {
  roleScorecardId: string;
  effectiveDate: string;
  reasonCode?: string;
}

/**
 * Update an employee's role (from role scorecard).
 * This also creates a pay profile based on the role's base salary.
 * Permission: employee:edit
 */
export async function updateEmployeeRole(employeeId: string, input: UpdateEmployeeRoleInput) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

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
    include: {
      roleScorecard: {
        include: { department: true },
      },
    },
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  // Get the new role scorecard
  const newRole = await prisma.roleScorecard.findUnique({
    where: { id: input.roleScorecardId },
    include: {
      department: true,
      shiftTemplate: true,
    },
  });

  if (!newRole) {
    return { success: false, error: "Role scorecard not found" };
  }

  const effectiveDate = new Date(input.effectiveDate);
  const oldRole = employee.roleScorecard;

  try {
    await prisma.$transaction(async (tx) => {
      // Update employee with new role
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          roleScorecardId: input.roleScorecardId,
          jobTitle: newRole.jobTitle,
          departmentId: newRole.departmentId,
        },
      });

      // Create employment event for role change
      await tx.employmentEvent.create({
        data: {
          employeeId,
          eventType: "ROLE_CHANGE",
          eventDate: effectiveDate,
          status: "APPROVED",
          payload: {
            previousRole: oldRole?.jobTitle || null,
            newRole: newRole.jobTitle,
            previousDepartment: oldRole?.department?.name || null,
            newDepartment: newRole.department?.name || null,
            previousSalary: oldRole?.baseSalary?.toString() || null,
            newSalary: newRole.baseSalary?.toString() || null,
            reasonCode: input.reasonCode,
          },
          requestedById: auth.user.id,
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });
    });

    // Log the role change
    await audit.update(
      "Employee",
      employeeId,
      {
        roleScorecardId: employee.roleScorecardId,
        jobTitle: oldRole?.jobTitle || null,
        departmentId: oldRole?.department?.id || null,
      },
      {
        roleScorecardId: input.roleScorecardId,
        jobTitle: newRole.jobTitle,
        departmentId: newRole.departmentId,
        effectiveDate: input.effectiveDate,
        reasonCode: input.reasonCode,
      },
      `Role changed from ${oldRole?.jobTitle || "none"} to ${newRole.jobTitle}`
    );

    revalidatePath(`/employees/${employeeId}`);

    return { success: true, message: "Role updated successfully" };
  } catch (error) {
    console.error("Failed to update employee role:", error);
    return { success: false, error: "Failed to update role" };
  }
}

// =============================================================================
// Employment Events
// =============================================================================

/**
 * Create an employment event.
 * Permission: employee:edit
 */
export async function createEmploymentEvent(employeeId: string, input: CreateEmploymentEventInput) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

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
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  try {
    const event = await prisma.employmentEvent.create({
      data: {
        employeeId,
        eventType: input.eventType as "HIRE" | "REGULARIZATION" | "SALARY_CHANGE" | "ROLE_CHANGE" | "DEPARTMENT_TRANSFER" | "PROMOTION" | "DEMOTION" | "PENALTY_ISSUED" | "INCIDENT_REPORTED" | "COMMENDATION" | "SEPARATION_INITIATED" | "SEPARATION_CONFIRMED" | "REHIRE" | "STATUS_CHANGE",
        eventDate: new Date(input.eventDate),
        status: "PENDING",
        payload: input.payload ? JSON.parse(JSON.stringify(input.payload)) : undefined,
        remarks: input.remarks,
        requestedById: auth.user.id,
      },
    });

    // For regularization, auto-approve and update employee
    if (input.eventType === "REGULARIZATION") {
      await prisma.$transaction(async (tx) => {
        await tx.employmentEvent.update({
          where: { id: event.id },
          data: {
            status: "APPROVED",
            approvedById: auth.user.id,
            approvedAt: new Date(),
          },
        });

        await tx.employee.update({
          where: { id: employeeId },
          data: {
            employmentType: "REGULAR",
            regularizationDate: new Date(input.eventDate),
          },
        });
      });
    }

    // For separation initiated, update status
    if (input.eventType === "SEPARATION_INITIATED") {
      // Don't auto-change status yet, wait for confirmation
    }

    // For separation confirmed, update employee status
    if (input.eventType === "SEPARATION_CONFIRMED") {
      const separationType = input.payload.separationType as string;
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          employmentStatus: separationType === "RESIGNED" ? "RESIGNED" : separationType === "TERMINATED" ? "TERMINATED" : "END_OF_CONTRACT",
          separationDate: new Date(input.eventDate),
          separationReason: input.payload.reason as string,
        },
      });
    }

    await audit.create("EmploymentEvent", event.id, {
      employeeId,
      employeeNumber: employee.employeeNumber,
      eventType: input.eventType,
      eventDate: input.eventDate,
      payload: input.payload,
    });

    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      eventId: event.id,
      message: "Employment event created successfully",
    };
  } catch (error) {
    console.error("Failed to create employment event:", error);
    return { success: false, error: "Failed to create employment event" };
  }
}

/**
 * Approve an employment event.
 * Permission: employee:edit (or specific approval permission)
 */
export async function approveEmploymentEvent(eventId: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const event = await prisma.employmentEvent.findUnique({
    where: { id: eventId },
    include: { employee: true },
  });

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  if (event.status !== "PENDING") {
    return { success: false, error: "Event is not pending" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employmentEvent.update({
        where: { id: eventId },
        data: {
          status: "APPROVED",
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });

      // Apply event effects based on type
      if (event.eventType === "REGULARIZATION") {
        await tx.employee.update({
          where: { id: event.employeeId },
          data: {
            employmentType: "REGULAR",
            regularizationDate: event.eventDate,
          },
        });
      }

      if (event.eventType === "ROLE_CHANGE" || event.eventType === "PROMOTION" || event.eventType === "DEMOTION") {
        const payload = event.payload as { newJobTitle?: string; newJobLevel?: string; newDepartmentId?: string };
        await tx.employee.update({
          where: { id: event.employeeId },
          data: {
            jobTitle: payload.newJobTitle,
            jobLevel: payload.newJobLevel,
            departmentId: payload.newDepartmentId,
          },
        });
      }

      if (event.eventType === "DEPARTMENT_TRANSFER") {
        const payload = event.payload as { newDepartmentId?: string };
        await tx.employee.update({
          where: { id: event.employeeId },
          data: {
            departmentId: payload.newDepartmentId,
          },
        });
      }

      // Note: SALARY_CHANGE events now only update the role scorecard's baseSalary
      // The salary is stored in the RoleScorecard model, not in a separate PayProfile

      // Handle SEPARATION_CONFIRMED: Update employee status
      if (event.eventType === "SEPARATION_CONFIRMED") {
        const payload = event.payload as {
          separationType?: string;
          lastWorkingDate?: string;
        };

        let employmentStatus: "RESIGNED" | "TERMINATED" | "END_OF_CONTRACT" = "RESIGNED";
        if (payload.separationType === "TERMINATED") {
          employmentStatus = "TERMINATED";
        } else if (payload.separationType === "END_OF_CONTRACT") {
          employmentStatus = "END_OF_CONTRACT";
        }

        await tx.employee.update({
          where: { id: event.employeeId },
          data: {
            employmentStatus,
            separationDate: payload.lastWorkingDate ? new Date(payload.lastWorkingDate) : event.eventDate,
          },
        });
      }
    });

    // Auto-generate documents based on event type (outside transaction for resilience)
    const documentsGenerated: string[] = [];

    if (event.eventType === "REGULARIZATION") {
      const result = await autoGenerateEventDocument(
        event.employeeId,
        eventId,
        "regularization_memo",
        auth.user.id
      );
      if (result.success) documentsGenerated.push("regularization_memo");
    }

    if (event.eventType === "SALARY_CHANGE") {
      const salaryPayload = event.payload as {
        previousBaseRate?: number;
        newBaseRate?: number;
        reason?: string;
      };
      const result = await autoGenerateEventDocument(
        event.employeeId,
        eventId,
        "salary_change_memo",
        auth.user.id,
        {
          previousSalary: salaryPayload.previousBaseRate,
          newSalary: salaryPayload.newBaseRate,
          effectiveDate: event.eventDate.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          reason: salaryPayload.reason || "merit increase",
        }
      );
      if (result.success) documentsGenerated.push("salary_change_memo");
    }

    if (event.eventType === "SEPARATION_CONFIRMED") {
      // Generate both separation clearance and COE
      const clearanceResult = await autoGenerateEventDocument(
        event.employeeId,
        eventId,
        "separation_clearance",
        auth.user.id
      );
      if (clearanceResult.success) documentsGenerated.push("separation_clearance");

      const coeResult = await autoGenerateEventDocument(
        event.employeeId,
        eventId,
        "certificate_of_employment",
        auth.user.id
      );
      if (coeResult.success) documentsGenerated.push("certificate_of_employment");
    }

    if (event.eventType === "DEPARTMENT_TRANSFER") {
      const transferPayload = event.payload as {
        newDepartmentId?: string;
        oldDepartmentId?: string;
        reason?: string;
      };

      // Fetch new department name
      let newDepartmentName: string | undefined;
      if (transferPayload.newDepartmentId) {
        const newDept = await prisma.department.findUnique({
          where: { id: transferPayload.newDepartmentId },
          select: { name: true },
        });
        newDepartmentName = newDept?.name;
      }

      const result = await autoGenerateEventDocument(
        event.employeeId,
        eventId,
        "lateral_transfer",
        auth.user.id,
        {
          newDepartment: newDepartmentName,
          transferReason: transferPayload.reason || "operational_necessity",
          effectiveDate: event.eventDate.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        }
      );
      if (result.success) documentsGenerated.push("lateral_transfer");
    }

    if (event.eventType === "PENALTY_ISSUED") {
      const penaltyPayload = event.payload as {
        penaltyType?: string;
        description?: string;
      };
      // Determine which disciplinary document to generate based on penalty type
      const penaltyTypeLower = penaltyPayload.penaltyType?.toLowerCase() || "";
      let docType: "disciplinary_warning" | "disciplinary_action" = "disciplinary_warning";

      if (penaltyTypeLower.includes("suspension") || penaltyTypeLower.includes("termination")) {
        docType = "disciplinary_action";
      }

      const result = await autoGenerateEventDocument(
        event.employeeId,
        eventId,
        docType,
        auth.user.id,
        docType === "disciplinary_warning"
          ? {
              unsatisfactoryAspects: [penaltyPayload.description || penaltyPayload.penaltyType || "Performance issue"],
              suggestionsForImprovement: ["Adhere to company policies and procedures"],
              improvementPeriodDays: 30,
            }
          : {
              violations: [
                {
                  title: penaltyPayload.penaltyType || "Policy Violation",
                  description: penaltyPayload.description || "Details to be provided",
                },
              ],
            }
      );
      if (result.success) documentsGenerated.push(docType);
    }

    await audit.approve("EmploymentEvent", eventId, {
      employeeId: event.employeeId,
      eventType: event.eventType,
      documentsGenerated,
    });

    revalidatePath(`/employees/${event.employeeId}`);

    const message = documentsGenerated.length > 0
      ? `Event approved. Documents generated: ${documentsGenerated.join(", ")}`
      : "Event approved successfully";

    return { success: true, message };
  } catch (error) {
    console.error("Failed to approve event:", error);
    return { success: false, error: "Failed to approve event" };
  }
}

/**
 * Reject an employment event.
 * Permission: employee:edit
 */
export async function rejectEmploymentEvent(eventId: string, reason: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const event = await prisma.employmentEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return { success: false, error: "Event not found" };
  }

  if (event.status !== "PENDING") {
    return { success: false, error: "Event is not pending" };
  }

  try {
    await prisma.employmentEvent.update({
      where: { id: eventId },
      data: {
        status: "REJECTED",
        approvedById: auth.user.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    await audit.reject("EmploymentEvent", eventId, {
      employeeId: event.employeeId,
      eventType: event.eventType,
      reason,
    });

    revalidatePath(`/employees/${event.employeeId}`);

    return { success: true, message: "Event rejected" };
  } catch (error) {
    console.error("Failed to reject event:", error);
    return { success: false, error: "Failed to reject event" };
  }
}

// =============================================================================
// Statutory IDs
// =============================================================================

/**
 * Update employee statutory IDs.
 * Permission: employee:edit + employee:view_sensitive
 */
export async function updateStatutoryIds(
  employeeId: string,
  ids: { sss?: string; philhealth?: string; pagibig?: string; tin?: string }
) {
  await assertPermission(Permission.EMPLOYEE_EDIT);
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW_SENSITIVE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  try {
    for (const [idType, idNumber] of Object.entries(ids)) {
      if (idNumber !== undefined) {
        await prisma.employeeStatutoryId.upsert({
          where: {
            employeeId_idType: { employeeId, idType },
          },
          create: {
            employeeId,
            idType,
            idNumber,
          },
          update: {
            idNumber,
          },
        });
      }
    }

    await audit.update("EmployeeStatutoryId", employeeId, {}, maskSensitiveFields(ids as Record<string, unknown>));

    revalidatePath(`/employees/${employeeId}`);

    return { success: true, message: "Statutory IDs updated" };
  } catch (error) {
    console.error("Failed to update statutory IDs:", error);
    return { success: false, error: "Failed to update statutory IDs" };
  }
}

// =============================================================================
// Declared Wage Override (SUPER_ADMIN only)
// =============================================================================

export interface SetDeclaredWageOverrideInput {
  declaredWageOverride: number | null; // null to clear override
  declaredWageType?: "MONTHLY" | "DAILY" | "HOURLY";
  effectiveDate: string;
  reason: string;
}

/**
 * Set or clear an employee's declared wage override.
 * This override is used ONLY for statutory contributions (SSS, PhilHealth, PagIBIG)
 * and withholding tax calculations. Actual payroll earnings still use RoleScorecard.
 *
 * Permission: SUPER_ADMIN role ONLY
 */
export async function setDeclaredWageOverride(
  employeeId: string,
  input: SetDeclaredWageOverrideInput
) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // CRITICAL: SUPER_ADMIN role check
  if (!auth.user.roles.includes("SUPER_ADMIN")) {
    return {
      success: false,
      error: "Only Super Administrators can set wage overrides",
    };
  }

  // Validate input
  if (input.declaredWageOverride !== null) {
    if (input.declaredWageOverride <= 0) {
      return {
        success: false,
        error: "Override amount must be positive",
      };
    }
    if (!input.declaredWageType) {
      return {
        success: false,
        error: "Wage type is required when setting an override",
      };
    }
  }

  if (!input.reason || input.reason.trim().length < 10) {
    return {
      success: false,
      error: "Reason must be at least 10 characters",
    };
  }

  // Verify employee exists and belongs to company
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      declaredWageOverride: true,
      declaredWageType: true,
      declaredWageEffectiveAt: true,
      declaredWageReason: true,
    },
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  const effectiveDate = new Date(input.effectiveDate);
  const isClearing = input.declaredWageOverride === null;

  try {
    await prisma.$transaction(async (tx) => {
      // Update employee with override
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          declaredWageOverride: isClearing ? null : input.declaredWageOverride,
          declaredWageType: isClearing ? null : input.declaredWageType,
          declaredWageEffectiveAt: effectiveDate,
          declaredWageSetById: auth.user.id,
          declaredWageSetAt: new Date(),
          declaredWageReason: input.reason.trim(),
        },
      });

      // Create employment event for audit trail
      await tx.employmentEvent.create({
        data: {
          employeeId,
          eventType: "DECLARED_WAGE_OVERRIDE",
          eventDate: effectiveDate,
          status: "APPROVED",
          payload: {
            action: isClearing ? "CLEARED" : "SET",
            previousOverride: employee.declaredWageOverride?.toString() || null,
            previousWageType: employee.declaredWageType || null,
            newOverride: isClearing ? null : input.declaredWageOverride,
            newWageType: isClearing ? null : input.declaredWageType,
            reason: input.reason.trim(),
          },
          requestedById: auth.user.id,
          approvedById: auth.user.id,
          approvedAt: new Date(),
        },
      });
    });

    // Audit log
    await audit.update(
      "Employee",
      employeeId,
      {
        declaredWageOverride: employee.declaredWageOverride?.toString() || null,
        declaredWageType: employee.declaredWageType || null,
      },
      {
        declaredWageOverride: isClearing ? null : input.declaredWageOverride,
        declaredWageType: isClearing ? null : input.declaredWageType,
        effectiveDate: input.effectiveDate,
        reason: input.reason.trim(),
      },
      isClearing
        ? "Cleared declared wage override"
        : `Set declared wage override to ${input.declaredWageOverride} (${input.declaredWageType})`
    );

    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      message: isClearing
        ? "Declared wage override cleared"
        : "Declared wage override set successfully",
    };
  } catch (error) {
    console.error("Failed to set declared wage override:", error);
    return { success: false, error: "Failed to set declared wage override" };
  }
}

// =============================================================================
// Tax Calculation Mode (SUPER_ADMIN only)
// =============================================================================

/**
 * Toggle the tax calculation mode for an employee.
 * When enabled: Withholding tax uses full taxable earnings (earnings - statutory - non-taxable)
 * When disabled (default): Withholding tax uses only Basic Pay - Late/Undertime
 *
 * Permission: SUPER_ADMIN role ONLY
 */
export async function setTaxOnFullEarnings(
  employeeId: string,
  enabled: boolean
) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  // CRITICAL: SUPER_ADMIN role check
  if (!auth.user.roles.includes("SUPER_ADMIN")) {
    return {
      success: false,
      error: "Only Super Administrators can change tax calculation mode",
    };
  }

  // Verify employee exists and belongs to company
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      taxOnFullEarnings: true,
    },
  });

  if (!employee) {
    return { success: false, error: "Employee not found" };
  }

  try {
    await prisma.employee.update({
      where: { id: employeeId },
      data: { taxOnFullEarnings: enabled },
    });

    revalidatePath(`/employees/${employeeId}`);

    return {
      success: true,
      message: enabled
        ? "Tax will now be calculated on full taxable earnings"
        : "Tax will now be calculated on basic pay only",
    };
  } catch (error) {
    console.error("Failed to set tax calculation mode:", error);
    return { success: false, error: "Failed to set tax calculation mode" };
  }
}

// =============================================================================
// GET EMPLOYEE PAYSLIP DETAIL (Server Action for Client Components)
// =============================================================================

export interface PayslipDetailResult {
  success: boolean;
  data?: {
    id: string;
    payslipNumber: string | null;
    payPeriodCode: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    payrollRunStatus: string;
    grossPay: string;
    totalEarnings: string;
    totalDeductions: string;
    netPay: string;
    sssEe: string;
    sssEr: string;
    philhealthEe: string;
    philhealthEr: string;
    pagibigEe: string;
    pagibigEr: string;
    withholdingTax: string;
    ytdGrossPay: string;
    ytdTaxableIncome: string;
    ytdTaxWithheld: string;
    lines: Array<{
      id: string;
      category: string;
      description: string;
      quantity: string | null;
      rate: string | null;
      multiplier: string | null;
      amount: string;
    }>;
    pdfPath: string | null;
    pdfGeneratedAt: string | null;
    createdAt: string;
  };
  error?: string;
}

/**
 * Server action to get detailed payslip with all line items.
 * Can be called from client components.
 */
export async function getPayslipDetailAction(
  employeeId: string,
  payslipId: string
): Promise<PayslipDetailResult> {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  try {
    const payslip = await prisma.payslip.findFirst({
      where: {
        id: payslipId,
        employeeId,
        employee: {
          companyId: auth.user.companyId,
        },
      },
      include: {
        payrollRun: {
          include: {
            payPeriod: {
              select: {
                code: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!payslip) {
      return { success: false, error: "Payslip not found" };
    }

    return {
      success: true,
      data: {
        id: payslip.id,
        payslipNumber: payslip.payslipNumber,
        payPeriodCode: payslip.payrollRun.payPeriod.code,
        payPeriodStart: payslip.payrollRun.payPeriod.startDate.toISOString(),
        payPeriodEnd: payslip.payrollRun.payPeriod.endDate.toISOString(),
        payrollRunStatus: payslip.payrollRun.status,
        grossPay: payslip.grossPay.toString(),
        totalEarnings: payslip.totalEarnings.toString(),
        totalDeductions: payslip.totalDeductions.toString(),
        netPay: payslip.netPay.toString(),
        sssEe: payslip.sssEe.toString(),
        sssEr: payslip.sssEr.toString(),
        philhealthEe: payslip.philhealthEe.toString(),
        philhealthEr: payslip.philhealthEr.toString(),
        pagibigEe: payslip.pagibigEe.toString(),
        pagibigEr: payslip.pagibigEr.toString(),
        withholdingTax: payslip.withholdingTax.toString(),
        ytdGrossPay: payslip.ytdGrossPay.toString(),
        ytdTaxableIncome: payslip.ytdTaxableIncome.toString(),
        ytdTaxWithheld: payslip.ytdTaxWithheld.toString(),
        lines: payslip.lines.map((l) => ({
          id: l.id,
          category: l.category,
          description: l.description,
          quantity: l.quantity?.toString() ?? null,
          rate: l.rate?.toString() ?? null,
          multiplier: l.multiplier?.toString() ?? null,
          amount: l.amount.toString(),
        })),
        pdfPath: payslip.pdfPath,
        pdfGeneratedAt: payslip.pdfGeneratedAt?.toISOString() ?? null,
        createdAt: payslip.createdAt.toISOString(),
      },
    };
  } catch (error) {
    console.error("Failed to get payslip detail:", error);
    return { success: false, error: "Failed to get payslip detail" };
  }
}

