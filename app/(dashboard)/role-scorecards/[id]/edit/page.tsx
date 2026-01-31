// =============================================================================
// PeopleOS PH - Edit Role Scorecard Page
// =============================================================================

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission } from "@/lib/rbac";
import { getRoleScorecard, getDepartments, getShiftTemplates } from "@/app/actions/settings";
import { RoleScorecardForm } from "../../role-scorecard-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRoleScorecardPage({ params }: PageProps) {
  await requirePermission(Permission.ROLE_SCORECARD_MANAGE);

  const { id } = await params;
  const [scorecard, departments, shiftTemplates] = await Promise.all([
    getRoleScorecard(id),
    getDepartments(),
    getShiftTemplates(),
  ]);

  if (!scorecard) {
    notFound();
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/role-scorecards/${id}`}
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Role Scorecard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Role Scorecard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update the details for {scorecard.jobTitle}
        </p>
      </div>

      <RoleScorecardForm
        mode="edit"
        scorecardId={id}
        initialData={{
          jobTitle: scorecard.jobTitle,
          departmentId: scorecard.department?.id || null,
          missionStatement: scorecard.missionStatement || "",
          keyResponsibilities: scorecard.keyResponsibilities || [],
          kpis: scorecard.kpis || [],
          salaryRangeMin: scorecard.salaryRangeMin,
          salaryRangeMax: scorecard.salaryRangeMax,
          baseSalary: scorecard.baseSalary,
          wageType: scorecard.wageType as "MONTHLY" | "DAILY" | "HOURLY",
          shiftTemplateId: scorecard.shiftTemplate?.id || null,
          workHoursPerDay: scorecard.workHoursPerDay,
          workDaysPerWeek: scorecard.workDaysPerWeek,
          flexibleStartTime: scorecard.flexibleStartTime,
          flexibleEndTime: scorecard.flexibleEndTime,
          isActive: scorecard.isActive,
          effectiveDate: new Date(scorecard.effectiveDate).toISOString().split("T")[0],
        }}
        departments={departments}
        shiftTemplates={shiftTemplates}
      />
    </div>
  );
}
