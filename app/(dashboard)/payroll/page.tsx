"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getPayrollRuns,
  getPayrollEmployeePreview,
  createPayrollRunWithEmployees,
  deletePayrollRun,
  type PayrollRunListItem,
  type PayrollEmployeePreview,
} from "@/app/actions/payroll";
import type { PayrollRunStatus } from "@/app/generated/prisma";

// Status badge colors
const statusColors: Record<PayrollRunStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  COMPUTING: "bg-blue-100 text-blue-800",
  REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  RELEASED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusLabels: Record<PayrollRunStatus, string> = {
  DRAFT: "Draft",
  COMPUTING: "Computing",
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

export default function PayPeriodsPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<PayrollRunListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PayrollRunStatus | "ALL">("ALL");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payFrequency, setPayFrequency] = useState<"WEEKLY" | "SEMI_MONTHLY" | "MONTHLY">("SEMI_MONTHLY");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [employees, setEmployees] = useState<PayrollEmployeePreview[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Delete pay period state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load pay periods
  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await getPayrollRuns({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        year: yearFilter,
      });

      if (result.success && result.runs) {
        setPeriods(result.runs);
        setTotal(result.total || 0);
        setError(null);
      } else {
        setError(result.error || "Failed to load pay periods");
      }
      setLoading(false);
    }
    load();
  }, [statusFilter, yearFilter]);

  // Load employee preview when dates change
  const loadEmployeePreview = async () => {
    if (!startDate || !endDate) return;

    setLoadingPreview(true);
    setError(null);

    const result = await getPayrollEmployeePreview(startDate, endDate);

    if (result.success && result.employees) {
      setEmployees(result.employees);
      // Select all employees by default
      setSelectedEmployeeIds(new Set(result.employees.map((e) => e.id)));
    } else {
      setError(result.error || "Failed to load employees");
      setEmployees([]);
      setSelectedEmployeeIds(new Set());
    }
    setLoadingPreview(false);
  };

  // Load preview when dates are both set
  useEffect(() => {
    if (showCreateDialog && startDate && endDate) {
      loadEmployeePreview();
    }
  }, [showCreateDialog, startDate, endDate]);

  const handleToggleEmployee = (employeeId: string) => {
    const newSelected = new Set(selectedEmployeeIds);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployeeIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEmployeeIds.size === employees.length) {
      // Deselect all
      setSelectedEmployeeIds(new Set());
    } else {
      // Select all
      setSelectedEmployeeIds(new Set(employees.map((e) => e.id)));
    }
  };

  const handleCreatePayPeriod = async () => {
    if (!startDate || !endDate) {
      setError("Please select start and end dates");
      return;
    }

    if (!payDate) {
      setError("Please select a pay date");
      return;
    }

    if (selectedEmployeeIds.size === 0) {
      setError("Please select at least one employee");
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createPayrollRunWithEmployees({
      startDate,
      endDate,
      payDate,
      payFrequency,
      employeeIds: Array.from(selectedEmployeeIds),
    });

    if (result.success && result.payrollRunId) {
      setShowCreateDialog(false);
      resetCreateDialog();
      router.push(`/payroll/${result.payrollRunId}`);
    } else {
      setError(result.error || "Failed to create pay period");
    }
    setCreating(false);
  };

  const resetCreateDialog = () => {
    setStartDate("");
    setEndDate("");
    setPayDate("");
    setPayFrequency("SEMI_MONTHLY");
    setEmployees([]);
    setSelectedEmployeeIds(new Set());
    setError(null);
  };

  const handleDeletePayPeriod = async (id: string) => {
    setDeletingId(id);
    setError(null);

    const result = await deletePayrollRun(id);

    if (result.success) {
      const periodsResult = await getPayrollRuns({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        year: yearFilter,
      });
      if (periodsResult.success && periodsResult.runs) {
        setPeriods(periodsResult.runs);
        setTotal(periodsResult.total || 0);
      }
      setDeleteConfirm(null);
    } else {
      setError(result.error || "Failed to delete pay period");
    }
    setDeletingId(null);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pay Periods</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage payroll computation and disbursement
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          New Pay Period
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as PayrollRunStatus | "ALL")
            }
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPUTING">Computing</option>
            <option value="REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="RELEASED">Released</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pay Period
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employees
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Gross Pay
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Net Pay
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : periods.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No pay periods found
                </td>
              </tr>
            ) : (
              periods.map((period) => (
                <tr key={period.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {period.payPeriodCode}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(period.startDate)} - {formatDate(period.endDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[period.status]}`}
                    >
                      {statusLabels[period.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {period.employeeCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(period.totalGrossPay)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(period.totalNetPay)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{formatDate(period.createdAt)}</div>
                    {period.createdBy && (
                      <div className="text-xs text-gray-400">{period.createdBy}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/payroll/${period.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </Link>
                      {["DRAFT", "REVIEW", "CANCELLED"].includes(period.status) &&
                        (deleteConfirm === period.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeletePayPeriod(period.id)}
                              disabled={deletingId === period.id}
                              className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              {deletingId === period.id ? "..." : "Confirm"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(period.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination info */}
      {total > 0 && (
        <div className="mt-4 text-sm text-gray-500">
          Showing {periods.length} of {total} pay periods
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Create Pay Period
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Select the pay period dates and employees to include
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Pay Frequency */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Frequency
                </label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="WEEKLY"
                      checked={payFrequency === "WEEKLY"}
                      onChange={(e) => setPayFrequency(e.target.value as "WEEKLY")}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Weekly</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="SEMI_MONTHLY"
                      checked={payFrequency === "SEMI_MONTHLY"}
                      onChange={(e) => setPayFrequency(e.target.value as "SEMI_MONTHLY")}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Semi-Monthly</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      value="MONTHLY"
                      checked={payFrequency === "MONTHLY"}
                      onChange={(e) => setPayFrequency(e.target.value as "MONTHLY")}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Monthly</span>
                  </label>
                </div>
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pay Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">When employees get paid</p>
                </div>
              </div>

              {/* Period Name Preview */}
              {startDate && endDate && (
                <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">Period Name:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {startDate} - {endDate}
                  </span>
                </div>
              )}

              {/* Employee Preview */}
              {startDate && endDate && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Employees ({employees.length} found)
                    </h3>
                    {employees.length > 0 && (
                      <button
                        onClick={handleSelectAll}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {selectedEmployeeIds.size === employees.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    )}
                  </div>

                  {loadingPreview ? (
                    <div className="text-center py-8 text-gray-500">
                      Loading employees...
                    </div>
                  ) : employees.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      No active employees found.
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">
                              <input
                                type="checkbox"
                                checked={selectedEmployeeIds.size === employees.length}
                                onChange={handleSelectAll}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Employee
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Attendance Days
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {employees.map((emp) => (
                            <tr
                              key={emp.id}
                              className={`hover:bg-gray-50 cursor-pointer ${
                                !selectedEmployeeIds.has(emp.id) ? "opacity-50" : ""
                              }`}
                              onClick={() => handleToggleEmployee(emp.id)}
                            >
                              <td className="px-4 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedEmployeeIds.has(emp.id)}
                                  onChange={() => handleToggleEmployee(emp.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {emp.lastName}, {emp.firstName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {emp.employeeNumber}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                                {emp.attendanceDays}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {employees.length > 0 && (
                    <div className="mt-3 text-sm text-gray-500">
                      {selectedEmployeeIds.size} of {employees.length} employees selected
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  resetCreateDialog();
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePayPeriod}
                disabled={creating || !startDate || !endDate || selectedEmployeeIds.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? "Creating..." : `Create Pay Period (${selectedEmployeeIds.size} employees)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
