"use client";

// =============================================================================
// PeopleOS PH - Employee Attendance Tab with Edit/Delete/Batch Functionality
// =============================================================================

import { useState, useTransition, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import {
  getEmployeeAttendance,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  batchDeleteAttendanceRecords,
  batchUpdateAttendanceRecords,
  type EmployeeAttendanceEntry,
  type EmployeeAttendanceSummary,
} from "@/app/actions/attendance";
import { getShiftTemplates } from "@/app/actions/settings";
import {
  getEmployeeLeaveBalances,
  type EmployeeLeaveBalance,
} from "@/app/actions/leave";
import {
  EditAttendanceModal,
  type AttendanceRecordForEdit,
  type EditAttendanceData,
  type ShiftTemplate,
} from "@/components/attendance";

interface AttendanceTabProps {
  employeeId: string;
  canEdit?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatTime(date: Date | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function AttendanceTab({ employeeId, canEdit = false }: AttendanceTabProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<EmployeeAttendanceEntry[]>([]);
  const [summary, setSummary] = useState<EmployeeAttendanceSummary | null>(null);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<EmployeeLeaveBalance[]>([]);

  // Default to current month
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Edit modal state - now just stores the entry being edited
  const [editingEntry, setEditingEntry] = useState<EmployeeAttendanceEntry | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    entry: EmployeeAttendanceEntry;
    reason: string;
  } | null>(null);

  // Batch action modals
  const [batchDeleteModal, setBatchDeleteModal] = useState<{
    reason: string;
  } | null>(null);

  const [batchUpdateModal, setBatchUpdateModal] = useState<{
    selectedShiftId: string; // Empty string means "don't change"
    breakMinutes: string;
    earlyInApproved: boolean;
    lateOutApproved: boolean;
    reason: string;
    reasonCode: string;
  } | null>(null);

  // Generate year options (current year and 2 years back)
  const currentYear = now.getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  // Load shift templates on mount
  useEffect(() => {
    const loadShifts = async () => {
      const shifts = await getShiftTemplates();
      setShiftTemplates(shifts as ShiftTemplate[]);
    };
    loadShifts();
  }, []);

  // Load leave balances when year changes
  useEffect(() => {
    const loadLeaveBalances = async () => {
      const result = await getEmployeeLeaveBalances(employeeId, selectedYear);
      if (result.success && result.balances) {
        setLeaveBalances(result.balances);
      }
    };
    loadLeaveBalances();
  }, [employeeId, selectedYear]);

  // Load attendance data when month/year changes
  useEffect(() => {
    loadAttendance();
  }, [selectedYear, selectedMonth, employeeId]);

  // Clear selection when exiting selection mode
  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedIds(new Set());
    }
  }, [isSelectionMode]);

  const loadAttendance = () => {
    setError(null);
    // Use noon UTC to avoid timezone boundary issues
    // For a month view, we want first day at 00:00 and last day at 23:59 in the target timezone
    // But since we compare as date strings (YYYY-MM-DD), we create dates at noon UTC
    // to ensure the ISO date string matches the intended date
    const startDate = new Date(Date.UTC(selectedYear, selectedMonth, 1, 12, 0, 0));
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate(); // Get last day of month
    const endDate = new Date(Date.UTC(selectedYear, selectedMonth, lastDay, 12, 0, 0));

    startTransition(async () => {
      const result = await getEmployeeAttendance(employeeId, startDate, endDate);
      if (result.success && result.data) {
        setEntries(result.data.entries);
        setSummary(result.data.summary);
      } else {
        setError(result.error || "Failed to load attendance");
        setEntries([]);
        setSummary(null);
      }
    });
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  // Selection handlers
  const toggleSelection = (entryId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    // Select ALL entries (including rest days, absences, etc.) for easy batch operations
    const allIds = entries.map(e => e.id);
    setSelectedIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const getSelectedEntries = () => {
    return entries.filter(e => selectedIds.has(e.id));
  };

  const openEditModal = (entry: EmployeeAttendanceEntry) => {
    setEditingEntry(entry);
  };

  // Map EmployeeAttendanceEntry to AttendanceRecordForEdit for the modal
  const mapEntryToRecord = (entry: EmployeeAttendanceEntry): AttendanceRecordForEdit => ({
    id: entry.id,
    date: entry.date,
    clockIn: entry.clockIn,
    clockOut: entry.clockOut,
    attendanceType: entry.attendanceType,
    dayType: entry.holidayType || (entry.attendanceType === "REST_DAY" ? "REST_DAY" : "REGULAR_WORKING_DAY"),
    scheduledStartTime: entry.scheduledStartTime,
    scheduledEndTime: entry.scheduledEndTime,
    breakMinutes: entry.breakMinutes,
    shiftBreakMinutes: entry.shiftBreakMinutes,
    dailyRateOverride: entry.dailyRateOverride,
    hasOverride: entry.hasOverride,
    override: entry.override ? {
      breakMinutesOverride: entry.override.breakMinutesOverride,
      earlyInApproved: entry.override.earlyInApproved,
      lateOutApproved: entry.override.lateOutApproved,
      dailyRateOverride: entry.override.dailyRateOverride ?? null,
      reason: entry.override.reason,
    } : undefined,
  });

  const openDeleteModal = (entry: EmployeeAttendanceEntry) => {
    setDeleteModal({
      entry,
      reason: "",
    });
  };

  const openBatchDeleteModal = () => {
    setBatchDeleteModal({ reason: "" });
  };

  const openBatchUpdateModal = () => {
    setBatchUpdateModal({
      selectedShiftId: "", // Empty = don't change shift
      breakMinutes: "",
      earlyInApproved: false,
      lateOutApproved: false,
      reason: "",
      reasonCode: "",
    });
  };

  // Helper to format shift time from Date to HH:mm string
  const formatShiftTime = (date: Date): string => {
    const d = new Date(date);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const handleSaveEdit = async (data: EditAttendanceData) => {
    if (!editingEntry) return;

    const dateStr = new Date(editingEntry.date).toISOString().split("T")[0];

    startTransition(async () => {
      const result = await updateAttendanceRecord({
        employeeId,
        date: dateStr,
        clockIn: data.clockIn,
        clockOut: data.clockOut,
        // Only pass shiftTemplateId if user selected a shift (non-empty string)
        shiftTemplateId: data.selectedShiftId || undefined,
        breakMinutes: data.breakMinutes,
        earlyInApproved: data.earlyInApproved,
        lateOutApproved: data.lateOutApproved,
        dailyRateOverride: data.dailyRateOverride,
        reason: data.reason,
        reasonCode: data.reasonCode,
      });

      if (result.success) {
        setEditingEntry(null);
        loadAttendance();
      } else {
        setError(result.error || "Failed to update attendance");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteModal) return;
    if (!deleteModal.reason.trim()) {
      setError("Please provide a reason for deletion");
      return;
    }

    const dateStr = new Date(deleteModal.entry.date).toISOString().split("T")[0];

    startTransition(async () => {
      const result = await deleteAttendanceRecord(employeeId, dateStr, deleteModal.reason);

      if (result.success) {
        setDeleteModal(null);
        loadAttendance();
      } else {
        setError(result.error || "Failed to delete attendance");
      }
    });
  };

  const handleBatchDelete = () => {
    if (!batchDeleteModal) return;
    if (!batchDeleteModal.reason.trim()) {
      setError("Please provide a reason for deletion");
      return;
    }

    const selectedEntries = getSelectedEntries();
    const dates = selectedEntries.map(e => new Date(e.date).toISOString().split("T")[0]);

    startTransition(async () => {
      const result = await batchDeleteAttendanceRecords(employeeId, dates, batchDeleteModal.reason);

      if (result.success) {
        setBatchDeleteModal(null);
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        loadAttendance();
      } else {
        setError(result.error || "Failed to delete attendance records");
      }
    });
  };

  const handleBatchUpdate = () => {
    if (!batchUpdateModal) return;
    if (!batchUpdateModal.reason.trim() && !batchUpdateModal.reasonCode) {
      setError("Please provide a reason for the change");
      return;
    }

    const selectedEntries = getSelectedEntries();
    const dates = selectedEntries.map(e => new Date(e.date).toISOString().split("T")[0]);

    const finalReason = batchUpdateModal.reasonCode && batchUpdateModal.reasonCode !== "Other"
      ? batchUpdateModal.reasonCode
      : batchUpdateModal.reason;

    startTransition(async () => {
      // Parse break minutes - empty string = undefined (no change), "0" = 0 (no break)
      const breakMinsValue = batchUpdateModal.breakMinutes !== "" ? parseInt(batchUpdateModal.breakMinutes) : undefined;

      const result = await batchUpdateAttendanceRecords({
        employeeId,
        dates,
        breakMinutes: !isNaN(breakMinsValue as number) ? breakMinsValue : undefined,
        // For batch: only pass true if checked, undefined otherwise (don't change existing)
        earlyInApproved: batchUpdateModal.earlyInApproved ? true : undefined,
        lateOutApproved: batchUpdateModal.lateOutApproved ? true : undefined,
        reason: finalReason,
        reasonCode: batchUpdateModal.reasonCode !== "Other" ? batchUpdateModal.reasonCode : undefined,
      });

      if (result.success) {
        setBatchUpdateModal(null);
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        loadAttendance();
      } else {
        setError(result.error || "Failed to update attendance records");
      }
    });
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      {/* Month/Year Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={goToPreviousMonth} disabled={isPending}>
                &larr; Prev
              </Button>

              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isPending}
                >
                  {MONTH_NAMES.map((month, index) => (
                    <option key={index} value={index}>
                      {month}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isPending}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <Button variant="outline" onClick={goToNextMonth} disabled={isPending}>
                Next &rarr;
              </Button>

              <Button variant="outline" onClick={goToCurrentMonth} disabled={isPending}>
                Today
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isPending && (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
              {canEdit && (
                <Button
                  variant={isSelectionMode ? "primary" : "outline"}
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  disabled={isPending}
                >
                  {isSelectionMode ? "Exit Selection" : "Select Multiple"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Batch Action Bar */}
      {isSelectionMode && selectedCount > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedCount} {selectedCount === 1 ? "entry" : "entries"} selected
                </span>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All ({entries.length})
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openBatchUpdateModal}
                  disabled={isPending}
                >
                  Batch Update
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={openBatchDeleteModal}
                  disabled={isPending}
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - based on imported attendance data */}
      {summary && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          <SummaryCard
            label="Work Days"
            value={summary.workingDays}
            suffix="days"
            color="blue"
          />
          <SummaryCard
            label="Present"
            value={summary.presentDays}
            total={summary.workingDays}
            color="green"
          />
          <SummaryCard
            label="Absent"
            value={summary.absentDays}
            total={summary.workingDays}
            color="red"
          />
          <SummaryCard
            label="Rest Days"
            value={summary.restDays}
            suffix="days"
            color="blue"
          />
          <SummaryCard
            label="Regular Holiday"
            value={summary.regularHolidayDays}
            suffix="days"
            color="purple"
          />
          <SummaryCard
            label="Special Holiday"
            value={summary.specialHolidayDays}
            suffix="days"
            color="purple"
          />
          <SummaryCard
            label="On Leave"
            value={summary.leaveDays}
            suffix="days"
            color="purple"
          />
          <SummaryCard
            label="Late/Undertime"
            value={summary.totalDeductionMinutes}
            suffix="mins"
            color="yellow"
          />
          <SummaryCard
            label="Overtime"
            value={summary.totalOvertimeMinutes}
            suffix="mins"
            color="green"
          />
        </div>
      )}

      {/* Leave Balance Section */}
      {leaveBalances.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Leave Balance ({selectedYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {leaveBalances.map((balance) => (
                <div
                  key={balance.id}
                  className="bg-gray-50 rounded-lg p-3 flex flex-col"
                >
                  <span className="text-xs text-gray-500 font-medium">
                    {balance.leaveTypeName}
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-semibold text-gray-900">
                      {balance.currentBalance}
                    </span>
                    <span className="text-xs text-gray-500">
                      / {balance.openingBalance + balance.carriedOverFromPrevious} days
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 mt-1">
                    Used: {balance.used} days
                  </span>
                </div>
              ))}
            </div>
            {leaveBalances.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-2">
                No leave balances for this year.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Attendance for {MONTH_NAMES[selectedMonth]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 && !isPending ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No attendance data imported for this period.</p>
              <p className="text-sm text-gray-400 mt-1">Import attendance from Lark to see records.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {isSelectionMode && (
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedCount === entries.length && entries.length > 0}
                          onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Day</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">
                      Shift
                      <span className="block text-xs font-normal text-gray-400">(Scheduled)</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Clock In</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Clock Out</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Hours</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">
                      Deduction
                      <span className="block text-xs font-normal text-gray-400">(Late + Early Out)</span>
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">
                      Overtime
                      <span className="block text-xs font-normal text-gray-400">(Early In + Late Out)</span>
                    </th>
                    {canEdit && !isSelectionMode && (
                      <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {entries.map((entry) => {
                    const isSelected = selectedIds.has(entry.id);

                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-gray-50 ${
                          entry.attendanceType === "REST_DAY" ? "bg-gray-50" : ""
                        } ${isSelected ? "bg-blue-50" : ""}`}
                        onClick={isSelectionMode ? () => toggleSelection(entry.id) : undefined}
                        style={isSelectionMode ? { cursor: "pointer" } : undefined}
                      >
                        {isSelectionMode && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(entry.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {entry.dayOfWeek.slice(0, 3)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {/* Don't show shift times for rest days, holidays, or no data */}
                          {entry.attendanceType === "REST_DAY" || entry.attendanceType === "REGULAR_HOLIDAY" || entry.attendanceType === "SPECIAL_HOLIDAY" || entry.attendanceType === "NO_DATA" ? (
                            <span className="text-gray-400">-</span>
                          ) : entry.scheduledStartTime && entry.scheduledEndTime ? (
                            <span className="flex items-center gap-1">
                              {entry.scheduledStartTime} - {entry.scheduledEndTime}
                              {entry.hasOverride && (entry.override?.shiftStartOverride || entry.override?.shiftEndOverride) && (
                                <span className="text-yellow-600" title="Shift overridden">*</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {entry.clockIn ? (
                            <span className={entry.isLate ? "text-red-600 font-medium" : "text-gray-900"}>
                              {formatTime(entry.clockIn)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {entry.clockOut ? (
                            <span className={entry.isUndertime ? "text-yellow-600 font-medium" : "text-gray-900"}>
                              {formatTime(entry.clockOut)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {entry.hoursWorked !== null ? (
                            <span>{entry.hoursWorked.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <AttendanceStatusBadge status={entry.attendanceType} holidayName={entry.holidayName} holidayType={entry.holidayType} />
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {entry.totalDeductionMinutes > 0 ? (
                            <span className="text-red-600" title={`${entry.lateMinutes}m late + ${entry.undertimeMinutes}m early out`}>
                              {formatMinutes(entry.totalDeductionMinutes)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {entry.totalOvertimeMinutes > 0 ? (() => {
                            const breakOt = entry.breakOtMinutes || 0;
                            const approvedOt = (entry.earlyInApproved ? entry.earlyInMinutes : 0)
                              + (entry.lateOutApproved ? entry.lateOutMinutes : 0)
                              + breakOt;
                            const pendingOt = (!entry.earlyInApproved ? entry.earlyInMinutes : 0)
                              + (!entry.lateOutApproved ? entry.lateOutMinutes : 0);
                            return (
                              <div className="space-y-0.5">
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
                              </div>
                            );
                          })() : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        {canEdit && !isSelectionMode && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditModal(entry)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit attendance"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(entry)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete attendance"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Attendance Modal - Using reusable component */}
      <EditAttendanceModal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        record={editingEntry ? mapEntryToRecord(editingEntry) : null}
        shiftTemplates={shiftTemplates}
        onSave={handleSaveEdit}
        isPending={isPending}
        formatDate={formatDate}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Attendance Record"
      >
        {deleteModal && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete the attendance record for{" "}
              <strong>{formatDate(deleteModal.entry.date)}</strong>?
            </p>

            {deleteModal.entry.clockIn && (
              <p className="text-sm text-gray-600">
                Clock In: {formatTime(deleteModal.entry.clockIn)}
              </p>
            )}
            {deleteModal.entry.clockOut && (
              <p className="text-sm text-gray-600">
                Clock Out: {formatTime(deleteModal.entry.clockOut)}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Deletion <span className="text-red-500">*</span>
              </label>
              <textarea
                value={deleteModal.reason}
                onChange={(e) => setDeleteModal({ ...deleteModal, reason: e.target.value })}
                placeholder="Enter reason for deleting this record..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={() => setDeleteModal(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={isPending}>
                Delete
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Batch Delete Modal */}
      <Modal
        isOpen={!!batchDeleteModal}
        onClose={() => setBatchDeleteModal(null)}
        title="Delete Multiple Attendance Records"
      >
        {batchDeleteModal && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{selectedCount}</strong> attendance {selectedCount === 1 ? "record" : "records"}?
            </p>

            <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
              {getSelectedEntries().map((entry) => (
                <div key={entry.id} className="text-sm text-gray-600 py-1">
                  {formatDate(entry.date)} - {formatTime(entry.clockIn)} to {formatTime(entry.clockOut)}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Deletion <span className="text-red-500">*</span>
              </label>
              <textarea
                value={batchDeleteModal.reason}
                onChange={(e) => setBatchDeleteModal({ ...batchDeleteModal, reason: e.target.value })}
                placeholder="Enter reason for deleting these records..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={() => setBatchDeleteModal(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleBatchDelete} loading={isPending}>
                Delete {selectedCount} {selectedCount === 1 ? "Record" : "Records"}
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Batch Update Modal */}
      <Modal
        isOpen={!!batchUpdateModal}
        onClose={() => setBatchUpdateModal(null)}
        title="Update Multiple Attendance Records"
        size="lg"
      >
        {batchUpdateModal && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Apply changes to <strong>{selectedCount}</strong> selected {selectedCount === 1 ? "record" : "records"}.
              Only filled fields will be updated.
            </p>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Shift Schedule Override</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Select Shift</label>
                  <select
                    value={batchUpdateModal.selectedShiftId}
                    onChange={(e) => {
                      const shiftId = e.target.value;
                      const shift = shiftTemplates.find(s => s.id === shiftId);
                      setBatchUpdateModal({
                        ...batchUpdateModal,
                        selectedShiftId: shiftId,
                        // Auto-fill break minutes from shift template
                        breakMinutes: shift ? shift.breakMinutes.toString() : batchUpdateModal.breakMinutes,
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Don&apos;t change shift --</option>
                    {shiftTemplates.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Break Override (mins)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={batchUpdateModal.breakMinutes}
                    onChange={(e) => setBatchUpdateModal({ ...batchUpdateModal, breakMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Leave empty to keep existing"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = no break (counts as additional OT)</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Overtime Approval</h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchUpdateModal.earlyInApproved}
                    onChange={(e) => setBatchUpdateModal({ ...batchUpdateModal, earlyInApproved: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-gray-700">Approve Early In OT</span>
                    <p className="text-xs text-gray-500">For all selected dates</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchUpdateModal.lateOutApproved}
                    onChange={(e) => setBatchUpdateModal({ ...batchUpdateModal, lateOutApproved: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-gray-700">Approve Late Out OT</span>
                    <p className="text-xs text-gray-500">For all selected dates</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Change <span className="text-red-500">*</span>
              </label>
              <select
                value={batchUpdateModal.reasonCode}
                onChange={(e) => setBatchUpdateModal({ ...batchUpdateModal, reasonCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 mb-2"
              >
                <option value="">Select a reason...</option>
                <option value="Approve overtime">Approve overtime</option>
                <option value="Shift schedule correction">Shift schedule correction (wrong Lark shift)</option>
                <option value="No break this day">No break this day (working lunch)</option>
                <option value="Import data correction">Import data correction</option>
                <option value="Other">Other (specify below)</option>
              </select>
              {batchUpdateModal.reasonCode === "Other" && (
                <textarea
                  placeholder="Please specify the reason..."
                  value={batchUpdateModal.reason}
                  onChange={(e) => setBatchUpdateModal({ ...batchUpdateModal, reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={() => setBatchUpdateModal(null)}>
                Cancel
              </Button>
              <Button onClick={handleBatchUpdate} loading={isPending}>
                Update {selectedCount} {selectedCount === 1 ? "Record" : "Records"}
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  total,
  suffix,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  suffix?: string;
  color: "green" | "red" | "purple" | "blue" | "yellow";
}) {
  const colorClasses = {
    green: "text-green-600",
    red: "text-red-600",
    purple: "text-purple-600",
    blue: "text-blue-600",
    yellow: "text-yellow-600",
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className={`text-2xl font-bold ${colorClasses[color]}`}>
          {value}
          {suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
          {total !== undefined && (
            <span className="text-sm font-normal text-gray-500">/{total}</span>
          )}
        </div>
        <div className="text-sm text-gray-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function AttendanceStatusBadge({
  status,
  holidayName,
  holidayType,
}: {
  status: "PRESENT" | "ABSENT" | "REST_DAY" | "ON_LEAVE" | "NO_DATA" | "HALF_DAY" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";
  holidayName?: string;
  holidayType?: "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY";
}) {
  const config: Record<string, { label: string; variant: "success" | "danger" | "warning" | "default" }> = {
    PRESENT: { label: "Present", variant: "success" },
    HALF_DAY: { label: "Half Day", variant: "warning" },
    ABSENT: { label: "Absent", variant: "danger" },
    REST_DAY: { label: "Rest Day", variant: "default" },
    ON_LEAVE: { label: "On Leave", variant: "warning" },
    REGULAR_HOLIDAY: { label: "Regular Holiday", variant: "default" },
    SPECIAL_HOLIDAY: { label: "Special Holiday", variant: "default" },
    NO_DATA: { label: "No Data", variant: "default" },
  };

  const { label, variant } = config[status] || { label: status, variant: "default" as const };

  // Worked on a holiday - show both Present badge and holiday info
  if ((status === "PRESENT" || status === "HALF_DAY") && holidayType && holidayName) {
    const holidayLabel = holidayType === "REGULAR_HOLIDAY" ? "Regular Holiday" : "Special Holiday";
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex gap-1">
          <Badge variant={variant}>{label}</Badge>
          <Badge variant="warning">{holidayLabel}</Badge>
        </div>
        <span className="text-xs text-gray-500">{holidayName}</span>
      </div>
    );
  }

  // Non-working holiday - show holiday name if available
  if ((status === "REGULAR_HOLIDAY" || status === "SPECIAL_HOLIDAY") && holidayName) {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-gray-500">{holidayName}</span>
      </div>
    );
  }

  return <Badge variant={variant}>{label}</Badge>;
}
