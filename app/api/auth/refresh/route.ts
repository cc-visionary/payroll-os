// =============================================================================
// PeopleOS PH - Token Refresh API Route
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken,
  setAuthCookies,
  getRefreshTokenFromCookies,
} from "@/lib/auth/jwt";
import type { SessionUser, UserCompanyInfo } from "@/lib/auth/types";
import type { PermissionValue } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = await getRefreshTokenFromCookies();

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "No refresh token" },
        { status: 401 }
      );
    }

    // Verify the refresh token
    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: "Invalid refresh token" },
        { status: 401 }
      );
    }

    // Verify token exists in database (not revoked)
    const session = await prisma.session.findFirst({
      where: {
        userId: payload.sub,
        refreshToken,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session expired or revoked" },
        { status: 401 }
      );
    }

    // Load fresh user data
    const user = await prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      include: {
        userRoles: {
          include: { role: true },
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
      // Revoke the session
      await prisma.session.delete({ where: { id: session.id } });
      return NextResponse.json(
        { success: false, error: "User not found or inactive" },
        { status: 401 }
      );
    }

    // Build session user
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

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      companyId: activeCompanyId,
      employeeId: employee?.id ?? null,
      roles,
      permissions: Array.from(permissionSet) as PermissionValue[],
      companies,
    };

    // Create new tokens
    const newAccessToken = await createAccessToken(sessionUser);
    const newRefreshToken = await createRefreshToken(user.id);

    // Update session with new refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set new cookies
    await setAuthCookies(newAccessToken, newRefreshToken);

    return NextResponse.json({
      success: true,
      user: sessionUser,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to refresh token" },
      { status: 500 }
    );
  }
}
