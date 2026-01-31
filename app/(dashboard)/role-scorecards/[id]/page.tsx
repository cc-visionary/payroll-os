// =============================================================================
// PeopleOS PH - Role Scorecard Detail Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, checkPermission, Permission } from "@/lib/rbac";
import { getRoleScorecard } from "@/app/actions/settings";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RoleScorecardDetailPage({ params }: PageProps) {
  await requirePermission(Permission.ROLE_SCORECARD_VIEW);
  const canEdit = await checkPermission(Permission.ROLE_SCORECARD_MANAGE);

  const { id } = await params;
  const scorecard = await getRoleScorecard(id);

  if (!scorecard) {
    notFound();
  }

  const formatWageType = (type: string) => {
    switch (type) {
      case "MONTHLY":
        return "Monthly";
      case "DAILY":
        return "Daily";
      case "HOURLY":
        return "Hourly";
      default:
        return type;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/role-scorecards"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Role Scorecards
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{scorecard.jobTitle}</h1>
            <div className="flex items-center gap-3 mt-2">
              {scorecard.department && (
                <span className="text-gray-500">{scorecard.department.name}</span>
              )}
              <Badge variant={scorecard.isActive ? "success" : "default"}>
                {scorecard.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {canEdit && (
            <Link href={`/role-scorecards/${id}/edit`}>
              <Button variant="outline">Edit Scorecard</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 uppercase">Base Salary</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {scorecard.baseSalary ? formatCurrency(scorecard.baseSalary) : "Not set"}
              </div>
              <div className="text-sm text-gray-500">{formatWageType(scorecard.wageType)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 uppercase">Salary Range</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {scorecard.salaryRangeMin ? formatCurrency(scorecard.salaryRangeMin) : "N/A"} -{" "}
                {scorecard.salaryRangeMax ? formatCurrency(scorecard.salaryRangeMax) : "N/A"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 uppercase">Work Schedule</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {scorecard.shiftTemplate?.name || "Not assigned"}
              </div>
              <div className="text-sm text-gray-500">
                {scorecard.workHoursPerDay}h/day, {scorecard.workDaysPerWeek}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 uppercase">Effective Date</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {formatDate(scorecard.effectiveDate)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mission Statement */}
        {scorecard.missionStatement && (
          <Card>
            <CardHeader>
              <CardTitle>Mission Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{scorecard.missionStatement}</p>
            </CardContent>
          </Card>
        )}

        {/* Key Responsibilities */}
        {scorecard.keyResponsibilities && scorecard.keyResponsibilities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Key Responsibilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scorecard.keyResponsibilities.map((area, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">{area.area}</h4>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {area.tasks.map((task, taskIdx) => (
                        <li key={taskIdx}>{task}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        {scorecard.kpis && scorecard.kpis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Key Performance Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {scorecard.kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-900">{kpi.metric}</span>
                    <Badge variant="default">{kpi.frequency}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Flexible Hours */}
        {(scorecard.flexibleStartTime || scorecard.flexibleEndTime) && (
          <Card>
            <CardHeader>
              <CardTitle>Flexible Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Flexible Start</div>
                  <div className="text-gray-900">{scorecard.flexibleStartTime || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Flexible End</div>
                  <div className="text-gray-900">{scorecard.flexibleEndTime || "N/A"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Version History */}
        {scorecard.previousVersions && scorecard.previousVersions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scorecard.previousVersions.map((version) => (
                  <div
                    key={version.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-900">
                      Effective: {formatDate(version.effectiveDate)}
                    </span>
                    <span className="text-sm text-gray-500">
                      Created: {formatDate(version.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Created By</div>
                <div className="text-gray-900">{scorecard.createdBy?.email || "Unknown"}</div>
              </div>
              <div>
                <div className="text-gray-500">Created At</div>
                <div className="text-gray-900">{formatDate(scorecard.createdAt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
