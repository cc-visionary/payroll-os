// =============================================================================
// PeopleOS PH - Company Settings Page
// =============================================================================

import { requirePermission, Permission } from "@/lib/rbac";
import { getHiringEntities } from "@/app/actions/settings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HiringEntitiesList } from "./hiring-entities-list";

export default async function CompanySettingsPage() {
  await requirePermission(Permission.SYSTEM_SETTINGS);

  const hiringEntities = await getHiringEntities();

  return (
    <div className="space-y-6">
      {/* Hiring Entities */}
      <Card>
        <CardHeader>
          <CardTitle>Hiring Entities / Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Manage the legal entities (companies) that can hire employees. Each hiring entity has its own
            government registrations (TIN, SSS, PhilHealth, Pag-IBIG) and is used for contracts,
            payslips, and government reports.
          </p>
          <HiringEntitiesList initialEntities={hiringEntities} />
        </CardContent>
      </Card>
    </div>
  );
}
