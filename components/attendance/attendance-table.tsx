"use client";

import { AttendanceStatusBadge } from "./attendance-status-badge";
import { AttendanceSummaryCards } from "./attendance-summary-cards";
import type { AttendanceRecord, AttendanceSummary, AttendanceStatus, HolidayType } from "./types";

// Helper functions
function formatTime(date: Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

function formatWorkedHours(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  }
  return `${mins}m`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function getDayOfWeek(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", { weekday: "short" });
}

interface AttendanceTableProps {
  records: AttendanceRecord[];
  summary?: AttendanceSummary;
  showSummary?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onEdit?: (record: AttendanceRecord) => void;
  onDelete?: (record: AttendanceRecord) => void;
  variant?: "default" | "payslip";
}

export function AttendanceTable({
  records,
  summary,
  showSummary = true,
  canEdit = false,
  canDelete = false,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
  onEdit,
  onDelete,
  variant = "default",
}: AttendanceTableProps) {
  // Calculate summary from records if not provided
  const calculatedSummary = summary || calculateSummaryFromRecords(records, variant);

  const isPayslipVariant = variant === "payslip";

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {showSummary && calculatedSummary && (
        <AttendanceSummaryCards
          summary={calculatedSummary}
          variant={isPayslipVariant ? "payslip" : "compact"}
        />
      )}

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Daily Attendance</h3>
          <p className="text-sm text-gray-500 mt-1">
            {records.length} day(s) {isPayslipVariant ? "in pay period" : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {isSelectionMode && (
                  <th className="px-4 py-3 text-center w-10">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Day</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">
                  Schedule
                  {isPayslipVariant && <span className="block text-xs font-normal text-gray-400">(Scheduled)</span>}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Clock In</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Clock Out</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Hours</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Deduction
                  {isPayslipVariant && <span className="block text-xs font-normal text-gray-400">(Late + UT)</span>}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">
                  Overtime
                  {isPayslipVariant && <span className="block text-xs font-normal text-gray-400">(Regular / Holiday)</span>}
                </th>
                {isPayslipVariant && (
                  <th className="px-4 py-3 text-right font-medium text-gray-500">ND</th>
                )}
                {(canEdit || canDelete) && !isSelectionMode && (
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={isPayslipVariant ? (canEdit ? 12 : 11) : (canEdit ? 10 : 9)}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No attendance records for this period
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const isSelected = selectedIds.has(record.id);
                  // Calculate worked minutes from either workedMinutes or hoursWorked
                  const workedMins = record.workedMinutes && record.workedMinutes > 0
                    ? record.workedMinutes
                    : record.hoursWorked && record.hoursWorked > 0
                      ? Math.round(record.hoursWorked * 60)
                      : 0;

                  // Calculate totals
                  const totalDeduction = record.totalDeductionMinutes !== undefined
                    ? record.totalDeductionMinutes
                    : record.lateMinutes + record.undertimeMinutes;

                  const totalOt = record.totalOvertimeMinutes !== undefined
                    ? record.totalOvertimeMinutes
                    : (record.earlyInMinutes || 0) + (record.lateOutMinutes || 0) +
                      (record.otEarlyInMinutes || 0) + (record.otLateOutMinutes || 0) +
                      (record.otRestDayMinutes || 0) + (record.otHolidayMinutes || 0);

                  const otEarlyLate = (record.otEarlyInMinutes || 0) + (record.otLateOutMinutes || 0) + (record.otBreakMinutes || record.breakOtMinutes || 0);
                  const otOther = (record.otRestDayMinutes || 0) + (record.otHolidayMinutes || 0);

                  // Get attendance status for badge
                  const status = getAttendanceStatus(record);
                  const holidayType = getHolidayType(record);

                  return (
                    <tr key={record.id} className={`hover:bg-gray-50 ${isSelected ? "bg-blue-50" : ""}`}>
                      {isSelectionMode && (
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelection?.(record.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {formatDate(record.date)}
                        {record.dailyRateOverride != null && record.dailyRateOverride > 0 && (
                          <span
                            className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700"
                            title={`Daily rate override: ₱${record.dailyRateOverride.toFixed(2)}`}
                          >
                            ₱{record.dailyRateOverride.toFixed(0)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {record.dayOfWeek || getDayOfWeek(record.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {record.scheduledStart && record.scheduledEnd ? (
                          <span>{record.scheduledStart} - {record.scheduledEnd}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {record.clockIn ? (
                          <span className={record.lateMinutes > 0 ? "text-red-600" : "text-gray-900"}>
                            {formatTime(record.clockIn)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {record.clockOut ? formatTime(record.clockOut) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {workedMins > 0 ? (
                          <span>{formatWorkedHours(workedMins)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceStatusBadge
                          status={status}
                          holidayName={record.holidayName}
                          holidayType={holidayType}
                          leaveTypeName={record.leaveTypeName}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {totalDeduction > 0 ? (
                          <span
                            className="text-red-600"
                            title={`${record.lateMinutes}m late + ${record.undertimeMinutes}m early out`}
                          >
                            {formatMinutes(totalDeduction)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {isPayslipVariant ? (
                          // Payslip-style OT display with pending indicator
                          (otEarlyLate > 0 || otOther > 0) ? (
                            <div className="space-y-0.5">
                              {otEarlyLate > 0 && (() => {
                                const breakOt = record.otBreakMinutes || record.breakOtMinutes || 0;
                                const approvedOt = (record.earlyInApproved ? (record.otEarlyInMinutes || 0) : 0)
                                  + (record.lateOutApproved ? (record.otLateOutMinutes || 0) : 0)
                                  + breakOt;
                                const pendingOt = (!record.earlyInApproved ? (record.otEarlyInMinutes || 0) : 0)
                                  + (!record.lateOutApproved ? (record.otLateOutMinutes || 0) : 0);
                                return (
                                  <>
                                    {approvedOt > 0 && (
                                      <span className="text-green-600 block">
                                        {formatMinutes(approvedOt)}
                                      </span>
                                    )}
                                    {pendingOt > 0 && (
                                      <span className="text-yellow-600 block">
                                        {formatMinutes(pendingOt)}
                                        <span className="text-xs ml-1">(pending)</span>
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              {otOther > 0 && (
                                <span className="text-green-600 block">
                                  {formatMinutes(otOther)} <span className="text-xs text-gray-500">(hol/rd)</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )
                        ) : (
                          // Default employee view
                          totalOt > 0 ? (
                            <span
                              className="text-green-600"
                              title={`${record.earlyInMinutes || 0}m early in + ${record.lateOutMinutes || 0}m late out`}
                            >
                              {formatMinutes(totalOt)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )
                        )}
                      </td>
                      {isPayslipVariant && (
                        <td className="px-4 py-3 text-right text-gray-900">
                          {(record.nightDiffMinutes || 0) > 0 ? (
                            <span className="text-purple-600">{formatMinutes(record.nightDiffMinutes || 0)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      {(canEdit || canDelete) && !isSelectionMode && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && onEdit && (
                              <button
                                onClick={() => onEdit(record)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit attendance"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && onDelete && (
                              <button
                                onClick={() => onDelete(record)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete attendance"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper to get attendance status for badge
function getAttendanceStatus(record: AttendanceRecord): AttendanceStatus {
  // If already has a valid attendanceType, use it
  if (record.attendanceType && record.attendanceType !== "NO_DATA") {
    return record.attendanceType;
  }

  // Derive from other fields
  const isWorked = (record.workedMinutes || 0) > 0 || (record.hoursWorked || 0) > 0;
  if (isWorked) return "PRESENT";

  if (record.dayType === "REST_DAY") return "REST_DAY";
  if (record.dayType === "REGULAR_HOLIDAY") return "REGULAR_HOLIDAY";
  if (record.dayType === "SPECIAL_HOLIDAY") return "SPECIAL_HOLIDAY";

  return "ABSENT";
}

// Helper to get holiday type
function getHolidayType(record: AttendanceRecord): HolidayType | undefined {
  if (record.holidayType) return record.holidayType;
  if (record.dayType === "REGULAR_HOLIDAY") return "REGULAR_HOLIDAY";
  if (record.dayType === "SPECIAL_HOLIDAY") return "SPECIAL_HOLIDAY";
  return undefined;
}

// Calculate summary from records
function calculateSummaryFromRecords(records: AttendanceRecord[], variant: string): AttendanceSummary {
  const isPayslip = variant === "payslip";

  return records.reduce(
    (acc, r) => {
      const isWorked = (r.workedMinutes || 0) > 0 || (r.hoursWorked || 0) > 0;
      const isWorkday = r.dayType === "WORKDAY" || r.dayType === "REGULAR_WORKING_DAY" || (!r.dayType && r.attendanceType !== "REST_DAY");
      const isRestDay = r.dayType === "REST_DAY" || r.attendanceType === "REST_DAY";
      const isRegularHoliday = r.dayType === "REGULAR_HOLIDAY" || r.attendanceType === "REGULAR_HOLIDAY";
      const isSpecialHoliday = r.dayType === "SPECIAL_HOLIDAY" || r.attendanceType === "SPECIAL_HOLIDAY";
      const isOnLeave = r.attendanceType === "ON_LEAVE";

      const otOther = (r.otRestDayMinutes || 0) + (r.otHolidayMinutes || 0);
      // Split approved/pending OT using independent approval flags
      // Break OT is always auto-approved (worked through break)
      const breakOt = r.otBreakMinutes || r.breakOtMinutes || 0;
      const approvedRegularOt = (r.earlyInApproved ? (r.otEarlyInMinutes || 0) : 0)
        + (r.lateOutApproved ? (r.otLateOutMinutes || 0) : 0)
        + breakOt;
      const pendingOt = (!r.earlyInApproved ? (r.otEarlyInMinutes || 0) : 0)
        + (!r.lateOutApproved ? (r.otLateOutMinutes || 0) : 0);

      return {
        totalDays: acc.totalDays + 1,
        workingDays: acc.workingDays + (isWorkday ? 1 : 0),
        presentDays: acc.presentDays + (isWorkday && isWorked ? 1 : 0),
        absentDays: acc.absentDays + (isWorkday && !isWorked && !isOnLeave ? 1 : 0),
        restDays: acc.restDays + (isRestDay ? 1 : 0),
        restDaysWorked: acc.restDaysWorked + (isRestDay && isWorked ? 1 : 0),
        regularHolidayDays: acc.regularHolidayDays + (isRegularHoliday ? 1 : 0),
        regularHolidaysWorked: acc.regularHolidaysWorked + (isRegularHoliday && isWorked ? 1 : 0),
        specialHolidayDays: acc.specialHolidayDays + (isSpecialHoliday ? 1 : 0),
        specialHolidaysWorked: acc.specialHolidaysWorked + (isSpecialHoliday && isWorked ? 1 : 0),
        leaveDays: acc.leaveDays + (isOnLeave ? 1 : 0),
        totalWorkedMinutes: acc.totalWorkedMinutes + (r.workedMinutes || 0),
        totalDeductionMinutes: acc.totalDeductionMinutes + r.lateMinutes + r.undertimeMinutes,
        lateMinutes: acc.lateMinutes + r.lateMinutes,
        undertimeMinutes: acc.undertimeMinutes + r.undertimeMinutes,
        totalOvertimeMinutes: acc.totalOvertimeMinutes +
          (r.totalOvertimeMinutes !== undefined
            ? r.totalOvertimeMinutes
            : (r.earlyInMinutes || 0) + (r.lateOutMinutes || 0) + approvedRegularOt + otOther),
        regularOtApproved: acc.regularOtApproved + approvedRegularOt,
        regularOtPending: acc.regularOtPending + pendingOt,
        restDayOt: acc.restDayOt + (r.otRestDayMinutes || 0),
        holidayOt: acc.holidayOt + (r.otHolidayMinutes || 0),
        nightDiffMinutes: acc.nightDiffMinutes + (r.nightDiffMinutes || 0),
      };
    },
    {
      totalDays: 0,
      workingDays: 0,
      presentDays: 0,
      absentDays: 0,
      restDays: 0,
      restDaysWorked: 0,
      regularHolidayDays: 0,
      regularHolidaysWorked: 0,
      specialHolidayDays: 0,
      specialHolidaysWorked: 0,
      leaveDays: 0,
      totalWorkedMinutes: 0,
      totalDeductionMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      totalOvertimeMinutes: 0,
      regularOtApproved: 0,
      regularOtPending: 0,
      restDayOt: 0,
      holidayOt: 0,
      nightDiffMinutes: 0,
    }
  );
}
