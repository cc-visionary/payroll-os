// =============================================================================
// PeopleOS PH - RBAC Utilities
// =============================================================================
// Role-Based Access Control utilities for App Router.
// Provides guards for Server Components, Server Actions, and API Routes.
// =============================================================================

import { redirect } from "next/navigation";
import { requireAuthContext, getAuthContext } from "@/lib/auth";
import { Permission, type PermissionValue } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/types";

/**
 * Error thrown when permission check fails.
 */
export class PermissionDeniedError extends Error {
  constructor(
    public requiredPermissions: PermissionValue[],
    public userPermissions: PermissionValue[]
  ) {
    super("Permission denied");
    this.name = "PermissionDeniedError";
  }
}

/**
 * Guard for Server Components - redirects to access denied page.
 * Use in page.tsx or layout.tsx.
 *
 * @example
 * ```tsx
 * // app/admin/employees/page.tsx
 * export default async function EmployeesPage() {
 *   await requirePermission(Permission.EMPLOYEE_VIEW);
 *   // ... render page
 * }
 * ```
 */
export async function requirePermission(permission: PermissionValue): Promise<AuthContext> {
  const auth = await requireAuthContext();

  if (!auth.hasPermission(permission)) {
    redirect("/access-denied");
  }

  return auth;
}

/**
 * Guard requiring any of the specified permissions.
 */
export async function requireAnyPermission(
  permissions: PermissionValue[]
): Promise<AuthContext> {
  const auth = await requireAuthContext();

  if (!auth.hasAnyPermission(permissions)) {
    redirect("/access-denied");
  }

  return auth;
}

/**
 * Guard requiring all of the specified permissions.
 */
export async function requireAllPermissions(
  permissions: PermissionValue[]
): Promise<AuthContext> {
  const auth = await requireAuthContext();

  if (!auth.hasAllPermissions(permissions)) {
    redirect("/access-denied");
  }

  return auth;
}

/**
 * Guard for Server Actions - throws PermissionDeniedError.
 * Use in server action functions.
 *
 * @example
 * ```ts
 * // app/actions/employees.ts
 * "use server";
 *
 * export async function createEmployee(data: CreateEmployeeInput) {
 *   const auth = await assertPermission(Permission.EMPLOYEE_CREATE);
 *   // ... create employee
 * }
 * ```
 */
export async function assertPermission(permission: PermissionValue): Promise<AuthContext> {
  const auth = await getAuthContext();

  if (!auth) {
    throw new Error("Not authenticated");
  }

  if (!auth.hasPermission(permission)) {
    throw new PermissionDeniedError([permission], auth.user.permissions);
  }

  return auth;
}

/**
 * Assert any of the specified permissions.
 */
export async function assertAnyPermission(
  permissions: PermissionValue[]
): Promise<AuthContext> {
  const auth = await getAuthContext();

  if (!auth) {
    throw new Error("Not authenticated");
  }

  if (!auth.hasAnyPermission(permissions)) {
    throw new PermissionDeniedError(permissions, auth.user.permissions);
  }

  return auth;
}

/**
 * Assert all of the specified permissions.
 */
export async function assertAllPermissions(
  permissions: PermissionValue[]
): Promise<AuthContext> {
  const auth = await getAuthContext();

  if (!auth) {
    throw new Error("Not authenticated");
  }

  if (!auth.hasAllPermissions(permissions)) {
    throw new PermissionDeniedError(permissions, auth.user.permissions);
  }

  return auth;
}

/**
 * Check permission without throwing (for conditional UI).
 *
 * @example
 * ```tsx
 * // Server Component
 * const canEdit = await checkPermission(Permission.EMPLOYEE_EDIT);
 * return canEdit ? <EditButton /> : null;
 * ```
 */
export async function checkPermission(permission: PermissionValue): Promise<boolean> {
  const auth = await getAuthContext();
  return auth?.hasPermission(permission) ?? false;
}

/**
 * Check any permission.
 */
export async function checkAnyPermission(permissions: PermissionValue[]): Promise<boolean> {
  const auth = await getAuthContext();
  return auth?.hasAnyPermission(permissions) ?? false;
}

/**
 * Check all permissions.
 */
export async function checkAllPermissions(permissions: PermissionValue[]): Promise<boolean> {
  const auth = await getAuthContext();
  return auth?.hasAllPermissions(permissions) ?? false;
}

/**
 * Higher-order function to wrap a server action with permission check.
 *
 * @example
 * ```ts
 * export const createEmployee = withPermission(
 *   Permission.EMPLOYEE_CREATE,
 *   async (auth, data: CreateEmployeeInput) => {
 *     // auth.user is available
 *     return prisma.employee.create({ ... });
 *   }
 * );
 * ```
 */
export function withPermission<TArgs extends unknown[], TReturn>(
  permission: PermissionValue,
  handler: (auth: AuthContext, ...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    const auth = await assertPermission(permission);
    return handler(auth, ...args);
  };
}

/**
 * Higher-order function with multiple permission options.
 */
export function withAnyPermission<TArgs extends unknown[], TReturn>(
  permissions: PermissionValue[],
  handler: (auth: AuthContext, ...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    const auth = await assertAnyPermission(permissions);
    return handler(auth, ...args);
  };
}

// Re-export Permission for convenience
export { Permission } from "@/lib/auth/permissions";
export type { PermissionValue } from "@/lib/auth/permissions";
export type { AuthContext } from "@/lib/auth/types";
