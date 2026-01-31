// =============================================================================
// PeopleOS PH - Calendar Detail Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { getHolidayCalendar } from "@/lib/data/calendar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarViewTabs } from "./calendar-view-tabs";
import { AddEventModal } from "./add-event-modal";
import { ImportEventsModal } from "./import-events-modal";
import { CloneCalendarButton } from "./clone-calendar-button";

interface CalendarDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CalendarDetailPage({
  params,
}: CalendarDetailPageProps) {
  await requirePermission(Permission.CALENDAR_VIEW);
  const { id } = await params;

  const calendar = await getHolidayCalendar(id);

  if (!calendar) {
    notFound();
  }

  // Default rest days: Saturday (6) and Sunday (0)
  const restDays = [0, 6];

  // Group events by month for list display
  const eventsByMonth = calendar.events.reduce(
    (acc, event) => {
      const month = event.date.toLocaleString("en-US", { month: "long" });
      if (!acc[month]) acc[month] = [];
      acc[month].push(event);
      return acc;
    },
    {} as Record<string, typeof calendar.events>
  );

  // Count events by type
  const regularHolidayCount = calendar.events.filter(
    (e) => e.dayType === "REGULAR_HOLIDAY"
  ).length;
  const specialHolidayCount = calendar.events.filter(
    (e) => e.dayType === "SPECIAL_HOLIDAY"
  ).length;
  const restDayCount = calendar.events.filter(
    (e) => e.dayType === "REST_DAY"
  ).length;
  const otherCount = calendar.events.filter(
    (e) => e.dayType === "SPECIAL_WORKING"
  ).length;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/calendar"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Calendars
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {calendar.name || `${calendar.year} Holiday Calendar`}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-600">Year {calendar.year}</span>
              <Badge variant={calendar.isActive ? "success" : "default"}>
                {calendar.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <ImportEventsModal calendarId={calendar.id} year={calendar.year} />
            <AddEventModal calendarId={calendar.id} year={calendar.year} />
            <CloneCalendarButton
              calendarId={calendar.id}
              currentYear={calendar.year}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900">
              {calendar.events.length}
            </div>
            <div className="text-sm text-gray-500">Total Events</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {regularHolidayCount}
            </div>
            <div className="text-sm text-gray-500">Regular Holidays</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-600">
              {specialHolidayCount}
            </div>
            <div className="text-sm text-gray-500">Special Holidays</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">
              {restDayCount}
            </div>
            <div className="text-sm text-gray-500">Company Rest Days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">
              {otherCount}
            </div>
            <div className="text-sm text-gray-500">Other Events</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Views */}
      <CalendarViewTabs
        calendarId={calendar.id}
        year={calendar.year}
        events={calendar.events}
        eventsByMonth={eventsByMonth}
        restDays={restDays}
      />

      {/* Day Type Reference */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Day Type Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="font-medium text-red-800">Regular Holiday (200%)</div>
              <div className="text-red-600">
                200% of daily rate for work performed. Paid even if not worked.
              </div>
              <div className="text-red-500 text-xs mt-1">
                Examples: New Year, Maundy Thursday, Independence Day, Rizal Day
              </div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="font-medium text-orange-800">Special Holiday (130%)</div>
              <div className="text-orange-600">
                130% of daily rate for work performed. No pay if not worked.
              </div>
              <div className="text-orange-500 text-xs mt-1">
                Examples: Ninoy Aquino Day, All Saints Day, Christmas Eve
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="font-medium text-purple-800">
                Company Rest Day (130%)
              </div>
              <div className="text-purple-600">
                Company-declared non-working day. 130% if work is required.
              </div>
              <div className="text-purple-500 text-xs mt-1">
                Examples: Company outing, team building, annual shutdown
              </div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="font-medium text-blue-800">
                Special Working Day (100%)
              </div>
              <div className="text-blue-600">
                Regular pay rate. A moved holiday becomes a working day.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
