// =============================================================================
// PeopleOS PH - Daily Attendance View
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getDailyAttendance } from "@/app/actions/attendance";
import Link from "next/link";
import { DailyAttendanceClient } from "./daily-attendance-client";

interface DailyAttendancePageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function DailyAttendancePage({
  searchParams,
}: DailyAttendancePageProps) {
  await requirePermission(Permission.ATTENDANCE_VIEW);

  const params = await searchParams;
  const dateStr = params.date || new Date().toISOString().split("T")[0];

  const result = await getDailyAttendance(new Date(dateStr));
  const entries = result.success ? result.data || [] : [];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/attendance"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Attendance
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Daily Attendance</h1>
        <p className="text-gray-600 mt-1">
          View employee attendance for a specific date
        </p>
      </div>

      <DailyAttendanceClient initialDate={dateStr} entries={entries} />
    </div>
  );
}
