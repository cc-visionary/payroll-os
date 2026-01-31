// =============================================================================
// PeopleOS PH - Dashboard Page
// =============================================================================
// Main dashboard with HR analytics and visualizations following HRCI standards.
// =============================================================================

import { getDashboardMetrics } from "@/app/actions/dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  StatCard,
  BarChart,
  DonutChart,
  ProgressRing,
  DataTable,
} from "@/components/charts";

// Icons as simple SVG components
function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardMetrics();

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount);

  // Colors for charts
  const chartColors = {
    blue: "#3b82f6",
    green: "#22c55e",
    yellow: "#eab308",
    red: "#ef4444",
    purple: "#a855f7",
    indigo: "#6366f1",
    teal: "#14b8a6",
    orange: "#f97316",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            HR Analytics for {data.period.monthName} {data.period.year}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Employees"
          value={data.headcount.activeEmployees}
          subtitle={`${data.headcount.totalEmployees} total`}
          icon={<UsersIcon />}
          color="blue"
        />
        <StatCard
          title="Retention Rate"
          value={`${data.turnover.retentionRate}%`}
          subtitle={`${data.turnover.averageTenure.toFixed(1)} mo avg tenure`}
          icon={<TrendingUpIcon />}
          color="green"
        />
        <StatCard
          title="Open Positions"
          value={data.recruitment.openPositions}
          subtitle={`${data.recruitment.applicantsThisMonth} applicants this month`}
          icon={<BriefcaseIcon />}
          color="purple"
        />
        <StatCard
          title="Attendance Rate"
          value={`${data.attendance.attendanceRate}%`}
          subtitle={`${data.attendance.overtimeHours} OT hours`}
          icon={<ClockIcon />}
          color="yellow"
        />
      </div>

      {/* Headcount & Turnover Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by Department */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartIcon />
              Headcount by Department
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.headcount.byDepartment.length > 0 ? (
              <BarChart
                data={data.headcount.byDepartment.slice(0, 6).map((d) => ({
                  label: d.department,
                  value: d.count,
                }))}
                horizontal
              />
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Employment Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Employment Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={data.headcount.byEmploymentType.map((d, i) => ({
                label: d.type.charAt(0) + d.type.slice(1).toLowerCase(),
                value: d.count,
                color: [chartColors.blue, chartColors.green, chartColors.yellow, chartColors.purple][i % 4],
              }))}
              centerValue={data.headcount.activeEmployees}
              centerLabel="Total"
            />
          </CardContent>
        </Card>
      </div>

      {/* Hiring Entity & Tenure Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by Hiring Entity */}
        <Card>
          <CardHeader>
            <CardTitle>Employees by Hiring Entity</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={data.headcount.byHiringEntity.map((d, i) => ({
                label: d.entity,
                value: d.count,
                color: [chartColors.indigo, chartColors.teal, chartColors.orange, chartColors.red][i % 4],
              }))}
              centerValue={data.headcount.activeEmployees}
              centerLabel="Total"
            />
          </CardContent>
        </Card>

        {/* Tenure Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tenure Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.turnover.tenureDistribution.map((d) => ({
                label: d.range,
                value: d.count,
              }))}
              horizontal={false}
              height={180}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recruitment Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recruitment Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{data.recruitment.applicantsThisMonth}</p>
              <p className="text-sm text-gray-500">New Applicants</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{data.recruitment.interviewsScheduled}</p>
              <p className="text-sm text-gray-500">Interviews</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{data.recruitment.offersExtended}</p>
              <p className="text-sm text-gray-500">Offers Extended</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{data.recruitment.offersAccepted}</p>
              <p className="text-sm text-gray-500">Offers Accepted</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{data.recruitment.averageTimeToHire}</p>
              <p className="text-sm text-gray-500">Avg Days to Hire</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600">{data.recruitment.openPositions}</p>
              <p className="text-sm text-gray-500">Open Positions</p>
            </div>
          </div>

          {/* Pipeline Status Breakdown */}
          {data.recruitment.pipelineByStatus.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Pipeline by Status</h4>
              <BarChart
                data={data.recruitment.pipelineByStatus.map((d) => ({
                  label: d.status.replace(/_/g, " "),
                  value: d.count,
                }))}
                horizontal
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance & Payroll Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <ProgressRing
                value={data.attendance.attendanceRate}
                color={chartColors.green}
                label="Attendance"
              />
              <ProgressRing
                value={100 - data.attendance.absenteeismRate}
                color={chartColors.blue}
                label="Present"
              />
              <ProgressRing
                value={data.attendance.leaveUtilization}
                max={30}
                color={chartColors.purple}
                label="Leave Used"
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Avg Late Minutes</p>
                <p className="text-xl font-bold text-gray-900">{data.attendance.averageLateMinutes} min</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Overtime Hours</p>
                <p className="text-xl font-bold text-gray-900">{data.attendance.overtimeHours} hrs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Payroll Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <p className="text-sm text-gray-500">Total Payroll Cost</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.payroll.totalPayrollCost)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Avg Salary: {formatCurrency(data.payroll.averageSalary)}
              </p>
            </div>

            {/* Statutory Contributions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">SSS</p>
                <p className="text-sm font-bold text-blue-700">
                  {formatCurrency(data.payroll.statutoryContributions.sss)}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">PhilHealth</p>
                <p className="text-sm font-bold text-green-700">
                  {formatCurrency(data.payroll.statutoryContributions.philhealth)}
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-gray-500">Pag-IBIG</p>
                <p className="text-sm font-bold text-yellow-700">
                  {formatCurrency(data.payroll.statutoryContributions.pagibig)}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-500">Withholding Tax</p>
                <p className="text-sm font-bold text-red-700">
                  {formatCurrency(data.payroll.statutoryContributions.tax)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll by Department */}
      {data.payroll.payrollByDepartment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Cost by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.payroll.payrollByDepartment.slice(0, 8).map((d) => ({
                label: d.department,
                value: d.amount,
              }))}
              horizontal
            />
          </CardContent>
        </Card>
      )}

      {/* Performance Check-ins */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Check-ins</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{data.performance.checkInsCompleted}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{data.performance.checkInsPending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {data.performance.averageRating > 0 ? data.performance.averageRating.toFixed(1) : "N/A"}
              </p>
              <p className="text-sm text-gray-500">Avg Rating</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {data.performance.checkInsCompleted + data.performance.checkInsPending}
              </p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>

          {/* Rating Distribution */}
          {data.performance.ratingDistribution.some((r) => r.count > 0) && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Rating Distribution</h4>
              <BarChart
                data={data.performance.ratingDistribution.map((d) => ({
                  label: d.rating.split(" - ")[0],
                  value: d.count,
                }))}
                horizontal={false}
                height={120}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movement Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Movement (This Month)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-6 bg-green-50 rounded-lg border border-green-100">
              <p className="text-3xl font-bold text-green-600">{data.headcount.newHiresThisMonth}</p>
              <p className="text-sm text-gray-600 mt-1">New Hires</p>
            </div>
            <div className="text-center p-6 bg-red-50 rounded-lg border border-red-100">
              <p className="text-3xl font-bold text-red-600">{data.headcount.separationsThisMonth}</p>
              <p className="text-sm text-gray-600 mt-1">Separations</p>
            </div>
            <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-3xl font-bold text-orange-600">{data.turnover.voluntaryTurnover}</p>
              <p className="text-sm text-gray-600 mt-1">Voluntary (YTD)</p>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-3xl font-bold text-purple-600">{data.turnover.involuntaryTurnover}</p>
              <p className="text-sm text-gray-600 mt-1">Involuntary (YTD)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HRCI Standards Footer */}
      <div className="text-center text-xs text-gray-400 py-4">
        <p>Metrics aligned with HRCI (Human Resource Certification Institute) standards for HR analytics.</p>
        <p>Key metrics include: Turnover Rate, Retention Rate, Time-to-Hire, Absenteeism Rate, and more.</p>
      </div>
    </div>
  );
}
