// =============================================================================
// PeopleOS PH - Check-In Period Detail Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission, checkPermission } from "@/lib/rbac";
import { getCheckInPeriod } from "@/app/actions/check-ins";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { InitializeCheckInsButton } from "./initialize-button";

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function CheckInPeriodPage({ params }: PageProps) {
  await requirePermission(Permission.EMPLOYEE_VIEW);
  const canEdit = await checkPermission(Permission.EMPLOYEE_EDIT);

  const { id } = await params;
  const period = await getCheckInPeriod(id);

  if (!period) {
    notFound();
  }

  // Count by status
  const statusCounts = period.checkIns.reduce(
    (acc, checkIn) => {
      acc[checkIn.status] = (acc[checkIn.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/check-ins" className="hover:text-gray-700">
            Check-Ins
          </Link>
          <span>/</span>
          <span>{period.name}</span>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{period.name}</h1>
            <p className="text-gray-500 mt-1">
              {formatDate(period.startDate)} - {formatDate(period.endDate)}
              {" "}&middot;{" "}
              Due: {formatDate(period.dueDate)}
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <InitializeCheckInsButton periodId={period.id} periodName={period.name} />
            )}
            <Link href="/check-ins">
              <Button variant="outline">Back to Periods</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {period.checkIns.length}
              </div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-500">
                {statusCounts.DRAFT || 0}
              </div>
              <div className="text-xs text-gray-500">Draft</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {(statusCounts.SUBMITTED || 0) + (statusCounts.UNDER_REVIEW || 0)}
              </div>
              <div className="text-xs text-gray-500">Pending Review</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {statusCounts.COMPLETED || 0}
              </div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {period.checkIns.length > 0
                  ? Math.round(
                      ((statusCounts.COMPLETED || 0) / period.checkIns.length) * 100
                    )
                  : 0}
                %
              </div>
              <div className="text-xs text-gray-500">Complete</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Check-Ins List */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Check-Ins</CardTitle>
        </CardHeader>
        <CardContent>
          {period.checkIns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                No check-ins have been created for this period yet.
              </p>
              {canEdit && (
                <InitializeCheckInsButton
                  periodId={period.id}
                  periodName={period.name}
                  variant="primary"
                />
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Goals
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rating
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {period.checkIns.map((checkIn) => (
                    <tr key={checkIn.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">
                            {checkIn.employee.lastName}, {checkIn.employee.firstName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {checkIn.employee.employeeNumber}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {checkIn.employee.department?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {checkIn.employee.jobTitle || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusColors[checkIn.status]}>
                          {statusLabels[checkIn.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {checkIn._count.goals} goals
                      </td>
                      <td className="px-4 py-3">
                        {checkIn.overallRating ? (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span className="text-sm font-medium">
                              {checkIn.overallRating}/5
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/check-ins/${period.id}/${checkIn.id}`}>
                          <Button variant="ghost" size="sm">
                            {canEdit ? "Review" : "View"}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
