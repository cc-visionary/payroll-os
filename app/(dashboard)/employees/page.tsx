// =============================================================================
// PeopleOS PH - Employee List Page
// =============================================================================

import { requirePermission, Permission, checkPermission } from "@/lib/rbac";
import { getEmployees, getDepartments } from "@/lib/data/employees";
import { formatDate, formatName } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmploymentStatusBadge, EmploymentTypeBadge } from "@/components/ui/badge";
import { EmployeeSearch } from "./employee-search";
import { EmployeeActionBar } from "./employee-action-bar";
import { EmployeeDeleteButton } from "./employee-delete-button";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    employmentType?: string;
    departmentId?: string;
    page?: string;
  }>;
}

export default async function EmployeesPage({ searchParams }: PageProps) {
  await requirePermission(Permission.EMPLOYEE_VIEW);
  const canCreate = await checkPermission(Permission.EMPLOYEE_CREATE);
  const canDelete = await checkPermission(Permission.EMPLOYEE_DELETE);

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const [{ employees, total, totalPages }, departments] = await Promise.all([
    getEmployees({
      search: params.search,
      status: params.status,
      employmentType: params.employmentType,
      departmentId: params.departmentId,
      page,
      limit: 20,
    }),
    getDepartments(),
  ]);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">{total} employees total</p>
        </div>
        <EmployeeActionBar canCreate={canCreate} />
      </div>

      {/* Search and Filters */}
      <EmployeeSearch departments={departments} />

      {/* Employee List */}
      <Card className="mt-6">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hire Date
                  </th>
                  {canDelete && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={canDelete ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/employees/${employee.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <div className="font-medium">
                            {formatName(
                              employee.firstName,
                              employee.lastName,
                              employee.middleName,
                              employee.suffix
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.employeeNumber}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.department?.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.jobTitle || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <EmploymentTypeBadge type={employee.employmentType} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <EmploymentStatusBadge status={employee.employmentStatus} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(employee.hireDate)}
                      </td>
                      {canDelete && employee.employmentStatus === "ACTIVE" && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <EmployeeDeleteButton
                            employeeId={employee.id}
                            employeeName={formatName(
                              employee.firstName,
                              employee.lastName,
                              employee.middleName,
                              employee.suffix
                            )}
                            employeeNumber={employee.employeeNumber}
                            variant="icon"
                          />
                        </td>
                      )}
                      {canDelete && employee.employmentStatus !== "ACTIVE" && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">
                          -
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={{
                      pathname: "/employees",
                      query: { ...params, page: page - 1 },
                    }}
                  >
                    <Button variant="outline" size="sm">
                      Previous
                    </Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={{
                      pathname: "/employees",
                      query: { ...params, page: page + 1 },
                    }}
                  >
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
