"use client";

import { useState, useEffect, use, useTransition } from "react";
import Link from "next/link";
import {
  getPayslipDetail,
  type PayslipDetail,
  type PayslipLineItem,
  type PayslipAttendanceRecord,
  type ManualAdjustmentItem,
} from "@/app/actions/payroll";
import {
  addManualAdjustment,
  updateManualAdjustment,
  deleteManualAdjustment,
} from "@/app/actions/payroll-compute";
import { updateAttendanceRecord } from "@/app/actions/attendance";
import { getShiftTemplates } from "@/app/actions/settings";
import { Badge } from "@/components/ui/badge";
import {
  EditAttendanceModal,
  AttendanceTable as ReusableAttendanceTable,
  type AttendanceRecordForEdit,
  type AttendanceRecord,
  type EditAttendanceData,
  type ShiftTemplate,
} from "@/components/attendance";

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

// Format rate with 4 decimal places for precise calculation display
function formatRate(rate: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(rate);
}

// Format date
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Format day type
function formatDayType(dayType: string): string {
  const labels: Record<string, string> = {
    WORKDAY: "Work Day",
    REST_DAY: "Rest Day",
    REGULAR_HOLIDAY: "Regular Holiday",
    SPECIAL_HOLIDAY: "Special Holiday",
  };
  return labels[dayType] || dayType;
}

// Format attendance status
function formatAttendanceStatus(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    PRESENT: { label: "Present", color: "bg-green-100 text-green-800" },
    ABSENT: { label: "Absent", color: "bg-red-100 text-red-800" },
    HALF_DAY: { label: "Half Day", color: "bg-yellow-100 text-yellow-800" },
    ON_LEAVE: { label: "On Leave", color: "bg-blue-100 text-blue-800" },
    REST_DAY: { label: "Rest Day", color: "bg-gray-100 text-gray-800" },
  };
  return statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800" };
}

// Format minutes (just show minutes, not hours+minutes)
function formatMinutesToHours(minutes: number): string {
  if (minutes === 0) return "-";
  return `${minutes}m`;
}

// Calculation breakdown component
function CalculationBreakdown({
  title,
  items,
  total,
  isDeduction = false,
}: {
  title: string;
  items: PayslipLineItem[];
  total: number;
  isDeduction?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <div className="px-6 py-4 text-gray-500 text-sm">No items</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="px-6 py-3 flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-900">{item.description}</div>
                {(item.quantity || item.rate || item.multiplier) && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.quantity && `${item.quantity} units`}
                    {item.quantity && item.rate && " × "}
                    {item.rate && formatRate(item.rate)}
                    {item.multiplier && item.multiplier !== 1 && ` × ${item.multiplier}x`}
                  </div>
                )}
              </div>
              <div className={`text-sm font-medium ${isDeduction ? "text-red-600" : "text-gray-900"}`}>
                {isDeduction ? "-" : ""}
                {formatCurrency(item.amount)}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
        <span className="font-medium text-gray-900">Total {title}</span>
        <span className={`font-bold ${isDeduction ? "text-red-600" : "text-gray-900"}`}>
          {isDeduction ? "-" : ""}
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

export default function PayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const { id, payslipId } = use(params);

  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"breakdown" | "attendance" | "commissions">("breakdown");
  const [isPending, startTransition] = useTransition();

  // Commission form state
  const [showAddCommission, setShowAddCommission] = useState(false);
  const [commissionForm, setCommissionForm] = useState({
    type: "EARNING" as "EARNING" | "DEDUCTION",
    description: "",
    amount: "",
  });
  const [editingCommission, setEditingCommission] = useState<ManualAdjustmentItem | null>(null);

  // Attendance editing state
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [editingRecord, setEditingRecord] = useState<PayslipAttendanceRecord | null>(null);

  const loadPayslip = async () => {
    setLoading(true);
    const result = await getPayslipDetail(id, payslipId);
    if (result.success && result.payslip) {
      setPayslip(result.payslip);
    } else {
      setError(result.error || "Failed to load payslip");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPayslip();
  }, [id, payslipId]);

  // Load shift templates on mount
  useEffect(() => {
    const loadShifts = async () => {
      const shifts = await getShiftTemplates();
      setShiftTemplates(shifts as ShiftTemplate[]);
    };
    loadShifts();
  }, []);

  // Commission handlers
  const handleAddCommission = () => {
    if (!payslip || !commissionForm.description || !commissionForm.amount) return;

    startTransition(async () => {
      const result = await addManualAdjustment({
        payrollRunId: payslip.payrollRunId,
        employeeId: payslip.employee.id,
        type: commissionForm.type,
        description: commissionForm.description,
        amount: parseFloat(commissionForm.amount),
      });

      if (result.success) {
        setCommissionForm({ type: "EARNING", description: "", amount: "" });
        setShowAddCommission(false);
        loadPayslip();
      } else {
        setError(result.error || "Failed to add commission");
      }
    });
  };

  const handleUpdateCommission = () => {
    if (!editingCommission || !commissionForm.description || !commissionForm.amount) return;

    startTransition(async () => {
      const result = await updateManualAdjustment(editingCommission.id, {
        type: commissionForm.type,
        description: commissionForm.description,
        amount: parseFloat(commissionForm.amount),
      });

      if (result.success) {
        setCommissionForm({ type: "EARNING", description: "", amount: "" });
        setEditingCommission(null);
        loadPayslip();
      } else {
        setError(result.error || "Failed to update commission");
      }
    });
  };

  const handleDeleteCommission = (commissionId: string) => {
    if (!confirm("Are you sure you want to delete this commission?")) return;

    startTransition(async () => {
      const result = await deleteManualAdjustment(commissionId);

      if (result.success) {
        loadPayslip();
      } else {
        setError(result.error || "Failed to delete commission");
      }
    });
  };

  const startEditCommission = (commission: ManualAdjustmentItem) => {
    setEditingCommission(commission);
    setCommissionForm({
      type: commission.type,
      description: commission.description,
      amount: commission.amount.toString(),
    });
  };

  const cancelEdit = () => {
    setEditingCommission(null);
    setShowAddCommission(false);
    setCommissionForm({ type: "EARNING", description: "", amount: "" });
  };

  // Map PayslipAttendanceRecord to AttendanceRecord for the table
  const mapToAttendanceRecord = (record: PayslipAttendanceRecord): AttendanceRecord => {
    const hasBreakOverride = record.breakMinutesApplied !== null;

    // Use the server-computed attendanceStatus directly (already includes proper priority logic)
    // The server now applies: Time logs > Approved Leave > Holiday > Record dayType > Default
    const attendanceType = record.attendanceStatus as "PRESENT" | "ABSENT" | "REST_DAY" | "REGULAR_HOLIDAY" | "SPECIAL_HOLIDAY" | "ON_LEAVE" | "HALF_DAY" | "NO_DATA";

    return {
      id: record.id,
      date: record.date,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      clockIn: record.actualTimeIn,
      clockOut: record.actualTimeOut,
      hoursWorked: record.workedMinutes > 0 ? record.workedMinutes / 60 : null,
      workedMinutes: record.workedMinutes,
      attendanceType,
      dayType: record.dayType,
      holidayName: record.holidayName || undefined,
      // Use the holidayType from server (from calendar events or record's holiday relation)
      holidayType: record.holidayType || undefined,
      // Include leave type name from approved leave requests
      leaveTypeName: record.leaveTypeName || undefined,
      lateMinutes: record.lateMinutes,
      undertimeMinutes: record.undertimeMinutes,
      otEarlyInMinutes: record.otEarlyInMinutes,
      otLateOutMinutes: record.otLateOutMinutes,
      otRestDayMinutes: record.otRestDayMinutes,
      otHolidayMinutes: record.otHolidayMinutes,
      isOtApproved: record.isOtApproved,
      earlyInApproved: record.earlyInApproved,
      lateOutApproved: record.lateOutApproved,
      nightDiffMinutes: record.nightDiffMinutes,
      breakMinutes: record.breakMinutes,
      shiftBreakMinutes: record.shiftBreakMinutes,
      dailyRateOverride: record.dailyRateOverride ?? null,
      hasOverride: hasBreakOverride || record.earlyInApproved || record.lateOutApproved || record.dailyRateOverride != null,
      override: hasBreakOverride || record.earlyInApproved || record.lateOutApproved || record.dailyRateOverride != null ? {
        breakMinutesOverride: record.breakMinutesApplied,
        earlyInApproved: record.earlyInApproved,
        lateOutApproved: record.lateOutApproved,
        dailyRateOverride: record.dailyRateOverride ?? null,
        reason: "",
      } : undefined,
    };
  };

  // Map PayslipAttendanceRecord to AttendanceRecordForEdit for the modal
  const mapRecordForEdit = (record: PayslipAttendanceRecord): AttendanceRecordForEdit => {
    const hasBreakOverride = record.breakMinutesApplied !== null;
    const hasAnyOverride = hasBreakOverride || record.earlyInApproved || record.lateOutApproved || record.dailyRateOverride != null;
    return {
      id: record.id,
      date: record.date,
      clockIn: record.actualTimeIn,
      clockOut: record.actualTimeOut,
      attendanceType: record.attendanceStatus,
      dayType: record.dayType,
      scheduledStartTime: record.scheduledStart,
      scheduledEndTime: record.scheduledEnd,
      breakMinutes: record.breakMinutes,
      shiftBreakMinutes: record.shiftBreakMinutes,
      dailyRateOverride: record.dailyRateOverride ?? null,
      hasOverride: hasAnyOverride,
      override: hasAnyOverride ? {
        breakMinutesOverride: record.breakMinutesApplied,
        earlyInApproved: record.earlyInApproved,
        lateOutApproved: record.lateOutApproved,
        dailyRateOverride: record.dailyRateOverride ?? null,
        reason: "",
      } : undefined,
    };
  };

  // Handle edit from the reusable table (find original PayslipAttendanceRecord)
  const handleTableEdit = (record: AttendanceRecord) => {
    const originalRecord = payslip?.attendance.find(r => r.id === record.id);
    if (originalRecord) {
      setEditingRecord(originalRecord);
    }
  };

  const handleSaveAttendanceEdit = async (data: EditAttendanceData) => {
    if (!editingRecord || !payslip) return;

    const dateStr = new Date(editingRecord.date).toISOString().split("T")[0];

    const result = await updateAttendanceRecord({
      employeeId: payslip.employee.id,
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
      setEditingRecord(null);
      loadPayslip(); // Reload to get updated attendance
    } else {
      setError(result.error || "Failed to update attendance");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading payslip...</div>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-500">
          {error || "Payslip not found"}
        </div>
      </div>
    );
  }

  // Calculate monthly rate for display (for daily rate: daily × 26)
  const monthlyRate = payslip.payProfileSnapshot
    ? payslip.payProfileSnapshot.wageType === "DAILY"
      ? payslip.payProfileSnapshot.baseRate * 26
      : payslip.payProfileSnapshot.baseRate
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-800 hover:underline text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1 text-sm">
          <Link href="/payroll" className="text-gray-500 hover:text-gray-700">
            Payroll Runs
          </Link>
          <span className="text-gray-400">/</span>
          <Link href={`/payroll/${id}`} className="text-gray-500 hover:text-gray-700">
            {payslip.payPeriod.code}
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-700">Payslip</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {payslip.employee.lastName}, {payslip.employee.firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {payslip.employee.employeeNumber}
          {payslip.employee.jobTitle && ` • ${payslip.employee.jobTitle}`}
          {payslip.employee.department && ` • ${payslip.employee.department}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Gross Pay</div>
          <div className="text-xl font-bold text-gray-900 mt-1">
            {formatCurrency(payslip.grossPay)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Deductions</div>
          <div className="text-xl font-bold text-red-600 mt-1">
            -{formatCurrency(payslip.totalDeductions)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Net Pay</div>
          <div className="text-xl font-bold text-green-600 mt-1">
            {formatCurrency(payslip.netPay)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pay Period</div>
          <div className="text-sm font-medium text-gray-900 mt-1">
            {formatDate(payslip.payPeriod.startDate)} - {formatDate(payslip.payPeriod.endDate)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Pay Date: {formatDate(payslip.payPeriod.payDate)}
          </div>
        </div>
      </div>

      {/* Pay Profile Info */}
      {payslip.payProfileSnapshot && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-blue-800">
            <strong>Rate:</strong>{" "}
            {payslip.payProfileSnapshot.wageType === "DAILY" ? (
              <>
                {formatCurrency(payslip.payProfileSnapshot.baseRate)}/day
                <span className="text-blue-600 ml-1">
                  (Monthly: {formatCurrency(monthlyRate)} = daily × 26 days)
                </span>
              </>
            ) : payslip.payProfileSnapshot.wageType === "HOURLY" ? (
              <>
                {formatCurrency(payslip.payProfileSnapshot.baseRate)}/hour
              </>
            ) : (
              <>
                {formatCurrency(payslip.payProfileSnapshot.baseRate)}/month
              </>
            )}
            {" • "}
            <strong>Pay Frequency:</strong> {payslip.payProfileSnapshot.payFrequency.replace("_", "-").toLowerCase()}
          </div>
          {/* Derived Rates */}
          {payslip.derivedRates && (
            <div className="text-xs text-blue-600 mt-2 flex gap-4">
              <span>
                <strong>Daily:</strong> {formatCurrency(payslip.derivedRates.dailyRate)}
              </span>
              <span>
                <strong>Hourly:</strong> {formatCurrency(payslip.derivedRates.hourlyRate)}
              </span>
              <span>
                <strong>Minute:</strong> ₱{payslip.derivedRates.minuteRate.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "breakdown"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Calculation Breakdown
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "attendance"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Daily Attendance ({payslip.attendance.length})
          </button>
          <button
            onClick={() => setActiveTab("commissions")}
            className={`py-3 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "commissions"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Commissions & Adjustments ({payslip.manualAdjustments.length})
          </button>
        </nav>
      </div>

      {/* Breakdown Tab */}
      {activeTab === "breakdown" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings */}
            <CalculationBreakdown
              title="Earnings"
              items={payslip.earnings}
              total={payslip.totalEarnings}
            />

            {/* Deductions */}
            <CalculationBreakdown
              title="Deductions"
              items={payslip.deductions}
              total={payslip.totalDeductions}
              isDeduction
            />
          </div>

          {/* Statutory Breakdown */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Statutory Contributions</h3>
              <p className="text-xs text-gray-500 mt-1">
                Based on monthly rate of {formatCurrency(monthlyRate)}
                {payslip.payProfileSnapshot?.wageType === "DAILY" && " (daily × 26 days)"}
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-gray-500 mb-2">SSS</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employee</span>
                      <span className="font-medium">{formatCurrency(payslip.sssEe)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employer</span>
                      <span className="font-medium text-gray-500">{formatCurrency(payslip.sssEr)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">PhilHealth</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employee</span>
                      <span className="font-medium">{formatCurrency(payslip.philhealthEe)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employer</span>
                      <span className="font-medium text-gray-500">{formatCurrency(payslip.philhealthEr)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Pag-IBIG</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employee</span>
                      <span className="font-medium">{formatCurrency(payslip.pagibigEe)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employer</span>
                      <span className="font-medium text-gray-500">{formatCurrency(payslip.pagibigEr)}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-2">Withholding Tax</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax Due</span>
                    <span className="font-medium">{formatCurrency(payslip.withholdingTax)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* YTD Summary */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Year-to-Date Summary</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-500">YTD Gross Pay</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {formatCurrency(payslip.ytdGrossPay)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">YTD Taxable Income</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {formatCurrency(payslip.ytdTaxableIncome)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">YTD Tax Withheld</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {formatCurrency(payslip.ytdTaxWithheld)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === "attendance" && (
        <ReusableAttendanceTable
          records={payslip.attendance.map(mapToAttendanceRecord)}
          variant="payslip"
          canEdit={payslip.canEdit}
          onEdit={handleTableEdit}
        />
      )}

      {/* Commissions Tab */}
      {activeTab === "commissions" && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-900">Commissions & Manual Adjustments</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add commissions, incentives, or other manual adjustments for this pay period.
              </p>
            </div>
            {payslip.canEdit && !showAddCommission && !editingCommission && (
              <button
                onClick={() => setShowAddCommission(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Item
              </button>
            )}
          </div>

          {/* Add/Edit Form */}
          {(showAddCommission || editingCommission) && payslip.canEdit && (
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    value={commissionForm.type}
                    onChange={(e) => setCommissionForm({ ...commissionForm, type: e.target.value as "EARNING" | "DEDUCTION" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="EARNING">Earning (+)</option>
                    <option value="DEDUCTION">Deduction (-)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <input
                    type="text"
                    value={commissionForm.description}
                    onChange={(e) => setCommissionForm({ ...commissionForm, description: e.target.value })}
                    placeholder="e.g., Sales Commission - January"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={commissionForm.amount}
                    onChange={(e) => setCommissionForm({ ...commissionForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={editingCommission ? handleUpdateCommission : handleAddCommission}
                  disabled={isPending || !commissionForm.description || !commissionForm.amount}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Saving..." : editingCommission ? "Update" : "Add"}
                </button>
              </div>
            </div>
          )}

          {/* Commissions Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Added
                  </th>
                  {payslip.canEdit && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payslip.manualAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={payslip.canEdit ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                      No commissions or adjustments added yet.
                      {payslip.canEdit && " Click \"Add Item\" to add one."}
                    </td>
                  </tr>
                ) : (
                  payslip.manualAdjustments.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          item.type === "EARNING"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {item.type === "EARNING" ? "Earning" : "Deduction"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{item.description}</div>
                        {item.remarks && (
                          <div className="text-xs text-gray-500">{item.remarks}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          item.type === "EARNING" ? "text-green-600" : "text-red-600"
                        }`}>
                          {item.type === "DEDUCTION" ? "-" : ""}
                          {formatCurrency(item.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                      {payslip.canEdit && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEditCommission(item)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                              disabled={isPending}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteCommission(item.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                              disabled={isPending}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {payslip.manualAdjustments.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-6 py-3 text-sm font-medium text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(
                          payslip.manualAdjustments.reduce((sum, item) =>
                            sum + (item.type === "EARNING" ? item.amount : -item.amount), 0
                          )
                        )}
                      </span>
                    </td>
                    <td colSpan={payslip.canEdit ? 2 : 1}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Note */}
          {!payslip.canEdit && (
            <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-700">
              <strong>Note:</strong> This payroll run is finalized. Commissions can no longer be edited.
              To make changes, the payroll must be reopened.
            </div>
          )}
        </div>
      )}

      {/* Back button */}
      <div className="mt-6">
        <Link
          href={`/payroll/${id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Payroll Run
        </Link>
      </div>

      {/* Edit Attendance Modal */}
      {/* Edit Attendance Modal */}
      <EditAttendanceModal
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        record={editingRecord ? mapRecordForEdit(editingRecord) : null}
        shiftTemplates={shiftTemplates}
        onSave={handleSaveAttendanceEdit}
        isPending={isPending}
        formatDate={formatDate}
      />
    </div>
  );
}
