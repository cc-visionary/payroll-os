// =============================================================================
// PeopleOS PH - Roles Settings Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getRoles } from "@/app/actions/roles";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RoleList } from "./role-list";

export default async function RolesSettingsPage() {
  await requirePermission(Permission.ROLE_VIEW);

  const roles = await getRoles();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Manage user roles and their permissions. System roles cannot be deleted
            but their permissions can be customized.
          </p>
          <RoleList initialRoles={roles} />
        </CardContent>
      </Card>
    </div>
  );
}
