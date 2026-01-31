"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  getPayrollRunDetail,
  getEmployeePayslipDiffs,
  type PayrollRunDetail,
  type EmployeePayslipDiff,
} from "@/app/actions/payroll";

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

const flagColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  LARGE_CHANGE: "bg-yellow-100 text-yellow-800",
  DECREASED: "bg-red-100 text-red-800",
  HIGH_OT: "bg-purple-100 text-purple-800",
};

const flagLabels: Record<string, string> = {
  NEW: "New",
  LARGE_CHANGE: "Large Change",
  DECREASED: "Decreased",
  HIGH_OT: "High OT",
};

export default function PayrollComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [detail, setDetail] = useState<PayrollRunDetail | null>(null);
  const [diffs, setDiffs] = useState<EmployeePayslipDiff[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [flagFilter, setFlagFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [detailResult, diffsResult] = await Promise.all([
        getPayrollRunDetail(id),
        getEmployeePayslipDiffs(id, { onlyChanged }),
      ]);

      if (detailResult.success && detailResult.detail) {
        setDetail(detailResult.detail);
      } else {
        setError(detailResult.error || "Failed to load payroll run");
      }

      if (diffsResult.success && diffsResult.diffs) {
        setDiffs(diffsResult.diffs);
        setTotal(diffsResult.total || 0);
      }

      setLoading(false);
    }
    load();
  }, [id, onlyChanged]);

  // Apply client-side filters
  let filteredDiffs = diffs;

  if (flagFilter !== "ALL") {
    filteredDiffs = filteredDiffs.filter((d) => d.flags.includes(flagFilter));
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredDiffs = filteredDiffs.filter((d) =>
      d.employeeName.toLowerCase().includes(searchLower)
    );
  }

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/payroll" className="text-gray-500 hover:text-gray-700">
            Payroll Runs
          </Link>
          <span className="text-gray-400">/</span>
          <Link
            href={`/payroll/${id}`}
            className="text-gray-500 hover:text-gray-700"
          >
            {detail.payPeriod.code}
          </Link>
          <span className="text-gray-400">/</span>
          <span className="font-medium">Comparison</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Employee-by-Employee Comparison
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Detailed comparison with previous payroll period
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Employee
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Flag Filter
            </label>
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Employees</option>
              <option value="NEW">New Employees</option>
              <option value="LARGE_CHANGE">Large Changes</option>
              <option value="DECREASED">Decreased Pay</option>
              <option value="HIGH_OT">High Overtime</option>
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">
                Only show changed employees
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Employees</div>
          <div className="text-2xl font-semibold">{total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">New Employees</div>
          <div className="text-2xl font-semibold text-blue-600">
            {diffs.filter((d) => d.flags.includes("NEW")).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Large Changes</div>
          <div className="text-2xl font-semibold text-yellow-600">
            {diffs.filter((d) => d.flags.includes("LARGE_CHANGE")).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Decreased Pay</div>
          <div className="text-2xl font-semibold text-red-600">
            {diffs.filter((d) => d.flags.includes("DECREASED")).length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Gross
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Previous Gross
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Difference
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Net
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Flags
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDiffs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No employees match the current filters
                </td>
              </tr>
            ) : (
              filteredDiffs.map((diff) => (
                <tr key={diff.employeeId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {diff.employeeName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {formatCurrency(diff.current.grossPay)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                    {diff.previous
                      ? formatCurrency(diff.previous.grossPay)
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {diff.previous ? (
                      <span
                        className={
                          diff.diff.grossPayDiff > 0
                            ? "text-green-600"
                            : diff.diff.grossPayDiff < 0
                              ? "text-red-600"
                              : "text-gray-500"
                        }
                      >
                        {diff.diff.grossPayDiff > 0 ? "+" : ""}
                        {formatCurrency(diff.diff.grossPayDiff)}
                        <span className="text-xs ml-1">
                          ({diff.diff.grossPayDiffPercent > 0 ? "+" : ""}
                          {diff.diff.grossPayDiffPercent.toFixed(1)}%)
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {formatCurrency(diff.current.netPay)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {diff.flags.map((flag) => (
                        <span
                          key={flag}
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${flagColors[flag] || "bg-gray-100 text-gray-800"}`}
                        >
                          {flagLabels[flag] || flag}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Result count */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredDiffs.length} of {total} employees
      </div>
    </div>
  );
}
