// =============================================================================
// PeopleOS PH - Shift Templates Settings Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getShiftTemplates } from "@/app/actions/settings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShiftTemplateList } from "./shift-template-list";

export default async function ShiftTemplatesSettingsPage() {
  await requirePermission(Permission.SYSTEM_SETTINGS);

  const shiftTemplates = await getShiftTemplates();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Shift Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Define standard work schedules that can be assigned to employees. Shift
            templates specify regular working hours and are used for attendance tracking
            and overtime calculations.
          </p>
          <ShiftTemplateList initialShiftTemplates={shiftTemplates} />
        </CardContent>
      </Card>
    </div>
  );
}
