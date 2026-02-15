// Common types for attendance components

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "REST_DAY"
  | "ON_LEAVE"
  | "NO_DATA"
  | "HALF_DAY"
  | "REGULAR_HOLIDAY"
  | "SPECIAL_HOLIDAY";

export type HolidayType = "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";

export type DayType =
  | "REGULAR_WORKING_DAY"
  | "WORKDAY"
  | "REST_DAY"
  | "REGULAR_HOLIDAY"
  | "SPECIAL_HOLIDAY";

// Common attendance record interface for table display
export interface AttendanceRecord {
  id: string;
  date: Date;
  dayOfWeek?: string;
  // Schedule info
  scheduledStart: string | null;
  scheduledEnd: string | null;
  // Actual times
  clockIn: Date | null;
  clockOut: Date | null;
  // Hours worked
  hoursWorked: number | null;
  workedMinutes?: number;
  // Status
  attendanceType: AttendanceStatus;
  dayType?: DayType | string;
  holidayName?: string;
  holidayType?: HolidayType;
  leaveTypeName?: string;
  // Deductions
  lateMinutes: number;
  undertimeMinutes: number;
  totalDeductionMinutes?: number;
  // Overtime
  earlyInMinutes?: number;
  lateOutMinutes?: number;
  totalOvertimeMinutes?: number;
  // Payslip-specific OT fields
  otEarlyInMinutes?: number;
  otLateOutMinutes?: number;
  otRestDayMinutes?: number;
  otHolidayMinutes?: number;
  isOtApproved?: boolean;
  // Independent approval flags
  earlyInApproved?: boolean;
  lateOutApproved?: boolean;
  // Break OT (auto-approved, from working through break)
  breakOtMinutes?: number;
  otBreakMinutes?: number;
  // Night differential
  nightDiffMinutes?: number;
  // Break info
  breakMinutes: number;
  shiftBreakMinutes: number;
  // Daily rate override
  dailyRateOverride?: number | null;
  // Override info
  hasOverride?: boolean;
  override?: {
    breakMinutesOverride: number | null;
    earlyInApproved: boolean;
    lateOutApproved: boolean;
    dailyRateOverride: number | null;
    reason: string;
  };
}

// Summary statistics
export interface AttendanceSummary {
  // Day counts
  totalDays: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  restDays: number;
  restDaysWorked?: number;
  regularHolidayDays: number;
  regularHolidaysWorked?: number;
  specialHolidayDays: number;
  specialHolidaysWorked?: number;
  leaveDays: number;
  // Time totals
  totalWorkedMinutes?: number;
  totalDeductionMinutes: number;
  lateMinutes?: number;
  undertimeMinutes?: number;
  totalOvertimeMinutes: number;
  // OT breakdown
  regularOtApproved?: number;
  regularOtPending?: number;
  restDayOt?: number;
  holidayOt?: number;
  // Night diff
  nightDiffMinutes?: number;
}
