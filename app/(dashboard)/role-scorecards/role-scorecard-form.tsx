"use client";

// =============================================================================
// PeopleOS PH - Role Scorecard Form Component
// =============================================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createRoleScorecard, updateRoleScorecard } from "@/app/actions/settings";

interface RoleScorecardResponsibility {
  area: string;
  tasks: string[];
}

interface RoleScorecardKPI {
  metric: string;
  frequency: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  code: string;
}

interface RoleScorecardFormProps {
  mode: "create" | "edit";
  scorecardId?: string;
  initialData?: {
    jobTitle: string;
    departmentId: string | null;
    missionStatement: string;
    keyResponsibilities: RoleScorecardResponsibility[];
    kpis: RoleScorecardKPI[];
    salaryRangeMin: number | null;
    salaryRangeMax: number | null;
    baseSalary: number | null;
    wageType: "MONTHLY" | "DAILY" | "HOURLY";
    shiftTemplateId: string | null;
    workHoursPerDay: number;
    workDaysPerWeek: string;
    flexibleStartTime: string | null;
    flexibleEndTime: string | null;
    isActive: boolean;
    effectiveDate: string;
  };
  departments: Department[];
  shiftTemplates: ShiftTemplate[];
}

const defaultFormData = {
  jobTitle: "",
  departmentId: null as string | null,
  missionStatement: "",
  keyResponsibilities: [] as RoleScorecardResponsibility[],
  kpis: [] as RoleScorecardKPI[],
  salaryRangeMin: null as number | null,
  salaryRangeMax: null as number | null,
  baseSalary: null as number | null,
  wageType: "MONTHLY" as "MONTHLY" | "DAILY" | "HOURLY",
  shiftTemplateId: null as string | null,
  workHoursPerDay: 8,
  workDaysPerWeek: "Mon-Fri",
  flexibleStartTime: null as string | null,
  flexibleEndTime: null as string | null,
  isActive: true,
  effectiveDate: new Date().toISOString().split("T")[0],
};

export function RoleScorecardForm({
  mode,
  scorecardId,
  initialData,
  departments,
  shiftTemplates,
}: RoleScorecardFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState(initialData || defaultFormData);

  // Responsibilities state
  const [newResponsibilityArea, setNewResponsibilityArea] = useState("");
  const [newTask, setNewTask] = useState("");
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(null);

  // KPI state
  const [newKpiMetric, setNewKpiMetric] = useState("");
  const [newKpiFrequency, setNewKpiFrequency] = useState("Monthly");

  const handleSubmit = () => {
    if (!formData.jobTitle.trim()) {
      setError("Job title is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      // Convert null to undefined for optional fields that expect undefined
      const dataToSubmit = {
        ...formData,
        departmentId: formData.departmentId || undefined,
        salaryRangeMin: formData.salaryRangeMin ?? undefined,
        salaryRangeMax: formData.salaryRangeMax ?? undefined,
        baseSalary: formData.baseSalary ?? undefined,
        shiftTemplateId: formData.shiftTemplateId || undefined,
        flexibleStartTime: formData.flexibleStartTime || undefined,
        flexibleEndTime: formData.flexibleEndTime || undefined,
      };

      let result;
      if (mode === "edit" && scorecardId) {
        result = await updateRoleScorecard(scorecardId, dataToSubmit);
      } else {
        result = await createRoleScorecard(dataToSubmit);
      }

      if (result.success) {
        if (mode === "edit") {
          router.push(`/role-scorecards/${scorecardId}`);
        } else {
          router.push("/role-scorecards");
        }
        router.refresh();
      } else {
        setError(result.error || "Failed to save role scorecard");
      }
    });
  };

  const addResponsibilityArea = () => {
    if (!newResponsibilityArea.trim()) return;
    setFormData({
      ...formData,
      keyResponsibilities: [
        ...formData.keyResponsibilities,
        { area: newResponsibilityArea.trim(), tasks: [] },
      ],
    });
    setNewResponsibilityArea("");
  };

  const addTaskToArea = (areaIndex: number) => {
    if (!newTask.trim()) return;
    const updated = [...formData.keyResponsibilities];
    updated[areaIndex].tasks.push(newTask.trim());
    setFormData({ ...formData, keyResponsibilities: updated });
    setNewTask("");
  };

  const removeResponsibilityArea = (index: number) => {
    const updated = formData.keyResponsibilities.filter((_, i) => i !== index);
    setFormData({ ...formData, keyResponsibilities: updated });
  };

  const removeTask = (areaIndex: number, taskIndex: number) => {
    const updated = [...formData.keyResponsibilities];
    updated[areaIndex].tasks = updated[areaIndex].tasks.filter((_, i) => i !== taskIndex);
    setFormData({ ...formData, keyResponsibilities: updated });
  };

  const addKpi = () => {
    if (!newKpiMetric.trim()) return;
    setFormData({
      ...formData,
      kpis: [...formData.kpis, { metric: newKpiMetric.trim(), frequency: newKpiFrequency }],
    });
    setNewKpiMetric("");
    setNewKpiFrequency("Monthly");
  };

  const removeKpi = (index: number) => {
    const updated = formData.kpis.filter((_, i) => i !== index);
    setFormData({ ...formData, kpis: updated });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Software Engineer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              value={formData.departmentId || ""}
              onChange={(e) =>
                setFormData({ ...formData, departmentId: e.target.value || null })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mission Statement
            </label>
            <textarea
              value={formData.missionStatement}
              onChange={(e) =>
                setFormData({ ...formData, missionStatement: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe the purpose and goals of this role..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Effective Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.effectiveDate}
              onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active (available for assignment)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Salary
              </label>
              <input
                type="number"
                value={formData.baseSalary || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    baseSalary: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Wage Type
              </label>
              <select
                value={formData.wageType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wageType: e.target.value as "MONTHLY" | "DAILY" | "HOURLY",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="DAILY">Daily</option>
                <option value="HOURLY">Hourly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary Range Min
              </label>
              <input
                type="number"
                value={formData.salaryRangeMin || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    salaryRangeMin: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary Range Max
              </label>
              <input
                type="number"
                value={formData.salaryRangeMax || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    salaryRangeMax: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Work Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shift Template
              </label>
              <select
                value={formData.shiftTemplateId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, shiftTemplateId: e.target.value || null })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No Shift Template</option>
                {shiftTemplates.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hours Per Day
              </label>
              <input
                type="number"
                value={formData.workHoursPerDay}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    workHoursPerDay: parseFloat(e.target.value) || 8,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                max="24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Days
              </label>
              <input
                type="text"
                value={formData.workDaysPerWeek}
                onChange={(e) =>
                  setFormData({ ...formData, workDaysPerWeek: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Mon-Fri"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flexible Start Time
              </label>
              <input
                type="time"
                value={formData.flexibleStartTime || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    flexibleStartTime: e.target.value || null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flexible End Time
              </label>
              <input
                type="time"
                value={formData.flexibleEndTime || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    flexibleEndTime: e.target.value || null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Responsibilities */}
      <Card>
        <CardHeader>
          <CardTitle>Key Responsibilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newResponsibilityArea}
              onChange={(e) => setNewResponsibilityArea(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add a responsibility area (e.g., Development, Code Review)"
              onKeyDown={(e) => e.key === "Enter" && addResponsibilityArea()}
            />
            <Button onClick={addResponsibilityArea}>Add Area</Button>
          </div>

          {/* List areas */}
          {formData.keyResponsibilities.map((area, areaIndex) => (
            <div key={areaIndex} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">{area.area}</h4>
                <button
                  onClick={() => removeResponsibilityArea(areaIndex)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove Area
                </button>
              </div>

              {/* Tasks in area */}
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3">
                {area.tasks.map((task, taskIndex) => (
                  <li key={taskIndex} className="flex justify-between items-center">
                    <span>{task}</span>
                    <button
                      onClick={() => removeTask(areaIndex, taskIndex)}
                      className="text-red-500 hover:text-red-700 text-xs ml-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add task */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedAreaIndex === areaIndex ? newTask : ""}
                  onChange={(e) => {
                    setSelectedAreaIndex(areaIndex);
                    setNewTask(e.target.value);
                  }}
                  onFocus={() => setSelectedAreaIndex(areaIndex)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add a task..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addTaskToArea(areaIndex);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addTaskToArea(areaIndex)}
                >
                  Add
                </Button>
              </div>
            </div>
          ))}

          {formData.keyResponsibilities.length === 0 && (
            <p className="text-sm text-gray-500">
              No responsibility areas added yet. Add areas and their associated tasks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <Card>
        <CardHeader>
          <CardTitle>Key Performance Indicators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add KPI */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKpiMetric}
              onChange={(e) => setNewKpiMetric(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
              placeholder="KPI metric (e.g., Code review turnaround time)"
              onKeyDown={(e) => e.key === "Enter" && addKpi()}
            />
            <select
              value={newKpiFrequency}
              onChange={(e) => setNewKpiFrequency(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
            </select>
            <Button onClick={addKpi}>Add KPI</Button>
          </div>

          {/* List KPIs */}
          {formData.kpis.length > 0 ? (
            <div className="space-y-2">
              {formData.kpis.map((kpi, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-gray-900">{kpi.metric}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                      {kpi.frequency}
                    </span>
                    <button
                      onClick={() => removeKpi(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No KPIs added yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={isPending}>
          {mode === "edit" ? "Save Changes" : "Create Role Scorecard"}
        </Button>
      </div>
    </div>
  );
}
