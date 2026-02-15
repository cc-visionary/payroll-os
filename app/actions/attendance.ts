"use server";

// =============================================================================
// PeopleOS PH - Attendance Server Actions
// =============================================================================
// Server actions for attendance management with RBAC and audit logging.
// =============================================================================

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger, maskSensitiveFields } from "@/lib/audit";
import { headers } from "next/headers";
import { setManilaHours } from "@/lib/utils/timezone";

/**
 * Import attendance from uploaded file.
 * Permission: attendance:import
 */
export async function importAttendance(formData: FormData) {
  // Check permission
  const auth = await assertPermission(Permission.ATTENDANCE_IMPORT);

  // Get request context for audit
  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const file = formData.get("file") as File;

  if (!file) {
    return { success: false, error: "No file provided" };
  }

  try {
    // Create import record
    const importRecord = await prisma.attendanceImport.create({
      data: {
        companyId: auth.user.companyId,
        fileName: file.name,
        filePath: `/uploads/attendance/${Date.now()}-${file.name}`,
        fileSize: BigInt(file.size),
        status: "PENDING",
        uploadedById: auth.user.id,
      },
    });

    // Log the import action
    await audit.import("AttendanceImport", {
      importId: importRecord.id,
      fileName: file.name,
      fileSize: file.size,
    });

    // TODO: Queue async job to process the file
    // await queueJob("ATTENDANCE_FILE_IMPORT", { importId: importRecord.id });

    revalidatePath("/attendance/imports");

    return {
      success: true,
      importId: importRecord.id,
      message: "File uploaded. Processing will begin shortly.",
    };
  } catch (error) {
    console.error("Failed to import attendance:", error);
    return { success: false, error: "Failed to import attendance file" };
  }
}

// NOTE: adjustAttendance and approveAttendanceAdjustment functions have been removed.
// Attendance adjustments are now made directly via updateAttendanceRecord.
// All override flags (earlyInApproved, lateOutApproved, etc.) are stored on AttendanceDayRecord.

// =============================================================================
// Get Daily Attendance (Raw Time Logs)
// =============================================================================

export interface DailyTimeLogEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  department: string | null;
  logDate: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  attendanceType: "PRESENT" | "ABSENT" | "REST_DAY" | "ON_LEAVE" | "NO_DATA" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";
  sourceType: string;
  sourceBatchId: string | null;
}

// =============================================================================
// Get Employee Attendance by Date Range
// =============================================================================

export interface EmployeeAttendanceEntry {
  id: string;
  date: Date;
  dayOfWeek: string;
  clockIn: Date | null;
  clockOut: Date | null;
  hoursWorked: number | null;
  attendanceType: "PRESENT" | "ABSENT" | "REST_DAY" | "ON_LEAVE" | "NO_DATA" | "HALF_DAY" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";
  // Holiday info (tracked separately so we know if someone worked on a holiday)
  holidayName?: string; // e.g., "New Year's Day", "Christmas Day"
  holidayType?: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY"; // Set even if attendanceType is PRESENT (worked on holiday)
  sourceType: string;
  // Deductions: Late (clocked in after start) + Undertime (clocked out early)
  isLate: boolean;
  lateMinutes: number;
  isUndertime: boolean;
  undertimeMinutes: number;
  totalDeductionMinutes: number; // lateMinutes + undertimeMinutes
  // Overtime: Early In (clocked in before start) + Late Out (clocked out after end)
  isEarlyIn: boolean;
  earlyInMinutes: number;
  earlyInApproved: boolean;
  isLateOut: boolean;
  lateOutMinutes: number;
  lateOutApproved: boolean;
  breakOtMinutes: number;       // OT from working through break (auto-approved)
  totalOvertimeMinutes: number; // earlyInMinutes + lateOutMinutes + breakOtMinutes
  // Shift schedule info
  scheduledStartTime: string | null; // HH:mm format
  scheduledEndTime: string | null;   // HH:mm format
  scheduledHours: number | null;
  // Raw log IDs for edit/delete operations
  clockInLogId: string | null;
  clockOutLogId: string | null;
  // Break tracking
  breakMinutes: number;           // Effective break (may be overridden)
  shiftBreakMinutes: number;      // Original shift template break minutes
  isBreakApplicable: boolean;
  // Override info (if any manual override exists)
  // Daily rate override
  dailyRateOverride: number | null;
  hasOverride: boolean;
  override?: {
    shiftStartOverride: string | null;
    shiftEndOverride: string | null;
    breakMinutesOverride: number | null;
    dailyRateOverride: number | null;
    earlyInApproved: boolean;
    lateOutApproved: boolean;
    lateInApproved: boolean;
    earlyOutApproved: boolean;
    reason: string;
  };
}

export interface EmployeeAttendanceSummary {
  totalDays: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  restDays: number;
  regularHolidayDays: number;
  specialHolidayDays: number;
  noDataDays: number;
  totalHoursWorked: number;
  // Deductions
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalDeductionMinutes: number; // late + undertime combined
  // Overtime
  totalEarlyInMinutes: number;
  totalLateOutMinutes: number;
  totalBreakOtMinutes: number;
  totalOvertimeMinutes: number; // earlyIn + lateOut + breakOt combined
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function getEmployeeAttendance(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  success: boolean;
  data?: {
    employee: {
      id: string;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      department: string | null;
    };
    entries: EmployeeAttendanceEntry[];
    summary: EmployeeAttendanceSummary;
  };
  error?: string;
}> {
  try {
    await assertPermission(Permission.ATTENDANCE_VIEW);

    const { getAuthContext } = await import("@/lib/auth");
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Get employee with shift schedule info
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: auth.user.companyId,
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        roleScorecard: {
          select: {
            workHoursPerDay: true,
            workDaysPerWeek: true,
            flexibleStartTime: true,
            flexibleEndTime: true,
            shiftTemplate: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
                breakMinutes: true,
                breakStartTime: true,
                breakEndTime: true,
                graceMinutesLate: true,
                graceMinutesEarlyOut: true,
                scheduledWorkMinutes: true,
              },
            },
          },
        },
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Get the active shift template from RoleScorecard
    // Note: EmployeeSchedule removed - shift now comes from RoleScorecard only
    const getShiftForDate = (date: Date) => {
      const dayOfWeek = date.getDay();

      // Use RoleScorecard shift if available
      if (employee.roleScorecard?.shiftTemplate) {
        // Default: weekends (Saturday=6, Sunday=0) are rest days
        const isRestDay = dayOfWeek === 0 || dayOfWeek === 6;
        return { isRestDay, shift: isRestDay ? null : employee.roleScorecard.shiftTemplate };
      }

      // Default: weekends are rest days, no shift
      return { isRestDay: dayOfWeek === 0 || dayOfWeek === 6, shift: null };
    };

    // Calculate default work hours from roleScorecard or default to 8
    const defaultWorkHours = employee.roleScorecard?.workHoursPerDay || 8;
    const halfDayThreshold = defaultWorkHours / 2;

    // Extract year/month/day from the passed dates (which are already in correct UTC representation)
    // and create proper UTC boundaries for database queries
    const startDateKey = startDate.toISOString().split("T")[0];
    const endDateKey = endDate.toISOString().split("T")[0];
    const [startYear, startMonth, startDay] = startDateKey.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDateKey.split("-").map(Number);

    // Create UTC date boundaries (midnight UTC for start, end of day UTC for end)
    const start = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999));

    // Get attendance records for date range with their shift templates
    const attendanceRecords = await prisma.attendanceDayRecord.findMany({
      where: {
        employeeId,
        attendanceDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        // Include the shift template linked to this specific day record
        // This is the actual imported shift, which may differ from the employee's default shift
        shiftTemplate: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
            breakStartTime: true,
            breakEndTime: true,
            graceMinutesLate: true,
            graceMinutesEarlyOut: true,
            scheduledWorkMinutes: true,
          },
        },
      },
      orderBy: { attendanceDate: "asc" },
    });

    // Index attendance records by date
    const recordsByDate = new Map<string, typeof attendanceRecords[0]>();
    for (const record of attendanceRecords) {
      const dateKey = record.attendanceDate.toISOString().split("T")[0];
      recordsByDate.set(dateKey, record);
    }

    // NOTE: AttendanceRawRow and AttendanceOverride tables have been removed.
    // All data (including overrides) is now stored directly on AttendanceDayRecord.

    // Get holidays for the date range from the active calendar
    const activeCalendar = await prisma.holidayCalendar.findFirst({
      where: {
        companyId: auth.user.companyId,
        isActive: true,
        year: { in: [start.getFullYear(), end.getFullYear()] },
      },
      include: {
        events: {
          where: {
            date: {
              gte: start,
              lte: end,
            },
          },
        },
      },
    });

    // Index holidays by date
    const holidaysByDate = new Map<string, { name: string; dayType: string }>();
    if (activeCalendar) {
      for (const event of activeCalendar.events) {
        const dateKey = event.date.toISOString().split("T")[0];
        holidaysByDate.set(dateKey, { name: event.name, dayType: event.dayType });
      }
    }

    // Get approved leave requests for the date range
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: {
        leaveType: {
          select: { name: true },
        },
      },
    });

    // Index leave requests by date (a leave request can span multiple days)
    const leavesByDate = new Map<string, { leaveTypeName: string }>();
    for (const leave of approvedLeaves) {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      // Iterate through each day of the leave
      const currentLeaveDate = new Date(leaveStart);
      while (currentLeaveDate <= leaveEnd) {
        const dateKey = currentLeaveDate.toISOString().split("T")[0];
        leavesByDate.set(dateKey, { leaveTypeName: leave.leaveType.name });
        currentLeaveDate.setDate(currentLeaveDate.getDate() + 1);
      }
    }

    // Generate entries ONLY for dates that have attendance records
    // Collect all dates that have data
    const datesWithData = new Set<string>();

    // Add dates with attendance records
    for (const dateKey of recordsByDate.keys()) {
      datesWithData.add(dateKey);
    }

    // Sort dates chronologically and filter to only include dates within the requested range
    const sortedDates = Array.from(datesWithData)
      .filter(dateKey => dateKey >= startDateKey && dateKey <= endDateKey)
      .sort();

    const entries: EmployeeAttendanceEntry[] = [];

    for (const dateKey of sortedDates) {
      const currentDate = new Date(dateKey + "T12:00:00"); // Use noon to avoid timezone issues
      const record = recordsByDate.get(dateKey);
      const clockInTime = record?.actualTimeIn ?? null;
      const clockOutTime = record?.actualTimeOut ?? null;

      // Get shift info for this date
      // Priority: Record's shiftTemplate (actual imported shift) > Employee's default shift from roleScorecard
      const { isRestDay, shift: defaultShift } = getShiftForDate(currentDate);

      // Use the record's shift template if available (this is the actual imported shift),
      // otherwise fall back to the employee's default shift from roleScorecard
      const shift = record?.shiftTemplate || defaultShift;

      // Format shift times for display
      let scheduledStartTime: string | null = null;
      let scheduledEndTime: string | null = null;
      let scheduledHours: number | null = null;
      let shiftBreakMinutes = 60; // Original shift break (for adjustment calculation)
      let breakMinutes = 60; // Effective break (may be overridden)
      let breakStartTime: string | null = null; // For break window overlap calculation
      let breakEndTime: string | null = null; // For break window overlap calculation
      let graceMinutesLate = 0;
      let graceMinutesEarlyOut = 0;

      // Schedule info comes from shift template
      if (shift) {
        const startT = new Date(shift.startTime);
        const endT = new Date(shift.endTime);
        // Use UTC methods since times are stored as UTC in the database
        scheduledStartTime = `${startT.getUTCHours().toString().padStart(2, '0')}:${startT.getUTCMinutes().toString().padStart(2, '0')}`;
        scheduledEndTime = `${endT.getUTCHours().toString().padStart(2, '0')}:${endT.getUTCMinutes().toString().padStart(2, '0')}`;
        scheduledHours = shift.scheduledWorkMinutes ? shift.scheduledWorkMinutes / 60 : defaultWorkHours;
        shiftBreakMinutes = shift.breakMinutes;
        breakMinutes = shift.breakMinutes;
        graceMinutesLate = shift.graceMinutesLate;
        graceMinutesEarlyOut = shift.graceMinutesEarlyOut;
        if (shift.breakStartTime) {
          const breakStartT = new Date(shift.breakStartTime);
          breakStartTime = `${breakStartT.getUTCHours().toString().padStart(2, '0')}:${breakStartT.getUTCMinutes().toString().padStart(2, '0')}`;
        }
        if (shift.breakEndTime) {
          const breakEndT = new Date(shift.breakEndTime);
          breakEndTime = `${breakEndT.getUTCHours().toString().padStart(2, '0')}:${breakEndT.getUTCMinutes().toString().padStart(2, '0')}`;
        }
      }

      // Apply break override if set (null = use shift template, 0 = no break, >0 = override value)
      if (record?.breakMinutesApplied !== null && record?.breakMinutesApplied !== undefined) {
        breakMinutes = record.breakMinutesApplied;
      }

      // Calculate break adjustment - if break is reduced/removed, late/undertime should be reduced
      // e.g., 9AM-6PM with 60min break = 8 hours expected work
      // If break = 0, leaving at 5PM still completes 8 hours (no undertime)
      const breakAdjustmentMinutes = shiftBreakMinutes - breakMinutes;

      // Determine attendance type
      // Priority: Time logs > Approved Leave > Holiday check > Record dayType > Rest day detection > No data
      let attendanceType: EmployeeAttendanceEntry["attendanceType"] = "NO_DATA";
      let holidayName: string | undefined = undefined;
      let holidayType: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | undefined = undefined;
      const dayOfWeek = currentDate.getDay();

      // Check if this date is a holiday from the company calendar
      const holiday = holidaysByDate.get(dateKey);

      // Check if this date has an approved leave request
      const approvedLeave = leavesByDate.get(dateKey);

      // Always track holiday info separately (for premium pay calculations)
      if (holiday) {
        holidayName = holiday.name;
        if (holiday.dayType === "REGULAR_HOLIDAY") {
          holidayType = "REGULAR_HOLIDAY";
        } else if (holiday.dayType === "SPECIAL_HOLIDAY") {
          holidayType = "SPECIAL_HOLIDAY";
        }
      }

      if (clockInTime || clockOutTime) {
        // Has actual attendance = Present (even on holidays/leaves, if they worked)
        attendanceType = "PRESENT";
      } else if (approvedLeave) {
        // Has an approved leave request - mark as ON_LEAVE
        attendanceType = "ON_LEAVE";
      } else if (holiday) {
        // Date is a holiday and didn't work - use specific holiday type from calendar
        if (holiday.dayType === "REGULAR_HOLIDAY") {
          attendanceType = "REGULAR_HOLIDAY";
        } else if (holiday.dayType === "SPECIAL_HOLIDAY") {
          attendanceType = "SPECIAL_HOLIDAY";
        } else {
          // Default to special holiday if type is unknown
          attendanceType = "SPECIAL_HOLIDAY";
        }
      } else if (record?.dayType) {
        // Use the day type from the attendance record
        if (record.dayType === "REST_DAY") {
          attendanceType = "REST_DAY";
        } else if (record.attendanceStatus === "ABSENT") {
          attendanceType = "ABSENT";
        } else if (record.attendanceStatus === "ON_LEAVE") {
          attendanceType = "ON_LEAVE";
        }
      } else if (isRestDay) {
        // Fall back to RoleScorecard rest day configuration
        attendanceType = "REST_DAY";
      }

      // Calculate hours worked (effective hours based on OT approval status)
      // - Early in only counts if earlyInApproved
      // - Late out only counts if lateOutApproved
      // - Late arrival and early departure are always deducted (unless excused)
      let hoursWorked: number | null = null;
      let rawHoursWorked: number | null = null; // For internal half-day check
      if (clockInTime && clockOutTime) {
        // Calculate raw hours first (for half-day detection)
        const rawDiffMs = clockOutTime.getTime() - clockInTime.getTime();
        const rawGrossHours = rawDiffMs / (1000 * 60 * 60);
        const rawBreakHours = rawGrossHours > 5 ? breakMinutes / 60 : 0;
        rawHoursWorked = Math.round((rawGrossHours - rawBreakHours) * 100) / 100;

        // Calculate effective clock times based on schedule and approval
        let effectiveClockIn = clockInTime;
        let effectiveClockOut = clockOutTime;

        if (scheduledStartTime && scheduledEndTime) {
          // Parse scheduled times and build using Manila timezone utility
          const [startH, startM] = scheduledStartTime.split(':').map(Number);
          const [endH, endM] = scheduledEndTime.split(':').map(Number);

          const schedStart = setManilaHours(new Date(clockInTime), startH, startM);
          const schedEnd = setManilaHours(new Date(clockOutTime), endH, endM);

          // Handle overnight shifts
          if (endH < startH) {
            schedEnd.setUTCDate(schedEnd.getUTCDate() + 1);
          }

          // Cap clock in to scheduled start unless early in is approved
          if (clockInTime < schedStart && !record?.earlyInApproved) {
            effectiveClockIn = schedStart;
          }

          // Cap clock out to scheduled end unless late out is approved
          if (clockOutTime > schedEnd && !record?.lateOutApproved) {
            effectiveClockOut = schedEnd;
          }
        }

        // Calculate effective hours
        const effectiveDiffMs = effectiveClockOut.getTime() - effectiveClockIn.getTime();
        const effectiveGrossHours = effectiveDiffMs / (1000 * 60 * 60);
        const breakHours = effectiveGrossHours > 5 ? breakMinutes / 60 : 0;
        hoursWorked = Math.round((effectiveGrossHours - breakHours) * 100) / 100;

        // Ensure hours worked is not negative
        if (hoursWorked < 0) hoursWorked = 0;

        // Check for half-day (worked less than half the scheduled hours)
        if (rawHoursWorked > 0 && rawHoursWorked <= halfDayThreshold && attendanceType === "PRESENT") {
          attendanceType = "HALF_DAY";
        }
      }

      // Calculate late minutes using actual shift schedule (imported shift > roleScorecard)
      let isLate = false;
      let lateMinutes = 0;
      if (clockInTime && !isRestDay && scheduledStartTime) {
        // Use Manila timezone utility for schedule time
        const [startH, startM] = scheduledStartTime.split(':').map(Number);
        const standardStart = setManilaHours(new Date(clockInTime), startH, startM);

        // Add grace period
        const graceEnd = new Date(standardStart.getTime() + graceMinutesLate * 60 * 1000);

        if (clockInTime > graceEnd) {
          isLate = true;
          lateMinutes = Math.round((clockInTime.getTime() - standardStart.getTime()) / (1000 * 60));

          // Exclude break window overlap from late period [standardStart, clockInTime]
          // e.g., arriving at 2:05 PM with 1-2 PM break: 60 min of break falls in the late period
          if (breakStartTime && breakEndTime) {
            const [breakStartH, breakStartM] = breakStartTime.split(':').map(Number);
            const [breakEndH, breakEndM] = breakEndTime.split(':').map(Number);
            const breakStartDT = setManilaHours(new Date(clockInTime), breakStartH, breakStartM);
            const breakEndDT = setManilaHours(new Date(clockInTime), breakEndH, breakEndM);

            const overlapStart = Math.max(standardStart.getTime(), breakStartDT.getTime());
            const overlapEnd = Math.min(clockInTime.getTime(), breakEndDT.getTime());
            const breakOverlap = Math.max(0, Math.round((overlapEnd - overlapStart) / (1000 * 60)));
            lateMinutes = Math.max(0, lateMinutes - breakOverlap);
          }
        }
      }

      // Apply override: if lateInApproved, clear late status (excuse late arrival)
      if (record?.lateInApproved && isLate) {
        isLate = false;
        lateMinutes = 0;
      }

      // Calculate undertime using actual shift schedule (imported shift > roleScorecard)
      let isUndertime = false;
      let undertimeMinutes = 0;
      if (clockOutTime && (attendanceType === "PRESENT" || attendanceType === "HALF_DAY") && scheduledEndTime) {
        // Use Manila timezone utility for schedule time
        const [endH, endM] = scheduledEndTime.split(':').map(Number);
        const standardEnd = setManilaHours(new Date(clockOutTime), endH, endM);

        // Handle overnight shifts (end time is next day)
        if (scheduledStartTime) {
          const [startH] = scheduledStartTime.split(':').map(Number);
          if (endH < startH) {
            // This is an overnight shift, end time is next day
            standardEnd.setUTCDate(standardEnd.getUTCDate() + 1);
          }
        }

        // Subtract grace period
        const graceStart = new Date(standardEnd.getTime() - graceMinutesEarlyOut * 60 * 1000);

        if (clockOutTime < graceStart) {
          isUndertime = true;
          undertimeMinutes = Math.round((standardEnd.getTime() - clockOutTime.getTime()) / (1000 * 60));

          // Exclude break window overlap from undertime period [clockOutTime, standardEnd]
          // e.g., leaving at 1:06 PM with 1-2 PM break: 54 min of break is in undertime period
          let breakOverlapInUndertime = 0;
          if (breakStartTime && breakEndTime) {
            const [breakStartH, breakStartM] = breakStartTime.split(':').map(Number);
            const [breakEndH, breakEndM] = breakEndTime.split(':').map(Number);
            const breakStartDT = setManilaHours(new Date(clockOutTime), breakStartH, breakStartM);
            const breakEndDT = setManilaHours(new Date(clockOutTime), breakEndH, breakEndM);

            const overlapStart = Math.max(clockOutTime.getTime(), breakStartDT.getTime());
            const overlapEnd = Math.min(standardEnd.getTime(), breakEndDT.getTime());
            breakOverlapInUndertime = Math.max(0, Math.round((overlapEnd - overlapStart) / (1000 * 60)));
            undertimeMinutes = Math.max(0, undertimeMinutes - breakOverlapInUndertime);
          }

          // Apply break adjustment, reduced by break overlap to prevent double-counting
          if (breakAdjustmentMinutes > 0) {
            const effectiveBreakAdjustment = Math.max(0, breakAdjustmentMinutes - breakOverlapInUndertime);
            undertimeMinutes = Math.max(0, undertimeMinutes - effectiveBreakAdjustment);
          }

          // If undertime reduced to 0, clear the flag
          if (undertimeMinutes === 0) {
            isUndertime = false;
          }
        }
      }

      // Apply override: if earlyOutApproved, clear undertime status (excuse early departure)
      if (record?.earlyOutApproved && isUndertime) {
        isUndertime = false;
        undertimeMinutes = 0;
      }

      // Calculate early in (overtime - clocked in before scheduled start)
      // Always calculate so it can be displayed as pending in the attendance tab
      let isEarlyIn = false;
      let earlyInMinutes = 0;
      if (clockInTime && !isRestDay && scheduledStartTime) {
        const [startH, startM] = scheduledStartTime.split(':').map(Number);
        const standardStart = setManilaHours(new Date(clockInTime), startH, startM);

        if (clockInTime < standardStart) {
          isEarlyIn = true;
          earlyInMinutes = Math.round((standardStart.getTime() - clockInTime.getTime()) / (1000 * 60));
        }
      }

      // Calculate late out (overtime - clocked out after scheduled end)
      // Always calculate so it can be displayed as pending in the attendance tab
      let isLateOut = false;
      let lateOutMinutes = 0;
      if (clockOutTime && (attendanceType === "PRESENT" || attendanceType === "HALF_DAY") && scheduledEndTime) {
        const [endH, endM] = scheduledEndTime.split(':').map(Number);
        const standardEnd = setManilaHours(new Date(clockOutTime), endH, endM);

        // Handle overnight shifts (end time is next day)
        if (scheduledStartTime) {
          const [startH] = scheduledStartTime.split(':').map(Number);
          if (endH < startH) {
            standardEnd.setUTCDate(standardEnd.getUTCDate() + 1);
          }
        }

        if (clockOutTime > standardEnd) {
          isLateOut = true;
          lateOutMinutes = Math.round((clockOutTime.getTime() - standardEnd.getTime()) / (1000 * 60));
        }
      }

      // Break OT: when break is overridden/reduced, worked break time is auto-approved OT
      let breakOtMinutes = 0;
      if (record?.breakMinutesApplied !== null && record?.breakMinutesApplied !== undefined) {
        breakOtMinutes = Math.max(0, shiftBreakMinutes - record.breakMinutesApplied);
      }

      // Calculate totals
      const totalDeductionMinutes = lateMinutes + undertimeMinutes;
      const totalOvertimeMinutes = earlyInMinutes + lateOutMinutes + breakOtMinutes;

      entries.push({
        id: `${employeeId}-${dateKey}`,
        date: new Date(currentDate),
        dayOfWeek: DAY_NAMES[dayOfWeek],
        clockIn: clockInTime,
        clockOut: clockOutTime,
        hoursWorked,
        attendanceType,
        holidayName, // Include holiday name for display (e.g., "New Year's Day")
        holidayType, // Track holiday type separately (even if worked = PRESENT)
        sourceType: record?.sourceType || "NONE",
        isLate,
        lateMinutes,
        isUndertime,
        undertimeMinutes,
        totalDeductionMinutes,
        isEarlyIn,
        earlyInMinutes,
        earlyInApproved: record?.earlyInApproved ?? false,
        isLateOut,
        lateOutMinutes,
        lateOutApproved: record?.lateOutApproved ?? false,
        breakOtMinutes,
        totalOvertimeMinutes,
        scheduledStartTime,
        scheduledEndTime,
        scheduledHours,
        clockInLogId: record?.id || null,
        clockOutLogId: record?.id || null,
        breakMinutes,
        shiftBreakMinutes,
        isBreakApplicable: (hoursWorked || 0) > 5,
        // Daily rate override
        dailyRateOverride: record?.dailyRateOverride ? Number(record.dailyRateOverride) : null,
        // Override data now comes directly from the record
        hasOverride: !!(record?.overrideReason || record?.earlyInApproved || record?.lateOutApproved || record?.lateInApproved || record?.earlyOutApproved || record?.breakMinutesApplied !== null || record?.dailyRateOverride !== null),
        override: record ? {
          shiftStartOverride: null,
          shiftEndOverride: null,
          breakMinutesOverride: record.breakMinutesApplied,
          dailyRateOverride: record.dailyRateOverride ? Number(record.dailyRateOverride) : null,
          earlyInApproved: record.earlyInApproved,
          lateOutApproved: record.lateOutApproved,
          lateInApproved: record.lateInApproved,
          earlyOutApproved: record.earlyOutApproved,
          reason: record.overrideReason ?? "",
        } : undefined,
      });
    }

    // Calculate summary - all entries now have actual imported data (no NO_DATA entries)
    // Work days = Present + Absent + Leave (days you should have worked)
    // Holidays where you worked count as both a work day AND a holiday (for premium pay)
    const totalLateMinutes = entries.reduce((sum, e) => sum + e.lateMinutes, 0);
    const totalUndertimeMinutes = entries.reduce((sum, e) => sum + e.undertimeMinutes, 0);
    const totalEarlyInMinutes = entries.reduce((sum, e) => sum + (e.earlyInApproved ? e.earlyInMinutes : 0), 0);
    const totalLateOutMinutes = entries.reduce((sum, e) => sum + (e.lateOutApproved ? e.lateOutMinutes : 0), 0);
    const totalBreakOtMinutes = entries.reduce((sum, e) => sum + e.breakOtMinutes, 0);

    const summary: EmployeeAttendanceSummary = {
      totalDays: entries.length,
      // workingDays = Present + Absent + Leave (scheduled work days, not rest days or unworked holidays)
      workingDays: entries.filter((e) =>
        e.attendanceType === "PRESENT" ||
        e.attendanceType === "HALF_DAY" ||
        e.attendanceType === "ABSENT" ||
        e.attendanceType === "ON_LEAVE"
      ).length,
      presentDays: entries.filter((e) => e.attendanceType === "PRESENT" || e.attendanceType === "HALF_DAY").length,
      absentDays: entries.filter((e) => e.attendanceType === "ABSENT").length,
      leaveDays: entries.filter((e) => e.attendanceType === "ON_LEAVE").length,
      restDays: entries.filter((e) => e.attendanceType === "REST_DAY").length,
      // Holiday counts use holidayType (tracks holidays even if worked)
      regularHolidayDays: entries.filter((e) => e.holidayType === "REGULAR_HOLIDAY").length,
      specialHolidayDays: entries.filter((e) => e.holidayType === "SPECIAL_HOLIDAY").length,
      noDataDays: 0, // No longer applicable - we only show imported data
      totalHoursWorked: entries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0),
      // Deductions
      totalLateMinutes,
      totalUndertimeMinutes,
      totalDeductionMinutes: totalLateMinutes + totalUndertimeMinutes,
      // Overtime
      totalEarlyInMinutes,
      totalLateOutMinutes,
      totalBreakOtMinutes,
      totalOvertimeMinutes: totalEarlyInMinutes + totalLateOutMinutes + totalBreakOtMinutes,
    };

    return {
      success: true,
      data: {
        employee: {
          id: employee.id,
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          department: employee.department?.name || null,
        },
        entries,
        summary,
      },
    };
  } catch (error) {
    console.error("Failed to get employee attendance:", error);
    return { success: false, error: "Failed to get employee attendance" };
  }
}

export async function getDailyAttendance(date: Date): Promise<{
  success: boolean;
  data?: DailyTimeLogEntry[];
  error?: string;
}> {
  try {
    await assertPermission(Permission.ATTENDANCE_VIEW);

    const { getAuthContext } = await import("@/lib/auth");
    const auth = await getAuthContext();
    if (!auth) return { success: false, error: "Not authenticated" };

    // Get the date key in YYYY-MM-DD format (UTC)
    const dateKey = date.toISOString().split("T")[0];
    const [year, month, day] = dateKey.split("-").map(Number);

    // Create UTC date boundaries for queries
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Get all employees in the company (only active employees)
    const employees = await prisma.employee.findMany({
      where: {
        companyId: auth.user.companyId,
        employmentStatus: "ACTIVE",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        department: {
          select: { name: true },
        },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    // Get attendance records for the date
    const attendanceRecords = await prisma.attendanceDayRecord.findMany({
      where: {
        employee: { companyId: auth.user.companyId },
        attendanceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Index attendance records by employee
    const recordsByEmployee = new Map<string, typeof attendanceRecords[0]>();
    for (const record of attendanceRecords) {
      recordsByEmployee.set(record.employeeId, record);
    }

    // Build daily entries for all employees
    const entries: DailyTimeLogEntry[] = employees.map((emp) => {
      const record = recordsByEmployee.get(emp.id);

      let attendanceType: DailyTimeLogEntry["attendanceType"] = "NO_DATA";
      if (record?.actualTimeIn || record?.actualTimeOut) {
        attendanceType = "PRESENT";
      }

      return {
        id: emp.id,
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        department: emp.department?.name || null,
        logDate: startOfDay,
        clockIn: record?.actualTimeIn || null,
        clockOut: record?.actualTimeOut || null,
        attendanceType,
        sourceType: record?.sourceType || "NONE",
        sourceBatchId: record?.sourceBatchId || null,
      };
    });

    return { success: true, data: entries };
  } catch (error) {
    console.error("Failed to get daily attendance:", error);
    return { success: false, error: "Failed to get daily attendance" };
  }
}

// =============================================================================
// Edit/Delete Attendance Records
// =============================================================================

export interface UpdateAttendanceInput {
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockIn?: string | null; // HH:mm or null to remove
  clockOut?: string | null; // HH:mm or null to remove
  // Shift template override (empty string = keep current, valid ID = override shift)
  shiftTemplateId?: string;
  // Break override (null = use shift template default, 0 = no break, >0 = custom break)
  // Pass undefined to leave unchanged, null to reset to shift default
  breakMinutes?: number | null;
  // Approval flags
  earlyInApproved?: boolean; // Approve early clock in (counts as OT)
  lateOutApproved?: boolean; // Approve late clock out (counts as OT)
  lateInApproved?: boolean; // Excuse late arrival (clear late minutes)
  earlyOutApproved?: boolean; // Excuse early departure (clear undertime)
  // Daily rate override (null = reset to standard, undefined = no change, number = override)
  dailyRateOverride?: number | null;
  // Reason
  reason: string;
  reasonCode?: string;
}

/**
 * Update or create attendance record for a specific date.
 * Permission: attendance:edit
 */
export async function updateAttendanceRecord(
  input: UpdateAttendanceInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await assertPermission(Permission.ATTENDANCE_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        companyId: auth.user.companyId,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Parse the date - use UTC to avoid timezone issues
    const [year, month, day] = input.date.split("-").map(Number);
    const attendanceDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Get existing attendance record for this date
    const existingRecord = await prisma.attendanceDayRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: input.employeeId,
          attendanceDate,
        },
      },
    });

    // Check if record is locked
    if (existingRecord?.isLocked) {
      return { success: false, error: "Attendance record is locked by payroll" };
    }

    // Helper to parse time string to Date (Manila timezone)
    const parseTimeToDate = (timeStr: string, baseDate: Date): Date => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return setManilaHours(new Date(baseDate), hours, minutes);
    };

    // Determine new time values
    let actualTimeIn = existingRecord?.actualTimeIn ?? null;
    let actualTimeOut = existingRecord?.actualTimeOut ?? null;

    if (input.clockIn !== undefined) {
      actualTimeIn = input.clockIn ? parseTimeToDate(input.clockIn, attendanceDate) : null;
    }
    if (input.clockOut !== undefined) {
      actualTimeOut = input.clockOut ? parseTimeToDate(input.clockOut, attendanceDate) : null;
    }

    // Calculate worked minutes for attendance status determination only
    // (actual worked minutes are calculated on the fly when needed)
    // Break minutes default to 60 (shift template lookup done on-the-fly during payroll computation)
    const breakMinutes = input.breakMinutes ?? 60;
    let workedMinutes = 0;

    if (actualTimeIn && actualTimeOut) {
      const grossWorkedMinutes = Math.round(
        (actualTimeOut.getTime() - actualTimeIn.getTime()) / (1000 * 60)
      );
      workedMinutes = Math.max(0, grossWorkedMinutes - breakMinutes);
    }

    // Determine attendance status
    let attendanceStatus: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "REST_DAY" = "PRESENT";
    if (workedMinutes > 0 && workedMinutes < 240) {
      attendanceStatus = "HALF_DAY";
    } else if (workedMinutes === 0 && !actualTimeIn && !actualTimeOut) {
      attendanceStatus = "ABSENT";
    }

    // Build record data (computed values like late/OT are calculated on the fly, not stored)
    const recordData = {
      actualTimeIn,
      actualTimeOut,
      sourceType: "MANUAL" as const,
      enteredById: auth.user.id,
      manualReason: input.reason,
      attendanceStatus,
      // Shift template override (only update if a valid ID is provided, empty string = keep current)
      ...(input.shiftTemplateId && { shiftTemplateId: input.shiftTemplateId }),
      // Override fields - include directly in main update
      earlyInApproved: input.earlyInApproved ?? existingRecord?.earlyInApproved ?? false,
      lateOutApproved: input.lateOutApproved ?? existingRecord?.lateOutApproved ?? false,
      lateInApproved: input.lateInApproved ?? existingRecord?.lateInApproved ?? false,
      earlyOutApproved: input.earlyOutApproved ?? existingRecord?.earlyOutApproved ?? false,
      // Break override (null = use shift template, 0 = no break, >0 = override)
      ...(input.breakMinutes !== undefined && { breakMinutesApplied: input.breakMinutes }),
      // Daily rate override (null = reset to standard, number = override rate)
      ...(input.dailyRateOverride !== undefined && { dailyRateOverride: input.dailyRateOverride }),
      // Override reason tracking
      overrideReason: input.reason,
      overrideReasonCode: input.reasonCode ?? null,
      overrideById: auth.user.id,
      overrideAt: new Date(),
    };

    if (existingRecord) {
      // Update existing record
      await prisma.attendanceDayRecord.update({
        where: { id: existingRecord.id },
        data: recordData,
      });
      await audit.update(
        "AttendanceDayRecord",
        existingRecord.id,
        {
          actualTimeIn: existingRecord.actualTimeIn?.toISOString(),
          actualTimeOut: existingRecord.actualTimeOut?.toISOString(),
          breakMinutesApplied: existingRecord.breakMinutesApplied,
          dailyRateOverride: existingRecord.dailyRateOverride ? Number(existingRecord.dailyRateOverride) : null,
          shiftTemplateId: existingRecord.shiftTemplateId,
        },
        {
          actualTimeIn: actualTimeIn?.toISOString(),
          actualTimeOut: actualTimeOut?.toISOString(),
          breakMinutesApplied: input.breakMinutes,
          dailyRateOverride: input.dailyRateOverride,
          shiftTemplateId: input.shiftTemplateId,
          reason: input.reason,
        }
      );
    } else {
      // Create new record
      const newRecord = await prisma.attendanceDayRecord.create({
        data: {
          employeeId: input.employeeId,
          attendanceDate,
          dayType: "WORKDAY",
          ...recordData,
        },
      });
      await audit.create("AttendanceDayRecord", newRecord.id, {
        employeeId: input.employeeId,
        attendanceDate: input.date,
        actualTimeIn: actualTimeIn?.toISOString(),
        actualTimeOut: actualTimeOut?.toISOString(),
        breakMinutesApplied: input.breakMinutes,
        dailyRateOverride: input.dailyRateOverride,
        shiftTemplateId: input.shiftTemplateId,
        reason: input.reason,
      });
    }

    revalidatePath(`/employees/${input.employeeId}`);
    revalidatePath("/attendance/daily");

    return { success: true };
  } catch (error) {
    console.error("Failed to update attendance record:", error);
    return { success: false, error: "Failed to update attendance record" };
  }
}

/**
 * Delete attendance record for a specific date (both clock in and out).
 * Permission: attendance:edit
 */
export async function deleteAttendanceRecord(
  employeeId: string,
  date: string, // YYYY-MM-DD
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await assertPermission(Permission.ATTENDANCE_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: auth.user.companyId,
      },
    });

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    // Parse the date - use UTC to avoid timezone issues
    const [year, month, day] = date.split("-").map(Number);
    const attendanceDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Get existing attendance record
    const existingRecord = await prisma.attendanceDayRecord.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate,
        },
      },
    });

    if (!existingRecord) {
      return { success: false, error: "No attendance record found for this date" };
    }

    if (existingRecord.isLocked) {
      return { success: false, error: "Attendance record is locked by payroll" };
    }

    // Delete the attendance record
    await prisma.attendanceDayRecord.delete({
      where: { id: existingRecord.id },
    });

    await audit.delete("AttendanceDayRecord", existingRecord.id, {
      employeeId,
      attendanceDate: date,
      actualTimeIn: existingRecord.actualTimeIn?.toISOString(),
      actualTimeOut: existingRecord.actualTimeOut?.toISOString(),
      reason,
    });

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/attendance/daily");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete attendance record:", error);
    return { success: false, error: "Failed to delete attendance record" };
  }
}

/**
 * Create a manual attendance entry for a specific date.
 * Permission: attendance:edit
 */
export async function createAttendanceRecord(
  input: UpdateAttendanceInput
): Promise<{ success: boolean; error?: string }> {
  // Reuse updateAttendanceRecord for creation
  return updateAttendanceRecord(input);
}

/**
 * Batch delete attendance records for multiple dates.
 * Permission: attendance:edit
 */
export async function batchDeleteAttendanceRecords(
  employeeId: string,
  dates: string[], // Array of YYYY-MM-DD
  reason: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const auth = await assertPermission(Permission.ATTENDANCE_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId: auth.user.companyId,
      },
    });

    if (!employee) {
      return { success: false, deletedCount: 0, error: "Employee not found" };
    }

    let deletedCount = 0;

    for (const date of dates) {
      // Parse the date - use UTC to avoid timezone issues
      const [year, month, day] = date.split("-").map(Number);
      const attendanceDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

      // Get existing attendance record
      const existingRecord = await prisma.attendanceDayRecord.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId,
            attendanceDate,
          },
        },
      });

      if (existingRecord && !existingRecord.isLocked) {
        // Delete the attendance record
        await prisma.attendanceDayRecord.delete({
          where: { id: existingRecord.id },
        });

        await audit.delete("AttendanceDayRecord", existingRecord.id, {
          employeeId,
          attendanceDate: date,
          reason,
          batchDelete: true,
        });

        deletedCount++;
      }
    }

    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/attendance/daily");

    return { success: true, deletedCount };
  } catch (error) {
    console.error("Failed to batch delete attendance records:", error);
    return { success: false, deletedCount: 0, error: "Failed to batch delete attendance records" };
  }
}

export interface BatchUpdateInput {
  employeeId: string;
  dates: string[]; // Array of YYYY-MM-DD
  // Break override (null = use shift template default, 0 = no break, >0 = custom break)
  breakMinutes?: number | null;
  // Approval flags
  earlyInApproved?: boolean;
  lateOutApproved?: boolean;
  lateInApproved?: boolean;
  earlyOutApproved?: boolean;
  reason: string;
  reasonCode?: string;
}

/**
 * Batch update attendance records for multiple dates.
 * Updates override fields directly on AttendanceDayRecord.
 * Permission: attendance:edit
 */
export async function batchUpdateAttendanceRecords(
  input: BatchUpdateInput
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const auth = await assertPermission(Permission.ATTENDANCE_EDIT);

    const headersList = await headers();
    const audit = createAuditLogger({
      userId: auth.user.id,
      userEmail: auth.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    // Verify employee belongs to company
    const employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        companyId: auth.user.companyId,
      },
    });

    if (!employee) {
      return { success: false, updatedCount: 0, error: "Employee not found" };
    }

    let updatedCount = 0;

    for (const date of input.dates) {
      // Parse the date - use UTC to avoid timezone issues
      const [year, month, day] = date.split("-").map(Number);
      const attendanceDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

      // Check for existing attendance record
      const existingRecord = await prisma.attendanceDayRecord.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId: input.employeeId,
            attendanceDate,
          },
        },
      });

      if (!existingRecord) {
        // Skip dates without attendance records
        continue;
      }

      if (existingRecord.isLocked) {
        // Skip locked records
        continue;
      }

      const updateData = {
        // Approval flags
        earlyInApproved: input.earlyInApproved ?? existingRecord.earlyInApproved,
        lateOutApproved: input.lateOutApproved ?? existingRecord.lateOutApproved,
        lateInApproved: input.lateInApproved ?? existingRecord.lateInApproved,
        earlyOutApproved: input.earlyOutApproved ?? existingRecord.earlyOutApproved,
        // Break override (0 = use shift template default)
        ...(input.breakMinutes !== undefined && { breakMinutesApplied: input.breakMinutes }),
        // Override reason tracking
        overrideReason: input.reason,
        overrideReasonCode: input.reasonCode ?? null,
        overrideById: auth.user.id,
        overrideAt: new Date(),
      };

      await prisma.attendanceDayRecord.update({
        where: { id: existingRecord.id },
        data: updateData,
      });

      await audit.update(
        "AttendanceDayRecord",
        existingRecord.id,
        {},
        { ...updateData, batchUpdate: true }
      );

      updatedCount++;
    }

    revalidatePath(`/employees/${input.employeeId}`);
    revalidatePath("/attendance/daily");

    return { success: true, updatedCount };
  } catch (error) {
    console.error("Failed to batch update attendance records:", error);
    return { success: false, updatedCount: 0, error: "Failed to batch update attendance records" };
  }
}

