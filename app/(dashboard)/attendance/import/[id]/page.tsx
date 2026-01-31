// =============================================================================
// PeopleOS PH - Import Details Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { getImportDetails } from "@/app/actions/attendance-import";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteImportButton } from "./delete-import-button";

interface ImportDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImportDetailsPage({
  params,
}: ImportDetailsPageProps) {
  await requirePermission(Permission.ATTENDANCE_IMPORT);
  const { id } = await params;

  const result = await getImportDetails(id);

  if (!result.success || !result.import) {
    notFound();
  }

  const importData = result.import;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/attendance/import"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Import
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {importData.fileName}
            </h1>
            <ImportStatusBadge status={importData.status} />
          </div>
          <DeleteImportButton
            importId={importData.id}
            fileName={importData.fileName}
          />
        </div>
        <p className="text-gray-600 mt-1">
          Imported {importData.createdAt.toLocaleString()}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-900">
              {importData.totalRows}
            </div>
            <div className="text-sm text-gray-500">Total Rows</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {importData.validRows}
            </div>
            <div className="text-sm text-gray-500">Valid</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {importData.invalidRows}
            </div>
            <div className="text-sm text-gray-500">Invalid</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">
              {importData.duplicateRows}
            </div>
            <div className="text-sm text-gray-500">Duplicates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-gray-500">Completed</div>
            <div className="text-lg font-medium">
              {importData.completedAt
                ? importData.completedAt.toLocaleTimeString()
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {importData.errorMessage && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Import Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-700 whitespace-pre-wrap">
              {importData.errorMessage}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Info about raw rows */}
      <Card>
        <CardHeader>
          <CardTitle>Import Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">
            Attendance data has been written directly to employee records.
            View individual employee attendance for imported data.
          </p>
        </CardContent>
      </Card>
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

function RowStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "warning" | "danger" | "default"> = {
    VALID: "success",
    INVALID: "danger",
    DUPLICATE: "warning",
    SKIPPED: "default",
    PENDING: "default",
  };

  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}
