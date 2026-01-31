"use client";

// =============================================================================
// PeopleOS PH - Employee Edit Form (Client Component)
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateEmployee, setDeclaredWageOverride, setTaxOnFullEarnings } from "@/app/actions/employees";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";

interface RoleScorecard {
  id: string;
  jobTitle: string;
  department: { id: string; name: string } | null;
  baseSalary: string | null;
  salaryRangeMin: string | null;
  salaryRangeMax: string | null;
  wageType: string;
  shiftTemplate: { id: string; name: string; code: string } | null;
}

interface HiringEntity {
  id: string;
  name: string;
  tradeName: string | null;
  tin: string | null;
}

interface EmployeeDropdownItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
}

interface Employee {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  birthDate: Date | null;
  gender: string | null;
  civilStatus: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  mobileNumber: string | null;
  phoneNumber: string | null;
  presentAddressLine1: string | null;
  presentAddressLine2: string | null;
  presentCity: string | null;
  presentProvince: string | null;
  presentZipCode: string | null;
  roleScorecardId: string | null;
  hiringEntityId: string | null;
  reportsToId: string | null;
}

interface DeclaredWageOverride {
  amount: number;
  wageType: "MONTHLY" | "DAILY" | "HOURLY" | null;
  effectiveAt: Date | null;
  reason: string | null;
}

interface EmployeeEditFormProps {
  employee: Employee;
  roleScorecards: RoleScorecard[];
  hiringEntities: HiringEntity[];
  employees: EmployeeDropdownItem[];
  // SUPER_ADMIN only - for declared wage override feature
  isSuperAdmin?: boolean;
  declaredWageOverride?: DeclaredWageOverride | null;
  taxOnFullEarnings?: boolean;
}

const genderOptions = [
  { value: "", label: "Select..." },
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
];

const civilStatusOptions = [
  { value: "", label: "Select..." },
  { value: "Single", label: "Single" },
  { value: "Married", label: "Married" },
  { value: "Widowed", label: "Widowed" },
  { value: "Separated", label: "Separated" },
];

export function EmployeeEditForm({
  employee,
  roleScorecards,
  hiringEntities,
  employees,
  isSuperAdmin = false,
  declaredWageOverride = null,
  taxOnFullEarnings = false,
}: EmployeeEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState(employee.roleScorecardId || "");
  const [selectedHiringEntityId, setSelectedHiringEntityId] = useState(employee.hiringEntityId || "");
  const [selectedReportsToId, setSelectedReportsToId] = useState(employee.reportsToId || "");

  // Declared Wage Override Modal state (SUPER_ADMIN only)
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState(
    declaredWageOverride?.amount?.toString() || ""
  );
  const [overrideWageType, setOverrideWageType] = useState<"MONTHLY" | "DAILY" | "HOURLY">(
    declaredWageOverride?.wageType || "MONTHLY"
  );
  const [overrideEffectiveDate, setOverrideEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverridePending, startOverrideTransition] = useTransition();
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const roleOptions = [
    { value: "", label: "Select role..." },
    ...roleScorecards.map((sc) => ({
      value: sc.id,
      label: sc.department ? `${sc.jobTitle} (${sc.department.name})` : sc.jobTitle,
    })),
  ];

  const hiringEntityOptions = [
    { value: "", label: "Select hiring entity..." },
    ...hiringEntities.map((he) => ({
      value: he.id,
      label: he.tradeName || he.name,
    })),
  ];

  // Filter out current employee from reports to options (can't report to themselves)
  const reportsToOptions = [
    { value: "", label: "No direct manager" },
    ...employees
      .filter((e) => e.id !== employee.id)
      .map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}${e.jobTitle ? ` - ${e.jobTitle}` : ""} (${e.employeeNumber})`,
      })),
  ];

  // Find the selected role scorecard
  const selectedRole = roleScorecards.find((sc) => sc.id === selectedRoleId);

  // Find the selected hiring entity
  const selectedHiringEntity = hiringEntities.find((he) => he.id === selectedHiringEntityId);

  // Find the selected reports to employee
  const selectedReportsTo = employees.find((e) => e.id === selectedReportsToId);

  const formatCurrency = (value: string | null) => {
    if (!value) return null;
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(parseFloat(value));
  };

  const formatWageType = (type: string) => {
    switch (type) {
      case "MONTHLY": return "monthly";
      case "DAILY": return "daily";
      case "HOURLY": return "hourly";
      default: return type.toLowerCase();
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleSetOverride = () => {
    if (!overrideAmount || parseFloat(overrideAmount) <= 0) {
      setOverrideError("Override amount must be positive");
      return;
    }
    if (overrideReason.trim().length < 10) {
      setOverrideError("Reason must be at least 10 characters");
      return;
    }

    setOverrideError(null);
    startOverrideTransition(async () => {
      const result = await setDeclaredWageOverride(employee.id, {
        declaredWageOverride: parseFloat(overrideAmount),
        declaredWageType: overrideWageType,
        effectiveDate: overrideEffectiveDate,
        reason: overrideReason,
      });

      if (result.success) {
        setIsOverrideModalOpen(false);
        setOverrideReason("");
        router.refresh();
      } else {
        setOverrideError(result.error || "Failed to set wage override");
      }
    });
  };

  const handleClearOverride = () => {
    if (overrideReason.trim().length < 10) {
      setOverrideError("Reason must be at least 10 characters");
      return;
    }

    setOverrideError(null);
    startOverrideTransition(async () => {
      const result = await setDeclaredWageOverride(employee.id, {
        declaredWageOverride: null,
        effectiveDate: overrideEffectiveDate,
        reason: overrideReason,
      });

      if (result.success) {
        setIsOverrideModalOpen(false);
        setOverrideAmount("");
        setOverrideReason("");
        router.refresh();
      } else {
        setOverrideError(result.error || "Failed to clear wage override");
      }
    });
  };

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const data = {
      firstName: formData.get("firstName") as string,
      middleName: (formData.get("middleName") as string) || undefined,
      lastName: formData.get("lastName") as string,
      suffix: (formData.get("suffix") as string) || undefined,
      birthDate: (formData.get("birthDate") as string) || undefined,
      gender: (formData.get("gender") as string) || undefined,
      civilStatus: (formData.get("civilStatus") as string) || undefined,
      personalEmail: (formData.get("personalEmail") as string) || undefined,
      workEmail: (formData.get("workEmail") as string) || undefined,
      mobileNumber: (formData.get("mobileNumber") as string) || undefined,
      phoneNumber: (formData.get("phoneNumber") as string) || undefined,
      presentAddressLine1: (formData.get("presentAddressLine1") as string) || undefined,
      presentAddressLine2: (formData.get("presentAddressLine2") as string) || undefined,
      presentCity: (formData.get("presentCity") as string) || undefined,
      presentProvince: (formData.get("presentProvince") as string) || undefined,
      presentZipCode: (formData.get("presentZipCode") as string) || undefined,
      roleScorecardId: selectedRoleId || undefined,
      hiringEntityId: selectedHiringEntityId || undefined,
      reportsToId: selectedReportsToId || null,
    };

    startTransition(async () => {
      const result = await updateEmployee(employee.id, data);
      if (result.success) {
        router.push(`/employees/${employee.id}`);
      } else {
        setError(result.error || "Failed to update employee");
      }
    });
  };

  return (
    <form action={handleSubmit}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="First Name"
                name="firstName"
                defaultValue={employee.firstName}
                required
              />
              <Input
                label="Middle Name"
                name="middleName"
                defaultValue={employee.middleName || ""}
              />
              <Input
                label="Last Name"
                name="lastName"
                defaultValue={employee.lastName}
                required
              />
              <Input
                label="Suffix"
                name="suffix"
                defaultValue={employee.suffix || ""}
                placeholder="Jr., Sr., III"
              />
            </div>
          </CardContent>
        </Card>

        {/* Personal Details */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Birth Date"
                name="birthDate"
                type="date"
                defaultValue={employee.birthDate?.toISOString().split("T")[0] || ""}
              />
              <Select
                label="Gender"
                name="gender"
                options={genderOptions}
                defaultValue={employee.gender || ""}
              />
              <Select
                label="Civil Status"
                name="civilStatus"
                options={civilStatusOptions}
                defaultValue={employee.civilStatus || ""}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Personal Email"
                name="personalEmail"
                type="email"
                defaultValue={employee.personalEmail || ""}
              />
              <Input
                label="Work Email"
                name="workEmail"
                type="email"
                defaultValue={employee.workEmail || ""}
              />
              <Input
                label="Mobile Number"
                name="mobileNumber"
                defaultValue={employee.mobileNumber || ""}
                placeholder="+63"
              />
              <Input
                label="Phone Number"
                name="phoneNumber"
                defaultValue={employee.phoneNumber || ""}
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Present Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Address Line 1"
                name="presentAddressLine1"
                defaultValue={employee.presentAddressLine1 || ""}
              />
              <Input
                label="Address Line 2"
                name="presentAddressLine2"
                defaultValue={employee.presentAddressLine2 || ""}
              />
              <Input
                label="City"
                name="presentCity"
                defaultValue={employee.presentCity || ""}
              />
              <Input
                label="Province"
                name="presentProvince"
                defaultValue={employee.presentProvince || ""}
              />
              <Input
                label="ZIP Code"
                name="presentZipCode"
                defaultValue={employee.presentZipCode || ""}
              />
            </div>
          </CardContent>
        </Card>

        {/* Employment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Employment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role Selection - determines job title and department */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Job title and department are automatically set based on the selected role.
                </p>
              </div>

              {/* Role Details - shown when a role is selected */}
              {selectedRole && (
                <div className="md:col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3">Role Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-blue-600 uppercase">Job Title</div>
                      <div className="text-sm font-medium text-blue-900">
                        {selectedRole.jobTitle}
                      </div>
                    </div>
                    {selectedRole.department && (
                      <div>
                        <div className="text-xs text-blue-600 uppercase">Department</div>
                        <div className="text-sm font-medium text-blue-900">
                          {selectedRole.department.name}
                        </div>
                      </div>
                    )}
                    {selectedRole.baseSalary && (
                      <div>
                        <div className="text-xs text-blue-600 uppercase">Base Salary</div>
                        <div className="text-lg font-semibold text-blue-900">
                          {formatCurrency(selectedRole.baseSalary)}
                        </div>
                        <div className="text-xs text-blue-600">
                          {formatWageType(selectedRole.wageType)}
                        </div>
                      </div>
                    )}
                    {selectedRole.shiftTemplate && (
                      <div>
                        <div className="text-xs text-blue-600 uppercase">Shift Template</div>
                        <div className="text-sm text-blue-900">
                          {selectedRole.shiftTemplate.name} ({selectedRole.shiftTemplate.code})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reports To Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reports To
                </label>
                <select
                  value={selectedReportsToId}
                  onChange={(e) => setSelectedReportsToId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                >
                  {reportsToOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The direct manager this employee reports to.
                </p>
              </div>

              {/* Reports To Details */}
              {selectedReportsTo && (
                <div className="md:col-span-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">Manager Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-purple-600 uppercase">Name</div>
                      <div className="text-purple-900">{selectedReportsTo.firstName} {selectedReportsTo.lastName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-purple-600 uppercase">Employee Number</div>
                      <div className="text-purple-900">{selectedReportsTo.employeeNumber}</div>
                    </div>
                    {selectedReportsTo.jobTitle && (
                      <div>
                        <div className="text-xs text-purple-600 uppercase">Position</div>
                        <div className="text-purple-900">{selectedReportsTo.jobTitle}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hiring Entity Selection */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hiring Entity <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedHiringEntityId}
                  onChange={(e) => setSelectedHiringEntityId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                >
                  {hiringEntityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The legal entity that employs this person (used for contracts and government filings).
                </p>
              </div>

              {/* Hiring Entity Details */}
              {selectedHiringEntity && (
                <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Hiring Entity Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Legal Name</div>
                      <div className="text-gray-900">{selectedHiringEntity.name}</div>
                    </div>
                    {selectedHiringEntity.tradeName && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase">Trade Name</div>
                        <div className="text-gray-900">{selectedHiringEntity.tradeName}</div>
                      </div>
                    )}
                    {selectedHiringEntity.tin && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase">TIN</div>
                        <div className="text-gray-900">{selectedHiringEntity.tin}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Declared Wage Override - SUPER_ADMIN Only */}
        {isSuperAdmin && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-amber-900 flex items-center gap-2">
                    Declared Wage Override
                    <Badge variant="warning" className="text-xs">SUPER_ADMIN ONLY</Badge>
                  </CardTitle>
                  <p className="text-sm text-amber-700 mt-1">
                    Override the role&apos;s base salary for statutory contributions (SSS, PhilHealth, PagIBIG) only.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOverrideModalOpen(true)}
                  className="border-amber-400 text-amber-900 hover:bg-amber-100"
                >
                  {declaredWageOverride ? "Edit Override" : "Set Override"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {declaredWageOverride ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-white rounded-lg border border-amber-200">
                      <div className="text-xs text-amber-600 uppercase">Override Amount</div>
                      <div className="text-lg font-semibold text-amber-900 mt-1">
                        {formatCurrency(declaredWageOverride.amount.toString())}
                      </div>
                      <div className="text-sm text-amber-700">
                        {declaredWageOverride.wageType?.toLowerCase() || "monthly"}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-amber-200">
                      <div className="text-xs text-amber-600 uppercase">Effective Since</div>
                      <div className="text-lg font-semibold text-amber-900 mt-1">
                        {formatDate(declaredWageOverride.effectiveAt)}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-amber-200">
                      <div className="text-xs text-amber-600 uppercase">Reason</div>
                      <div className="text-sm text-amber-900 mt-1">
                        {declaredWageOverride.reason || "-"}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600">
                    ⚠️ This override affects SSS, PhilHealth, and PagIBIG contributions. Actual payroll earnings still use the role&apos;s base salary.
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-amber-700">
                    No wage override set. Statutory contributions will be based on the role&apos;s base salary.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tax Calculation Mode - SUPER_ADMIN Only */}
        {isSuperAdmin && (
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-purple-900 flex items-center gap-2">
                    Tax Calculation Mode
                    <Badge variant="info" className="text-xs">SUPER_ADMIN ONLY</Badge>
                  </CardTitle>
                  <p className="text-sm text-purple-700 mt-1">
                    Choose how withholding tax is calculated for this employee.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-purple-200">
                <div>
                  <div className="font-medium text-purple-900">
                    {taxOnFullEarnings ? "Full Taxable Earnings" : "Basic Pay Only"}
                  </div>
                  <div className="text-sm text-purple-700 mt-1">
                    {taxOnFullEarnings
                      ? "Tax is calculated on all earnings (OT, holiday pay, bonuses, etc.) minus statutory deductions"
                      : "Tax is calculated only on Basic Pay minus Late/Undertime deductions (default)"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const result = await setTaxOnFullEarnings(employee.id, !taxOnFullEarnings);
                    if (result.success) {
                      router.refresh();
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    taxOnFullEarnings ? "bg-purple-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      taxOnFullEarnings ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-purple-600 mt-3">
                ⚠️ Changing this affects how withholding tax is computed during payroll processing.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" loading={isPending}>
            Save Changes
          </Button>
          <Link href={`/employees/${employee.id}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </div>

      {/* Declared Wage Override Modal - SUPER_ADMIN Only */}
      {isSuperAdmin && (
        <Modal
          isOpen={isOverrideModalOpen}
          onClose={() => {
            setIsOverrideModalOpen(false);
            setOverrideError(null);
          }}
          title="Declared Wage Override"
          size="md"
        >
          {overrideError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {overrideError}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Important:</strong> This override affects only statutory contributions
              (SSS, PhilHealth, PagIBIG). The employee&apos;s actual payroll
              earnings will still be based on the role&apos;s base salary.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Override Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  placeholder="e.g., 25000"
                  min="0"
                  step="0.01"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-amber-500 focus:border-amber-500"
                />
                <select
                  value={overrideWageType}
                  onChange={(e) => setOverrideWageType(e.target.value as "MONTHLY" | "DAILY" | "HOURLY")}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="DAILY">Daily</option>
                  <option value="HOURLY">Hourly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={overrideEffectiveDate}
                onChange={(e) => setOverrideEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-1">(min 10 characters)</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this wage override is being set..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          <ModalFooter>
            {declaredWageOverride && (
              <Button
                type="button"
                variant="danger"
                onClick={handleClearOverride}
                loading={isOverridePending}
              >
                Clear Override
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOverrideModalOpen(false);
                setOverrideError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSetOverride}
              loading={isOverridePending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {declaredWageOverride ? "Update Override" : "Set Override"}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </form>
  );
}
