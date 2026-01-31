"use client";

// =============================================================================
// PeopleOS PH - Role & Responsibilities Tab
// =============================================================================
// Shows the employee's assigned role (from Role Scorecard) including:
// - Current role/position and its compensation
// - Key responsibilities and KPIs
// - Work schedule (from shift template)
// - Role history
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { updateEmployeeRole } from "@/app/actions/employees";

interface RoleScorecard {
  id: string;
  jobTitle: string;
  missionStatement: string;
  department: { id: string; name: string } | null;
  baseSalary: string | null;
  salaryRangeMin: string | null;
  salaryRangeMax: string | null;
  wageType: string;
  workHoursPerDay: number;
  workDaysPerWeek: string;
  shiftTemplate: {
    id: string;
    name: string;
    code: string;
    startTime: string;
    endTime: string;
  } | null;
  keyResponsibilities: Array<{ area: string; tasks: string[] }>;
  kpis: Array<{ metric: string; frequency: string }>;
}

interface RoleHistory {
  id: string;
  roleScorecardId: string | null;
  jobTitle: string | null;
  department: { name: string } | null;
  effectiveDate: string;
  endDate: string | null;
  reasonCode: string | null;
}

interface RoleTabProps {
  employeeId: string;
  currentRole: RoleScorecard | null;
  roleHistory: RoleHistory[];
  availableRoles: Array<{
    id: string;
    jobTitle: string;
    department: { id: string; name: string } | null;
    baseSalary: string | null;
    wageType: string;
  }>;
  canEdit: boolean;
}

const reasonCodeOptions = [
  { value: "", label: "Select reason..." },
  { value: "hire", label: "New Hire" },
  { value: "promotion", label: "Promotion" },
  { value: "lateral_transfer", label: "Lateral Transfer" },
  { value: "demotion", label: "Demotion" },
  { value: "reorganization", label: "Reorganization" },
];

export function RoleTab({
  employeeId,
  currentRole,
  roleHistory,
  availableRoles,
  canEdit,
}: RoleTabProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(currentRole?.id || "");
  const [reasonCode, setReasonCode] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedRole = availableRoles.find((r) => r.id === selectedRoleId);

  const handleRoleChange = () => {
    if (!selectedRoleId) {
      setError("Please select a role");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateEmployeeRole(employeeId, {
        roleScorecardId: selectedRoleId,
        effectiveDate,
        reasonCode: reasonCode || undefined,
      });

      if (result.success) {
        setIsModalOpen(false);
        router.refresh();
      } else {
        setError(result.error || "Failed to update role");
      }
    });
  };

  const formatWageType = (type: string) => {
    switch (type) {
      case "MONTHLY":
        return "monthly";
      case "DAILY":
        return "daily";
      case "HOURLY":
        return "hourly";
      default:
        return type.toLowerCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Role */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Current Role</CardTitle>
            {currentRole && (
              <p className="text-sm text-gray-500 mt-1">{currentRole.jobTitle}</p>
            )}
          </div>
          {canEdit && (
            <Button onClick={() => setIsModalOpen(true)}>
              {currentRole ? "Change Role" : "Assign Role"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {currentRole ? (
            <div className="space-y-6">
              {/* Role Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-xs text-blue-600 uppercase">Position</div>
                  <div className="text-lg font-semibold text-blue-900 mt-1">
                    {currentRole.jobTitle}
                  </div>
                  {currentRole.department && (
                    <div className="text-sm text-blue-700">
                      {currentRole.department.name}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-xs text-green-600 uppercase">Base Salary</div>
                  <div className="text-lg font-semibold text-green-900 mt-1">
                    {currentRole.baseSalary
                      ? formatCurrency(currentRole.baseSalary)
                      : "Not set"}
                  </div>
                  <div className="text-sm text-green-700">
                    {formatWageType(currentRole.wageType)}
                  </div>
                </div>

                {currentRole.shiftTemplate && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-xs text-purple-600 uppercase">
                      Work Schedule
                    </div>
                    <div className="text-lg font-semibold text-purple-900 mt-1">
                      {currentRole.shiftTemplate.name}
                    </div>
                    <div className="text-sm text-purple-700">
                      {currentRole.shiftTemplate.startTime} -{" "}
                      {currentRole.shiftTemplate.endTime}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600 uppercase">Hours</div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {currentRole.workHoursPerDay}h / day
                  </div>
                  <div className="text-sm text-gray-700">
                    {currentRole.workDaysPerWeek}
                  </div>
                </div>
              </div>

              {/* Salary Range */}
              {(currentRole.salaryRangeMin || currentRole.salaryRangeMax) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    Salary Range for this Role
                  </h4>
                  <p className="text-gray-900">
                    {currentRole.salaryRangeMin
                      ? formatCurrency(currentRole.salaryRangeMin)
                      : "N/A"}{" "}
                    -{" "}
                    {currentRole.salaryRangeMax
                      ? formatCurrency(currentRole.salaryRangeMax)
                      : "N/A"}
                  </p>
                </div>
              )}

              {/* Mission Statement */}
              {currentRole.missionStatement && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    Mission Statement
                  </h4>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
                    {currentRole.missionStatement}
                  </p>
                </div>
              )}

              {/* Key Responsibilities */}
              {currentRole.keyResponsibilities &&
                currentRole.keyResponsibilities.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">
                      Key Responsibilities
                    </h4>
                    <div className="space-y-4">
                      {currentRole.keyResponsibilities.map((area, idx) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                          <h5 className="font-medium text-gray-900 mb-2">
                            {area.area}
                          </h5>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                            {area.tasks.map((task, taskIdx) => (
                              <li key={taskIdx}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* KPIs */}
              {currentRole.kpis && currentRole.kpis.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-3">
                    Key Performance Indicators
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentRole.kpis.map((kpi, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-gray-900">{kpi.metric}</span>
                        <Badge variant="default">{kpi.frequency}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to full scorecard */}
              <div className="pt-4 border-t">
                <Link
                  href={`/role-scorecards/${currentRole.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View full Role Scorecard details &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                No role has been assigned to this employee yet.
              </p>
              {canEdit && (
                <Button onClick={() => setIsModalOpen(true)}>Assign Role</Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role History */}
      {roleHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Role History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Position
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Department
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {roleHistory.map((history) => (
                    <tr key={history.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDate(history.effectiveDate)}
                        {history.endDate && ` - ${formatDate(history.endDate)}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {history.jobTitle || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {history.department?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {history.reasonCode || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Role Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentRole ? "Change Role" : "Assign Role"}
        size="md"
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Role <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a role...</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.jobTitle}
                  {role.department && ` (${role.department.name})`}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Role Preview */}
          {selectedRole && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Role Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-600">Position:</span>
                  <span className="text-blue-900 ml-2">
                    {selectedRole.jobTitle}
                  </span>
                </div>
                {selectedRole.department && (
                  <div>
                    <span className="text-blue-600">Department:</span>
                    <span className="text-blue-900 ml-2">
                      {selectedRole.department.name}
                    </span>
                  </div>
                )}
                {selectedRole.baseSalary && (
                  <div>
                    <span className="text-blue-600">Base Salary:</span>
                    <span className="text-blue-900 ml-2">
                      {formatCurrency(selectedRole.baseSalary)} (
                      {formatWageType(selectedRole.wageType)})
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-3">
                The employee&apos;s compensation will be based on this role&apos;s
                base salary.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Select
            label="Reason for Change"
            options={reasonCodeOptions}
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
          />
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRoleChange} loading={isPending}>
            {currentRole ? "Update Role" : "Assign Role"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
