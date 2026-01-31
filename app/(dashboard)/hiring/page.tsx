// =============================================================================
// PeopleOS PH - Hiring / Applicant Tracking Page
// =============================================================================

import Link from "next/link";
import { requirePermission, checkPermission, Permission } from "@/lib/rbac";
import { getApplicants, getApplicantStats, getApplicantSources } from "@/lib/data/hiring";
import { getDepartments, getRoleScorecardsDropdown } from "@/lib/data/employees";
import { formatName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApplicantStatusBadge } from "@/components/ui/badge";
import { HiringActionBar } from "./hiring-action-bar";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    position?: string;
    department?: string;
    source?: string;
    page?: string;
  }>;
}

export default async function HiringPage({ searchParams }: PageProps) {
  await requirePermission(Permission.HIRING_VIEW);
  const canCreate = await checkPermission(Permission.HIRING_CREATE);

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const [{ applicants, total, totalPages }, stats, departments, positions, sources] = await Promise.all([
    getApplicants({
      search: params.search,
      status: params.status,
      roleScorecardId: params.position,
      departmentId: params.department,
      source: params.source,
      page,
      limit: 20,
    }),
    getApplicantStats(),
    getDepartments(),
    getRoleScorecardsDropdown(),
    getApplicantSources(),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hiring Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Track applicants through the hiring process</p>
        </div>
        <HiringActionBar canCreate={canCreate} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard label="New" value={stats.new} color="blue" />
        <StatCard label="Screening" value={stats.screening} color="yellow" />
        <StatCard label="Interview" value={stats.interview} color="purple" />
        <StatCard label="Offer" value={stats.offer} color="orange" />
        <StatCard label="Hired" value={stats.hired} color="green" />
        <StatCard label="Rejected" value={stats.rejected} color="red" />
        <StatCard label="Pipeline" value={stats.pipeline} color="gray" highlight />
        <StatCard label="Interviews" value={stats.upcomingInterviews} color="indigo" />
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <form className="flex flex-wrap gap-4">
            <input
              type="text"
              name="search"
              placeholder="Search by name or email..."
              defaultValue={params.search}
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              name="status"
              defaultValue={params.status}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900"
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="SCREENING">Screening</option>
              <option value="INTERVIEW">Interview</option>
              <option value="ASSESSMENT">Assessment</option>
              <option value="OFFER">Offer</option>
              <option value="OFFER_ACCEPTED">Offer Accepted</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
            <select
              name="position"
              defaultValue={params.position}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900"
            >
              <option value="">All Positions</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jobTitle}
                </option>
              ))}
            </select>
            <select
              name="department"
              defaultValue={params.department}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              name="source"
              defaultValue={params.source}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900"
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {(params.search || params.status || params.position || params.department || params.source) && (
              <Link href="/hiring">
                <Button type="button" variant="ghost">
                  Clear
                </Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Applicants Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Applicants
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({total} total)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {applicants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No applicants found. {canCreate && (
                <Link href="/hiring/new" className="text-blue-600 hover:underline">
                  Add your first applicant
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Name</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Email</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Position</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Source</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Applied</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Interviews</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((applicant) => (
                    <tr key={applicant.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <Link
                          href={`/hiring/${applicant.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {formatName(
                            applicant.firstName,
                            applicant.lastName,
                            applicant.middleName,
                            applicant.suffix
                          )}
                        </Link>
                      </td>
                      <td className="py-3 px-2 text-gray-600">{applicant.email}</td>
                      <td className="py-3 px-2">
                        <div className="text-gray-900">
                          {applicant.roleScorecard?.jobTitle || applicant.customJobTitle || "-"}
                        </div>
                        {applicant.department && (
                          <div className="text-xs text-gray-500">{applicant.department.name}</div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <ApplicantStatusBadge status={applicant.status} />
                      </td>
                      <td className="py-3 px-2 text-gray-600">{applicant.source || "-"}</td>
                      <td className="py-3 px-2 text-gray-600">
                        {new Date(applicant.appliedAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {applicant.interviewCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {applicant.interviewCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {page > 1 && (
                <Link
                  href={`/hiring?${new URLSearchParams({
                    ...params,
                    page: String(page - 1),
                  })}`}
                >
                  <Button variant="outline" size="sm">
                    Previous
                  </Button>
                </Link>
              )}
              <span className="py-2 px-4 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/hiring?${new URLSearchParams({
                    ...params,
                    page: String(page + 1),
                  })}`}
                >
                  <Button variant="outline" size="sm">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    yellow: "bg-yellow-50 text-yellow-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  return (
    <div
      className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.gray} ${
        highlight ? "ring-2 ring-gray-300" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wide opacity-75">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
