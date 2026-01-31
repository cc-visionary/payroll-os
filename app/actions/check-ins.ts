"use server";

// =============================================================================
// PeopleOS PH - Performance Check-In Server Actions
// =============================================================================

import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

// =============================================================================
// Check-In Periods
// =============================================================================

/**
 * Get all check-in periods for the company.
 */
export async function getCheckInPeriods() {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  const periods = await prisma.checkInPeriod.findMany({
    where: {
      companyId: auth.user.companyId,
    },
    orderBy: { startDate: "desc" },
    include: {
      _count: {
        select: { checkIns: true },
      },
    },
  });

  return periods;
}

/**
 * Get a specific check-in period with all check-ins.
 */
export async function getCheckInPeriod(periodId: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  const period = await prisma.checkInPeriod.findFirst({
    where: {
      id: periodId,
      companyId: auth.user.companyId,
    },
    include: {
      checkIns: {
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              department: { select: { name: true } },
              jobTitle: true,
            },
          },
          reviewer: {
            select: { id: true, email: true },
          },
          _count: {
            select: { goals: true, skillRatings: true },
          },
        },
        orderBy: [
          { employee: { lastName: "asc" } },
          { employee: { firstName: "asc" } },
        ],
      },
    },
  });

  return period;
}

/**
 * Create a new check-in period.
 */
export async function createCheckInPeriod(data: {
  name: string;
  periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  startDate: string;
  endDate: string;
  dueDate: string;
}) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  try {
    const period = await prisma.checkInPeriod.create({
      data: {
        companyId: auth.user.companyId,
        name: data.name,
        periodType: data.periodType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        dueDate: new Date(data.dueDate),
      },
    });

    revalidatePath("/check-ins");

    return { success: true, periodId: period.id };
  } catch (error) {
    console.error("Failed to create check-in period:", error);
    return { success: false, error: "Failed to create check-in period" };
  }
}

/**
 * Create check-ins for all active employees in a period.
 */
export async function initializeCheckInsForPeriod(periodId: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_EDIT);

  try {
    // Get the period
    const period = await prisma.checkInPeriod.findFirst({
      where: {
        id: periodId,
        companyId: auth.user.companyId,
      },
    });

    if (!period) {
      return { success: false, error: "Period not found" };
    }

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: {
        companyId: auth.user.companyId,
        employmentStatus: "ACTIVE",
        deletedAt: null,
      },
      select: { id: true },
    });

    // Get existing check-ins for this period
    const existingCheckIns = await prisma.performanceCheckIn.findMany({
      where: { periodId },
      select: { employeeId: true },
    });

    const existingEmployeeIds = new Set(existingCheckIns.map((c) => c.employeeId));

    // Create check-ins for employees who don't have one
    const newCheckIns = employees
      .filter((e) => !existingEmployeeIds.has(e.id))
      .map((e) => ({
        periodId,
        employeeId: e.id,
        status: "DRAFT" as const,
      }));

    if (newCheckIns.length > 0) {
      await prisma.performanceCheckIn.createMany({
        data: newCheckIns,
      });
    }

    revalidatePath(`/check-ins/${periodId}`);

    return {
      success: true,
      message: `Created ${newCheckIns.length} check-ins`,
      created: newCheckIns.length,
      skipped: existingCheckIns.length,
    };
  } catch (error) {
    console.error("Failed to initialize check-ins:", error);
    return { success: false, error: "Failed to initialize check-ins" };
  }
}

// =============================================================================
// Individual Check-Ins
// =============================================================================

/**
 * Get a specific check-in with all details.
 */
export async function getCheckIn(checkInId: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  const checkIn = await prisma.performanceCheckIn.findFirst({
    where: {
      id: checkInId,
      period: {
        companyId: auth.user.companyId,
      },
    },
    include: {
      period: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNumber: true,
          department: { select: { name: true } },
          jobTitle: true,
          roleScorecard: {
            select: {
              jobTitle: true,
              missionStatement: true,
              keyResponsibilities: true,
              kpis: true,
            },
          },
        },
      },
      reviewer: {
        select: { id: true, email: true },
      },
      goals: {
        orderBy: { createdAt: "asc" },
      },
      skillRatings: {
        orderBy: [{ skillCategory: "asc" }, { skillName: "asc" }],
      },
    },
  });

  return checkIn;
}

/**
 * Update a check-in's self-assessment fields.
 */
export async function updateCheckInSelfAssessment(
  checkInId: string,
  data: {
    accomplishments?: string;
    challenges?: string;
    learnings?: string;
    supportNeeded?: string;
  }
) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  try {
    const checkIn = await prisma.performanceCheckIn.findFirst({
      where: {
        id: checkInId,
        period: { companyId: auth.user.companyId },
      },
      include: { employee: { select: { userId: true } } },
    });

    if (!checkIn) {
      return { success: false, error: "Check-in not found" };
    }

    // Only the employee or someone with edit permission can update
    if (checkIn.employee.userId !== auth.user.id) {
      await assertPermission(Permission.EMPLOYEE_EDIT);
    }

    await prisma.performanceCheckIn.update({
      where: { id: checkInId },
      data: {
        accomplishments: data.accomplishments,
        challenges: data.challenges,
        learnings: data.learnings,
        supportNeeded: data.supportNeeded,
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update check-in:", error);
    return { success: false, error: "Failed to update check-in" };
  }
}

/**
 * Submit a check-in for review.
 */
export async function submitCheckIn(checkInId: string) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  try {
    const checkIn = await prisma.performanceCheckIn.findFirst({
      where: {
        id: checkInId,
        period: { companyId: auth.user.companyId },
      },
      include: { employee: { select: { userId: true } } },
    });

    if (!checkIn) {
      return { success: false, error: "Check-in not found" };
    }

    // Only the employee or someone with edit permission can submit
    if (checkIn.employee.userId !== auth.user.id) {
      await assertPermission(Permission.EMPLOYEE_EDIT);
    }

    await prisma.performanceCheckIn.update({
      where: { id: checkInId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to submit check-in:", error);
    return { success: false, error: "Failed to submit check-in" };
  }
}

/**
 * Update manager feedback on a check-in.
 */
export async function updateCheckInManagerFeedback(
  checkInId: string,
  data: {
    managerFeedback?: string;
    strengths?: string;
    areasForImprovement?: string;
    overallRating?: number;
    overallComments?: string;
  }
) {
  await assertPermission(Permission.EMPLOYEE_EDIT);

  try {
    await prisma.performanceCheckIn.update({
      where: { id: checkInId },
      data: {
        managerFeedback: data.managerFeedback,
        strengths: data.strengths,
        areasForImprovement: data.areasForImprovement,
        overallRating: data.overallRating,
        overallComments: data.overallComments,
        status: "UNDER_REVIEW",
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update manager feedback:", error);
    return { success: false, error: "Failed to update manager feedback" };
  }
}

/**
 * Complete a check-in review.
 */
export async function completeCheckIn(checkInId: string, reviewerId: string) {
  await assertPermission(Permission.EMPLOYEE_EDIT);

  try {
    await prisma.performanceCheckIn.update({
      where: { id: checkInId },
      data: {
        status: "COMPLETED",
        reviewerId,
        reviewedAt: new Date(),
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to complete check-in:", error);
    return { success: false, error: "Failed to complete check-in" };
  }
}

// =============================================================================
// Goals
// =============================================================================

/**
 * Add a goal to a check-in.
 */
export async function addGoal(
  checkInId: string,
  data: {
    goalType: "PERFORMANCE" | "LEARNING" | "PROJECT" | "BEHAVIORAL";
    title: string;
    description?: string;
    targetDate?: string;
  }
) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  try {
    const checkIn = await prisma.performanceCheckIn.findFirst({
      where: {
        id: checkInId,
        period: { companyId: auth.user.companyId },
      },
      include: { employee: { select: { userId: true } } },
    });

    if (!checkIn) {
      return { success: false, error: "Check-in not found" };
    }

    // Allow employee to add goals to their own check-in
    if (checkIn.employee.userId !== auth.user.id) {
      await assertPermission(Permission.EMPLOYEE_EDIT);
    }

    const goal = await prisma.checkInGoal.create({
      data: {
        checkInId,
        goalType: data.goalType,
        title: data.title,
        description: data.description,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true, goalId: goal.id };
  } catch (error) {
    console.error("Failed to add goal:", error);
    return { success: false, error: "Failed to add goal" };
  }
}

/**
 * Update a goal.
 */
export async function updateGoal(
  goalId: string,
  data: {
    title?: string;
    description?: string;
    targetDate?: string;
    progress?: number;
    status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PARTIALLY_MET" | "NOT_MET" | "DEFERRED";
    selfAssessment?: string;
    managerAssessment?: string;
    rating?: number;
    carryForward?: boolean;
  }
) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  try {
    const goal = await prisma.checkInGoal.findFirst({
      where: { id: goalId },
      include: {
        checkIn: {
          include: {
            period: { select: { companyId: true } },
            employee: { select: { userId: true } },
          },
        },
      },
    });

    if (!goal || goal.checkIn.period.companyId !== auth.user.companyId) {
      return { success: false, error: "Goal not found" };
    }

    // Allow employee to update their own goals
    if (goal.checkIn.employee.userId !== auth.user.id) {
      await assertPermission(Permission.EMPLOYEE_EDIT);
    }

    await prisma.checkInGoal.update({
      where: { id: goalId },
      data: {
        title: data.title,
        description: data.description,
        targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
        progress: data.progress,
        status: data.status,
        selfAssessment: data.selfAssessment,
        managerAssessment: data.managerAssessment,
        rating: data.rating,
        carryForward: data.carryForward,
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to update goal:", error);
    return { success: false, error: "Failed to update goal" };
  }
}

/**
 * Delete a goal.
 */
export async function deleteGoal(goalId: string) {
  await assertPermission(Permission.EMPLOYEE_EDIT);

  try {
    await prisma.checkInGoal.delete({
      where: { id: goalId },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return { success: false, error: "Failed to delete goal" };
  }
}

// =============================================================================
// Skill Ratings
// =============================================================================

/**
 * Add or update a skill rating.
 */
export async function upsertSkillRating(
  checkInId: string,
  data: {
    skillCategory: string;
    skillName: string;
    selfRating?: number;
    managerRating?: number;
    comments?: string;
    developmentPlan?: string;
  }
) {
  const auth = await assertPermission(Permission.EMPLOYEE_VIEW);

  try {
    const checkIn = await prisma.performanceCheckIn.findFirst({
      where: {
        id: checkInId,
        period: { companyId: auth.user.companyId },
      },
      include: { employee: { select: { userId: true } } },
    });

    if (!checkIn) {
      return { success: false, error: "Check-in not found" };
    }

    // Allow employee to rate their own skills
    if (checkIn.employee.userId !== auth.user.id) {
      await assertPermission(Permission.EMPLOYEE_EDIT);
    }

    await prisma.skillRating.upsert({
      where: {
        checkInId_skillCategory_skillName: {
          checkInId,
          skillCategory: data.skillCategory,
          skillName: data.skillName,
        },
      },
      create: {
        checkInId,
        skillCategory: data.skillCategory,
        skillName: data.skillName,
        selfRating: data.selfRating,
        managerRating: data.managerRating,
        comments: data.comments,
        developmentPlan: data.developmentPlan,
      },
      update: {
        selfRating: data.selfRating,
        managerRating: data.managerRating,
        comments: data.comments,
        developmentPlan: data.developmentPlan,
      },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to upsert skill rating:", error);
    return { success: false, error: "Failed to save skill rating" };
  }
}

/**
 * Delete a skill rating.
 */
export async function deleteSkillRating(skillRatingId: string) {
  await assertPermission(Permission.EMPLOYEE_EDIT);

  try {
    await prisma.skillRating.delete({
      where: { id: skillRatingId },
    });

    revalidatePath(`/check-ins`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete skill rating:", error);
    return { success: false, error: "Failed to delete skill rating" };
  }
}
