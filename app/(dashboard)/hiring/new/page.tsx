// =============================================================================
// PeopleOS PH - New Applicant Page
// =============================================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { getDepartments, getRoleScorecardsDropdown, getEmployeesDropdown } from "@/lib/data/employees";
import { createApplicant } from "@/app/actions/hiring";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default async function NewApplicantPage() {
  await requirePermission(Permission.HIRING_CREATE);
  const [departments, positions, employees] = await Promise.all([
    getDepartments(),
    getRoleScorecardsDropdown(),
    getEmployeesDropdown(),
  ]);

  const departmentOptions = [
    { value: "", label: "Select department..." },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  const positionOptions = [
    { value: "", label: "Select position (or enter custom below)..." },
    ...positions.map((p) => ({
      value: p.id,
      label: p.department ? `${p.jobTitle} (${p.department.name})` : p.jobTitle,
    })),
  ];

  const referrerOptions = [
    { value: "", label: "No referrer" },
    ...employees.map((e) => ({
      value: e.id,
      label: `${e.firstName} ${e.lastName} (${e.employeeNumber})`,
    })),
  ];

  const hiringEntityOptions = [
    { value: "GAMECOVE", label: "GameCove" },
    { value: "LUXIUM", label: "Luxium" },
  ];

  const sourceOptions = [
    { value: "", label: "Select source..." },
    { value: "LinkedIn", label: "LinkedIn" },
    { value: "Indeed", label: "Indeed" },
    { value: "JobStreet", label: "JobStreet" },
    { value: "Referral", label: "Employee Referral" },
    { value: "Website", label: "Company Website" },
    { value: "Walk-in", label: "Walk-in" },
    { value: "Job Fair", label: "Job Fair" },
    { value: "Other", label: "Other" },
  ];

  async function handleSubmit(formData: FormData) {
    "use server";

    const data = {
      firstName: formData.get("firstName") as string,
      middleName: (formData.get("middleName") as string) || undefined,
      lastName: formData.get("lastName") as string,
      suffix: (formData.get("suffix") as string) || undefined,
      email: formData.get("email") as string,
      phoneNumber: (formData.get("phoneNumber") as string) || undefined,
      mobileNumber: (formData.get("mobileNumber") as string) || undefined,
      roleScorecardId: (formData.get("roleScorecardId") as string) || undefined,
      customJobTitle: (formData.get("customJobTitle") as string) || undefined,
      departmentId: (formData.get("departmentId") as string) || undefined,
      hiringEntityId: (formData.get("hiringEntityId") as string) || undefined,
      source: (formData.get("source") as string) || undefined,
      referredById: (formData.get("referredById") as string) || undefined,
      portfolioUrl: (formData.get("portfolioUrl") as string) || undefined,
      linkedinUrl: (formData.get("linkedinUrl") as string) || undefined,
      expectedSalaryMin: formData.get("expectedSalaryMin")
        ? parseFloat(formData.get("expectedSalaryMin") as string)
        : undefined,
      expectedSalaryMax: formData.get("expectedSalaryMax")
        ? parseFloat(formData.get("expectedSalaryMax") as string)
        : undefined,
      expectedStartDate: (formData.get("expectedStartDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    const result = await createApplicant(data);

    if (result.success && result.applicantId) {
      redirect(`/hiring/${result.applicantId}`);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/hiring"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Hiring
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Applicant</h1>
      </div>

      <form action={handleSubmit}>
        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="First Name" name="firstName" required />
                <Input label="Middle Name" name="middleName" />
                <Input label="Last Name" name="lastName" required />
                <Input label="Suffix" name="suffix" placeholder="Jr., Sr., III" />
                <Input label="Email" name="email" type="email" required />
                <Input label="Mobile Number" name="mobileNumber" placeholder="+63" />
                <Input label="Phone Number" name="phoneNumber" />
              </div>
            </CardContent>
          </Card>

          {/* Position & Source */}
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Hiring Entity"
                  name="hiringEntity"
                  options={hiringEntityOptions}
                  defaultValue="GAMECOVE"
                  required
                />
                <Select
                  label="Department"
                  name="departmentId"
                  options={departmentOptions}
                />
                <Select
                  label="Position (from Role Scorecards)"
                  name="roleScorecardId"
                  options={positionOptions}
                />
                <Input
                  label="Custom Job Title"
                  name="customJobTitle"
                  placeholder="Only if position not in list..."
                />
                <Select
                  label="Source"
                  name="source"
                  options={sourceOptions}
                />
                <Select
                  label="Referred By"
                  name="referredById"
                  options={referrerOptions}
                />
              </div>
            </CardContent>
          </Card>

          {/* Links & Portfolio */}
          <Card>
            <CardHeader>
              <CardTitle>Links & Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="LinkedIn URL"
                  name="linkedinUrl"
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                />
                <Input
                  label="Portfolio URL"
                  name="portfolioUrl"
                  type="url"
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Salary & Start Date */}
          <Card>
            <CardHeader>
              <CardTitle>Expectations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Expected Salary (Min)"
                  name="expectedSalaryMin"
                  type="number"
                  step="0.01"
                  placeholder="PHP"
                />
                <Input
                  label="Expected Salary (Max)"
                  name="expectedSalaryMax"
                  type="number"
                  step="0.01"
                  placeholder="PHP"
                />
                <Input
                  label="Expected Start Date"
                  name="expectedStartDate"
                  type="date"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                name="notes"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes about the applicant..."
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit">Create Applicant</Button>
            <Link href="/hiring">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
