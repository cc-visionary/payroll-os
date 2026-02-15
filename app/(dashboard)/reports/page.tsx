"use client";

// =============================================================================
// PeopleOS PH - Reports Page
// =============================================================================
// Comprehensive reporting with HRCI-standard HR reports and statutory exports.
// =============================================================================

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/charts";
import { exportStatutoryReport } from "@/app/actions/documents";
import {
  getHeadcountReport,
  getTenureReport,
  getLeaveUtilizationReport,
  getAttendanceSummaryReport,
  getPayrollSummaryReport,
  getAvailablePayrollMonths,
  type PayrollSummaryData,
} from "@/app/actions/dashboard";

type ReportType = "sss_r3" | "philhealth_rf1" | "pagibig_mcrf" | "bir_1601c";
type HRReportType = "headcount" | "tenure" | "leave" | "attendance";

interface ReportCategory {
  title: string;
  description: string;
  reports: {
    id: ReportType;
    name: string;
    description: string;
    icon: React.ReactNode;
  }[];
}

// Icons
function FileIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

const reportCategories: ReportCategory[] = [
  {
    title: "Statutory Reports",
    description: "Government agency compliance reports for remittance",
    reports: [
      {
        id: "sss_r3",
        name: "SSS R3",
        description: "SSS Contribution Collection List for monthly remittance",
        icon: <FileIcon />,
      },
      {
        id: "philhealth_rf1",
        name: "PhilHealth RF-1",
        description: "PhilHealth Remittance Form for monthly contributions",
        icon: <FileIcon />,
      },
      {
        id: "pagibig_mcrf",
        name: "Pag-IBIG MCRF",
        description: "Pag-IBIG Monthly Contribution Remittance Form",
        icon: <FileIcon />,
      },
      {
        id: "bir_1601c",
        name: "BIR 1601-C",
        description: "Monthly Remittance Return of Income Taxes Withheld",
        icon: <FileIcon />,
      },
    ],
  },
];

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // HR Report state
  const [hrReportType, setHrReportType] = useState<HRReportType | null>(null);
  const [hrReportData, setHrReportData] = useState<unknown[] | null>(null);
  const [hrReportLoading, setHrReportLoading] = useState(false);

  // Payroll Summary state
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummaryData | null>(null);
  const [payrollSummaryLoading, setPayrollSummaryLoading] = useState(false);
  const [payrollViewMode, setPayrollViewMode] = useState<"month" | "ytd">("ytd");
  const [payrollSelectedMonth, setPayrollSelectedMonth] = useState<number | null>(null);
  const [availablePayrollMonths, setAvailablePayrollMonths] = useState<
    { month: number; monthName: string; payDates: string[] }[]
  >([]);
  const [availablePayrollYears, setAvailablePayrollYears] = useState<number[]>([]);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [hasPayrollAccess, setHasPayrollAccess] = useState(true);

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Load available payroll months and YTD data on mount
  useEffect(() => {
    const loadPayrollData = async () => {
      setPayrollSummaryLoading(true);
      try {
        // Load available months
        const { months, availableYears } = await getAvailablePayrollMonths(payrollYear);
        setAvailablePayrollMonths(months);
        if (availableYears.length > 0) {
          setAvailablePayrollYears(availableYears);
        }
        // Load YTD by default
        const data = await getPayrollSummaryReport(payrollYear);
        setPayrollSummary(data);
      } catch (err) {
        if (err instanceof Error && err.message === "Permission denied") {
          setHasPayrollAccess(false);
        } else {
          setError("Failed to load payroll summary");
        }
      } finally {
        setPayrollSummaryLoading(false);
      }
    };
    loadPayrollData();
  }, [payrollYear]);

  const handleGenerateReport = async (reportType: ReportType) => {
    setGenerating(reportType);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportStatutoryReport(reportType, selectedMonth, selectedYear);

      if (result.success) {
        setSuccess(`${result.message}. Click to download.`);
        if (result.downloadUrl) {
          window.open(result.downloadUrl, "_blank");
        }
      } else {
        setError(result.error || "Failed to generate report");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateHRReport = async (type: HRReportType) => {
    setHrReportLoading(true);
    setHrReportType(type);
    setHrReportData(null);
    setError(null);

    try {
      let data;
      switch (type) {
        case "headcount":
          data = await getHeadcountReport();
          break;
        case "tenure":
          data = await getTenureReport();
          break;
        case "leave":
          data = await getLeaveUtilizationReport(selectedYear);
          break;
        case "attendance":
          data = await getAttendanceSummaryReport(selectedMonth, selectedYear);
          break;
      }
      setHrReportData(data);
    } catch {
      setError("Failed to generate HR report");
    } finally {
      setHrReportLoading(false);
    }
  };

  const handleLoadPayrollSummary = async (mode: "month" | "ytd", month?: number) => {
    setPayrollSummaryLoading(true);
    setPayrollViewMode(mode);
    if (mode === "month" && month) {
      setPayrollSelectedMonth(month);
    } else {
      setPayrollSelectedMonth(null);
    }
    setError(null);

    try {
      const data = await getPayrollSummaryReport(
        payrollYear,
        mode === "month" ? month : undefined
      );
      setPayrollSummary(data);
    } catch {
      setError("Failed to load payroll summary");
    } finally {
      setPayrollSummaryLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const downloadAsCSV = () => {
    if (!hrReportData || hrReportData.length === 0) return;

    const headers = Object.keys(hrReportData[0] as Record<string, unknown>);
    const csv = [
      headers.join(","),
      ...hrReportData.map((row) =>
        headers.map((h) => {
          const val = (row as Record<string, unknown>)[h];
          return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hrReportType}_report_${selectedYear}_${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Column configurations for HR reports
  const reportColumns: Record<HRReportType, { key: string; label: string; align?: "left" | "center" | "right" }[]> = {
    headcount: [
      { key: "employeeNumber", label: "Employee #" },
      { key: "name", label: "Name" },
      { key: "department", label: "Department" },
      { key: "position", label: "Position" },
      { key: "hiringEntity", label: "Hiring Entity" },
      { key: "employmentType", label: "Type" },
      { key: "employmentStatus", label: "Status" },
      { key: "hireDate", label: "Hire Date" },
      { key: "tenureMonths", label: "Tenure (Mo)", align: "right" },
    ],
    tenure: [
      { key: "department", label: "Department" },
      { key: "headcount", label: "Headcount", align: "right" },
      { key: "averageTenure", label: "Avg Tenure (Mo)", align: "right" },
      { key: "minTenure", label: "Min Tenure", align: "right" },
      { key: "maxTenure", label: "Max Tenure", align: "right" },
    ],
    leave: [
      { key: "employeeNumber", label: "Employee #" },
      { key: "employeeName", label: "Name" },
      { key: "department", label: "Department" },
      { key: "leaveType", label: "Leave Type" },
      { key: "entitled", label: "Entitled", align: "right" },
      { key: "used", label: "Used", align: "right" },
      { key: "pending", label: "Pending", align: "right" },
      { key: "balance", label: "Balance", align: "right" },
      { key: "utilizationRate", label: "Util %", align: "right" },
    ],
    attendance: [
      { key: "employeeNumber", label: "Employee #" },
      { key: "employeeName", label: "Name" },
      { key: "department", label: "Department" },
      { key: "daysPresent", label: "Present", align: "right" },
      { key: "daysAbsent", label: "Absent", align: "right" },
      { key: "daysOnLeave", label: "Leave", align: "right" },
      { key: "timesLate", label: "Times Late", align: "right" },
      { key: "totalLateMinutes", label: "Late (min)", align: "right" },
      { key: "totalOtHours", label: "OT (hrs)", align: "right" },
      { key: "attendanceRate", label: "Att %", align: "right" },
    ],
  };

  const reportTitles: Record<HRReportType, string> = {
    headcount: "Headcount Report",
    tenure: "Tenure Analysis Report",
    leave: "Leave Utilization Report",
    attendance: "Attendance Summary Report",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">Generate statutory compliance and HR analytics reports</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          {success}
        </div>
      )}

      {/* Statutory Reports */}
      {reportCategories.map((category) => (
        <Card key={category.title}>
          <CardHeader>
            <CardTitle>{category.title}</CardTitle>
            <p className="text-sm text-gray-500">{category.description}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.reports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        {report.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{report.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleGenerateReport(report.id)}
                      loading={generating === report.id}
                      disabled={generating !== null}
                    >
                      Generate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* HR Reports - HRCI Standard */}
      <Card>
        <CardHeader>
          <CardTitle>HR Analytics Reports (HRCI Standard)</CardTitle>
          <p className="text-sm text-gray-500">
            Workforce analytics following Human Resource Certification Institute standards
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Headcount Report */}
            <div className="p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                    <UsersIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Headcount Report</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Employee counts by department, status, type, and hiring entity
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateHRReport("headcount")}
                  loading={hrReportLoading && hrReportType === "headcount"}
                  disabled={hrReportLoading}
                >
                  Generate
                </Button>
              </div>
            </div>

            {/* Tenure Analysis */}
            <div className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <ChartIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Tenure Analysis</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Employee tenure distribution and averages by department
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateHRReport("tenure")}
                  loading={hrReportLoading && hrReportType === "tenure"}
                  disabled={hrReportLoading}
                >
                  Generate
                </Button>
              </div>
            </div>

            {/* Leave Utilization */}
            <div className="p-4 border border-gray-200 rounded-lg hover:border-yellow-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                    <CalendarIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Leave Utilization</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Leave balance and usage by employee and leave type
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateHRReport("leave")}
                  loading={hrReportLoading && hrReportType === "leave"}
                  disabled={hrReportLoading}
                >
                  Generate
                </Button>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <ClockIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Attendance Summary</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Attendance patterns, lates, absences, and overtime
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateHRReport("attendance")}
                  loading={hrReportLoading && hrReportType === "attendance"}
                  disabled={hrReportLoading}
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HR Report Results */}
      {hrReportType && hrReportData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{reportTitles[hrReportType]}</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {hrReportData.length} records
                </span>
                <Button size="sm" variant="outline" onClick={downloadAsCSV}>
                  <DownloadIcon />
                  <span className="ml-1">Download CSV</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hrReportData.length > 0 ? (
              <DataTable
                columns={reportColumns[hrReportType]}
                data={hrReportData as Record<string, unknown>[]}
                maxRows={20}
              />
            ) : (
              <p className="text-center text-gray-500 py-8">No data available for this report</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll Summary Report */}
      {hasPayrollAccess && <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Payroll Summary</CardTitle>
              <p className="text-sm text-gray-500">
                Detailed breakdown of earnings, deductions, and benefits
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Year Selector */}
              <select
                value={payrollYear}
                onChange={(e) => setPayrollYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900"
                disabled={payrollSummaryLoading}
              >
                {(availablePayrollYears.length > 0 ? availablePayrollYears : years).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              {/* YTD Button */}
              <Button
                size="sm"
                variant={payrollViewMode === "ytd" ? "primary" : "outline"}
                onClick={() => handleLoadPayrollSummary("ytd")}
                disabled={payrollSummaryLoading}
              >
                Year-to-Date {payrollYear}
              </Button>
              {/* Month Dropdown */}
              {availablePayrollMonths.length > 0 && (
                <select
                  value={payrollSelectedMonth || ""}
                  onChange={(e) => {
                    const month = Number(e.target.value);
                    if (month) {
                      handleLoadPayrollSummary("month", month);
                    }
                  }}
                  className={`px-3 py-1.5 border rounded-md text-sm bg-white text-gray-900 ${
                    payrollViewMode === "month"
                      ? "border-blue-500 ring-1 ring-blue-500"
                      : "border-gray-300"
                  }`}
                  disabled={payrollSummaryLoading}
                >
                  <option value="">Select Month</option>
                  {availablePayrollMonths.map((m) => (
                    <option key={m.month} value={m.month}>
                      {m.monthName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payrollSummaryLoading ? (
            <div className="text-center py-8 text-gray-500">Loading payroll summary...</div>
          ) : payrollSummary ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-blue-600">Total Gross Pay</div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatCurrency(payrollSummary.summary.totalGrossPay)}
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-600">Total Deductions</div>
                  <div className="text-lg font-bold text-red-900">
                    {formatCurrency(payrollSummary.summary.totalDeductions)}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600">Total Net Pay</div>
                  <div className="text-lg font-bold text-green-900">
                    {formatCurrency(payrollSummary.summary.totalNetPay)}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-purple-600">Employees</div>
                  <div className="text-lg font-bold text-purple-900">
                    {payrollSummary.summary.employeeCount}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Payslips</div>
                  <div className="text-lg font-bold text-gray-900">
                    {payrollSummary.summary.payslipCount}
                  </div>
                </div>
              </div>

              {/* Three-column breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Earnings */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-green-50 px-4 py-2 border-b border-green-100">
                    <h4 className="font-semibold text-green-800">Earnings</h4>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Basic Pay</span>
                      <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.basicPay)}</span>
                    </div>
                    {payrollSummary.earnings.overtimeRegular > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Overtime (Regular)</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.overtimeRegular)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.overtimeRestDay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Overtime (Rest Day)</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.overtimeRestDay)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.overtimeHoliday > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Overtime (Holiday)</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.overtimeHoliday)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.nightDifferential > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Night Differential</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.nightDifferential)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.holidayPay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Holiday Pay</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.holidayPay)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.restDayPay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rest Day Pay</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.restDayPay)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.allowances > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Allowances</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.allowances)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.incentives > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Incentives</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.incentives)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.bonuses > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bonuses</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.bonuses)}</span>
                      </div>
                    )}
                    {payrollSummary.earnings.thirteenthMonthPay > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">13th Month Pay</span>
                        <span className="font-medium text-gray-900">{formatCurrency(payrollSummary.earnings.thirteenthMonthPay)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                      <span>Total Earnings</span>
                      <span className="text-green-600">{formatCurrency(payrollSummary.earnings.totalEarnings)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-100">
                    <h4 className="font-semibold text-red-800">Deductions</h4>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    {(payrollSummary.deductions.late > 0 || payrollSummary.deductions.undertime > 0 || payrollSummary.deductions.lateUndertime > 0) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Late/Undertime</span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(payrollSummary.deductions.late + payrollSummary.deductions.undertime + payrollSummary.deductions.lateUndertime)}
                        </span>
                      </div>
                    )}
                    {payrollSummary.deductions.absent > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Absent</span>
                        <span className="font-medium text-red-600">{formatCurrency(payrollSummary.deductions.absent)}</span>
                      </div>
                    )}
                    {payrollSummary.deductions.cashAdvance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cash Advance</span>
                        <span className="font-medium text-red-600">{formatCurrency(payrollSummary.deductions.cashAdvance)}</span>
                      </div>
                    )}
                    {payrollSummary.deductions.loans > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Loans</span>
                        <span className="font-medium text-red-600">{formatCurrency(payrollSummary.deductions.loans)}</span>
                      </div>
                    )}
                    {payrollSummary.deductions.otherDeductions > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Other Deductions</span>
                        <span className="font-medium text-red-600">{formatCurrency(payrollSummary.deductions.otherDeductions)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                      <span>Total Deductions</span>
                      <span className="text-red-600">{formatCurrency(payrollSummary.deductions.totalDeductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Benefits (EE + ER) */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-100">
                    <h4 className="font-semibold text-yellow-800">Statutory Benefits</h4>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    {payrollSummary.benefits.sssTotal > 0 && (
                      <div>
                        <div className="flex justify-between font-medium">
                          <span className="text-gray-700">SSS</span>
                          <span className="text-gray-900">{formatCurrency(payrollSummary.benefits.sssTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>EE: {formatCurrency(payrollSummary.benefits.sssEe)}</span>
                          <span>ER: {formatCurrency(payrollSummary.benefits.sssEr)}</span>
                        </div>
                      </div>
                    )}
                    {payrollSummary.benefits.philhealthTotal > 0 && (
                      <div>
                        <div className="flex justify-between font-medium">
                          <span className="text-gray-700">PhilHealth</span>
                          <span className="text-gray-900">{formatCurrency(payrollSummary.benefits.philhealthTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>EE: {formatCurrency(payrollSummary.benefits.philhealthEe)}</span>
                          <span>ER: {formatCurrency(payrollSummary.benefits.philhealthEr)}</span>
                        </div>
                      </div>
                    )}
                    {payrollSummary.benefits.pagibigTotal > 0 && (
                      <div>
                        <div className="flex justify-between font-medium">
                          <span className="text-gray-700">Pag-IBIG</span>
                          <span className="text-gray-900">{formatCurrency(payrollSummary.benefits.pagibigTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>EE: {formatCurrency(payrollSummary.benefits.pagibigEe)}</span>
                          <span>ER: {formatCurrency(payrollSummary.benefits.pagibigEr)}</span>
                        </div>
                      </div>
                    )}
                    {payrollSummary.benefits.withholdingTax > 0 && (
                      <div className="flex justify-between font-medium">
                        <span className="text-gray-700">Withholding Tax</span>
                        <span className="text-gray-900">{formatCurrency(payrollSummary.benefits.withholdingTax)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold">
                      <span>Total Benefits</span>
                      <span className="text-yellow-700">{formatCurrency(payrollSummary.benefits.totalBenefits)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Department Breakdown */}
              {payrollSummary.byDepartment.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">By Department</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Department</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Employees</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Gross Pay</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {payrollSummary.byDepartment.map((dept) => (
                          <tr key={dept.department} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-900">{dept.department}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{dept.employeeCount}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{formatCurrency(dept.grossPay)}</td>
                            <td className="px-4 py-2 text-right font-medium text-green-600">{formatCurrency(dept.netPay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No payroll data available for {payrollYear}.
                {availablePayrollMonths.length === 0 && " No approved/released payroll runs found."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* HRCI Standards Info */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">About HRCI Standard Reports</h3>
        <p className="text-sm text-gray-600 mb-4">
          Our HR Analytics reports follow the Human Resource Certification Institute (HRCI)
          standards for workforce metrics and analytics. These include:
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Turnover Rate (voluntary/involuntary)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Retention Rate
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            Time-to-Fill / Time-to-Hire
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Cost-per-Hire
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            Absenteeism Rate
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
            Training Hours per Employee
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
            Revenue per Employee
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            Employee Satisfaction Index
          </li>
        </ul>
      </div>
    </div>
  );
}
