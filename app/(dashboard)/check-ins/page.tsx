// =============================================================================
// PeopleOS PH - Performance Check-Ins Page
// =============================================================================

import Link from "next/link";
import { requirePermission, Permission, checkPermission } from "@/lib/rbac";
import { getCheckInPeriods } from "@/app/actions/check-ins";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CreatePeriodButton } from "./create-period-button";

export default async function CheckInsPage() {
  await requirePermission(Permission.EMPLOYEE_VIEW);
  const canEdit = await checkPermission(Permission.EMPLOYEE_EDIT);

  const periods = await getCheckInPeriods();

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Check-Ins</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monthly performance reviews, goals tracking, and skill assessments
          </p>
        </div>
        {canEdit && <CreatePeriodButton />}
      </div>

      {/* Active Periods */}
      <Card>
        <CardHeader>
          <CardTitle>Check-In Periods</CardTitle>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No check-in periods created yet. Create your first period to start tracking
              employee performance.
            </p>
          ) : (
            <div className="space-y-4">
              {periods.map((period) => {
                const isOverdue = new Date(period.dueDate) < now;
                const isActive = new Date(period.startDate) <= now && new Date(period.endDate) >= now;

                return (
                  <Link
                    key={period.id}
                    href={`/check-ins/${period.id}`}
                    className="block"
                  >
                    <div className="border rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{period.name}</h3>
                            <Badge
                              variant={
                                isActive ? "success" : isOverdue ? "warning" : "default"
                              }
                            >
                              {isActive ? "Active" : isOverdue ? "Overdue" : period.periodType}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(period.startDate)} - {formatDate(period.endDate)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Due: {formatDate(period.dueDate)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            {period._count.checkIns}
                          </div>
                          <div className="text-xs text-gray-500">check-ins</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {periods.filter((p) => {
                  const start = new Date(p.startDate);
                  const end = new Date(p.endDate);
                  return start <= now && end >= now;
                }).length}
              </div>
              <div className="text-sm text-gray-500 mt-1">Active Periods</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {periods.reduce((sum, p) => sum + p._count.checkIns, 0)}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total Check-Ins</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {periods.length}
              </div>
              <div className="text-sm text-gray-500 mt-1">Total Periods</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
