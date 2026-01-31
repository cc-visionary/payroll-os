"use client";

// =============================================================================
// PeopleOS PH - Attendance Import Wizard
// =============================================================================

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  parseAttendanceFile,
  getFileHeaders,
  detectColumnMapping,
} from "@/lib/attendance/file-parser";
import type {
  AttendanceColumnMapping,
  AttendanceImportConfig,
  ImportPreviewResult,
  ValidatedAttendanceRow,
} from "@/lib/attendance/import-types";
import { DEFAULT_IMPORT_CONFIG } from "@/lib/attendance/import-types";
import {
  createImportRecord,
  previewImport,
  commitImport,
} from "@/app/actions/attendance-import";

type WizardStep = "upload" | "mapping" | "preview" | "complete";

export function AttendanceImportWizard() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [detectedMapping, setDetectedMapping] = useState<Partial<AttendanceColumnMapping>>({});
  const [columnMapping, setColumnMapping] = useState<AttendanceColumnMapping>(
    DEFAULT_IMPORT_CONFIG.columnMapping
  );

  // Import state
  const [importId, setImportId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [validatedRows, setValidatedRows] = useState<ValidatedAttendanceRow[]>([]);
  const [config, setConfig] = useState<AttendanceImportConfig>(DEFAULT_IMPORT_CONFIG);

  // Result state
  const [result, setResult] = useState<{
    success: boolean;
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // Preview display state
  const [showAllPreview, setShowAllPreview] = useState(false);

  // Step 1: File Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);
    setFile(selectedFile);

    try {
      const fileHeaders = await getFileHeaders(selectedFile);
      setHeaders(fileHeaders);

      const detected = detectColumnMapping(fileHeaders);
      setDetectedMapping(detected);

      // Pre-fill mapping with detected values
      setColumnMapping({
        ...DEFAULT_IMPORT_CONFIG.columnMapping,
        ...detected,
      });

      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  // Step 2: Column Mapping
  const handleMappingChange = (field: keyof AttendanceColumnMapping, value: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleMappingSubmit = async () => {
    if (!file) return;

    setError(null);

    startTransition(async () => {
      try {
        // Parse file with mapping
        const { rows } = await parseAttendanceFile(file, columnMapping);

        if (rows.length === 0) {
          setError("No valid rows found in file");
          return;
        }

        // Compute file hash
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        // Create import record
        const createResult = await createImportRecord({
          fileName: file.name,
          fileSize: file.size,
          fileHash,
          columnMapping,
          totalRows: rows.length,
        });

        if (!createResult.success || !createResult.importId) {
          setError(createResult.error || "Failed to create import");
          return;
        }

        setImportId(createResult.importId);

        // Preview import
        const previewResult = await previewImport({
          importId: createResult.importId,
          rows: rows.map((r) => ({
            rowNumber: r.rowNumber,
            rawData: r.rawData,
            employeeCode: r.employeeCode,
            employeeEmail: r.employeeEmail,
            employeeName: r.employeeName,
            date: r.date,
            timeIn: r.timeIn,
            timeOut: r.timeOut,
            shift: r.shift,
            remarks: r.remarks,
            attendanceResult: r.attendanceResult,
          })),
          config,
        });

        if (!previewResult.success || !previewResult.preview) {
          setError(previewResult.error || "Failed to preview import");
          return;
        }

        setPreview(previewResult.preview);
        // Use ALL validated rows for commit, not just the sample rows shown in preview
        setValidatedRows(previewResult.preview.allValidatedRows);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process file");
      }
    });
  };

  // Step 3: Commit Import
  const handleCommit = async () => {
    if (!importId || !preview) return;

    setError(null);

    startTransition(async () => {
      try {
        const commitResult = await commitImport({
          importId,
          validatedRows,
          duplicateStrategy: config.duplicateStrategy,
        });

        setResult({
          success: commitResult.success,
          created: commitResult.rowsProcessed,
          skipped: commitResult.skippedDuplicates,
          errors: commitResult.errors,
        });

        setStep("complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to commit import");
      }
    });
  };

  // Reset wizard
  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setDetectedMapping({});
    setColumnMapping(DEFAULT_IMPORT_CONFIG.columnMapping);
    setImportId(null);
    setPreview(null);
    setValidatedRows([]);
    setResult(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === "upload" && "Step 1: Upload File"}
          {step === "mapping" && "Step 2: Map Columns"}
          {step === "preview" && "Step 3: Review & Import"}
          {step === "complete" && "Import Complete"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="text-4xl mb-2">📄</div>
                <p className="text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  CSV, XLSX, or XLS files
                </p>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{file?.name}</p>
              <p className="text-sm text-gray-500">
                {headers.length} columns detected
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MappingSelect
                label="Employee ID Column"
                description="Maps to Employee ID in database"
                value={columnMapping.employeeCode || ""}
                options={headers}
                onChange={(v) => handleMappingChange("employeeCode", v)}
                detected={detectedMapping.employeeCode}
                required
              />

              <MappingSelect
                label="Date Column"
                value={columnMapping.date || ""}
                options={headers}
                onChange={(v) => handleMappingChange("date", v)}
                detected={detectedMapping.date}
                required
              />

              <MappingSelect
                label="Time In Column"
                value={columnMapping.timeIn || ""}
                options={headers}
                onChange={(v) => handleMappingChange("timeIn", v)}
                detected={detectedMapping.timeIn}
              />

              <MappingSelect
                label="Time Out Column"
                value={columnMapping.timeOut || ""}
                options={headers}
                onChange={(v) => handleMappingChange("timeOut", v)}
                detected={detectedMapping.timeOut}
              />

              <MappingSelect
                label="Shift Column"
                value={columnMapping.shift || ""}
                options={headers}
                onChange={(v) => handleMappingChange("shift", v)}
                detected={detectedMapping.shift}
              />

              <MappingSelect
                label="Attendance Result Column"
                description="Detects leave status (e.g., 'Optional (Leave)')"
                value={columnMapping.attendanceResult || ""}
                options={headers}
                onChange={(v) => handleMappingChange("attendanceResult", v)}
                detected={detectedMapping.attendanceResult}
              />
            </div>

            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-800">Duplicate Handling</p>
              <div className="mt-2 flex gap-4">
                {(["SKIP", "REPLACE", "ERROR"] as const).map((strategy) => (
                  <label key={strategy} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="duplicateStrategy"
                      checked={config.duplicateStrategy === strategy}
                      onChange={() =>
                        setConfig((c) => ({ ...c, duplicateStrategy: strategy }))
                      }
                    />
                    <span className="text-blue-700">
                      {strategy === "SKIP" && "Skip duplicates"}
                      {strategy === "REPLACE" && "Replace existing"}
                      {strategy === "ERROR" && "Fail on duplicates"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={handleReset}>
                Back
              </Button>
              <Button
                onClick={handleMappingSubmit}
                loading={isPending}
                disabled={!columnMapping.employeeCode || !columnMapping.date}
              >
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <SummaryCard
                label="Total Rows"
                value={preview.totalRows}
                variant="default"
              />
              <SummaryCard
                label="Valid"
                value={preview.validRows}
                variant="success"
              />
              <SummaryCard
                label="Invalid"
                value={preview.invalidRows}
                variant="error"
              />
              <SummaryCard
                label="Duplicates"
                value={preview.duplicateRows}
                variant="warning"
              />
            </div>

            {/* Employee Matching */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">Employee Matching</p>
              <div className="mt-2 text-sm text-gray-600">
                <span className="text-green-600">
                  {preview.matchedEmployees} matched
                </span>
                {preview.unmatchedEmployees > 0 && (
                  <span className="text-red-600 ml-4">
                    {preview.unmatchedEmployees} unmatched
                  </span>
                )}
                {preview.ambiguousMatches > 0 && (
                  <span className="text-orange-600 ml-4">
                    {preview.ambiguousMatches} ambiguous
                  </span>
                )}
              </div>
            </div>

            {/* Error Summary */}
            {Object.keys(preview.errorSummary).length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="font-medium text-red-800">Validation Errors</p>
                <div className="mt-2 space-y-1 text-sm">
                  {Object.entries(preview.errorSummary).map(([code, count]) => (
                    <div key={code} className="flex justify-between text-red-600">
                      <span>{formatErrorCode(code)}</span>
                      <span>{count} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning Summary */}
            {Object.keys(preview.warningSummary).length > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="font-medium text-yellow-800">Warnings</p>
                <div className="mt-2 space-y-1 text-sm">
                  {Object.entries(preview.warningSummary).map(([code, count]) => (
                    <div key={code} className="flex justify-between text-yellow-600">
                      <span>{formatErrorCode(code)}</span>
                      <span>{count} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Rows Table */}
            <div className="border rounded-lg overflow-hidden">
              {/* Show All Toggle */}
              <div className="px-4 py-2 bg-gray-50 flex items-center justify-between border-b">
                <span className="text-sm text-gray-600">
                  {showAllPreview
                    ? `Showing all ${preview.allValidatedRows.length} rows`
                    : `Showing first 20 of ${preview.allValidatedRows.length} rows`}
                </span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showAllPreview}
                    onChange={(e) => setShowAllPreview(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Show all rows</span>
                </label>
              </div>
              <div className={showAllPreview ? "max-h-[500px] overflow-y-auto" : ""}>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Row</th>
                      <th className="px-4 py-2 text-left">Employee ID</th>
                      <th className="px-4 py-2 text-left">Matched Employee</th>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Shift</th>
                      <th className="px-4 py-2 text-left">Time In</th>
                      <th className="px-4 py-2 text-left">Time Out</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(showAllPreview ? preview.allValidatedRows : preview.sampleRows.slice(0, 20)).map((row) => (
                      <tr key={row.rowNumber} className={row.status === "INVALID" ? "bg-red-50" : row.status === "DUPLICATE" ? "bg-yellow-50" : ""}>
                        <td className="px-4 py-2">{row.rowNumber}</td>
                        <td className="px-4 py-2 font-mono text-sm">{row.employeeCode}</td>
                        <td className="px-4 py-2">
                          {row.matchedEmployeeName || (
                            <span className="text-red-500 text-xs">Not matched</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {row.date?.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2">
                          <ShiftBadge shift={row.shift} hasTemplate={!!row.shiftTemplateId} />
                        </td>
                        <td className="px-4 py-2">
                          {row.timeIn?.toLocaleTimeString("en-PH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Manila",
                          }) || "-"}
                        </td>
                        <td className="px-4 py-2">
                          {row.timeOut?.toLocaleTimeString("en-PH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Manila",
                          }) || "-"}
                        </td>
                        <td className="px-4 py-2">
                          <AttendanceTypeBadge type={row.attendanceType} holidayName={row.holidayName} />
                        </td>
                        <td className="px-4 py-2">
                          <RowStatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back
              </Button>
              <Button
                onClick={handleCommit}
                loading={isPending}
                disabled={preview.validRows === 0}
              >
                Import {preview.validRows} Valid Records
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && result && (
          <div className="space-y-4 text-center py-8">
            {result.success ? (
              <>
                <div className="text-6xl">✅</div>
                <h3 className="text-xl font-semibold text-green-700">
                  Import Successful
                </h3>
              </>
            ) : (
              <>
                <div className="text-6xl">⚠️</div>
                <h3 className="text-xl font-semibold text-orange-700">
                  Import Completed with Errors
                </h3>
              </>
            )}

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {result.created}
                </div>
                <div className="text-sm text-green-600">Rows Processed</div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">
                  {result.skipped}
                </div>
                <div className="text-sm text-yellow-600">Skipped</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg text-left max-w-md mx-auto">
                <p className="font-medium text-red-800">Errors:</p>
                <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>...and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            <Button onClick={handleReset}>Import Another File</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper Components

function MappingSelect({
  label,
  description,
  value,
  options,
  onChange,
  detected,
  required,
}: {
  label: string;
  description?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  detected?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-xs text-gray-500 mb-1">{description}</p>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- Select column --</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
            {opt === detected && " (auto-detected)"}
          </option>
        ))}
      </select>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "default" | "success" | "error" | "warning";
}) {
  const colors = {
    default: "bg-gray-50 text-gray-900",
    success: "bg-green-50 text-green-700",
    error: "bg-red-50 text-red-700",
    warning: "bg-yellow-50 text-yellow-700",
  };

  return (
    <div className={`p-4 rounded-lg ${colors[variant]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}

function RowStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "success" | "warning" | "danger" | "default"> = {
    VALID: "success",
    INVALID: "danger",
    DUPLICATE: "warning",
    SKIPPED: "default",
  };

  return <Badge variant={variants[status] || "default"}>{status}</Badge>;
}

function AttendanceTypeBadge({ type, holidayName }: { type?: string; holidayName?: string }) {
  if (!type) return <span className="text-gray-400">-</span>;

  const config: Record<string, { label: string; className: string }> = {
    PRESENT: { label: "Present", className: "bg-green-100 text-green-700" },
    ABSENT: { label: "Absent", className: "bg-red-100 text-red-700" },
    REST_DAY: { label: "Rest Day", className: "bg-blue-100 text-blue-700" },
    ON_LEAVE: { label: "On Leave", className: "bg-purple-100 text-purple-700" },
    REGULAR_HOLIDAY: { label: "Regular Holiday", className: "bg-orange-100 text-orange-700" },
    SPECIAL_HOLIDAY: { label: "Special Holiday", className: "bg-amber-100 text-amber-700" },
  };

  const { label, className } = config[type] || { label: type, className: "bg-gray-100 text-gray-700" };

  return (
    <div className="flex flex-col">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
        {label}
      </span>
      {holidayName && (
        <span className="text-xs text-gray-500 mt-0.5 max-w-[120px] truncate" title={holidayName}>
          {holidayName}
        </span>
      )}
    </div>
  );
}

function ShiftBadge({ shift, hasTemplate }: { shift?: string; hasTemplate: boolean }) {
  if (!shift || shift === "-") {
    return <span className="text-gray-400">-</span>;
  }

  // Format the shift display - extract just the time part if it has the dual format
  let displayShift = shift;
  const dualTimeMatch = shift.match(/(\d{1,2}:\d{2}-\d{1,2}:\d{2})$/);
  if (dualTimeMatch) {
    displayShift = dualTimeMatch[1];
  }

  return (
    <div className="flex flex-col">
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${hasTemplate ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
        {displayShift}
      </span>
      {hasTemplate && (
        <span className="text-xs text-green-600 mt-0.5">✓ Matched</span>
      )}
    </div>
  );
}

function formatErrorCode(code: string): string {
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
