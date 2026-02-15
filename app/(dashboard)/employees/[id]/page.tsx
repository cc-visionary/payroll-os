// =============================================================================
// PeopleOS PH - Employee Detail Page
// =============================================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, Permission, checkPermission } from "@/lib/rbac";
import {
  getEmployee,
  getEmployeeEvents,
  getEmployeeDocuments,
  getEmployeesDropdown,
  getRoleScorecardsDropdown,
  getEmployeeRoleScorecard,
  getEmployeeRoleHistory,
  getAvailableRoles,
  getEmployeePayslips,
} from "@/lib/data/employees";
import { formatDate, formatName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmploymentStatusBadge, EmploymentTypeBadge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileTab } from "./tabs/profile-tab";
import { RoleTab } from "./tabs/role-tab";
import { EventsTab } from "./tabs/events-tab";
import { DocumentsTab } from "./tabs/documents-tab";
import { AttendanceTab } from "./tabs/attendance-tab";
import { PayslipTab } from "./tabs/payslip-tab";
import { PenaltiesTab } from "./tabs/penalties-tab";
import { EmployeeDeleteButton } from "../employee-delete-button";
import { getEmployeePenalties, getPenaltyTypes } from "@/app/actions/penalties";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const auth = await requirePermission(Permission.EMPLOYEE_VIEW);
  const canEdit = await checkPermission(Permission.EMPLOYEE_EDIT);
  const canDelete = await checkPermission(Permission.EMPLOYEE_DELETE);
  const canViewSensitive = await checkPermission(Permission.EMPLOYEE_VIEW_SENSITIVE);
  const canGenerateDocuments = await checkPermission(Permission.DOCUMENT_GENERATE);
  const canEditAttendance = await checkPermission(Permission.ATTENDANCE_EDIT);
  const canManagePenalties = await checkPermission(Permission.PENALTY_MANAGE);

  // Check SUPER_ADMIN role for wage override feature
  const isSuperAdmin = auth.user.roles.includes("SUPER_ADMIN");

  const { id } = await params;

  const [employee, events, documents, allEmployees, roleScorecards, currentRoleScorecard, roleHistory, availableRoles, payslips, penalties, penaltyTypes] = await Promise.all([
    getEmployee(id),
    getEmployeeEvents(id),
    getEmployeeDocuments(id),
    getEmployeesDropdown(),
    getRoleScorecardsDropdown(),
    getEmployeeRoleScorecard(id),
    getEmployeeRoleHistory(id),
    getAvailableRoles(),
    getEmployeePayslips(id),
    getEmployeePenalties(id).catch(() => []),
    getPenaltyTypes().catch(() => []),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/employees"
          className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
        >
          &larr; Back to Employees
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatName(
                employee.firstName,
                employee.lastName,
                employee.middleName,
                employee.suffix
              )}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-gray-500">{employee.employeeNumber}</span>
              <span className="text-gray-300">|</span>
              <EmploymentTypeBadge type={employee.employmentType} />
              <EmploymentStatusBadge status={employee.employmentStatus} />
            </div>
            {employee.jobTitle && (
              <p className="text-gray-600 mt-1">
                {employee.jobTitle}
                {employee.department && ` • ${employee.department.name}`}
              </p>
            )}
            {employee.hiringEntity && (
              <p className="text-sm text-gray-500 mt-0.5">
                Hired under: <span className="font-medium">{employee.hiringEntity.tradeName || employee.hiringEntity.name}</span>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {canEdit && (
              <Link href={`/employees/${id}/edit`}>
                <Button variant="outline">Edit Employee</Button>
              </Link>
            )}
            {canDelete && employee.employmentStatus === "ACTIVE" && (
              <EmployeeDeleteButton
                employeeId={employee.id}
                employeeName={formatName(
                  employee.firstName,
                  employee.lastName,
                  employee.middleName,
                  employee.suffix
                )}
                employeeNumber={employee.employeeNumber}
              />
            )}
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <InfoCard label="Hire Date" value={formatDate(employee.hireDate)} />
          <InfoCard
            label="Regularization Date"
            value={formatDate(employee.regularizationDate)}
            highlight={!employee.regularizationDate && employee.employmentType === "PROBATIONARY"}
          />
          <InfoCard
            label="OT Eligible"
            value={employee.isOtEligible ? "Yes" : "No"}
            highlight={!employee.isOtEligible}
          />
          <InfoCard
            label="Reports To"
            value={
              employee.reportsTo
                ? `${employee.reportsTo.firstName} ${employee.reportsTo.lastName}`
                : "-"
            }
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="role">Role & Responsibilities</TabsTrigger>
          <TabsTrigger value="penalties">Penalties</TabsTrigger>
          <TabsTrigger value="events">Employment Events</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            employee={employee}
            canEdit={canEdit}
            canViewSensitive={canViewSensitive}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab employeeId={employee.id} canEdit={canEditAttendance} />
        </TabsContent>

        <TabsContent value="payslips">
          <PayslipTab
            employeeId={employee.id}
            payslips={payslips}
          />
        </TabsContent>

        <TabsContent value="role">
          <RoleTab
            employeeId={employee.id}
            currentRole={currentRoleScorecard as Parameters<typeof RoleTab>[0]["currentRole"]}
            roleHistory={roleHistory}
            availableRoles={availableRoles}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="penalties">
          <PenaltiesTab
            employeeId={employee.id}
            penalties={penalties}
            penaltyTypes={penaltyTypes}
            canManage={canManagePenalties}
          />
        </TabsContent>

        <TabsContent value="events">
          <EventsTab
            employeeId={employee.id}
            events={events}
            employmentType={employee.employmentType}
            regularizationDate={employee.regularizationDate}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab
            employeeId={employee.id}
            documents={documents}
            canGenerate={canGenerateDocuments}
            employees={allEmployees}
            roleScorecards={roleScorecards}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg border ${
        highlight ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-medium mt-1 ${highlight ? "text-yellow-700" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}
