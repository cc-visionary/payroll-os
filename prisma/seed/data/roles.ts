// =============================================================================
// PeopleOS PH - Role Definitions
// =============================================================================
// Admin-only roles for the desktop payroll application.
// Employee self-service and manager roles removed (not needed for this use case).

import { RolePermissions } from "../../../lib/auth/permissions";

export const roles = [
  {
    code: "SUPER_ADMIN",
    name: "Super Administrator",
    permissions: RolePermissions.SUPER_ADMIN,
    isSystem: true,
  },
  {
    code: "HR_ADMIN",
    name: "HR Administrator",
    permissions: RolePermissions.HR_ADMIN,
    isSystem: true,
  },
  {
    code: "PAYROLL_ADMIN",
    name: "Payroll Administrator",
    permissions: RolePermissions.PAYROLL_ADMIN,
    isSystem: true,
  },
  {
    code: "FINANCE_MANAGER",
    name: "Finance Manager",
    permissions: RolePermissions.FINANCE_MANAGER,
    isSystem: true,
  },
];
