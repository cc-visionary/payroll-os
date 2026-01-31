"use client";

import { useState, useEffect } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatManilaTime } from "@/lib/utils/timezone";

// Common attendance record interface that works for both contexts
export interface AttendanceRecordForEdit {
  id: string;
  date: Date;
  clockIn: Date | null;
  clockOut: Date | null;
  attendanceType: string;
  dayType?: string;
  // Schedule info
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  // Break info
  breakMinutes: number;           // Effective break (may be overridden)
  shiftBreakMinutes: number;      // Original shift template break
  // Override info
  hasOverride?: boolean;
  override?: {
    breakMinutesOverride: number | null;
    earlyInApproved: boolean;
    lateOutApproved: boolean;
    reason: string;
  };
}

export interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
}

interface EditAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecordForEdit | null;
  shiftTemplates: ShiftTemplate[];
  onSave: (data: EditAttendanceData) => Promise<void>;
  isPending?: boolean;
  formatDate?: (date: Date) => string;
}

export interface EditAttendanceData {
  clockIn: string | null;
  clockOut: string | null;
  selectedShiftId: string;
  breakMinutes: number | null | undefined;
  earlyInApproved: boolean;
  lateOutApproved: boolean;
  reason: string;
  reasonCode: string | undefined;
}

interface ModalState {
  clockIn: string;
  clockOut: string;
  selectedShiftId: string;
  breakMinutes: string;
  useShiftBreak: boolean;
  reason: string;
  reasonCode: string;
  earlyInApproved: boolean;
  lateOutApproved: boolean;
}

// Use formatManilaTime from timezone utils for proper UTC to Manila conversion

function formatShiftTime(date: Date): string {
  const d = new Date(date);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
}

function formatDayType(dayType: string | undefined): string {
  if (!dayType) return "Work Day";
  const map: Record<string, string> = {
    REGULAR_WORKING_DAY: "Work Day",
    REST_DAY: "Rest Day",
    REGULAR_HOLIDAY: "Regular Holiday",
    SPECIAL_HOLIDAY: "Special Holiday",
  };
  return map[dayType] || dayType;
}

const defaultFormatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function EditAttendanceModal({
  isOpen,
  onClose,
  record,
  shiftTemplates,
  onSave,
  isPending = false,
  formatDate = defaultFormatDate,
}: EditAttendanceModalProps) {
  const [state, setState] = useState<ModalState>({
    clockIn: "",
    clockOut: "",
    selectedShiftId: "",
    breakMinutes: "60",
    useShiftBreak: true,
    reason: "",
    reasonCode: "",
    earlyInApproved: false,
    lateOutApproved: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Initialize state when record changes
  useEffect(() => {
    if (record) {
      const hasBreakOverride = record.override?.breakMinutesOverride !== null &&
                               record.override?.breakMinutesOverride !== undefined;
      setState({
        clockIn: formatManilaTime(record.clockIn),
        clockOut: formatManilaTime(record.clockOut),
        selectedShiftId: "",
        breakMinutes: hasBreakOverride
          ? record.override!.breakMinutesOverride!.toString()
          : record.shiftBreakMinutes.toString(),
        useShiftBreak: !hasBreakOverride,
        reason: record.override?.reason || "",
        reasonCode: "",
        earlyInApproved: record.override?.earlyInApproved || false,
        lateOutApproved: record.override?.lateOutApproved || false,
      });
      setError(null);
    }
  }, [record]);

  const handleSave = async () => {
    if (!state.reason.trim() && !state.reasonCode) {
      setError("Please provide a reason for the change");
      return;
    }
    setError(null);

    // Determine break minutes value
    let breakMinutesValue: number | null | undefined;
    if (state.useShiftBreak) {
      breakMinutesValue = null; // Reset to shift default
    } else {
      const parsed = parseInt(state.breakMinutes);
      breakMinutesValue = !isNaN(parsed) ? parsed : undefined;
    }

    const finalReason = state.reasonCode && state.reasonCode !== "Other"
      ? state.reasonCode
      : state.reason;

    await onSave({
      clockIn: state.clockIn || null,
      clockOut: state.clockOut || null,
      selectedShiftId: state.selectedShiftId,
      breakMinutes: breakMinutesValue,
      earlyInApproved: state.earlyInApproved,
      lateOutApproved: state.lateOutApproved,
      reason: finalReason,
      reasonCode: state.reasonCode !== "Other" ? state.reasonCode : undefined,
    });
  };

  if (!record) return null;

  const hasBreakOverride = record.override?.breakMinutesOverride !== null &&
                           record.override?.breakMinutesOverride !== undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Attendance - ${formatDate(record.date)}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Override Indicator */}
        {hasBreakOverride && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Has Override:</strong> No break this day
          </div>
        )}

        {/* Current Status Summary */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Status:</span>{" "}
              <span className="font-medium">{record.attendanceType.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-gray-500">Day Type:</span>{" "}
              <span className="font-medium">{formatDayType(record.dayType)}</span>
            </div>
          </div>
        </div>

        {/* Actual Time */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Actual Time</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Clock In</label>
              <input
                type="time"
                value={state.clockIn}
                onChange={(e) => setState({ ...state, clockIn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Clock Out</label>
              <input
                type="time"
                value={state.clockOut}
                onChange={(e) => setState({ ...state, clockOut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Shift Schedule Override */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Shift Schedule Override
            <span className="text-xs font-normal text-gray-500 ml-2">(Overwrite imported schedule if incorrect)</span>
          </h4>
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">
              Current: {record.scheduledStartTime || "N/A"} - {record.scheduledEndTime || "N/A"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Shift</label>
              <select
                value={state.selectedShiftId}
                onChange={(e) => {
                  const shiftId = e.target.value;
                  const shift = shiftTemplates.find(s => s.id === shiftId);
                  setState({
                    ...state,
                    selectedShiftId: shiftId,
                    breakMinutes: shift ? shift.breakMinutes.toString() : state.breakMinutes,
                    useShiftBreak: shift ? true : state.useShiftBreak,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Keep current shift --</option>
                {shiftTemplates.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Break Override (mins)</label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="useShiftBreak"
                  checked={state.useShiftBreak}
                  onChange={(e) => setState({
                    ...state,
                    useShiftBreak: e.target.checked,
                    breakMinutes: e.target.checked
                      ? record.shiftBreakMinutes.toString()
                      : state.breakMinutes
                  })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="useShiftBreak" className="text-sm text-gray-600">
                  Use shift default ({record.shiftBreakMinutes} mins)
                </label>
              </div>
              <input
                type="number"
                min="0"
                max="120"
                value={state.breakMinutes}
                onChange={(e) => setState({ ...state, breakMinutes: e.target.value, useShiftBreak: false })}
                disabled={state.useShiftBreak}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 ${
                  state.useShiftBreak ? "bg-gray-100 text-gray-500" : "bg-white text-gray-900"
                }`}
                placeholder="60"
              />
              <p className="text-xs text-gray-500 mt-1">
                {state.useShiftBreak
                  ? "Using shift template default"
                  : "0 = no break (reduces undertime by break amount)"}
              </p>
            </div>
          </div>
        </div>

        {/* Overtime Approval */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Overtime Approval</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={state.earlyInApproved}
                onChange={(e) => setState({ ...state, earlyInApproved: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700">Approve Early In OT</span>
                <p className="text-xs text-gray-500">Clock in before shift start counts as OT</p>
              </div>
            </label>
            <label className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={state.lateOutApproved}
                onChange={(e) => setState({ ...state, lateOutApproved: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700">Approve Late Out OT</span>
                <p className="text-xs text-gray-500">Clock out after shift end counts as OT</p>
              </div>
            </label>
          </div>
        </div>

        {/* Reason */}
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Change <span className="text-red-500">*</span>
          </label>
          <select
            value={state.reasonCode}
            onChange={(e) => setState({ ...state, reasonCode: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 mb-2"
          >
            <option value="">Select a reason...</option>
            <option value="Approve overtime">Approve overtime</option>
            <option value="Forgot to clock in/out">Forgot to clock in/out</option>
            <option value="Shift schedule correction">Shift schedule correction (wrong import)</option>
            <option value="No break this day">No break this day (working lunch)</option>
            <option value="System error correction">System error correction</option>
            <option value="Biometric malfunction">Biometric malfunction</option>
            <option value="Work from home">Work from home</option>
            <option value="Official business">Official business (fieldwork)</option>
            <option value="Import data correction">Import data correction</option>
            <option value="Other">Other (specify below)</option>
          </select>
          {state.reasonCode === "Other" && (
            <textarea
              placeholder="Please specify the reason..."
              value={state.reason}
              onChange={(e) => setState({ ...state, reason: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            />
          )}
          {error && (
            <p className="text-red-500 text-sm mt-1">{error}</p>
          )}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isPending}>
            Save Changes
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
