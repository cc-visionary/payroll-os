// =============================================================================
// PeopleOS PH - Attendance Import Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AttendanceImportWizard } from "./import-wizard";
import { getImportHistory } from "@/app/actions/attendance-import";
import { Badge } from "@/components/ui/badge";

export default async function AttendanceImportPage() {
  await requirePermission(Permission.ATTENDANCE_IMPORT);

  const historyResult = await getImportHistory(10);
  const recentImports = historyResult.success ? historyResult.imports || [] : [];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/attendance"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Attendance
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Import Attendance</h1>
        <p className="text-gray-600 mt-1">
          Upload CSV or Excel files containing attendance data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Import Wizard */}
        <div className="lg:col-span-2">
          <AttendanceImportWizard />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* File Format Guide */}
          <Card>
            <CardHeader>
              <CardTitle>File Format</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p>Supported formats: <strong>CSV, XLSX, XLS</strong></p>

              <div>
                <p className="font-medium">Required columns:</p>
                <ul className="list-disc list-inside text-gray-600">
                  <li>Employee ID or Employee Number</li>
                  <li>Date</li>
                </ul>
              </div>

              <div>
                <p className="font-medium">Optional columns:</p>
                <ul className="list-disc list-inside text-gray-600">
                  <li>Employee Name (for verification)</li>
                  <li>Time In</li>
                  <li>Time Out</li>
                  <li>Shift</li>
                  <li>Remarks</li>
                </ul>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-800">Date formats:</p>
                <p className="text-blue-600">
                  YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-800">Time formats:</p>
                <p className="text-blue-600">
                  HH:MM (24h), HH:MM:SS, HH:MM AM/PM
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Imports */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Imports</CardTitle>
            </CardHeader>
            <CardContent>
              {recentImports.length === 0 ? (
                <p className="text-sm text-gray-500">No imports yet</p>
              ) : (
                <div className="space-y-3">
                  {recentImports.map((imp) => (
                    <Link
                      key={imp.id}
                      href={`/attendance/import/${imp.id}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate max-w-[150px]">
                          {imp.fileName}
                        </span>
                        <ImportStatusBadge status={imp.status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {imp.totalRows} rows • {imp.createdAt.toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ImportStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "warning" | "danger" | "default"> = {
    COMPLETED: "success",
    PARTIALLY_COMPLETED: "warning",
    FAILED: "danger",
    PROCESSING: "default",
    PENDING: "default",
  };

  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}
