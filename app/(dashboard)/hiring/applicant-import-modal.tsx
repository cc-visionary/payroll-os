"use client";

// =============================================================================
// PeopleOS PH - Applicant Import Modal
// =============================================================================

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter } from "@/components/ui/modal";
import {
  downloadApplicantTemplate,
  validateApplicantImport,
  importApplicants,
  exportApplicants,
  type ApplicantImportValidationResult,
} from "@/app/actions/applicant-import";

interface ApplicantImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApplicantImportModal({ isOpen, onClose }: ApplicantImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [validation, setValidation] = useState<ApplicantImportValidationResult | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const resetModal = () => {
    setStep("upload");
    setError(null);
    setFileContent(null);
    setValidation(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    startTransition(async () => {
      const result = await downloadApplicantTemplate();
      if (result.success) {
        // Handle base64 content for XLSX
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
      }
    });
  };

  const handleExportExisting = async () => {
    startTransition(async () => {
      const result = await exportApplicants();
      if (result.success) {
        // Handle base64 content for XLSX
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
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Read file as base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = btoa(binary);
      setFileContent(base64Content);

      // Validate
      startTransition(async () => {
        const result = await validateApplicantImport(base64Content);
        setValidation(result);
        if (result.success || result.validApplicants.length > 0) {
          setStep("preview");
        } else if (result.errors.length > 0) {
          setError(result.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n"));
        }
      });
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!fileContent) return;

    setError(null);
    startTransition(async () => {
      const result = await importApplicants(fileContent);
      if (result.success || result.imported > 0) {
        setImportResult({ imported: result.imported, skipped: result.skipped });
        setStep("result");
        router.refresh();
      } else {
        setError(result.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n"));
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Applicants" size="lg">
      {step === "upload" && (
        <>
          <div className="space-y-6">
            {/* Download Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Step 1: Download Template</h4>
              <p className="text-sm text-blue-700 mb-3">
                Download the Excel template with the correct column headers and fill in your applicant
                data. The template includes reference sheets for departments, positions, and more.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={isPending}
                >
                  Download Template (.xlsx)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportExisting}
                  disabled={isPending}
                >
                  Export Existing Applicants
                </Button>
              </div>
            </div>

            {/* Upload File */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <h4 className="font-medium text-gray-900 mb-2">Step 2: Upload Excel File</h4>
              <p className="text-sm text-gray-500 mb-4">
                Select your completed Excel file (.xlsx) to import applicants.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="applicant-xlsx-upload"
              />
              <label
                htmlFor="applicant-xlsx-upload"
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                <svg
                  className="w-5 h-5 mr-2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Choose Excel File
              </label>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-1">Validation Errors</h4>
                <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </ModalFooter>
        </>
      )}

      {step === "preview" && validation && (
        <>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800">
                Ready to import {validation.validApplicants.length} applicant(s)
              </h4>
            </div>

            {validation.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                <ul className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
                  {validation.warnings.map((w, i) => (
                    <li key={i}>
                      Row {w.row}: {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {validation.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Errors (will be skipped)</h4>
                <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                  {validation.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Position
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Department
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Source
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Expected Salary
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {validation.validApplicants.map((app, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{app.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{app.email}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{app.position || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {app.departmentName || "-"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{app.source || "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        {app.expectedSalary || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-1">Import Errors</h4>
                <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button onClick={handleImport} loading={isPending} disabled={validation.validApplicants.length === 0}>
              Import {validation.validApplicants.length} Applicant(s)
            </Button>
          </ModalFooter>
        </>
      )}

      {step === "result" && importResult && (
        <>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Import Complete</h3>
            <p className="text-gray-500">
              Successfully imported {importResult.imported} applicant(s).
              {importResult.skipped > 0 && ` ${importResult.skipped} row(s) were skipped.`}
            </p>
          </div>

          <ModalFooter>
            <Button onClick={handleClose}>Done</Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
