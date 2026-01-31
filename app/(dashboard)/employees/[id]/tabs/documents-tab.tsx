"use client";

// =============================================================================
// PeopleOS PH - Documents Tab
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { generateDocument } from "@/app/actions/documents";

interface EmployeeDocument {
  id: string;
  documentType: string;
  title: string;
  description: string | null;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  requiresAcknowledgment: boolean;
  acknowledgedAt: Date | null;
  uploadedBy: { id: string; email: string } | null;
  acknowledgedBy: { id: string; email: string } | null;
  createdAt: Date;
}

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

interface RoleScorecardOption {
  id: string;
  jobTitle: string;
  department: { id: string; name: string } | null;
}

interface DocumentsTabProps {
  employeeId: string;
  documents: EmployeeDocument[];
  canGenerate: boolean;
  employees: EmployeeOption[];
  roleScorecards: RoleScorecardOption[];
}

const documentTypeOptions = [
  // Employment Documents
  { value: "certificate_of_employment", label: "Certificate of Employment (COE)" },
  { value: "employment_contract", label: "Employment Contract" },
  { value: "offer_letter", label: "Offer Letter" },
  // HR Memos
  { value: "salary_change_memo", label: "Salary Change Memorandum" },
  { value: "regularization_memo", label: "Regularization Memorandum" },
  { value: "lateral_transfer", label: "Notice of Lateral Transfer" },
  // Separation Documents
  { value: "separation_clearance", label: "Separation Clearance Form" },
  { value: "quitclaim_release", label: "Quitclaim and Release" },
  // Disciplinary Documents
  { value: "disciplinary_warning", label: "Disciplinary Warning Letter" },
  { value: "disciplinary_action", label: "Disciplinary Action Letter" },
  { value: "notice_to_explain", label: "Notice to Explain (NTE)" },
  { value: "notice_of_decision", label: "Notice of Decision (NOD)" },
  // Financial Documents
  { value: "repayment_agreement", label: "Employee Repayment Agreement" },
];

const documentTypeLabels: Record<string, string> = {
  certificate_of_employment: "COE",
  salary_change_memo: "Salary Memo",
  regularization_memo: "Regularization Memo",
  separation_clearance: "Clearance",
  payslip: "Payslip",
  employment_contract: "Contract",
  offer_letter: "Offer Letter",
  lateral_transfer: "Transfer Notice",
  quitclaim_release: "Quitclaim",
  disciplinary_warning: "Warning",
  disciplinary_action: "Disciplinary Action",
  notice_to_explain: "NTE",
  notice_of_decision: "NOD",
  repayment_agreement: "Repayment Agreement",
};

// Document types that require additional options
const documentsWithOptions = [
  "salary_change_memo",
  "regularization_memo",
  "lateral_transfer",
  "quitclaim_release",
  "disciplinary_warning",
  "disciplinary_action",
  "notice_to_explain",
  "notice_of_decision",
  "repayment_agreement",
  "offer_letter",
  "employment_contract",
];

export function DocumentsTab({ employeeId, documents, canGenerate, employees, roleScorecards }: DocumentsTabProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, unknown>>({});

  const resetOptions = () => {
    setOptions({});
    setError(null);
  };

  const handleGenerate = async () => {
    if (!selectedType) return;

    setError(null);

    startTransition(async () => {
      const result = await generateDocument(
        employeeId,
        selectedType as
          | "certificate_of_employment"
          | "salary_change_memo"
          | "regularization_memo"
          | "separation_clearance"
          | "employment_contract"
          | "offer_letter"
          | "lateral_transfer"
          | "quitclaim_release"
          | "disciplinary_warning"
          | "disciplinary_action"
          | "notice_to_explain"
          | "notice_of_decision"
          | "repayment_agreement",
        options
      );

      if (result.success) {
        setIsModalOpen(false);
        setSelectedType("");
        resetOptions();
        router.refresh();
      } else {
        setError(result.error || "Failed to generate document");
      }
    });
  };

  const openModal = () => {
    resetOptions();
    setIsModalOpen(true);
  };

  // Group documents by type
  const groupedDocs = documents.reduce((acc, doc) => {
    const type = doc.documentType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, EmployeeDocument[]>);

  const requiresOptions = documentsWithOptions.includes(selectedType);

  // Render options form based on document type
  const renderOptionsForm = () => {
    switch (selectedType) {
      case "salary_change_memo":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Previous Salary"
              type="number"
              placeholder="e.g., 25000"
              onChange={(e) => setOptions({ ...options, previousSalary: Number(e.target.value) })}
            />
            <Input
              label="New Salary"
              type="number"
              placeholder="e.g., 30000"
              onChange={(e) => setOptions({ ...options, newSalary: Number(e.target.value) })}
            />
            <Input
              label="Effective Date"
              type="date"
              onChange={(e) => setOptions({ ...options, effectiveDate: e.target.value })}
            />
          </div>
        );

      case "regularization_memo":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Probation Start Date"
              type="date"
              onChange={(e) => setOptions({ ...options, probationStartDate: e.target.value })}
            />
            <Input
              label="Regularization Effective Date"
              type="date"
              onChange={(e) => setOptions({ ...options, effectiveDate: e.target.value })}
            />
          </div>
        );

      case "lateral_transfer":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Old Position"
              placeholder="Current position title"
              onChange={(e) => setOptions({ ...options, oldPosition: e.target.value })}
            />
            <Input
              label="New Position"
              placeholder="New position title"
              onChange={(e) => setOptions({ ...options, newPosition: e.target.value })}
            />
            <Input
              label="New Department"
              placeholder="Department name"
              onChange={(e) => setOptions({ ...options, newDepartment: e.target.value })}
            />
            <Input
              label="New Supervisor Name"
              placeholder="Supervisor's full name"
              onChange={(e) => setOptions({ ...options, newSupervisorName: e.target.value })}
            />
            <Select
              label="Transfer Reason"
              options={[
                { value: "restructuring", label: "Company Restructuring" },
                { value: "discontinuance", label: "Discontinuance of Position" },
                { value: "operational_necessity", label: "Operational Necessity" },
                { value: "employee_request", label: "Employee Request" },
                { value: "performance", label: "Performance-Based" },
                { value: "other", label: "Other" },
              ]}
              onChange={(e) => setOptions({ ...options, transferReason: e.target.value })}
            />
            <Input
              label="Effective Date"
              type="date"
              onChange={(e) => setOptions({ ...options, effectiveDate: e.target.value })}
            />
          </div>
        );

      case "quitclaim_release":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Final Pay Amount"
              type="number"
              placeholder="Total final pay"
              onChange={(e) => setOptions({ ...options, lastPayAmount: Number(e.target.value) })}
            />
            <Select
              label="Separation Reason"
              options={[
                { value: "resignation", label: "Resignation" },
                { value: "termination", label: "Termination" },
                { value: "end_of_contract", label: "End of Contract" },
                { value: "probation_failed", label: "Probation Failed" },
                { value: "redundancy", label: "Redundancy" },
                { value: "retrenchment", label: "Retrenchment" },
              ]}
              onChange={(e) => setOptions({ ...options, separationReason: e.target.value })}
            />
            <Input
              label="Effective Date"
              type="date"
              onChange={(e) => setOptions({ ...options, effectiveDate: e.target.value })}
            />
            <Input
              label="Signing Location"
              placeholder="e.g., Makati City"
              onChange={(e) => setOptions({ ...options, signingLocation: e.target.value })}
            />

            {/* Manager/Signatories Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Signatories (for Notarization)</h4>
              <div className="space-y-3">
                <Select
                  label="Manager/Company Representative"
                  options={[
                    { value: "", label: "Select manager..." },
                    ...employees
                      .filter((emp) => emp.id !== employeeId)
                      .map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` - ${emp.jobTitle}` : ""}`,
                      })),
                  ]}
                  onChange={(e) => {
                    const selected = employees.find((emp) => emp.id === e.target.value);
                    if (selected) {
                      setOptions({
                        ...options,
                        managerName: `${selected.firstName} ${selected.lastName}`,
                        managerPosition: selected.jobTitle || "Manager",
                      });
                    }
                  }}
                />
                <Select
                  label="Witness 1"
                  options={[
                    { value: "", label: "Select witness 1..." },
                    ...employees
                      .filter((emp) => emp.id !== employeeId)
                      .map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` - ${emp.jobTitle}` : ""}`,
                      })),
                  ]}
                  onChange={(e) => {
                    const selected = employees.find((emp) => emp.id === e.target.value);
                    if (selected) {
                      setOptions({
                        ...options,
                        witness1Name: `${selected.firstName} ${selected.lastName}`,
                        witness1Position: selected.jobTitle || "",
                      });
                    }
                  }}
                />
                <Select
                  label="Witness 2"
                  options={[
                    { value: "", label: "Select witness 2..." },
                    ...employees
                      .filter((emp) => emp.id !== employeeId)
                      .map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` - ${emp.jobTitle}` : ""}`,
                      })),
                  ]}
                  onChange={(e) => {
                    const selected = employees.find((emp) => emp.id === e.target.value);
                    if (selected) {
                      setOptions({
                        ...options,
                        witness2Name: `${selected.firstName} ${selected.lastName}`,
                        witness2Position: selected.jobTitle || "",
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>
        );

      case "disciplinary_warning":
        return (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unsatisfactory Aspects (one per line)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="List performance issues..."
                onChange={(e) =>
                  setOptions({ ...options, unsatisfactoryAspects: e.target.value.split("\n").filter(Boolean) })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suggestions for Improvement (one per line)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="List improvement requirements..."
                onChange={(e) =>
                  setOptions({ ...options, suggestionsForImprovement: e.target.value.split("\n").filter(Boolean) })
                }
              />
            </div>
            <Input
              label="Improvement Period (days)"
              type="number"
              defaultValue="30"
              onChange={(e) => setOptions({ ...options, improvementPeriodDays: Number(e.target.value) })}
            />
          </div>
        );

      case "disciplinary_action":
        return (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Violation Details (Title | Description, one per line)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="e.g., Tardiness | Multiple late arrivals in March 2024"
                onChange={(e) => {
                  const violations = e.target.value.split("\n").filter(Boolean).map((line) => {
                    const [title, description] = line.split("|").map((s) => s.trim());
                    return { title: title || "", description: description || "" };
                  });
                  setOptions({ ...options, violations });
                }}
              />
            </div>
            <Input
              label="Suspension Days"
              type="number"
              placeholder="Leave blank if no suspension"
              onChange={(e) => setOptions({ ...options, suspensionDays: Number(e.target.value) || undefined })}
            />
            <Input
              label="Suspension Start Date"
              type="date"
              onChange={(e) => setOptions({ ...options, suspensionStartDate: e.target.value })}
            />
            <Input
              label="Suspension End Date"
              type="date"
              onChange={(e) => setOptions({ ...options, suspensionEndDate: e.target.value })}
            />
          </div>
        );

      case "notice_to_explain":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Incident Date"
              type="date"
              onChange={(e) => setOptions({ ...options, incidentDate: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Incident Description
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="Describe the incident..."
                onChange={(e) => setOptions({ ...options, incidentDescription: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alleged Violations (one per line)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="List alleged violations..."
                onChange={(e) =>
                  setOptions({ ...options, allegedViolations: e.target.value.split("\n").filter(Boolean) })
                }
              />
            </div>
            <Input
              label="Response Deadline"
              placeholder="e.g., 48 hours from receipt"
              defaultValue="48 hours from receipt of this notice"
              onChange={(e) => setOptions({ ...options, responseDeadline: e.target.value })}
            />
          </div>
        );

      case "notice_of_decision":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Original Incident Date"
              type="date"
              onChange={(e) => setOptions({ ...options, originalIncidentDate: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Original Violations (one per line)
              </label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                onChange={(e) =>
                  setOptions({ ...options, originalViolations: e.target.value.split("\n").filter(Boolean) })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Investigation Summary
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="Summary of investigation findings..."
                onChange={(e) => setOptions({ ...options, investigationSummary: e.target.value })}
              />
            </div>
            <Select
              label="Decision"
              options={[
                { value: "warning", label: "Written Warning" },
                { value: "suspension", label: "Suspension" },
                { value: "termination", label: "Termination" },
              ]}
              onChange={(e) => setOptions({ ...options, decision: e.target.value })}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Decision Details
              </label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="Details of the decision..."
                onChange={(e) => setOptions({ ...options, decisionDetails: e.target.value })}
              />
            </div>
            <Input
              label="Effective Date"
              type="date"
              onChange={(e) => setOptions({ ...options, effectiveDate: e.target.value })}
            />
          </div>
        );

      case "repayment_agreement":
        return (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Items to Repay (Date | Description | Amount, one per line)
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm"
                placeholder="e.g., 2024-01-15 | Lost company laptop | 45000"
                onChange={(e) => {
                  const items = e.target.value.split("\n").filter(Boolean).map((line) => {
                    const [date, explanation, amount] = line.split("|").map((s) => s.trim());
                    return { date: date || "", explanation: explanation || "", amount: Number(amount) || 0 };
                  });
                  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
                  setOptions({ ...options, items, totalAmount });
                }}
              />
            </div>
            <Select
              label="Repayment Method"
              options={[
                { value: "salary_deduction", label: "Salary Deduction" },
                { value: "lump_sum", label: "Lump Sum Payment" },
                { value: "thirteenth_month", label: "13th Month Deduction" },
              ]}
              onChange={(e) => setOptions({ ...options, repaymentMethod: e.target.value })}
            />
            <Input
              label="Installment Amount (if applicable)"
              type="number"
              placeholder="Monthly installment amount"
              onChange={(e) => setOptions({ ...options, installmentAmount: Number(e.target.value) || undefined })}
            />
            <Input
              label="Start Date"
              type="date"
              onChange={(e) => setOptions({ ...options, installmentStartDate: e.target.value })}
            />
          </div>
        );

      case "offer_letter":
        return (
          <div className="space-y-4 mt-4">
            <Input
              label="Job Title"
              placeholder="Position being offered"
              onChange={(e) => setOptions({ ...options, jobTitle: e.target.value })}
            />
            <Input
              label="Daily Salary Rate"
              type="number"
              placeholder="Daily rate"
              onChange={(e) => setOptions({ ...options, dailySalaryRate: Number(e.target.value) })}
            />
            <Select
              label="Employment Type"
              options={[
                { value: "probationary", label: "Probationary" },
                { value: "regular", label: "Regular" },
                { value: "project", label: "Project-Based" },
                { value: "contractual", label: "Contractual" },
              ]}
              onChange={(e) => setOptions({ ...options, employmentType: e.target.value })}
            />
            <Input
              label="Target Start Date"
              type="date"
              onChange={(e) => setOptions({ ...options, targetStartDate: e.target.value })}
            />
            <Input
              label="Office Location"
              placeholder="e.g., Makati Office"
              onChange={(e) => setOptions({ ...options, officeLocation: e.target.value })}
            />
            <Input
              label="Work Schedule"
              placeholder="e.g., Monday to Friday, 9AM-6PM"
              onChange={(e) => setOptions({ ...options, workSchedule: e.target.value })}
            />
            <Input
              label="Offer Valid Until"
              type="date"
              onChange={(e) => setOptions({ ...options, offerValidUntil: e.target.value })}
            />
          </div>
        );

      case "employment_contract":
        return (
          <div className="space-y-4 mt-4">
            {/* Role Scorecard Selection (Required) */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Role Scorecard (Required)</h4>
              <p className="text-xs text-blue-600 mb-2">
                A role scorecard defines the job responsibilities and KPIs for this position.
                The system will auto-select one based on the employee&apos;s job title and department if available.
              </p>
              <Select
                label="Select Role Scorecard"
                options={[
                  { value: "", label: "Auto-detect from employee..." },
                  ...roleScorecards.map((sc) => ({
                    value: sc.id,
                    label: `${sc.jobTitle}${sc.department ? ` - ${sc.department.name}` : ""}`,
                  })),
                ]}
                onChange={(e) => setOptions({ ...options, roleScorecardId: e.target.value || undefined })}
              />
              {roleScorecards.length === 0 && (
                <p className="text-xs text-red-600 mt-2">
                  No role scorecards found. Please create one in Settings &gt; Role Scorecards before generating this document.
                </p>
              )}
            </div>

            <Input
              label="Daily Salary Rate"
              type="number"
              placeholder="Daily rate"
              onChange={(e) => setOptions({ ...options, dailySalaryRate: Number(e.target.value) })}
            />
            <Input
              label="Probation Start Date"
              type="date"
              onChange={(e) => setOptions({ ...options, probationStartDate: e.target.value })}
            />
            <Input
              label="Probation End Date"
              type="date"
              onChange={(e) => setOptions({ ...options, probationEndDate: e.target.value })}
            />

            {/* Employer Representative Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Employer Representative</h4>
              <Select
                label="Select Representative"
                options={[
                  { value: "", label: "Select representative..." },
                  ...employees
                    .filter((emp) => emp.id !== employeeId)
                    .map((emp) => ({
                      value: emp.id,
                      label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` - ${emp.jobTitle}` : ""}`,
                    })),
                ]}
                onChange={(e) => {
                  const selected = employees.find((emp) => emp.id === e.target.value);
                  if (selected) {
                    setOptions({
                      ...options,
                      employerRepresentative: {
                        name: `${selected.firstName} ${selected.lastName}`,
                        title: selected.jobTitle || "Manager",
                      },
                    });
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                The representative&apos;s name and position will be automatically used.
              </p>
            </div>

            {/* Witnesses Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Witnesses</h4>
              <div className="space-y-3">
                <Select
                  label="Witness 1"
                  options={[
                    { value: "", label: "Select witness 1..." },
                    ...employees
                      .filter((emp) => emp.id !== employeeId)
                      .map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` - ${emp.jobTitle}` : ""}`,
                      })),
                  ]}
                  onChange={(e) => {
                    const selected = employees.find((emp) => emp.id === e.target.value);
                    if (selected) {
                      const currentWitnesses = (options.witnesses as Array<{ name: string; position: string }>) || [];
                      currentWitnesses[0] = {
                        name: `${selected.firstName} ${selected.lastName}`,
                        position: selected.jobTitle || "",
                      };
                      setOptions({ ...options, witnesses: currentWitnesses });
                    }
                  }}
                />
                <Select
                  label="Witness 2"
                  options={[
                    { value: "", label: "Select witness 2..." },
                    ...employees
                      .filter((emp) => emp.id !== employeeId)
                      .map((emp) => ({
                        value: emp.id,
                        label: `${emp.firstName} ${emp.lastName}${emp.jobTitle ? ` - ${emp.jobTitle}` : ""}`,
                      })),
                  ]}
                  onChange={(e) => {
                    const selected = employees.find((emp) => emp.id === e.target.value);
                    if (selected) {
                      const currentWitnesses = (options.witnesses as Array<{ name: string; position: string }>) || [];
                      currentWitnesses[1] = {
                        name: `${selected.firstName} ${selected.lastName}`,
                        position: selected.jobTitle || "",
                      };
                      setOptions({ ...options, witnesses: currentWitnesses });
                    }
                  }}
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate Document */}
      {canGenerate && (
        <Card>
          <CardHeader>
            <CardTitle>Generate Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Select
                  options={[{ value: "", label: "Select document type..." }, ...documentTypeOptions]}
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                />
              </div>
              <Button onClick={openModal} disabled={!selectedType}>
                Generate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-gray-500">No documents on file</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDocs).map(([type, docs]) => (
                <div key={type}>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">
                    {documentTypeLabels[type] || type}
                  </h4>
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {/* File Icon */}
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-blue-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>

                          <div>
                            <div className="font-medium text-gray-900">{doc.title}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(doc.createdAt)}
                              {doc.uploadedBy && ` • by ${doc.uploadedBy.email}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {doc.requiresAcknowledgment && (
                            <Badge
                              variant={doc.acknowledgedAt ? "success" : "warning"}
                            >
                              {doc.acknowledgedAt ? "Acknowledged" : "Pending Ack"}
                            </Badge>
                          )}

                          <a
                            href={`/api/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Document Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Generate ${documentTypeLabels[selectedType] || "Document"}`}
        size={requiresOptions ? "md" : "sm"}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
        )}

        <p className="text-gray-600">
          Generate a <strong>{documentTypeLabels[selectedType] || selectedType}</strong> for this
          employee.
        </p>

        {requiresOptions ? (
          <>
            <p className="text-sm text-gray-500 mt-2">
              Fill in the details below to customize the document.
            </p>
            {renderOptionsForm()}
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            The document will be created using the current employee data and saved to their file.
          </p>
        )}

        <ModalFooter>
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} loading={isPending}>
            Generate Document
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
