// =============================================================================
// PeopleOS PH - Switch Company API Route
// =============================================================================
// Allows users to switch between companies they have access to.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAccessToken, createRefreshToken, setAuthCookies } from "@/lib/auth/jwt";
import { createAuditLog } from "@/lib/audit";
import type { SessionUser, UserCompanyInfo } from "@/lib/auth/types";
import type { PermissionValue } from "@/lib/auth/permissions";

interface SwitchCompanyRequest {
  companyId: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SwitchCompanyRequest;
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this company
    const userCompany = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: session.user.id,
          companyId,
        },
      },
      include: {
        company: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // If no UserCompany record, check if it's the user's primary company
    let hasAccess = !!userCompany;
    let targetCompany: { id: string; code: string; name: string } | null = null;

    if (!hasAccess) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          company: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      if (user && user.companyId === companyId) {
        hasAccess = true;
        targetCompany = user.company;
      }
    } else {
      targetCompany = userCompany!.company;
    }

    if (!hasAccess || !targetCompany) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this company" },
        { status: 403 }
      );
    }

    // Get user's full data for token generation
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Build permissions
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissionSet = new Set<string>();

    for (const userRole of user.userRoles) {
      const rolePermissions = userRole.role.permissions as string[];
      rolePermissions.forEach((p) => permissionSet.add(p));
    }

    // Build companies list
    let companies: UserCompanyInfo[];
    if (user.userCompanies.length > 0) {
      companies = user.userCompanies.map((uc) => ({
        id: uc.company.id,
        code: uc.company.code,
        name: uc.company.name,
        isDefault: uc.isDefault,
      }));
    } else {
      companies = [
        {
          id: targetCompany.id,
          code: targetCompany.code,
          name: targetCompany.name,
          isDefault: true,
        },
      ];
    }

    // Get employee ID in the target company
    const employee = await prisma.employee.findFirst({
      where: { userId: user.id, companyId, deletedAt: null },
      select: { id: true },
    });

    // Build new session user with switched company
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      companyId: companyId, // New active company
      employeeId: employee?.id ?? null,
      roles,
      permissions: Array.from(permissionSet) as PermissionValue[],
      companies,
    };

    // Generate new tokens with the new company
    const accessToken = await createAccessToken(sessionUser);
    const refreshToken = await createRefreshToken(user.id);

    // Update session in database
    const ipAddress = request.headers.get("x-forwarded-for") ?? undefined;
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: userAgent?.substring(0, 500),
        ipAddress: ipAddress?.substring(0, 45),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Set new cookies
    await setAuthCookies(accessToken, refreshToken);

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: "LOGIN",
      entityType: "Company",
      entityId: companyId,
      description: `Switched to company: ${targetCompany.name}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      company: {
        id: targetCompany.id,
        code: targetCompany.code,
        name: targetCompany.name,
      },
    });
  } catch (error) {
    console.error("Switch company error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to switch company" },
      { status: 500 }
    );
  }
}
