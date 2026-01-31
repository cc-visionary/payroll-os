// =============================================================================
// PeopleOS PH - Login Handler
// =============================================================================
// Server-side login logic.
// =============================================================================

import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";
import { createAccessToken, createRefreshToken, setAuthCookies } from "./jwt";
import { createAuditLog } from "@/lib/audit";
import type { LoginCredentials, LoginResult, SessionUser, UserCompanyInfo } from "./types";
import type { PermissionValue } from "./permissions";

// Max failed login attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Authenticate a user with email and password.
 */
export async function login(
  credentials: LoginCredentials,
  ipAddress?: string,
  userAgent?: string
): Promise<LoginResult> {
  const { email, password } = credentials;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
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

  // User not found - return generic error (don't reveal if email exists)
  if (!user) {
    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Check if account is deleted
  if (user.deletedAt) {
    return {
      success: false,
      error: "Account has been deactivated",
    };
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
    );
    return {
      success: false,
      error: `Account is locked. Try again in ${remainingMinutes} minutes.`,
    };
  }

  // Check if account is inactive
  if (user.status === "INACTIVE" || user.status === "LOCKED") {
    return {
      success: false,
      error: "Account is not active. Please contact your administrator.",
    };
  }

  // Check if email is verified (optional, can be disabled for internal tools)
  // if (user.status === "PENDING_VERIFICATION") {
  //   return {
  //     success: false,
  //     error: "Please verify your email before logging in",
  //   };
  // }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    // Increment failed login count
    const newFailedCount = user.failedLoginCount + 1;
    const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: newFailedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
          : null,
        status: shouldLock ? "LOCKED" : user.status,
      },
    });

    // Log failed attempt
    await createAuditLog({
      userId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      description: `Failed login attempt (${newFailedCount}/${MAX_FAILED_ATTEMPTS})`,
      ipAddress,
      userAgent,
    });

    if (shouldLock) {
      return {
        success: false,
        error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MINUTES} minutes.`,
      };
    }

    return {
      success: false,
      error: "Invalid email or password",
    };
  }

  // Successful login - reset failed count and update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      // If locked via lockout timer expiration, reactivate
      status: "ACTIVE",
    },
  });

  // Build session user
  const roles = user.userRoles.map((ur) => ur.role.code);
  const permissionSet = new Set<string>();

  for (const userRole of user.userRoles) {
    const rolePermissions = userRole.role.permissions as string[];
    rolePermissions.forEach((p) => permissionSet.add(p));
  }

  // Build available companies list
  // If user has UserCompany entries, use those. Otherwise, use the default companyId.
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

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    companyId: activeCompanyId,
    employeeId: employee?.id ?? null,
    roles,
    permissions: Array.from(permissionSet) as PermissionValue[],
    companies,
  };

  // Generate tokens
  const accessToken = await createAccessToken(sessionUser);
  const refreshToken = await createRefreshToken(user.id);

  // Store refresh token in database for revocation capability
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent: userAgent?.substring(0, 500),
      ipAddress: ipAddress?.substring(0, 45),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Set cookies
  await setAuthCookies(accessToken, refreshToken);

  // Log successful login
  await createAuditLog({
    userId: user.id,
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    description: "User logged in successfully",
    ipAddress,
    userAgent,
  });

  return {
    success: true,
    accessToken,
    refreshToken,
    user: sessionUser,
  };
}

/**
 * Logout the current user.
 */
export async function logout(
  userId: string,
  refreshToken?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const { clearAuthCookies } = await import("./jwt");

  // Revoke the refresh token in database
  if (refreshToken) {
    await prisma.session.deleteMany({
      where: {
        userId,
        refreshToken,
      },
    });
  }

  // Clear cookies
  await clearAuthCookies();

  // Log logout
  await createAuditLog({
    userId,
    action: "LOGOUT",
    entityType: "User",
    entityId: userId,
    description: "User logged out",
    ipAddress,
    userAgent,
  });
}

/**
 * Logout from all devices (revoke all sessions).
 */
export async function logoutAllDevices(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const { clearAuthCookies } = await import("./jwt");

  // Delete all sessions for user
  await prisma.session.deleteMany({
    where: { userId },
  });

  // Clear cookies
  await clearAuthCookies();

  // Log logout
  await createAuditLog({
    userId,
    action: "LOGOUT",
    entityType: "User",
    entityId: userId,
    description: "User logged out from all devices",
    ipAddress,
    userAgent,
  });
}
