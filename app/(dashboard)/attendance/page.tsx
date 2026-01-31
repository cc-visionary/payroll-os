// =============================================================================
// PeopleOS PH - Attendance Page
// =============================================================================

import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function AttendancePage() {
  await requirePermission(Permission.ATTENDANCE_VIEW);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-600 mt-1">
            Manage employee attendance records
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/attendance/import">
            <Button>Import Attendance</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Import Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Upload CSV or Excel files containing attendance data from biometric
              systems or manual timesheets.
            </p>
            <Link href="/attendance/import">
              <Button variant="outline" className="w-full">
                Import File
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              View and manage attendance records for a specific date.
            </p>
            <Link href="/attendance/daily">
              <Button variant="outline" className="w-full">
                View Daily Attendance
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Computation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Compute attendance records from raw time logs for a pay period.
            </p>
            <Button variant="outline" className="w-full" disabled>
              Compute (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Attendance Import Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-800">1. Upload</div>
              <p className="text-sm text-blue-600 mt-1">
                Upload CSV or Excel file with employee attendance data
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-800">2. Map</div>
              <p className="text-sm text-blue-600 mt-1">
                Map columns to Employee ID, Date, Time In, Time Out
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-800">3. Validate</div>
              <p className="text-sm text-blue-600 mt-1">
                Match employees, check for duplicates and errors
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-lg font-semibold text-blue-800">4. Import</div>
              <p className="text-sm text-blue-600 mt-1">
                Create RawTimeLog records for payroll computation
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-800">Employee Matching</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Employees are matched using <strong>Employee Number</strong> (primary).
              The import will fail for rows where no matching employee is found.
              Ensure your import file uses the same Employee IDs as configured in
              the employee records.
            </p>
          </div>

          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800">Duplicate Prevention</h4>
            <p className="text-sm text-green-700 mt-1">
              The system prevents duplicate imports through:
            </p>
            <ul className="text-sm text-green-700 mt-2 list-disc list-inside">
              <li>
                <strong>File hash check:</strong> Same file cannot be imported twice
                within 24 hours
              </li>
              <li>
                <strong>Record check:</strong> Attendance records are unique per
                employee per date
              </li>
              <li>
                <strong>Locked records:</strong> Records linked to payroll runs
                cannot be modified
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
