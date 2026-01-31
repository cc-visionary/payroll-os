// =============================================================================
// PeopleOS PH - Edit Employee Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { getEmployee, getRoleScorecardsDropdown, getEmployeesDropdown } from "@/lib/data/employees";
import { getHiringEntitiesDropdown } from "@/app/actions/settings";
import { EmployeeEditForm } from "./employee-edit-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: PageProps) {
  const auth = await requirePermission(Permission.EMPLOYEE_EDIT);

  // Check SUPER_ADMIN role for wage override feature
  const isSuperAdmin = auth.user.roles.includes("SUPER_ADMIN");

  const { id } = await params;
  const [employee, roleScorecards, hiringEntities, employees] = await Promise.all([
    getEmployee(id),
    getRoleScorecardsDropdown(),
    getHiringEntitiesDropdown(),
    getEmployeesDropdown(),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/employees/${id}`}
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Employee
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Edit {employee.firstName} {employee.lastName}
        </h1>
      </div>

      <EmployeeEditForm
        employee={{
          id: employee.id,
          firstName: employee.firstName,
          middleName: employee.middleName,
          lastName: employee.lastName,
          suffix: employee.suffix,
          birthDate: employee.birthDate,
          gender: employee.gender,
          civilStatus: employee.civilStatus,
          personalEmail: employee.personalEmail,
          workEmail: employee.workEmail,
          mobileNumber: employee.mobileNumber,
          phoneNumber: employee.phoneNumber,
          presentAddressLine1: employee.presentAddressLine1,
          presentAddressLine2: employee.presentAddressLine2,
          presentCity: employee.presentCity,
          presentProvince: employee.presentProvince,
          presentZipCode: employee.presentZipCode,
          roleScorecardId: employee.roleScorecardId,
          hiringEntityId: employee.hiringEntityId,
          reportsToId: employee.reportsToId,
        }}
        roleScorecards={roleScorecards}
        hiringEntities={hiringEntities}
        employees={employees}
        isSuperAdmin={isSuperAdmin}
        declaredWageOverride={
          employee.declaredWageOverride
            ? {
                amount: Number(employee.declaredWageOverride),
                wageType: employee.declaredWageType as "MONTHLY" | "DAILY" | "HOURLY" | null,
                effectiveAt: employee.declaredWageEffectiveAt,
                reason: employee.declaredWageReason,
              }
            : null
        }
        taxOnFullEarnings={employee.taxOnFullEarnings}
      />
    </div>
  );
}
