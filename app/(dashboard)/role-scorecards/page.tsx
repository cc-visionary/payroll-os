// =============================================================================
// PeopleOS PH - Role Scorecards List Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, checkPermission, Permission } from "@/lib/rbac";
import { getRoleScorecards, getDepartments } from "@/app/actions/settings";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleScorecardList } from "./role-scorecard-list";

export default async function RoleScorecardsPage() {
  await requirePermission(Permission.ROLE_SCORECARD_VIEW);
  const canManage = await checkPermission(Permission.ROLE_SCORECARD_MANAGE);

  const [scorecards, departments] = await Promise.all([
    getRoleScorecards(),
    getDepartments(),
  ]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Role Scorecards</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define job positions, responsibilities, KPIs, and compensation
          </p>
        </div>
        {canManage && (
          <Link href="/role-scorecards/new">
            <Button>Add Role Scorecard</Button>
          </Link>
        )}
      </div>

      <RoleScorecardList
        scorecards={scorecards}
        departments={departments}
        canEdit={canManage}
        canDelete={canManage}
      />
    </div>
  );
}
