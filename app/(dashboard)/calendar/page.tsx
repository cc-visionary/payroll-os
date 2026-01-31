// =============================================================================
// PeopleOS PH - Holiday Calendar Page
// =============================================================================

import Link from "next/link";
import { requirePermission, Permission, checkPermission } from "@/lib/rbac";
import { getHolidayCalendars } from "@/lib/data/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateCalendarModal } from "./create-calendar-modal";

export default async function CalendarPage() {
  await requirePermission(Permission.CALENDAR_VIEW);
  const canManage = await checkPermission(Permission.CALENDAR_MANAGE);

  const calendars = await getHolidayCalendars();

  const currentYear = new Date().getFullYear();

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Holiday Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage holidays and rest day configurations
          </p>
        </div>
        {canManage && <CreateCalendarModal currentYear={currentYear} />}
      </div>

      <div className="space-y-4">
        {/* Calendar List */}
        {calendars.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No calendars configured yet.</p>
              {canManage && (
                <p className="text-sm text-gray-400 mt-2">
                  Create a calendar for {currentYear} to get started.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          calendars.map((calendar) => (
            <Card key={calendar.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{calendar.name}</h3>
                      {calendar.year === currentYear && (
                        <Badge variant="info">Current Year</Badge>
                      )}
                      {!calendar.isActive && <Badge variant="warning">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {calendar._count.events} holidays configured
                    </p>
                  </div>
                  <Link href={`/calendar/${calendar.id}`}>
                    <Button variant="outline" size="sm">
                      View & Edit
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Information Box */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardContent className="py-4">
          <h4 className="font-medium text-blue-900">How Holidays Affect Payroll</h4>
          <ul className="mt-2 text-sm text-blue-800 space-y-1">
            <li>
              • <strong>Regular Holiday:</strong> 200% pay for work rendered, 100% pay even if
              not worked (for regular employees)
            </li>
            <li>
              • <strong>Special Holiday:</strong> 130% pay for work rendered, no pay if not
              worked (unless company policy)
            </li>
            <li>
              • <strong>Special Working Day:</strong> Regular work day, but may have company
              incentives
            </li>
            <li>
              • <strong>Rest Day:</strong> 130% pay for work rendered
            </li>
          </ul>
          <p className="mt-3 text-xs text-blue-700">
            Note: Once attendance is computed and payroll is run, changing calendar events will
            not affect locked records. This ensures payroll integrity.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
