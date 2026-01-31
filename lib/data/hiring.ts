// =============================================================================
// PeopleOS PH - Hiring/Applicant Data Fetching
// =============================================================================
// Server-side data fetching functions for applicants and interviews.
// These are used by Server Components and can be cached.
// =============================================================================

import { cache } from "react";
import { prisma } from "@/lib/db";
import { getAuthContext } from "@/lib/auth";

export interface ApplicantListFilters {
  search?: string;
  status?: string;
  roleScorecardId?: string;
  departmentId?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export interface ApplicantListResult {
  applicants: ApplicantListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApplicantListItem {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string;
  phoneNumber: string | null;
  mobileNumber: string | null;
  status: string;
  source: string | null;
  appliedAt: Date;
  roleScorecard: { id: string; jobTitle: string } | null;
  customJobTitle: string | null;
  department: { id: string; name: string } | null;
  interviewCount: number;
}

/**
 * Get paginated list of applicants with search and filters.
 */
export const getApplicants = cache(async (filters: ApplicantListFilters = {}): Promise<ApplicantListResult> => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const { search, status, roleScorecardId, departmentId, source, page = 1, limit = 20 } = filters;

  const where: NonNullable<Parameters<typeof prisma.applicant.findMany>[0]>["where"] = {
    companyId: auth.user.companyId,
    deletedAt: null,
  };

  // Search by name or email
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filter by status
  if (status) {
    where.status = status as "NEW" | "SCREENING" | "INTERVIEW" | "ASSESSMENT" | "OFFER" | "OFFER_ACCEPTED" | "HIRED" | "REJECTED" | "WITHDRAWN";
  }

  // Filter by position
  if (roleScorecardId) {
    where.roleScorecardId = roleScorecardId;
  }

  // Filter by department
  if (departmentId) {
    where.departmentId = departmentId;
  }

  // Filter by source
  if (source) {
    where.source = source;
  }

  const [applicants, total] = await Promise.all([
    prisma.applicant.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        email: true,
        phoneNumber: true,
        mobileNumber: true,
        status: true,
        source: true,
        appliedAt: true,
        customJobTitle: true,
        roleScorecard: {
          select: { id: true, jobTitle: true },
        },
        department: {
          select: { id: true, name: true },
        },
        _count: {
          select: { interviews: true },
        },
      },
      orderBy: { appliedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.applicant.count({ where }),
  ]);

  return {
    applicants: applicants.map((a) => ({
      ...a,
      interviewCount: a._count.interviews,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
});

/**
 * Get a single applicant by ID with full details.
 */
export const getApplicant = cache(async (applicantId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const applicant = await prisma.applicant.findFirst({
    where: {
      id: applicantId,
      companyId: auth.user.companyId,
      deletedAt: null,
    },
    include: {
      roleScorecard: {
        select: {
          id: true,
          jobTitle: true,
          missionStatement: true,
          keyResponsibilities: true,
        },
      },
      department: true,
      hiringEntity: {
        select: {
          id: true,
          code: true,
          name: true,
          tradeName: true,
        },
      },
      referredBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
        },
      },
      statusChangedBy: {
        select: { id: true, email: true },
      },
      createdBy: {
        select: { id: true, email: true },
      },
      convertedToEmployee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      interviews: {
        include: {
          primaryInterviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            },
          },
          createdBy: {
            select: { id: true, email: true },
          },
        },
        orderBy: { scheduledDate: "desc" },
      },
    },
  });

  return applicant;
});

/**
 * Get applicant interviews.
 */
export const getApplicantInterviews = cache(async (applicantId: string) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const interviews = await prisma.interview.findMany({
    where: { applicantId },
    include: {
      primaryInterviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
        },
      },
      createdBy: {
        select: { id: true, email: true },
      },
    },
    orderBy: { scheduledDate: "desc" },
  });

  return interviews;
});

/**
 * Get upcoming interviews (for dashboard/calendar).
 */
export const getUpcomingInterviews = cache(async (days: number = 7) => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const interviews = await prisma.interview.findMany({
    where: {
      applicant: {
        companyId: auth.user.companyId,
        deletedAt: null,
      },
      scheduledDate: {
        gte: today,
        lte: endDate,
      },
      result: "PENDING",
    },
    include: {
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          roleScorecard: {
            select: { jobTitle: true },
          },
          customJobTitle: true,
        },
      },
      primaryInterviewer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { scheduledStartTime: "asc" }],
  });

  return interviews;
});

/**
 * Get applicant statistics for dashboard.
 */
export const getApplicantStats = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const [
    totalNew,
    totalScreening,
    totalInterview,
    totalOffer,
    totalHired,
    totalRejected,
    upcomingInterviewCount,
  ] = await Promise.all([
    prisma.applicant.count({
      where: { companyId: auth.user.companyId, deletedAt: null, status: "NEW" },
    }),
    prisma.applicant.count({
      where: { companyId: auth.user.companyId, deletedAt: null, status: "SCREENING" },
    }),
    prisma.applicant.count({
      where: { companyId: auth.user.companyId, deletedAt: null, status: "INTERVIEW" },
    }),
    prisma.applicant.count({
      where: { companyId: auth.user.companyId, deletedAt: null, status: { in: ["OFFER", "OFFER_ACCEPTED"] } },
    }),
    prisma.applicant.count({
      where: { companyId: auth.user.companyId, deletedAt: null, status: "HIRED" },
    }),
    prisma.applicant.count({
      where: { companyId: auth.user.companyId, deletedAt: null, status: "REJECTED" },
    }),
    prisma.interview.count({
      where: {
        applicant: { companyId: auth.user.companyId, deletedAt: null },
        scheduledDate: { gte: new Date() },
        result: "PENDING",
      },
    }),
  ]);

  return {
    new: totalNew,
    screening: totalScreening,
    interview: totalInterview,
    offer: totalOffer,
    hired: totalHired,
    rejected: totalRejected,
    upcomingInterviews: upcomingInterviewCount,
    pipeline: totalNew + totalScreening + totalInterview + totalOffer,
  };
});

/**
 * Get unique applicant sources for filters.
 */
export const getApplicantSources = cache(async () => {
  const auth = await getAuthContext();
  if (!auth) throw new Error("Not authenticated");

  const sources = await prisma.applicant.findMany({
    where: {
      companyId: auth.user.companyId,
      deletedAt: null,
      source: { not: null },
    },
    select: { source: true },
    distinct: ["source"],
    orderBy: { source: "asc" },
  });

  return sources.map((s) => s.source).filter((s): s is string => s !== null);
});
