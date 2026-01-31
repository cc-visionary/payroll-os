// =============================================================================
// PeopleOS PH - Departments Settings Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getDepartments } from "@/app/actions/settings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DepartmentList } from "./department-list";

export default async function DepartmentsSettingsPage() {
  await requirePermission(Permission.DEPARTMENT_VIEW);

  const departments = await getDepartments();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Departments</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Manage your organization&apos;s departments. Departments are used to organize
            employees and can be assigned managers for approval workflows.
          </p>
          <DepartmentList initialDepartments={departments} />
        </CardContent>
      </Card>
    </div>
  );
}
