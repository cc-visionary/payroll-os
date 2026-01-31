// =============================================================================
// PeopleOS PH - Individual Check-In Review Page
// =============================================================================
// Aligned with HRCI standards for performance management:
// - SMART Goals (Specific, Measurable, Achievable, Relevant, Time-bound)
// - Competency-based assessment
// - 360-degree feedback elements
// - Development planning
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission, checkPermission } from "@/lib/rbac";
import { getCheckIn } from "@/app/actions/check-ins";
import { formatDate, formatName } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckInForm } from "./check-in-form";

interface PageProps {
  params: Promise<{ id: string; checkInId: string }>;
}

const statusColors: Record<string, "default" | "warning" | "success" | "danger"> = {
  DRAFT: "default",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  COMPLETED: "success",
  SKIPPED: "default",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
};

export default async function CheckInReviewPage({ params }: PageProps) {
  await requirePermission(Permission.EMPLOYEE_VIEW);
  const canEdit = await checkPermission(Permission.EMPLOYEE_EDIT);

  const { id: periodId, checkInId } = await params;
  const checkIn = await getCheckIn(checkInId);

  if (!checkIn) {
    notFound();
  }

  const employee = checkIn.employee;
  const roleScorecard = employee.roleScorecard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/check-ins" className="hover:text-gray-700">
            Check-Ins
          </Link>
          <span>/</span>
          <Link href={`/check-ins/${periodId}`} className="hover:text-gray-700">
            {checkIn.period.name}
          </Link>
          <span>/</span>
          <span>{employee.lastName}, {employee.firstName}</span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Performance Check-In
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-gray-600">
                {formatName(employee.firstName, employee.lastName)}
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">{employee.employeeNumber}</span>
              <Badge variant={statusColors[checkIn.status]}>
                {statusLabels[checkIn.status]}
              </Badge>
            </div>
          </div>
          <Link href={`/check-ins/${periodId}`}>
            <Button variant="outline">Back to Period</Button>
          </Link>
        </div>
      </div>

      {/* Employee Context Card */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Position</h4>
              <p className="text-gray-900 mt-1">{employee.jobTitle || "Not assigned"}</p>
              {employee.department && (
                <p className="text-sm text-gray-500">{employee.department.name}</p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Review Period</h4>
              <p className="text-gray-900 mt-1">{checkIn.period.name}</p>
              <p className="text-sm text-gray-500">
                {formatDate(checkIn.period.startDate)} - {formatDate(checkIn.period.endDate)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Due Date</h4>
              <p className="text-gray-900 mt-1">{formatDate(checkIn.period.dueDate)}</p>
              {checkIn.submittedAt && (
                <p className="text-sm text-green-600">
                  Submitted: {formatDate(checkIn.submittedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Role Scorecard Reference - HRCI: Job-Related Criteria */}
          {roleScorecard && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium text-gray-500 mb-3">
                Role Expectations (from Role Scorecard)
              </h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  {roleScorecard.jobTitle}
                </p>
                {roleScorecard.missionStatement && (
                  <p className="text-sm text-blue-700 mb-3">
                    {roleScorecard.missionStatement}
                  </p>
                )}

                {/* Key Responsibilities */}
                {roleScorecard.keyResponsibilities && (roleScorecard.keyResponsibilities as Array<{area: string; tasks: string[]}>).length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-xs font-medium text-blue-600 uppercase mb-1">
                      Key Responsibilities
                    </h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {(roleScorecard.keyResponsibilities as Array<{area: string; tasks: string[]}>).map((resp, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{resp.area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* KPIs */}
                {roleScorecard.kpis && (roleScorecard.kpis as Array<{metric: string; frequency: string}>).length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-blue-600 uppercase mb-1">
                      Key Performance Indicators
                    </h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {(roleScorecard.kpis as Array<{metric: string; frequency: string}>).map((kpi, i) => (
                        <li key={i} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{kpi.metric} ({kpi.frequency})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-In Form */}
      <CheckInForm
        checkIn={checkIn}
        canEdit={canEdit}
        periodId={periodId}
      />
    </div>
  );
}
