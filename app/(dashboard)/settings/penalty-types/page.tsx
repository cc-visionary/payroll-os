// =============================================================================
// PeopleOS PH - Penalty Types Settings Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getPenaltyTypes } from "@/app/actions/penalties";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PenaltyTypeList } from "./penalty-type-list";

export default async function PenaltyTypesSettingsPage() {
  await requirePermission(Permission.PENALTY_VIEW);

  const penaltyTypes = await getPenaltyTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Penalty Types</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Configure predefined penalty categories. When issuing a penalty to an employee,
            users can select from these types or choose &quot;Other&quot; with a custom description.
          </p>
          <PenaltyTypeList initialPenaltyTypes={penaltyTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
