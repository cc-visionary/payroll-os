"use client";

// =============================================================================
// PeopleOS PH - Role Scorecard List Component
// =============================================================================

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteRoleScorecard } from "@/app/actions/settings";
import {
  downloadRoleScorecardTemplate,
  validateRoleScorecardImport,
  importRoleScorecards,
  type ImportValidationResult,
} from "@/app/actions/role-scorecard-import";

interface RoleScorecard {
  id: string;
  jobTitle: string;
  department: { id: string; name: string; code: string } | null;
  missionStatement: string | null;
  baseSalary: number | null;
  salaryRangeMin: number | null;
  salaryRangeMax: number | null;
  wageType: string;
  workHoursPerDay: number;
  workDaysPerWeek: string;
  shiftTemplate: { id: string; name: string; code: string } | null;
  isActive: boolean;
  effectiveDate: Date;
  createdAt: Date;
  assignedActiveEmployees: number;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface RoleScorecardListProps {
  scorecards: RoleScorecard[];
  departments: Department[];
  canEdit: boolean;
  canDelete: boolean;
}

export function RoleScorecardList({
  scorecards,
  departments,
  canEdit,
  canDelete,
}: RoleScorecardListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "result">("upload");
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter scorecards
  const filteredScorecards = scorecards.filter((sc) => {
    const matchesDepartment = !filterDepartment || sc.department?.id === filterDepartment;
    const matchesSearch =
      !searchQuery ||
      sc.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sc.missionStatement?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const handleDelete = async () => {
    if (!deleteModal) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteRoleScorecard(deleteModal.id);
      if (result.success) {
        setDeleteModal(null);
        router.refresh();
      } else {
        setError(result.error || "Failed to delete role scorecard");
      }
    });
  };

  const handleDownloadTemplate = async () => {
    startTransition(async () => {
      const result = await downloadRoleScorecardTemplate();
      if (result.success && result.content) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError("Failed to download template");
      }
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setValidationResult(null);
    setImportResult(null);

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setFileContent(base64);

      startTransition(async () => {
        const result = await validateRoleScorecardImport(base64);
        setValidationResult(result);
        setImportStep("preview");
      });
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!fileContent) return;

    setError(null);
    startTransition(async () => {
      const result = await importRoleScorecards(fileContent);
      setImportResult(result);
      setImportStep("result");
      if (result.imported > 0) {
        router.refresh();
      }
    });
  };

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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by job title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              setImportModal(true);
              setImportStep("upload");
              setValidationResult(null);
              setImportResult(null);
              setFileContent(null);
              setError(null);
            }}
            disabled={isPending}
          >
            Import XLSX
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {filteredScorecards.length} of {scorecards.length} role scorecards
      </div>

      {/* Scorecards Grid */}
      {filteredScorecards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No role scorecards found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScorecards.map((scorecard) => (
            <Card key={scorecard.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Link
                      href={`/role-scorecards/${scorecard.id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {scorecard.jobTitle}
                    </Link>
                    {scorecard.department && (
                      <p className="text-sm text-gray-500">{scorecard.department.name}</p>
                    )}
                  </div>
                  <Badge variant={scorecard.isActive ? "success" : "default"}>
                    {scorecard.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {scorecard.missionStatement && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {scorecard.missionStatement}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {scorecard.baseSalary && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Base Salary:</span>
                      <span className="text-gray-900 font-medium">
                        {formatCurrency(scorecard.baseSalary)} ({formatWageType(scorecard.wageType)})
                      </span>
                    </div>
                  )}
                  {(scorecard.salaryRangeMin || scorecard.salaryRangeMax) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Range:</span>
                      <span className="text-gray-900">
                        {scorecard.salaryRangeMin ? formatCurrency(scorecard.salaryRangeMin) : "N/A"} -{" "}
                        {scorecard.salaryRangeMax ? formatCurrency(scorecard.salaryRangeMax) : "N/A"}
                      </span>
                    </div>
                  )}
                  {scorecard.shiftTemplate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shift:</span>
                      <span className="text-gray-900">{scorecard.shiftTemplate.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hours:</span>
                    <span className="text-gray-900">
                      {scorecard.workHoursPerDay}h/day, {scorecard.workDaysPerWeek}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Assigned:</span>
                    <span className="text-gray-900">
                      {scorecard.assignedActiveEmployees} employee{scorecard.assignedActiveEmployees !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <span className="text-xs text-gray-400">
                    Effective: {formatDate(scorecard.effectiveDate)}
                  </span>
                  <div className="flex gap-2">
                    {canEdit && (
                      <Link href={`/role-scorecards/${scorecard.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                    )}
                    {canDelete && (
                      <div className="relative group">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDeleteModal({ id: scorecard.id, title: scorecard.jobTitle })
                          }
                          disabled={scorecard.assignedActiveEmployees > 0}
                          className={
                            scorecard.assignedActiveEmployees > 0
                              ? "text-gray-400 border-gray-200 cursor-not-allowed"
                              : "text-red-600 hover:text-red-700 hover:border-red-300"
                          }
                        >
                          Delete
                        </Button>
                        {scorecard.assignedActiveEmployees > 0 && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {scorecard.assignedActiveEmployees} active employee{scorecard.assignedActiveEmployees > 1 ? "s" : ""} assigned.
                            <br />
                            Reassign or separate them first.
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Role Scorecard"
        size="sm"
      >
        <p className="text-gray-600">
          Are you sure you want to delete the role scorecard &quot;{deleteModal?.title}&quot;? This
          action cannot be undone.
        </p>
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteModal(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isPending}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={importModal}
        onClose={() => {
          setImportModal(false);
          setImportStep("upload");
          setValidationResult(null);
          setImportResult(null);
          setFileContent(null);
          setError(null);
        }}
        title="Import Role Scorecards"
        size="lg"
      >
        <div className="space-y-4">
          {/* Step 1: Upload */}
          {importStep === "upload" && (
            <>
              <p className="text-gray-600">
                Upload an XLSX file with role scorecards. Download the template to see the expected format.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={isPending}
                >
                  Download Template
                </Button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-gray-700 mb-2">How it works:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Multiple rows with the same <code>job_title</code> = one role scorecard</li>
                  <li>First row contains main fields (department, salary, mission, etc.)</li>
                  <li>Additional rows add responsibilities and KPIs</li>
                </ul>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="xlsx-import"
                />
                <label
                  htmlFor="xlsx-import"
                  className="cursor-pointer text-blue-600 hover:text-blue-800"
                >
                  {isPending ? (
                    <span className="text-gray-500">Validating...</span>
                  ) : (
                    <>
                      <span className="underline">Choose an XLSX file</span>
                      <span className="text-gray-500"> or drag and drop</span>
                    </>
                  )}
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
              )}
            </>
          )}

          {/* Step 2: Preview */}
          {importStep === "preview" && validationResult && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Preview Import</h3>
                <Badge variant={validationResult.errors.length === 0 ? "success" : "danger"}>
                  {validationResult.validRoles.length} roles found
                </Badge>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-red-800 mb-2">Errors:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {validationResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>Row {err.row}: {err.message}</li>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <li className="text-red-600">...and {validationResult.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-medium text-yellow-800 mb-2">Warnings:</p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {validationResult.warnings.slice(0, 5).map((warn, i) => (
                      <li key={i}>Row {warn.row}: {warn.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.validRoles.length > 0 && (
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Job Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Department</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Wage Type</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Salary</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Resp.</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">KPIs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {validationResult.validRoles.map((role, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-sm text-gray-900">{role.jobTitle}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{role.departmentName || "-"}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{role.wageType}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {role.baseSalary ? formatCurrency(role.baseSalary) : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 text-center">{role.responsibilityCount}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 text-center">{role.kpiCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Step 3: Result */}
          {importStep === "result" && importResult && (
            <div className={`p-4 rounded-lg ${importResult.imported > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`font-medium ${importResult.imported > 0 ? "text-green-800" : "text-red-800"}`}>
                {importResult.imported > 0 ? "Import Complete" : "Import Failed"}
              </p>
              <ul className="mt-2 text-sm text-gray-700">
                <li>Imported: {importResult.imported} scorecards</li>
                <li>Skipped: {importResult.skipped} roles</li>
              </ul>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-700">Errors:</p>
                  <ul className="text-sm text-red-600 mt-1 space-y-1">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>Row {err.row}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <ModalFooter>
          {importStep === "upload" && (
            <Button
              variant="outline"
              onClick={() => {
                setImportModal(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          )}

          {importStep === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setImportStep("upload");
                  setValidationResult(null);
                  setFileContent(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isPending || !validationResult?.validRoles.length}
                loading={isPending}
              >
                Import {validationResult?.validRoles.length || 0} Roles
              </Button>
            </>
          )}

          {importStep === "result" && (
            <Button
              variant="outline"
              onClick={() => {
                setImportModal(false);
                setImportStep("upload");
                setValidationResult(null);
                setImportResult(null);
                setFileContent(null);
              }}
            >
              Close
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
