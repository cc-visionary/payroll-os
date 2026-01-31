"use server";

// =============================================================================
// PeopleOS PH - Dashboard Analytics Server Actions
// =============================================================================
// Server actions for dashboard metrics following HRCI (Human Resource
// Certification Institute) standards for HR analytics and reporting.
// =============================================================================

import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";

// =============================================================================
// TYPES
// =============================================================================

export interface HeadcountMetrics {
  totalEmployees: number;
  activeEmployees: number;
  byEmploymentType: { type: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  byHiringEntity: { entity: string; count: number }[];
  newHiresThisMonth: number;
  separationsThisMonth: number;
}

export interface TurnoverMetrics {
  turnoverRate: number; // Annual turnover rate %
  voluntaryTurnover: number;
  involuntaryTurnover: number;
  averageTenure: number; // In months
  tenureDistribution: { range: string; count: number }[];
  retentionRate: number;
}

export interface RecruitmentMetrics {
  openPositions: number;
  applicantsThisMonth: number;
  interviewsScheduled: number;
  offersExtended: number;
  offersAccepted: number;
  averageTimeToHire: number; // In days
  pipelineByStatus: { status: string; count: number }[];
  sourceEffectiveness: { source: string; count: number; hired: number }[];
}

export interface AttendanceMetrics {
  attendanceRate: number; // %
  averageLateMinutes: number;
  absenteeismRate: number; // %
  leaveUtilization: number; // %
  overtimeHours: number;
  attendanceTrend: { date: string; rate: number }[];
}

export interface PayrollMetrics {
  totalPayrollCost: number;
  averageSalary: number;
  payrollByDepartment: { department: string; amount: number }[];
  payrollByHiringEntity: { entity: string; amount: number }[];
  statutoryContributions: {
    sss: number;
    philhealth: number;
    pagibig: number;
    tax: number;
  };
}

export interface PerformanceMetrics {
  checkInsCompleted: number;
  checkInsPending: number;
  averageRating: number;
  ratingDistribution: { rating: string; count: number }[];
}

export interface DashboardData {
  headcount: HeadcountMetrics;
  turnover: TurnoverMetrics;
  recruitment: RecruitmentMetrics;
  attendance: AttendanceMetrics;
  payroll: PayrollMetrics;
  performance: PerformanceMetrics;
  period: {
    month: number;
    year: number;
    monthName: string;
  };
}

// =============================================================================
// DASHBOARD DATA FETCHING
// =============================================================================

/**
 * Get comprehensive dashboard metrics following HRCI standards.
 */
export async function getDashboardMetrics(): Promise<DashboardData> {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);
  const companyId = auth.user.companyId;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);
  const yearStart = new Date(currentYear, 0, 1);

  // Fetch all metrics in parallel for performance
  const [
    headcount,
    turnover,
    recruitment,
    attendance,
    payroll,
    performance,
  ] = await Promise.all([
    getHeadcountMetrics(companyId, monthStart, monthEnd),
    getTurnoverMetrics(companyId, yearStart, now),
    getRecruitmentMetrics(companyId, monthStart, monthEnd),
    getAttendanceMetrics(companyId, monthStart, monthEnd),
    getPayrollMetrics(companyId, monthStart, monthEnd),
    getPerformanceMetrics(companyId),
  ]);

  return {
    headcount,
    turnover,
    recruitment,
    attendance,
    payroll,
    performance,
    period: {
      month: currentMonth + 1,
      year: currentYear,
      monthName: now.toLocaleString("en-PH", { month: "long" }),
    },
  };
}

// =============================================================================
// HEADCOUNT METRICS (HRCI: Workforce Planning)
// =============================================================================

async function getHeadcountMetrics(
  companyId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<HeadcountMetrics> {
  // Total and active employees
  const [totalEmployees, activeEmployees] = await Promise.all([
    prisma.employee.count({
      where: { companyId, deletedAt: null },
    }),
    prisma.employee.count({
      where: { companyId, deletedAt: null, employmentStatus: "ACTIVE" },
    }),
  ]);

  // By employment type
  const byTypeRaw = await prisma.employee.groupBy({
    by: ["employmentType"],
    where: { companyId, deletedAt: null, employmentStatus: "ACTIVE" },
    _count: true,
  });
  const byEmploymentType = byTypeRaw.map((r) => ({
    type: r.employmentType,
    count: r._count,
  }));

  // By department
  const employeesWithDept = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, employmentStatus: "ACTIVE" },
    select: {
      department: { select: { name: true } },
    },
  });
  const deptCounts = new Map<string, number>();
  for (const emp of employeesWithDept) {
    const dept = emp.department?.name || "Unassigned";
    deptCounts.set(dept, (deptCounts.get(dept) || 0) + 1);
  }
  const byDepartment = Array.from(deptCounts.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  // By hiring entity
  const employeesWithEntity = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, employmentStatus: "ACTIVE" },
    select: {
      hiringEntity: { select: { tradeName: true, name: true } },
    },
  });
  const entityCounts = new Map<string, number>();
  for (const emp of employeesWithEntity) {
    const entity = emp.hiringEntity?.tradeName || emp.hiringEntity?.name || "Unassigned";
    entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
  }
  const byHiringEntity = Array.from(entityCounts.entries())
    .map(([entity, count]) => ({ entity, count }))
    .sort((a, b) => b.count - a.count);

  // New hires this month
  const newHiresThisMonth = await prisma.employee.count({
    where: {
      companyId,
      deletedAt: null,
      hireDate: { gte: monthStart, lte: monthEnd },
    },
  });

  // Separations this month
  const separationsThisMonth = await prisma.employee.count({
    where: {
      companyId,
      employmentStatus: { in: ["RESIGNED", "TERMINATED", "AWOL", "END_OF_CONTRACT"] },
      updatedAt: { gte: monthStart, lte: monthEnd },
    },
  });

  return {
    totalEmployees,
    activeEmployees,
    byEmploymentType,
    byDepartment,
    byHiringEntity,
    newHiresThisMonth,
    separationsThisMonth,
  };
}

// =============================================================================
// TURNOVER METRICS (HRCI: Workforce Analytics)
// =============================================================================

async function getTurnoverMetrics(
  companyId: string,
  yearStart: Date,
  now: Date
): Promise<TurnoverMetrics> {
  // Get all employees for tenure calculation
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, employmentStatus: "ACTIVE" },
    select: { hireDate: true },
  });

  // Calculate average tenure in months
  const tenures = employees.map((emp) => {
    const months = (now.getTime() - emp.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.max(0, months);
  });
  const averageTenure = tenures.length > 0
    ? tenures.reduce((a, b) => a + b, 0) / tenures.length
    : 0;

  // Tenure distribution
  const tenureRanges = [
    { range: "< 1 year", min: 0, max: 12 },
    { range: "1-2 years", min: 12, max: 24 },
    { range: "2-5 years", min: 24, max: 60 },
    { range: "5+ years", min: 60, max: Infinity },
  ];
  const tenureDistribution = tenureRanges.map(({ range, min, max }) => ({
    range,
    count: tenures.filter((t) => t >= min && t < max).length,
  }));

  // Get separations this year
  const separations = await prisma.employee.findMany({
    where: {
      companyId,
      employmentStatus: { in: ["RESIGNED", "TERMINATED", "AWOL", "END_OF_CONTRACT"] },
      updatedAt: { gte: yearStart },
    },
    select: { employmentStatus: true },
  });

  const voluntaryTurnover = separations.filter(
    (e) => e.employmentStatus === "RESIGNED"
  ).length;
  const involuntaryTurnover = separations.filter(
    (e) => ["TERMINATED", "AWOL"].includes(e.employmentStatus)
  ).length;

  // Calculate turnover rate (annual)
  const avgHeadcount = employees.length || 1;
  const turnoverRate = (separations.length / avgHeadcount) * 100;
  const retentionRate = 100 - turnoverRate;

  return {
    turnoverRate: Math.round(turnoverRate * 10) / 10,
    voluntaryTurnover,
    involuntaryTurnover,
    averageTenure: Math.round(averageTenure * 10) / 10,
    tenureDistribution,
    retentionRate: Math.round(retentionRate * 10) / 10,
  };
}

// =============================================================================
// RECRUITMENT METRICS (HRCI: Talent Acquisition)
// =============================================================================

async function getRecruitmentMetrics(
  companyId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<RecruitmentMetrics> {
  // Open positions (active role scorecards without enough employees)
  const openPositions = await prisma.roleScorecard.count({
    where: { companyId, isActive: true, supersededById: null },
  });

  // Applicants this month
  const applicantsThisMonth = await prisma.applicant.count({
    where: {
      companyId,
      deletedAt: null,
      appliedAt: { gte: monthStart, lte: monthEnd },
    },
  });

  // Interviews scheduled
  const interviewsScheduled = await prisma.interview.count({
    where: {
      applicant: { companyId, deletedAt: null },
      scheduledDate: { gte: monthStart, lte: monthEnd },
    },
  });

  // Offers extended and accepted
  const [offersExtended, offersAccepted] = await Promise.all([
    prisma.applicant.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ["OFFER", "OFFER_ACCEPTED", "HIRED"] },
        statusChangedAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.applicant.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ["OFFER_ACCEPTED", "HIRED"] },
        statusChangedAt: { gte: monthStart, lte: monthEnd },
      },
    }),
  ]);

  // Pipeline by status
  const pipelineRaw = await prisma.applicant.groupBy({
    by: ["status"],
    where: { companyId, deletedAt: null },
    _count: true,
  });
  const pipelineByStatus = pipelineRaw.map((r) => ({
    status: r.status,
    count: r._count,
  }));

  // Source effectiveness
  const sourceRaw = await prisma.applicant.groupBy({
    by: ["source"],
    where: { companyId, deletedAt: null, source: { not: null } },
    _count: true,
  });

  const sourceEffectiveness = await Promise.all(
    sourceRaw.map(async (r) => {
      const hired = await prisma.applicant.count({
        where: {
          companyId,
          deletedAt: null,
          source: r.source,
          status: "HIRED",
        },
      });
      return {
        source: r.source || "Unknown",
        count: r._count,
        hired,
      };
    })
  );

  // Average time to hire (for hired applicants)
  const hiredApplicants = await prisma.applicant.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "HIRED",
      convertedAt: { not: null },
    },
    select: { appliedAt: true, convertedAt: true },
  });

  let averageTimeToHire = 0;
  if (hiredApplicants.length > 0) {
    const totalDays = hiredApplicants.reduce((sum, app) => {
      if (app.convertedAt) {
        const days = (app.convertedAt.getTime() - app.appliedAt.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }
      return sum;
    }, 0);
    averageTimeToHire = Math.round(totalDays / hiredApplicants.length);
  }

  return {
    openPositions,
    applicantsThisMonth,
    interviewsScheduled,
    offersExtended,
    offersAccepted,
    averageTimeToHire,
    pipelineByStatus,
    sourceEffectiveness,
  };
}

// =============================================================================
// ATTENDANCE METRICS (HRCI: Workforce Management)
// =============================================================================

async function getAttendanceMetrics(
  companyId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<AttendanceMetrics> {
  // Get attendance day records for the month (metrics calculated on the fly)
  const attendanceRecords = await prisma.attendanceDayRecord.findMany({
    where: {
      employee: { companyId, deletedAt: null },
      attendanceDate: { gte: monthStart, lte: monthEnd },
    },
    select: {
      attendanceStatus: true,
      dayType: true,
      actualTimeIn: true,
      actualTimeOut: true,
      earlyInApproved: true,
      lateOutApproved: true,
      breakMinutesApplied: true,
      shiftTemplate: {
        select: {
          startTime: true,
          endTime: true,
          breakMinutes: true,
          isOvernight: true,
        },
      },
    },
  });

  const totalRecords = attendanceRecords.length;
  const presentRecords = attendanceRecords.filter(
    (r) => r.attendanceStatus === "PRESENT" || r.attendanceStatus === "HALF_DAY"
  ).length;
  const absentRecords = attendanceRecords.filter((r) => r.attendanceStatus === "ABSENT").length;

  // Calculate rates
  const attendanceRate = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 0;
  const absenteeismRate = totalRecords > 0 ? (absentRecords / totalRecords) * 100 : 0;

  // For dashboard summary, we estimate metrics from the data
  // (Full calculations would require more processing per record)
  let totalLateMinutes = 0;
  let lateCount = 0;
  let totalOtMinutes = 0;

  for (const r of attendanceRecords) {
    if (!r.actualTimeIn || !r.actualTimeOut) continue;

    // Helper to extract time in minutes from TIME field
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

    // Schedule times come from shift template
    const schedStartMs = getTimeMinutes(r.shiftTemplate?.startTime);
    if (schedStartMs !== null) {
      // Simple late check: clock in after schedule start
      const clockInMs = r.actualTimeIn.getHours() * 60 + r.actualTimeIn.getMinutes();
      if (clockInMs > schedStartMs) {
        totalLateMinutes += clockInMs - schedStartMs;
        lateCount++;
      }
    }

    // OT: approved late out
    const schedEndMs = getTimeMinutes(r.shiftTemplate?.endTime);
    if (schedEndMs !== null && r.lateOutApproved) {
      const clockOutMs = r.actualTimeOut.getHours() * 60 + r.actualTimeOut.getMinutes();
      if (clockOutMs > schedEndMs) {
        totalOtMinutes += clockOutMs - schedEndMs;
      }
    }

    // Rest day/holiday work = all worked time is OT
    if (r.dayType === "REST_DAY" || r.dayType === "REGULAR_HOLIDAY" || r.dayType === "SPECIAL_HOLIDAY") {
      const breakMins = r.breakMinutesApplied ?? r.shiftTemplate?.breakMinutes ?? 60;
      const workedMs = r.actualTimeOut.getTime() - r.actualTimeIn.getTime();
      const workedMins = Math.max(0, Math.round(workedMs / (1000 * 60)) - breakMins);
      totalOtMinutes += workedMins;
    }
  }

  const averageLateMinutes = lateCount > 0 ? totalLateMinutes / lateCount : 0;
  const overtimeHours = totalOtMinutes / 60;

  // Leave utilization (simplified - would need more data)
  const leaveRecords = attendanceRecords.filter((r) => r.attendanceStatus === "ON_LEAVE").length;
  const leaveUtilization = totalRecords > 0 ? (leaveRecords / totalRecords) * 100 : 0;

  // Attendance trend (last 7 days)
  const attendanceTrend: { date: string; rate: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() - i);
    attendanceTrend.push({
      date: date.toISOString().split("T")[0],
      rate: attendanceRate, // Simplified - actual implementation would filter by date
    });
  }

  return {
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    averageLateMinutes: Math.round(averageLateMinutes),
    absenteeismRate: Math.round(absenteeismRate * 10) / 10,
    leaveUtilization: Math.round(leaveUtilization * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    attendanceTrend,
  };
}

// =============================================================================
// PAYROLL METRICS (HRCI: Total Rewards)
// =============================================================================

async function getPayrollMetrics(
  companyId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<PayrollMetrics> {
  // Get latest payroll run for the period
  const payrollRuns = await prisma.payrollRun.findMany({
    where: {
      payPeriod: {
        calendar: { companyId },
        startDate: { gte: monthStart },
        endDate: { lte: monthEnd },
      },
      status: { in: ["APPROVED", "RELEASED"] },
    },
    include: {
      payslips: {
        include: {
          employee: {
            select: {
              department: { select: { name: true } },
              hiringEntity: { select: { tradeName: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Aggregate payroll data
  let totalPayrollCost = 0;
  let totalSss = 0;
  let totalPhilhealth = 0;
  let totalPagibig = 0;
  let totalTax = 0;
  const deptPayroll = new Map<string, number>();
  const entityPayroll = new Map<string, number>();
  const salaries: number[] = [];

  const toNum = (val: unknown) =>
    typeof val === "object" && val !== null && "toNumber" in val
      ? (val as { toNumber: () => number }).toNumber()
      : Number(val) || 0;

  for (const run of payrollRuns) {
    for (const payslip of run.payslips) {
      const netPay = toNum(payslip.netPay);
      totalPayrollCost += netPay;
      salaries.push(toNum(payslip.grossPay));

      totalSss += toNum(payslip.sssEe) + toNum(payslip.sssEr);
      totalPhilhealth += toNum(payslip.philhealthEe) + toNum(payslip.philhealthEr);
      totalPagibig += toNum(payslip.pagibigEe) + toNum(payslip.pagibigEr);
      totalTax += toNum(payslip.withholdingTax);

      const dept = payslip.employee.department?.name || "Unassigned";
      deptPayroll.set(dept, (deptPayroll.get(dept) || 0) + netPay);

      const entity =
        payslip.employee.hiringEntity?.tradeName ||
        payslip.employee.hiringEntity?.name ||
        "Unassigned";
      entityPayroll.set(entity, (entityPayroll.get(entity) || 0) + netPay);
    }
  }

  const averageSalary =
    salaries.length > 0 ? salaries.reduce((a, b) => a + b, 0) / salaries.length : 0;

  return {
    totalPayrollCost: Math.round(totalPayrollCost * 100) / 100,
    averageSalary: Math.round(averageSalary * 100) / 100,
    payrollByDepartment: Array.from(deptPayroll.entries())
      .map(([department, amount]) => ({ department, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
    payrollByHiringEntity: Array.from(entityPayroll.entries())
      .map(([entity, amount]) => ({ entity, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
    statutoryContributions: {
      sss: Math.round(totalSss * 100) / 100,
      philhealth: Math.round(totalPhilhealth * 100) / 100,
      pagibig: Math.round(totalPagibig * 100) / 100,
      tax: Math.round(totalTax * 100) / 100,
    },
  };
}

// =============================================================================
// PERFORMANCE METRICS (HRCI: Performance Management)
// =============================================================================

async function getPerformanceMetrics(companyId: string): Promise<PerformanceMetrics> {
  // Get current check-in period
  const currentPeriod = await prisma.checkInPeriod.findFirst({
    where: {
      companyId,
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });

  if (!currentPeriod) {
    return {
      checkInsCompleted: 0,
      checkInsPending: 0,
      averageRating: 0,
      ratingDistribution: [],
    };
  }

  // Get check-ins for current period
  const checkIns = await prisma.performanceCheckIn.findMany({
    where: { periodId: currentPeriod.id },
    select: { status: true },
  });

  const checkInsCompleted = checkIns.filter(
    (c) => c.status === "COMPLETED" || c.status === "UNDER_REVIEW"
  ).length;
  const checkInsPending = checkIns.filter(
    (c) => c.status === "DRAFT" || c.status === "SUBMITTED"
  ).length;

  // Get skill ratings for distribution
  const skillRatings = await prisma.skillRating.findMany({
    where: {
      checkIn: { periodId: currentPeriod.id },
    },
    select: { selfRating: true, managerRating: true },
  });

  // Calculate average rating
  const ratings = skillRatings
    .map((r) => r.managerRating || r.selfRating)
    .filter((r): r is number => r !== null);
  const averageRating =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  // Rating distribution
  const ratingLabels = ["1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"];
  const ratingDistribution = ratingLabels.map((label, idx) => ({
    rating: label,
    count: ratings.filter((r) => Math.round(r) === idx + 1).length,
  }));

  return {
    checkInsCompleted,
    checkInsPending,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution,
  };
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Generate headcount report data
 */
export async function getHeadcountReport() {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);
  const companyId = auth.user.companyId;

  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      employmentType: true,
      employmentStatus: true,
      hireDate: true,
      regularizationDate: true,
      department: { select: { name: true } },
      hiringEntity: { select: { tradeName: true, name: true } },
      roleScorecard: { select: { jobTitle: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { lastName: "asc" }],
  });

  return employees.map((emp) => ({
    employeeNumber: emp.employeeNumber,
    name: `${emp.lastName}, ${emp.firstName}`,
    department: emp.department?.name || "Unassigned",
    position: emp.roleScorecard?.jobTitle || "N/A",
    hiringEntity: emp.hiringEntity?.tradeName || emp.hiringEntity?.name || "Unassigned",
    employmentType: emp.employmentType,
    employmentStatus: emp.employmentStatus,
    hireDate: emp.hireDate.toISOString().split("T")[0],
    regularizationDate: emp.regularizationDate?.toISOString().split("T")[0] || null,
    tenureMonths: Math.floor(
      (new Date().getTime() - emp.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    ),
  }));
}

/**
 * Generate tenure analysis report data
 */
export async function getTenureReport() {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);
  const companyId = auth.user.companyId;

  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, employmentStatus: "ACTIVE" },
    select: {
      hireDate: true,
      department: { select: { name: true } },
    },
  });

  const now = new Date();
  const byDepartment = new Map<string, { total: number; tenures: number[] }>();

  for (const emp of employees) {
    const dept = emp.department?.name || "Unassigned";
    const tenure = (now.getTime() - emp.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (!byDepartment.has(dept)) {
      byDepartment.set(dept, { total: 0, tenures: [] });
    }
    const data = byDepartment.get(dept)!;
    data.total++;
    data.tenures.push(tenure);
  }

  return Array.from(byDepartment.entries()).map(([department, data]) => ({
    department,
    headcount: data.total,
    averageTenure: Math.round(
      (data.tenures.reduce((a, b) => a + b, 0) / data.tenures.length) * 10
    ) / 10,
    minTenure: Math.round(Math.min(...data.tenures) * 10) / 10,
    maxTenure: Math.round(Math.max(...data.tenures) * 10) / 10,
  }));
}

/**
 * Generate leave utilization report data
 */
export async function getLeaveUtilizationReport(year: number) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);
  const companyId = auth.user.companyId;

  const leaveBalances = await prisma.leaveBalance.findMany({
    where: {
      employee: { companyId, deletedAt: null },
      year,
    },
    include: {
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { name: true, code: true } },
    },
  });

  const toNum = (val: unknown) =>
    typeof val === "object" && val !== null && "toNumber" in val
      ? (val as { toNumber: () => number }).toNumber()
      : Number(val) || 0;

  return leaveBalances.map((lb) => {
    // Calculate entitled as opening + accrued + carried over
    const entitled = toNum(lb.openingBalance) + toNum(lb.accrued) + toNum(lb.carriedOverFromPrevious);
    const used = toNum(lb.used);
    // Calculate current balance: opening + accrued - used - forfeited - converted + adjusted
    const currentBalance = entitled - used - toNum(lb.forfeited) - toNum(lb.converted) + toNum(lb.adjusted);

    return {
      employeeNumber: lb.employee.employeeNumber,
      employeeName: `${lb.employee.lastName}, ${lb.employee.firstName}`,
      department: lb.employee.department?.name || "Unassigned",
      leaveType: lb.leaveType.name,
      leaveCode: lb.leaveType.code,
      entitled: Math.round(entitled * 100) / 100,
      used: Math.round(used * 100) / 100,
      pending: 0, // Would need to check pending leave requests
      balance: Math.round(currentBalance * 100) / 100,
      utilizationRate: entitled > 0 ? Math.round((used / entitled) * 100) : 0,
    };
  });
}

/**
 * Generate attendance summary report data
 */
export async function getAttendanceSummaryReport(month: number, year: number) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);
  const companyId = auth.user.companyId;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const attendanceRecords = await prisma.attendanceDayRecord.findMany({
    where: {
      employee: { companyId, deletedAt: null },
      attendanceDate: { gte: startDate, lte: endDate },
    },
    include: {
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      shiftTemplate: {
        select: {
          startTime: true,
          endTime: true,
          breakMinutes: true,
        },
      },
    },
  });

  // Helper to extract time in minutes from TIME field
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

  // Group by employee
  const byEmployee = new Map<string, {
    employee: typeof attendanceRecords[0]["employee"];
    present: number;
    absent: number;
    leave: number;
    late: number;
    totalLateMinutes: number;
    totalOtMinutes: number;
  }>();

  for (const record of attendanceRecords) {
    const id = record.employeeId;
    if (!byEmployee.has(id)) {
      byEmployee.set(id, {
        employee: record.employee,
        present: 0,
        absent: 0,
        leave: 0,
        late: 0,
        totalLateMinutes: 0,
        totalOtMinutes: 0,
      });
    }
    const data = byEmployee.get(id)!;

    if (record.attendanceStatus === "PRESENT" || record.attendanceStatus === "HALF_DAY") data.present++;
    if (record.attendanceStatus === "ABSENT") data.absent++;
    if (record.attendanceStatus === "ON_LEAVE") data.leave++;

    // Calculate late on the fly
    if (record.actualTimeIn) {
      const schedStartMs = getTimeMinutes(record.shiftTemplate?.startTime);
      if (schedStartMs !== null) {
        const clockInMs = record.actualTimeIn.getHours() * 60 + record.actualTimeIn.getMinutes();
        if (clockInMs > schedStartMs) {
          data.late++;
          data.totalLateMinutes += clockInMs - schedStartMs;
        }
      }
    }

    // Calculate OT on the fly (approved late out + rest day/holiday work)
    if (record.actualTimeIn && record.actualTimeOut) {
      // Late out OT
      if (record.lateOutApproved) {
        const schedEndMs = getTimeMinutes(record.shiftTemplate?.endTime);
        if (schedEndMs !== null) {
          const clockOutMs = record.actualTimeOut.getHours() * 60 + record.actualTimeOut.getMinutes();
          if (clockOutMs > schedEndMs) {
            data.totalOtMinutes += clockOutMs - schedEndMs;
          }
        }
      }

      // Rest day/holiday work = entire worked time is premium
      if (record.dayType === "REST_DAY" || record.dayType === "REGULAR_HOLIDAY" || record.dayType === "SPECIAL_HOLIDAY") {
        const breakMins = record.breakMinutesApplied ?? record.shiftTemplate?.breakMinutes ?? 60;
        const workedMs = record.actualTimeOut.getTime() - record.actualTimeIn.getTime();
        const workedMins = Math.max(0, Math.round(workedMs / (1000 * 60)) - breakMins);
        data.totalOtMinutes += workedMins;
      }
    }
  }

  return Array.from(byEmployee.values()).map((data) => ({
    employeeNumber: data.employee.employeeNumber,
    employeeName: `${data.employee.lastName}, ${data.employee.firstName}`,
    department: data.employee.department?.name || "Unassigned",
    daysPresent: data.present,
    daysAbsent: data.absent,
    daysOnLeave: data.leave,
    timesLate: data.late,
    totalLateMinutes: data.totalLateMinutes,
    totalOtHours: Math.round(data.totalOtMinutes / 60 * 10) / 10,
    attendanceRate: data.present + data.absent > 0
      ? Math.round((data.present / (data.present + data.absent)) * 100)
      : 0,
  }));
}

// =============================================================================
// PAYROLL SUMMARY REPORT (Detailed breakdown by PayslipLine category)
// =============================================================================

export interface PayrollSummaryData {
  period: { month?: number; year: number; isYearToDate: boolean };
  earnings: {
    basicPay: number;
    overtimeRegular: number;
    overtimeRestDay: number;
    overtimeHoliday: number;
    nightDifferential: number;
    holidayPay: number;
    restDayPay: number;
    allowances: number;
    reimbursements: number;
    incentives: number;
    bonuses: number;
    adjustmentsAdd: number;
    thirteenthMonthPay: number;
    totalEarnings: number;
  };
  deductions: {
    late: number;
    undertime: number;
    lateUndertime: number;
    absent: number;
    cashAdvance: number;
    loans: number;
    adjustmentsDeduct: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  benefits: {
    sssEe: number;
    sssEr: number;
    sssTotal: number;
    philhealthEe: number;
    philhealthEr: number;
    philhealthTotal: number;
    pagibigEe: number;
    pagibigEr: number;
    pagibigTotal: number;
    withholdingTax: number;
    totalBenefits: number;
  };
  summary: {
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
    employeeCount: number;
    payslipCount: number;
  };
  byDepartment: {
    department: string;
    grossPay: number;
    netPay: number;
    employeeCount: number;
  }[];
}

/**
 * Get available payroll months that have approved/released payroll runs.
 * Returns list of months (year-month) with their paydate for the dropdown.
 */
export async function getAvailablePayrollMonths(year: number): Promise<{
  months: { month: number; monthName: string; payDates: string[] }[];
  availableYears: number[];
}> {
  const auth = await assertPermission(Permission.PAYROLL_VIEW);
  const companyId = auth.user.companyId;

  // Get all pay periods with approved/released payroll runs for this company
  const payPeriods = await prisma.payPeriod.findMany({
    where: {
      calendar: { companyId },
      payrollRuns: {
        some: { status: { in: ["APPROVED", "RELEASED"] } },
      },
    },
    select: {
      payDate: true,
      code: true,
    },
    orderBy: { payDate: "desc" },
  });

  // Group by month
  const monthMap = new Map<number, { monthName: string; payDates: Set<string> }>();
  const yearsSet = new Set<number>();

  for (const pp of payPeriods) {
    const payDateObj = new Date(pp.payDate);
    const ppYear = payDateObj.getFullYear();
    const ppMonth = payDateObj.getMonth() + 1;
    yearsSet.add(ppYear);

    // Only include months for the requested year
    if (ppYear === year) {
      if (!monthMap.has(ppMonth)) {
        monthMap.set(ppMonth, {
          monthName: payDateObj.toLocaleString("en-PH", { month: "long" }),
          payDates: new Set(),
        });
      }
      monthMap.get(ppMonth)!.payDates.add(pp.code);
    }
  }

  const months = Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      monthName: data.monthName,
      payDates: Array.from(data.payDates),
    }))
    .sort((a, b) => a.month - b.month);

  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  return { months, availableYears };
}

/**
 * Get detailed payroll summary report aggregated from PayslipLine categories.
 * Shows breakdown of earnings, deductions, and benefits (EE+ER combined).
 * Filters by payDate (when employees were paid).
 * @param year - Year to filter
 * @param month - Month to filter (1-12), if undefined returns YTD
 */
export async function getPayrollSummaryReport(
  year: number,
  month?: number
): Promise<PayrollSummaryData> {
  const auth = await assertPermission(Permission.PAYROLL_VIEW);
  const companyId = auth.user.companyId;

  // Build date range for payDate filtering
  const startDate = month
    ? new Date(year, month - 1, 1)
    : new Date(year, 0, 1);
  const endDate = month
    ? new Date(year, month, 0, 23, 59, 59)
    : new Date(year, 11, 31, 23, 59, 59);

  // Helper to convert Decimal to number
  const toNum = (val: unknown) =>
    typeof val === "object" && val !== null && "toNumber" in val
      ? (val as { toNumber: () => number }).toNumber()
      : Number(val) || 0;

  // Query payslip lines grouped by category (filter by payDate)
  const lineAggregates = await prisma.payslipLine.groupBy({
    by: ["category"],
    where: {
      payslip: {
        payrollRun: {
          payPeriod: {
            calendar: { companyId },
            payDate: { gte: startDate, lte: endDate },
          },
          status: { in: ["APPROVED", "RELEASED"] },
        },
      },
    },
    _sum: { amount: true },
  });

  // Build category map for easy lookup
  const categoryTotals = new Map<string, number>();
  for (const agg of lineAggregates) {
    categoryTotals.set(agg.category, toNum(agg._sum.amount));
  }

  const getCategory = (cat: string) => categoryTotals.get(cat) || 0;

  // Build earnings breakdown
  const earnings = {
    basicPay: getCategory("BASIC_PAY"),
    overtimeRegular: getCategory("OVERTIME_REGULAR"),
    overtimeRestDay: getCategory("OVERTIME_REST_DAY"),
    overtimeHoliday: getCategory("OVERTIME_HOLIDAY"),
    nightDifferential: getCategory("NIGHT_DIFFERENTIAL"),
    holidayPay: getCategory("HOLIDAY_PAY"),
    restDayPay: getCategory("REST_DAY_PAY"),
    allowances: getCategory("ALLOWANCE"),
    reimbursements: getCategory("REIMBURSEMENT"),
    incentives: getCategory("INCENTIVE"),
    bonuses: getCategory("BONUS"),
    adjustmentsAdd: getCategory("ADJUSTMENT_ADD"),
    thirteenthMonthPay: getCategory("THIRTEENTH_MONTH_PAY"),
    totalEarnings: 0,
  };
  earnings.totalEarnings = Object.values(earnings).reduce((a, b) => a + b, 0);

  // Build deductions breakdown (excluding statutory)
  const deductions = {
    late: getCategory("LATE_DEDUCTION"),
    undertime: getCategory("UNDERTIME_DEDUCTION"),
    lateUndertime: getCategory("LATE_UT_DEDUCTION"),
    absent: getCategory("ABSENT_DEDUCTION"),
    cashAdvance: getCategory("CASH_ADVANCE_DEDUCTION"),
    loans: getCategory("LOAN_DEDUCTION"),
    adjustmentsDeduct: getCategory("ADJUSTMENT_DEDUCT"),
    otherDeductions: getCategory("OTHER_DEDUCTION"),
    totalDeductions: 0,
  };
  deductions.totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);

  // Query payslip totals for summary, department breakdown, and statutory ER contributions (filter by payDate)
  // ER contributions are stored directly on Payslip model, not in PayslipLine
  const payslips = await prisma.payslip.findMany({
    where: {
      payrollRun: {
        payPeriod: {
          calendar: { companyId },
          payDate: { gte: startDate, lte: endDate },
        },
        status: { in: ["APPROVED", "RELEASED"] },
      },
    },
    select: {
      id: true,
      grossPay: true,
      netPay: true,
      totalDeductions: true,
      employeeId: true,
      // ER contributions are stored on Payslip model
      sssEr: true,
      philhealthEr: true,
      pagibigEr: true,
      employee: {
        select: {
          department: { select: { name: true } },
        },
      },
    },
  });

  // Sum ER contributions from Payslip model fields
  let totalSssEr = 0;
  let totalPhilhealthEr = 0;
  let totalPagibigEr = 0;
  for (const payslip of payslips) {
    totalSssEr += toNum(payslip.sssEr);
    totalPhilhealthEr += toNum(payslip.philhealthEr);
    totalPagibigEr += toNum(payslip.pagibigEr);
  }

  // Build benefits breakdown (EE from PayslipLine, ER from Payslip model)
  const sssEe = getCategory("SSS_EE");
  const sssEr = totalSssEr;
  const philhealthEe = getCategory("PHILHEALTH_EE");
  const philhealthEr = totalPhilhealthEr;
  const pagibigEe = getCategory("PAGIBIG_EE");
  const pagibigEr = totalPagibigEr;
  const withholdingTax = getCategory("TAX_WITHHOLDING");

  const benefits = {
    sssEe,
    sssEr,
    sssTotal: sssEe + sssEr,
    philhealthEe,
    philhealthEr,
    philhealthTotal: philhealthEe + philhealthEr,
    pagibigEe,
    pagibigEr,
    pagibigTotal: pagibigEe + pagibigEr,
    withholdingTax,
    totalBenefits: sssEe + sssEr + philhealthEe + philhealthEr + pagibigEe + pagibigEr + withholdingTax,
  };

  // Aggregate summary
  let totalGrossPay = 0;
  let totalNetPay = 0;
  let totalDeductionsSum = 0;
  const employeeIds = new Set<string>();
  const deptData = new Map<string, { grossPay: number; netPay: number; employees: Set<string> }>();

  for (const payslip of payslips) {
    const gross = toNum(payslip.grossPay);
    const net = toNum(payslip.netPay);
    const ded = toNum(payslip.totalDeductions);

    totalGrossPay += gross;
    totalNetPay += net;
    totalDeductionsSum += ded;
    employeeIds.add(payslip.employeeId);

    const dept = payslip.employee.department?.name || "Unassigned";
    if (!deptData.has(dept)) {
      deptData.set(dept, { grossPay: 0, netPay: 0, employees: new Set() });
    }
    const dd = deptData.get(dept)!;
    dd.grossPay += gross;
    dd.netPay += net;
    dd.employees.add(payslip.employeeId);
  }

  const summary = {
    totalGrossPay: Math.round(totalGrossPay * 100) / 100,
    totalDeductions: Math.round(totalDeductionsSum * 100) / 100,
    totalNetPay: Math.round(totalNetPay * 100) / 100,
    employeeCount: employeeIds.size,
    payslipCount: payslips.length,
  };

  const byDepartment = Array.from(deptData.entries())
    .map(([department, data]) => ({
      department,
      grossPay: Math.round(data.grossPay * 100) / 100,
      netPay: Math.round(data.netPay * 100) / 100,
      employeeCount: data.employees.size,
    }))
    .sort((a, b) => b.grossPay - a.grossPay);

  return {
    period: { month, year, isYearToDate: !month },
    earnings,
    deductions,
    benefits,
    summary,
    byDepartment,
  };
}
