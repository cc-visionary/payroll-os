"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getPayrollRunDetail,
  getPayrollRunPayslips,
  getPayrollRunDiff,
  approvePayroll,
  releasePayroll,
  cancelPayrollRun,
  type PayrollRunDetail,
  type PayslipListItem,
  type PayrollDiffSummary,
} from "@/app/actions/payroll";
import { runPayrollComputation } from "@/app/actions/payroll-compute";
import { generatePayslipPDFZipExport } from "@/app/actions/payroll-exports";
import type { PayrollRunStatus } from "@/app/generated/prisma";

// Status badge colors
const statusColors: Record<PayrollRunStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  COMPUTING: "bg-blue-100 text-blue-800 animate-pulse",
  REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  RELEASED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusLabels: Record<PayrollRunStatus, string> = {
  DRAFT: "Draft",
  COMPUTING: "Computing...",
  REVIEW: "In Review",
  APPROVED: "Approved",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

// Status Timeline Component
function PayrollStatusTimeline({
  status,
  createdAt,
  approvedAt,
  releasedAt,
}: {
  status: PayrollRunStatus;
  createdAt: Date;
  approvedAt?: Date | null;
  releasedAt?: Date | null;
}) {
  const steps = [
    {
      label: "Created",
      stepStatus: "completed" as const,
      date: createdAt,
    },
    {
      label: "Computed",
      stepStatus: (status !== "DRAFT" ? "completed" : "pending") as "completed" | "current" | "pending",
      date: status !== "DRAFT" ? createdAt : null, // Use createdAt as proxy since we don't track computedAt
    },
    {
      label: "Approved",
      stepStatus: (["APPROVED", "RELEASED"].includes(status)
        ? "completed"
        : status === "REVIEW"
        ? "current"
        : "pending") as "completed" | "current" | "pending",
      date: approvedAt,
    },
    {
      label: "Released",
      stepStatus: (status === "RELEASED"
        ? "completed"
        : status === "APPROVED"
        ? "current"
        : "pending") as "completed" | "current" | "pending",
      date: releasedAt,
    },
  ];

  // Don't show timeline for cancelled status
  if (status === "CANCELLED") {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.stepStatus === "completed"
                    ? "bg-green-500 text-white"
                    : step.stepStatus === "current"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step.stepStatus === "completed" ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-xs font-medium mt-1.5 text-gray-700">{step.label}</span>
              <span className="text-xs text-gray-400">
                {step.date ? formatShortDate(step.date) : "Pending"}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded ${
                  step.stepStatus === "completed" ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffIndicator({ value, percent }: { value: number; percent: number }) {
  if (value === 0) return <span className="text-gray-500">-</span>;

  const isPositive = value > 0;
  const color = isPositive ? "text-green-600" : "text-red-600";
  const arrow = isPositive ? "+" : "";

  return (
    <span className={color}>
      {arrow}
      {formatCurrency(value)} ({arrow}
      {percent.toFixed(1)}%)
    </span>
  );
}

export default function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [payslips, setPayslips] = useState<PayslipListItem[]>([]);
  const [diff, setDiff] = useState<PayrollDiffSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"summary" | "payslips" | "comparison">(
    "summary"
  );

  // Payslip search
  const [payslipSearch, setPayslipSearch] = useState("");

  // Confirmation dialogs
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Pre-approval checklist state
  const [checklistItems, setChecklistItems] = useState({
    employeeCountVerified: false,
    attendanceVerified: false,
    variancesReviewed: false,
  });

  const allChecklistItemsChecked = Object.values(checklistItems).every(Boolean);

  // Reset checklist when dialog closes
  const handleApproveDialogChange = (open: boolean) => {
    setShowApproveDialog(open);
    if (!open) {
      setChecklistItems({
        employeeCountVerified: false,
        attendanceVerified: false,
        variancesReviewed: false,
      });
    }
  };

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true);

      const [detailResult, payslipsResult, diffResult] = await Promise.all([
        getPayrollRunDetail(id),
        getPayrollRunPayslips(id),
        getPayrollRunDiff(id),
      ]);

      if (detailResult.success && detailResult.detail) {
        setDetail(detailResult.detail);
      } else {
        setError(detailResult.error || "Failed to load payroll run");
      }

      if (payslipsResult.success && payslipsResult.payslips) {
        setPayslips(payslipsResult.payslips);
      }

      if (diffResult.success && diffResult.diff) {
        setDiff(diffResult.diff);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  // Refresh polling for computing status
  useEffect(() => {
    if (detail?.status === "COMPUTING") {
      const interval = setInterval(async () => {
        const result = await getPayrollRunDetail(id);
        if (result.success && result.detail) {
          setDetail(result.detail);
          if (result.detail.status !== "COMPUTING") {
            // Reload payslips when computation completes
            const payslipsResult = await getPayrollRunPayslips(id);
            if (payslipsResult.success && payslipsResult.payslips) {
              setPayslips(payslipsResult.payslips);
            }
            const diffResult = await getPayrollRunDiff(id);
            if (diffResult.success && diffResult.diff) {
              setDiff(diffResult.diff);
            }
          }
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [detail?.status, id]);

  const handleCompute = async () => {
    setActionPending(true);
    const result = await runPayrollComputation(id);
    if (result.success) {
      // Reload detail
      const detailResult = await getPayrollRunDetail(id);
      if (detailResult.success && detailResult.detail) {
        setDetail(detailResult.detail);
      }
    } else {
      setError(result.error || "Failed to compute payroll");
    }
    setActionPending(false);
  };

  const handleApprove = async () => {
    setActionPending(true);
    const result = await approvePayroll(id);
    if (result.success) {
      const detailResult = await getPayrollRunDetail(id);
      if (detailResult.success && detailResult.detail) {
        setDetail(detailResult.detail);
      }
      setShowApproveDialog(false);
    } else {
      setError(result.error || "Failed to approve payroll");
    }
    setActionPending(false);
  };

  const handleRelease = async () => {
    setActionPending(true);
    const result = await releasePayroll(id);
    if (result.success) {
      const detailResult = await getPayrollRunDetail(id);
      if (detailResult.success && detailResult.detail) {
        setDetail(detailResult.detail);
      }
      setShowReleaseDialog(false);
    } else {
      setError(result.error || "Failed to release payroll");
    }
    setActionPending(false);
  };

  const handleCancel = async () => {
    setActionPending(true);
    const result = await cancelPayrollRun(id, cancelReason);
    if (result.success) {
      router.push("/payroll");
    } else {
      setError(result.error || "Failed to cancel payroll run");
    }
    setActionPending(false);
  };

  const handleExportPayslips = async () => {
    setActionPending(true);
    setError(null);
    const result = await generatePayslipPDFZipExport(id);
    if (result.success && result.downloadUrl) {
      // Trigger download
      window.open(result.downloadUrl, "_blank");
    } else {
      setError(result.error || "Failed to export payslips");
    }
    setActionPending(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-500">
          {error || "Payroll run not found"}
        </div>
      </div>
    );
  }

  const filteredPayslips = payslipSearch
    ? payslips.filter(
        (p) =>
          p.employeeName.toLowerCase().includes(payslipSearch.toLowerCase()) ||
          p.employeeNumber.toLowerCase().includes(payslipSearch.toLowerCase())
      )
    : payslips;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/payroll"
              className="text-gray-500 hover:text-gray-700"
            >
              Payroll Runs
            </Link>
            <span className="text-gray-400">/</span>
            <span className="font-medium">{detail.payPeriod.code}</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {detail.payPeriod.code}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(detail.payPeriod.startDate)} -{" "}
            {formatDate(detail.payPeriod.endDate)} | Pay Date:{" "}
            {formatDate(detail.payPeriod.payDate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded-full ${statusColors[detail.status]}`}
          >
            {statusLabels[detail.status]}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Timeline */}
      <PayrollStatusTimeline
        status={detail.status}
        createdAt={detail.workflow.createdAt}
        approvedAt={detail.workflow.approvedAt}
        releasedAt={detail.workflow.releasedAt}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        {detail.status === "DRAFT" && (
          <button
            onClick={handleCompute}
            disabled={actionPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {actionPending ? "Computing..." : "Compute Payroll"}
          </button>
        )}
        {detail.status === "REVIEW" && (
          <>
            <button
              onClick={handleCompute}
              disabled={actionPending}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Recompute
            </button>
            {detail.canApprove ? (
              <button
                onClick={() => handleApproveDialogChange(true)}
                disabled={actionPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
            ) : detail.isCreator ? (
              <span className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                Cannot self-approve (created by you)
              </span>
            ) : null}
          </>
        )}
        {detail.status === "APPROVED" && detail.canRelease && (
          <button
            onClick={() => setShowReleaseDialog(true)}
            disabled={actionPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            Release
          </button>
        )}
        {["DRAFT", "REVIEW"].includes(detail.status) && (
          <button
            onClick={() => setShowCancelDialog(true)}
            disabled={actionPending}
            className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Cancel Run
          </button>
        )}
        {["APPROVED", "RELEASED"].includes(detail.status) && (
          <button
            onClick={handleExportPayslips}
            disabled={actionPending}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {actionPending ? "Exporting..." : "Export Payslips"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {(["summary", "payslips", "comparison"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "summary" && "Summary"}
              {tab === "payslips" && `Payslips (${payslips.length})`}
              {tab === "comparison" && "Comparison"}
            </button>
          ))}
        </nav>
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Totals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Payroll Totals</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-600">Employees</dt>
                <dd className="font-medium text-gray-900">{detail.totals.employeeCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Gross Pay</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(detail.totals.grossPay)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Total Deductions</dt>
                <dd className="font-medium text-red-600">
                  -{formatCurrency(detail.totals.deductions)}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-3">
                <dt className="text-gray-900 font-medium">Total Net Pay</dt>
                <dd className="font-bold text-lg text-gray-900">
                  {formatCurrency(detail.totals.netPay)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Statutory Totals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Statutory Contributions
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-600">SSS (EE / ER)</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(detail.statutory.totalSssEe)} /{" "}
                  {formatCurrency(detail.statutory.totalSssEr)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">PhilHealth (EE / ER)</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(detail.statutory.totalPhilhealthEe)} /{" "}
                  {formatCurrency(detail.statutory.totalPhilhealthEr)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Pag-IBIG (EE / ER)</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(detail.statutory.totalPagibigEe)} /{" "}
                  {formatCurrency(detail.statutory.totalPagibigEr)}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-3">
                <dt className="text-gray-600">Withholding Tax</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(detail.statutory.totalWithholdingTax)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Workflow */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Workflow</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-600">Created</dt>
                <dd className="text-sm text-gray-900">
                  <div>{formatDateTime(detail.workflow.createdAt)}</div>
                  {detail.workflow.createdBy && (
                    <div className="text-gray-500">
                      by {detail.workflow.createdBy}
                    </div>
                  )}
                </dd>
              </div>
              {detail.workflow.approvedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Approved</dt>
                  <dd className="text-sm text-gray-900">
                    <div>{formatDateTime(detail.workflow.approvedAt)}</div>
                    {detail.workflow.approvedBy && (
                      <div className="text-gray-500">
                        by {detail.workflow.approvedBy}
                      </div>
                    )}
                  </dd>
                </div>
              )}
              {detail.workflow.releasedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">Released</dt>
                  <dd className="text-sm text-gray-900">
                    {formatDateTime(detail.workflow.releasedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Flags */}
          {diff && Object.values(diff.flags).some(Boolean) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Review Flags
              </h3>
              <ul className="space-y-2">
                {diff.flags.hasLargeIncrease && (
                  <li className="flex items-center gap-2 text-yellow-800">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Large increase from previous period (&gt;10%)
                  </li>
                )}
                {diff.flags.hasLargeDecrease && (
                  <li className="flex items-center gap-2 text-yellow-800">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Large decrease from previous period (&gt;10%)
                  </li>
                )}
                {diff.flags.hasNewEmployees && (
                  <li className="flex items-center gap-2 text-blue-800">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    {diff.changes.newEmployees} new employee(s) in this run
                  </li>
                )}
                {diff.flags.hasRemovedEmployees && (
                  <li className="flex items-center gap-2 text-orange-800">
                    <span className="w-2 h-2 bg-orange-500 rounded-full" />
                    {diff.changes.removedEmployees} employee(s) no longer in
                    payroll
                  </li>
                )}
                {diff.flags.hasMissingAttendance && (
                  <li className="flex items-center gap-2 text-red-800">
                    <span className="w-2 h-2 bg-red-500 rounded-full" />
                    Some employees have missing attendance records
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Payslips Tab */}
      {activeTab === "payslips" && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search employees..."
              value={payslipSearch}
              onChange={(e) => setPayslipSearch(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross Pay
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deductions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Pay
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayslips.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {payslipSearch
                      ? "No employees found"
                      : "No payslips computed yet"}
                  </td>
                </tr>
              ) : (
                filteredPayslips.map((ps) => (
                  <tr key={ps.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {ps.employeeName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ps.employeeNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {ps.department || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {formatCurrency(ps.grossPay)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                      -{formatCurrency(ps.totalDeductions)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      {formatCurrency(ps.netPay)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link
                        href={`/payroll/${id}/payslip/${ps.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparison Tab */}
      {activeTab === "comparison" && diff && (
        <div className="space-y-6">
          {/* Previous Run Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Comparison with Previous Run
            </h3>
            {diff.previousRun ? (
              <p className="text-sm text-gray-600 mb-4">
                Comparing with {diff.previousRun.payPeriodCode} (
                {formatDate(diff.previousRun.startDate)} -{" "}
                {formatDate(diff.previousRun.endDate)})
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                No previous payroll run found for comparison
              </p>
            )}

            {diff.previousRun && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Gross Pay</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(diff.totals.currentGrossPay)}
                  </div>
                  <div className="text-sm mt-1">
                    <DiffIndicator
                      value={diff.totals.grossPayDiff}
                      percent={diff.totals.grossPayDiffPercent}
                    />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">Net Pay</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(diff.totals.currentNetPay)}
                  </div>
                  <div className="text-sm mt-1">
                    <DiffIndicator
                      value={diff.totals.netPayDiff}
                      percent={diff.totals.netPayDiffPercent}
                    />
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">
                    Employee Changes
                  </div>
                  <div className="text-sm space-y-1 mt-2">
                    <div className="text-blue-600">
                      +{diff.changes.newEmployees} new
                    </div>
                    <div className="text-orange-600">
                      -{diff.changes.removedEmployees} removed
                    </div>
                    <div className="text-yellow-600">
                      {diff.changes.changedEmployees} changed ({">"}5%)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Link to detailed comparison */}
          <div className="text-center">
            <Link
              href={`/payroll/${id}/comparison`}
              className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800"
            >
              View detailed employee-by-employee comparison
              <svg
                className="ml-2 w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Approve Dialog with Pre-Approval Checklist */}
      {showApproveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Approve Payroll
            </h2>

            {/* Pre-Approval Checklist */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Before approving, please verify:
              </p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistItems.employeeCountVerified}
                    onChange={(e) =>
                      setChecklistItems((prev) => ({
                        ...prev,
                        employeeCountVerified: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-600">
                    Employee count ({detail.totals.employeeCount}) matches expected
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistItems.attendanceVerified}
                    onChange={(e) =>
                      setChecklistItems((prev) => ({
                        ...prev,
                        attendanceVerified: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-600">
                    No missing attendance records
                    {diff?.flags.hasMissingAttendance && (
                      <span className="ml-1 text-red-600 font-medium">(Warning: some missing!)</span>
                    )}
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistItems.variancesReviewed}
                    onChange={(e) =>
                      setChecklistItems((prev) => ({
                        ...prev,
                        variancesReviewed: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-600">
                    Reviewed employees with large variances (&gt;10% change)
                    {(diff?.flags.hasLargeIncrease || diff?.flags.hasLargeDecrease) && (
                      <span className="ml-1 text-yellow-600 font-medium">(Variances detected)</span>
                    )}
                  </span>
                </label>
              </div>
            </div>

            {/* Warning Note */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Note:</span> Approving will lock all attendance
                records for this period and freeze payslip computations.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleApproveDialogChange(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionPending || !allChecklistItemsChecked}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionPending ? "Approving..." : "Approve"}
              </button>
            </div>

            {!allChecklistItemsChecked && (
              <p className="text-xs text-gray-500 text-right mt-2">
                Please check all items above to enable approval
              </p>
            )}
          </div>
        </div>
      )}

      {/* Release Dialog */}
      {showReleaseDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Release Payroll
            </h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to release this payroll run? This will mark
              the payroll as disbursed and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReleaseDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRelease}
                disabled={actionPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {actionPending ? "Releasing..." : "Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Cancel Payroll Run
            </h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this payroll run? All computed
              payslips will be deleted.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason("");
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Keep Run
              </button>
              <button
                onClick={handleCancel}
                disabled={actionPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionPending ? "Cancelling..." : "Cancel Run"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
