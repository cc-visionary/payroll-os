// =============================================================================
// PeopleOS PH - New Employee Page
// =============================================================================

import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { getDepartments, getRoleScorecardsDropdown } from "@/lib/data/employees";
import { createEmployee } from "@/app/actions/employees";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default async function NewEmployeePage() {
  await requirePermission(Permission.EMPLOYEE_CREATE);
  const [departments, roleScorecards] = await Promise.all([
    getDepartments(),
    getRoleScorecardsDropdown(),
  ]);

  const departmentOptions = [
    { value: "", label: "Select department..." },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  // Build position options grouped by department - use roleScorecard ID as value
  const positionOptions = [
    { value: "", label: "Select position (or enter custom below)..." },
    ...roleScorecards.map((sc) => ({
      value: sc.id,
      label: sc.department ? `${sc.jobTitle} (${sc.department.name})` : sc.jobTitle,
    })),
  ];

  const hiringEntityOptions = [
    { value: "GAMECOVE", label: "GameCove" },
    { value: "LUXIUM", label: "Luxium" },
  ];

  const employmentTypeOptions = [
    { value: "PROBATIONARY", label: "Probationary" },
    { value: "REGULAR", label: "Regular" },
    { value: "CONTRACTUAL", label: "Contractual" },
    { value: "CONSULTANT", label: "Consultant" },
    { value: "INTERN", label: "Intern" },
  ];

  const genderOptions = [
    { value: "", label: "Select..." },
    { value: "Male", label: "Male" },
    { value: "Female", label: "Female" },
  ];

  async function handleSubmit(formData: FormData) {
    "use server";

    // Use selected position (roleScorecard ID) or custom job title
    const roleScorecardId = formData.get("positionSelect") as string;
    const customJobTitle = formData.get("jobTitle") as string;

    const data = {
      // Employee number is auto-generated
      firstName: formData.get("firstName") as string,
      middleName: (formData.get("middleName") as string) || undefined,
      lastName: formData.get("lastName") as string,
      suffix: (formData.get("suffix") as string) || undefined,
      birthDate: (formData.get("birthDate") as string) || undefined,
      gender: (formData.get("gender") as string) || undefined,
      personalEmail: (formData.get("personalEmail") as string) || undefined,
      mobileNumber: (formData.get("mobileNumber") as string) || undefined,
      departmentId: (formData.get("departmentId") as string) || undefined,
      roleScorecardId: roleScorecardId || undefined,
      jobTitle: customJobTitle || undefined, // Only used if no roleScorecard selected
      hiringEntityId: (formData.get("hiringEntityId") as string) || undefined,
      employmentType: formData.get("employmentType") as string,
      hireDate: formData.get("hireDate") as string,
    };

    const result = await createEmployee(data);

    if (result.success && result.employeeId) {
      redirect(`/employees/${result.employeeId}`);
    }

    // If failed, the error will be shown (need client-side handling for better UX)
    // Note: In a production app, you'd want to handle this with useFormState
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/employees"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Employees
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add New Employee</h1>
      </div>

      <form action={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="First Name" name="firstName" required />
                <Input label="Middle Name" name="middleName" />
                <Input label="Last Name" name="lastName" required />
                <Input label="Suffix" name="suffix" placeholder="Jr., Sr., III" />
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
                <Input label="Birth Date" name="birthDate" type="date" />
                <Select label="Gender" name="gender" options={genderOptions} />
                <div></div>
                <Input label="Personal Email" name="personalEmail" type="email" />
                <Input label="Mobile Number" name="mobileNumber" placeholder="+63" />
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
                  name="positionSelect"
                  options={positionOptions}
                />
                <Input
                  label="Custom Job Title"
                  name="jobTitle"
                  placeholder="Only if not using position above..."
                />
                <Select
                  label="Employment Type"
                  name="employmentType"
                  options={employmentTypeOptions}
                  defaultValue="PROBATIONARY"
                  required
                />
                <Input label="Hire Date" name="hireDate" type="date" required />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit">Create Employee</Button>
            <Link href="/employees">
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
