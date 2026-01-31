"use client";

// =============================================================================
// PeopleOS PH - Employee Profile Tab
// =============================================================================

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { updateEmployee, updateStatutoryIds } from "@/app/actions/employees";

interface Employee {
  id: string;
  employeeNumber: string;
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
  permanentAddressLine1: string | null;
  permanentAddressLine2: string | null;
  permanentCity: string | null;
  permanentProvince: string | null;
  permanentZipCode: string | null;
  department: { id: string; name: string } | null;
  jobTitle: string | null;
  jobLevel: string | null;
  reportsTo: { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
  statutoryIds: { idType: string; idNumber: string }[];
  bankAccounts: { id: string; bankName: string; accountNumber: string; isPrimary: boolean }[];
}

interface ProfileTabProps {
  employee: Employee;
  canEdit: boolean;
  canViewSensitive: boolean;
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

export function ProfileTab({ employee, canEdit, canViewSensitive }: ProfileTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const getStatutoryId = (type: string) =>
    employee.statutoryIds.find((s) => s.idType === type)?.idNumber || "";

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const data = {
      firstName: formData.get("firstName") as string,
      middleName: formData.get("middleName") as string || undefined,
      lastName: formData.get("lastName") as string,
      suffix: formData.get("suffix") as string || undefined,
      birthDate: formData.get("birthDate") as string || undefined,
      gender: formData.get("gender") as string || undefined,
      civilStatus: formData.get("civilStatus") as string || undefined,
      personalEmail: formData.get("personalEmail") as string || undefined,
      workEmail: formData.get("workEmail") as string || undefined,
      mobileNumber: formData.get("mobileNumber") as string || undefined,
      presentAddressLine1: formData.get("presentAddressLine1") as string || undefined,
      presentCity: formData.get("presentCity") as string || undefined,
      presentProvince: formData.get("presentProvince") as string || undefined,
      presentZipCode: formData.get("presentZipCode") as string || undefined,
    };

    startTransition(async () => {
      const result = await updateEmployee(employee.id, data);
      if (result.success) {
        setIsEditing(false);
      } else {
        setError(result.error || "Failed to update");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Personal Information</CardTitle>
          {canEdit && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form action={handleSubmit}>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}
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

              <h4 className="font-medium text-gray-900 mt-6 mb-3">Contact Information</h4>
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
                />
              </div>

              <h4 className="font-medium text-gray-900 mt-6 mb-3">Present Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Address Line"
                  name="presentAddressLine1"
                  defaultValue={employee.presentAddressLine1 || ""}
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

              <div className="flex gap-2 mt-6">
                <Button type="submit" loading={isPending}>
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Birth Date" value={formatDate(employee.birthDate)} />
                <InfoField label="Gender" value={employee.gender} />
                <InfoField label="Civil Status" value={employee.civilStatus} />
                <InfoField label="Nationality" value="Filipino" />
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoField label="Personal Email" value={employee.personalEmail} />
                  <InfoField label="Work Email" value={employee.workEmail} />
                  <InfoField label="Mobile" value={employee.mobileNumber} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Present Address</h4>
                <p className="text-sm text-gray-900">
                  {[
                    employee.presentAddressLine1,
                    employee.presentAddressLine2,
                    employee.presentCity,
                    employee.presentProvince,
                    employee.presentZipCode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statutory IDs */}
      {canViewSensitive && (
        <Card>
          <CardHeader>
            <CardTitle>Government IDs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoField label="SSS Number" value={maskId(getStatutoryId("sss"))} />
              <InfoField label="PhilHealth Number" value={maskId(getStatutoryId("philhealth"))} />
              <InfoField label="Pag-IBIG Number" value={maskId(getStatutoryId("pagibig"))} />
              <InfoField label="TIN" value={maskId(getStatutoryId("tin"))} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Accounts */}
      {canViewSensitive && (
        <Card>
          <CardHeader>
            <CardTitle>Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {employee.bankAccounts.length === 0 ? (
              <p className="text-sm text-gray-500">No bank accounts on file</p>
            ) : (
              <div className="space-y-3">
                {employee.bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{account.bankName}</div>
                      <div className="text-sm text-gray-500">
                        ****{account.accountNumber.slice(-4)}
                      </div>
                    </div>
                    {account.isPrimary && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 mt-1">{value || "-"}</div>
    </div>
  );
}

function maskId(id: string | null | undefined): string {
  if (!id) return "-";
  if (id.length <= 4) return id;
  return "*".repeat(id.length - 4) + id.slice(-4);
}
