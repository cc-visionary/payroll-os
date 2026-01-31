// =============================================================================
// PeopleOS PH - Employee Data Fetching
// =============================================================================
// Server-side data fetching functions for employees.
// These are used by Server Components and can be cached.
// =============================================================================

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

export interface EmployeeListFilters {
  search?: string;
  status?: string;
  employmentType?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeListResult {
  employees: EmployeeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmployeeListItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  jobTitle: string | null;
  employmentType: string;
  employmentStatus: string;
  hireDate: Date;
  regularizationDate: Date | null;
  department: { id: string; name: string } | null;
}

/**
 * Get paginated list of employees with search and filters.
 */
export const getEmployees = cache(async (filters: EmployeeListFilters = {}): Promise<EmployeeListResult> => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const { search, status, employmentType, departmentId, page = 1, limit = 20 } = filters;

  const where: NonNullable<Parameters<typeof prisma.employee.findMany>[0]>["where"] = {
    companyId: auth.user.companyId,
    deletedAt: null,
  };

  // Search by name or employee number
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filter by status
  if (status) {
    where.employmentStatus = status as "ACTIVE" | "RESIGNED" | "TERMINATED" | "AWOL" | "DECEASED" | "END_OF_CONTRACT";
  }

  // Filter by employment type
  if (employmentType) {
    where.employmentType = employmentType as "REGULAR" | "PROBATIONARY" | "CONTRACTUAL" | "CONSULTANT" | "INTERN";
  }

  // Filter by department
  if (departmentId) {
    where.departmentId = departmentId;
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        jobTitle: true,
        employmentType: true,
        employmentStatus: true,
        hireDate: true,
        regularizationDate: true,
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  return {
    employees,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
});

/**
 * Get a single employee by ID with full details.
 * Serializes Decimal values for client component compatibility.
 */
export const getEmployee = cache(async (employeeId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      department: true,
      roleScorecard: {
        select: {
          id: true,
          jobTitle: true,
        },
      },
      reportsTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      hiringEntity: {
        select: {
          id: true,
          code: true,
          name: true,
          tradeName: true,
        },
      },
      statutoryIds: true,
      bankAccounts: {
        where: { deletedAt: null },
      },
    },
  });

  if (!employee) return null;

  // Serialize Decimal values for client component compatibility
  return {
    ...employee,
    declaredWageOverride: employee.declaredWageOverride
      ? Number(employee.declaredWageOverride)
      : null,
  };
});

/**
 * Get employee employment events.
 */
export const getEmployeeEvents = cache(async (employeeId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const events = await prisma.employmentEvent.findMany({
    where: { employeeId },
    include: {
      requestedBy: {
        select: { id: true, email: true },
      },
      approvedBy: {
        select: { id: true, email: true },
      },
    },
    orderBy: { eventDate: "desc" },
  });

  return events;
});

/**
 * Get employee documents.
 */
export const getEmployeeDocuments = cache(async (employeeId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const documents = await prisma.employeeDocument.findMany({
    where: {
      employeeId,
      deletedAt: null,
    },
    include: {
      uploadedBy: {
        select: { id: true, email: true },
      },
      acknowledgedBy: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return documents;
});

/**
 * Get all departments for dropdowns.
 */
export const getDepartments = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const departments = await prisma.department.findMany({
    where: {
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return departments;
});

/**
 * Get all shift templates for dropdowns.
 */
export const getShiftTemplates = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const shifts = await prisma.shiftTemplate.findMany({
    where: {
      companyId: auth.user.companyId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      startTime: true,
      endTime: true,
    },
    orderBy: { code: "asc" },
  });

  return shifts;
});

/**
 * Get employees for dropdown (minimal data).
 */
export const getEmployeesDropdown = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

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
      jobTitle: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return employees;
});

/**
 * Get the full role scorecard for an employee (for Role tab display).
 * Serializes Decimal values to strings for client component compatibility.
 */
export const getEmployeeRoleScorecard = cache(async (employeeId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    select: {
      roleScorecardId: true,
    },
  });

  if (!employee?.roleScorecardId) {
    return null;
  }

  const scorecard = await prisma.roleScorecard.findUnique({
    where: { id: employee.roleScorecardId },
    select: {
      id: true,
      jobTitle: true,
      missionStatement: true,
      department: {
        select: { id: true, name: true },
      },
      baseSalary: true,
      salaryRangeMin: true,
      salaryRangeMax: true,
      wageType: true,
      workHoursPerDay: true,
      workDaysPerWeek: true,
      shiftTemplate: {
        select: {
          id: true,
          name: true,
          code: true,
          startTime: true,
          endTime: true,
        },
      },
      keyResponsibilities: true,
      kpis: true,
    },
  });

  if (!scorecard) return null;

  // Serialize Decimal and Date values to strings for client component compatibility
  return {
    ...scorecard,
    baseSalary: scorecard.baseSalary ? scorecard.baseSalary.toString() : null,
    salaryRangeMin: scorecard.salaryRangeMin ? scorecard.salaryRangeMin.toString() : null,
    salaryRangeMax: scorecard.salaryRangeMax ? scorecard.salaryRangeMax.toString() : null,
    shiftTemplate: scorecard.shiftTemplate
      ? {
          ...scorecard.shiftTemplate,
          startTime: scorecard.shiftTemplate.startTime.toISOString().slice(11, 16), // Extract HH:mm
          endTime: scorecard.shiftTemplate.endTime.toISOString().slice(11, 16), // Extract HH:mm
        }
      : null,
    keyResponsibilities: scorecard.keyResponsibilities as Array<{ area: string; tasks: string[] }>,
    kpis: scorecard.kpis as Array<{ metric: string; frequency: string }>,
  };
});

/**
 * Get role history for an employee from employment events.
 * Serializes Date objects to ISO strings for client component compatibility.
 */
export const getEmployeeRoleHistory = cache(async (employeeId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const events = await prisma.employmentEvent.findMany({
    where: {
      employeeId,
      eventType: { in: ["ROLE_CHANGE", "HIRE"] },
    },
    orderBy: { eventDate: "desc" },
    select: {
      id: true,
      eventDate: true,
      eventType: true,
      payload: true,
    },
  });

  // Transform events into role history format with serialized dates
  const history = events.map((event, index) => {
    const payload = event.payload as Record<string, unknown>;
    const nextEvent = events[index + 1];

    return {
      id: event.id,
      roleScorecardId: null, // We don't store the ID in events
      jobTitle: (payload?.newRole as string) || (payload?.jobTitle as string) || null,
      department: payload?.newDepartment
        ? { name: payload.newDepartment as string }
        : null,
      effectiveDate: event.eventDate.toISOString(),
      endDate: nextEvent ? nextEvent.eventDate.toISOString() : null,
      reasonCode: (payload?.reasonCode as string) || event.eventType,
    };
  });

  return history;
});

/**
 * Get all role scorecards with full details for role selection.
 * Serializes Decimal values to strings for client component compatibility.
 */
export const getAvailableRoles = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const scorecards = await prisma.roleScorecard.findMany({
    where: {
      companyId: auth.user.companyId,
      isActive: true,
      supersededById: null,
    },
    select: {
      id: true,
      jobTitle: true,
      department: {
        select: { id: true, name: true },
      },
      baseSalary: true,
      wageType: true,
    },
    orderBy: [{ jobTitle: "asc" }],
  });

  // Serialize Decimal values to strings
  return scorecards.map((sc) => ({
    ...sc,
    baseSalary: sc.baseSalary ? sc.baseSalary.toString() : null,
  }));
});

/**
 * Get role scorecards for dropdown (for document generation and employee assignment).
 * Includes compensation info for displaying salary when assigning roles.
 * Serializes Decimal values to strings for client component compatibility.
 */
export const getRoleScorecardsDropdown = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const scorecards = await prisma.roleScorecard.findMany({
    where: {
      companyId: auth.user.companyId,
      isActive: true,
      supersededById: null,
    },
    select: {
      id: true,
      jobTitle: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      // Compensation info
      baseSalary: true,
      salaryRangeMin: true,
      salaryRangeMax: true,
      wageType: true,
      // Shift template info
      shiftTemplate: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: [{ jobTitle: "asc" }],
  });

  // Serialize Decimal values to strings for client component compatibility
  return scorecards.map((sc) => ({
    ...sc,
    baseSalary: sc.baseSalary ? sc.baseSalary.toString() : null,
    salaryRangeMin: sc.salaryRangeMin ? sc.salaryRangeMin.toString() : null,
    salaryRangeMax: sc.salaryRangeMax ? sc.salaryRangeMax.toString() : null,
  }));
});

/**
 * Payslip summary for employee payslip list
 */
export interface EmployeePayslipSummary {
  id: string;
  payslipNumber: string | null;
  payPeriodCode: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payrollRunStatus: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  createdAt: string;
}

/**
 * Payslip line item for detailed view
 */
export interface PayslipLineItem {
  id: string;
  category: string;
  description: string;
  quantity: string | null;
  rate: string | null;
  multiplier: string | null;
  amount: string;
}

/**
 * Full payslip detail with lines
 */
export interface EmployeePayslipDetail {
  id: string;
  payslipNumber: string | null;
  payPeriodCode: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payrollRunStatus: string;
  // Summary totals
  grossPay: string;
  totalEarnings: string;
  totalDeductions: string;
  netPay: string;
  // Statutory breakdowns
  sssEe: string;
  sssEr: string;
  philhealthEe: string;
  philhealthEr: string;
  pagibigEe: string;
  pagibigEr: string;
  withholdingTax: string;
  // YTD totals
  ytdGrossPay: string;
  ytdTaxableIncome: string;
  ytdTaxWithheld: string;
  // Lines
  lines: PayslipLineItem[];
  // PDF
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  createdAt: string;
}

/**
 * Get payslips for an employee with summary info.
 * Serializes Decimal and Date values to strings for client component compatibility.
 */
export const getEmployeePayslips = cache(async (employeeId: string): Promise<EmployeePayslipSummary[]> => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const payslips = await prisma.payslip.findMany({
    where: {
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return payslips.map((p) => ({
    id: p.id,
    payslipNumber: p.payslipNumber,
    payPeriodCode: p.payrollRun.payPeriod.code,
    payPeriodStart: p.payrollRun.payPeriod.startDate.toISOString(),
    payPeriodEnd: p.payrollRun.payPeriod.endDate.toISOString(),
    payrollRunStatus: p.payrollRun.status,
    grossPay: p.grossPay.toString(),
    totalDeductions: p.totalDeductions.toString(),
    netPay: p.netPay.toString(),
    pdfPath: p.pdfPath,
    pdfGeneratedAt: p.pdfGeneratedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));
});

/**
 * Get detailed payslip with all line items.
 * Serializes Decimal and Date values to strings for client component compatibility.
 */
export const getEmployeePayslipDetail = cache(async (employeeId: string, payslipId: string): Promise<EmployeePayslipDetail | null> => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

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

  if (!payslip) return null;

  return {
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
  };
});
