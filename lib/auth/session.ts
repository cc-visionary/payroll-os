// =============================================================================
// PeopleOS PH - Session Management
// =============================================================================
// Server-side session utilities for App Router.
// Works with both Server Components and Server Actions.
// =============================================================================

import { cache } from "react";
import {
  verifyAccessToken,
  getAccessTokenFromCookies,
  createAccessToken,
  setAuthCookies,
  verifyRefreshToken,
  getRefreshTokenFromCookies,
  createRefreshToken,
} from "./jwt";
import type { AuthSession, SessionUser, AuthContext, UserCompanyInfo } from "./types";
import type { PermissionValue } from "./permissions";

/**
 * Get the current session (cached per request).
 * Returns null if not authenticated.
 *
 * Uses React's cache() to deduplicate calls within a single request.
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const accessToken = await getAccessTokenFromCookies();

  if (!accessToken) {
    return null;
  }

  const payload = await verifyAccessToken(accessToken);

  if (!payload) {
    // Access token expired or invalid - try refresh
    return await tryRefreshSession();
  }

  const user: SessionUser = {
    id: payload.sub,
    email: payload.email,
    companyId: payload.companyId,
    employeeId: payload.employeeId,
    roles: payload.roles,
    permissions: payload.permissions,
    companies: payload.companies || [],
  };

  return {
    user,
    accessToken,
    expiresAt: new Date(payload.exp * 1000),
  };
});

/**
 * Try to refresh the session using the refresh token.
 */
async function tryRefreshSession(): Promise<AuthSession | null> {
  const refreshToken = await getRefreshTokenFromCookies();

  if (!refreshToken) {
    return null;
  }

  const refreshPayload = await verifyRefreshToken(refreshToken);

  if (!refreshPayload) {
    return null;
  }

  // Load user from database to get fresh permissions
  // This is where we'd call Prisma to get user data
  const user = await loadUserForSession(refreshPayload.sub);

  if (!user) {
    return null;
  }

  // Create new tokens
  const newAccessToken = await createAccessToken(user);
  const newRefreshToken = await createRefreshToken(user.id);

  // Set new cookies
  await setAuthCookies(newAccessToken, newRefreshToken);

  const newPayload = await verifyAccessToken(newAccessToken);

  return {
    user,
    accessToken: newAccessToken,
    expiresAt: new Date(newPayload!.exp * 1000),
  };
}

/**
 * Load user data for session from database.
 * Called during token refresh to get fresh permissions.
 */
async function loadUserForSession(userId: string): Promise<SessionUser | null> {
  // Dynamic import to avoid circular dependencies
  const { prisma } = await import("@/lib/db");

  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      userCompanies: {
        include: {
          company: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  // Aggregate permissions from all roles
  const roles = user.userRoles.map((ur) => ur.role.code);
  const permissionSet = new Set<string>();

  for (const userRole of user.userRoles) {
    const rolePermissions = userRole.role.permissions as string[];
    rolePermissions.forEach((p) => permissionSet.add(p));
  }

  // Build available companies list
  let companies: UserCompanyInfo[];
  let activeCompanyId = user.companyId;

  if (user.userCompanies.length > 0) {
    companies = user.userCompanies.map((uc) => ({
      id: uc.company.id,
      code: uc.company.code,
      name: uc.company.name,
      isDefault: uc.isDefault,
    }));
    // Use the default company if set, otherwise use the first one
    const defaultCompany = user.userCompanies.find((uc) => uc.isDefault);
    activeCompanyId = defaultCompany?.companyId ?? user.userCompanies[0].companyId;
  } else {
    // Fallback: user only has access to their primary company
    const primaryCompany = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { id: true, code: true, name: true },
    });
    companies = primaryCompany
      ? [{ id: primaryCompany.id, code: primaryCompany.code, name: primaryCompany.name, isDefault: true }]
      : [];
  }

  // Get employee ID in the active company
  const employee = await prisma.employee.findFirst({
    where: { userId: user.id, companyId: activeCompanyId, deletedAt: null },
    select: { id: true },
  });

  return {
    id: user.id,
    email: user.email,
    companyId: activeCompanyId,
    employeeId: employee?.id ?? null,
    roles,
    permissions: Array.from(permissionSet) as PermissionValue[],
    companies,
  };
}

/**
 * Require authentication - throws redirect if not authenticated.
 * Use in Server Components or Server Actions.
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession();

  if (!session) {
    // In App Router, redirect throws and never returns
    const { redirect } = await import("next/navigation");
    redirect("/login");
    // TypeScript doesn't know redirect() never returns
    throw new Error("Unreachable");
  }

  return session;
}

/**
 * Create an auth context with permission helpers.
 */
export function createAuthContext(user: SessionUser): AuthContext {
  const permissionSet = new Set(user.permissions);

  return {
    user,
    hasPermission: (permission: PermissionValue) => permissionSet.has(permission),
    hasAnyPermission: (permissions: PermissionValue[]) =>
      permissions.some((p) => permissionSet.has(p)),
    hasAllPermissions: (permissions: PermissionValue[]) =>
      permissions.every((p) => permissionSet.has(p)),
  };
}

/**
 * Get auth context for current session.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return createAuthContext(session.user);
}

/**
 * Require auth context - throws redirect if not authenticated.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const session = await requireAuth();
  return createAuthContext(session.user);
}
