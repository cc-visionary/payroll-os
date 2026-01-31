// =============================================================================
// PeopleOS PH - Leave Types Settings Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getLeaveTypes } from "@/app/actions/settings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LeaveTypeList } from "./leave-type-list";

export default async function LeaveTypesSettingsPage() {
  await requirePermission(Permission.LEAVE_TYPE_VIEW);

  const leaveTypes = await getLeaveTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leave Types</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Configure the types of leave available to employees. Each leave type can have
            different entitlements, accrual rules, and whether it&apos;s paid or unpaid.
          </p>
          <LeaveTypeList initialLeaveTypes={leaveTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
