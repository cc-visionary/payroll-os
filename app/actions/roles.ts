"use server";

// =============================================================================
// PeopleOS PH - Role Management Server Actions
// =============================================================================

import { prisma } from "@/lib/db";
import { assertPermission, Permission } from "@/lib/rbac";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

// =============================================================================
// ROLE ACTIONS
// =============================================================================

/**
 * Get all roles with user counts.
 */
export async function getRoles() {
  await assertPermission(Permission.ROLE_VIEW);

  const roles = await prisma.role.findMany({
    include: {
      _count: { select: { userRoles: true } },
    },
    orderBy: { name: "asc" },
  });

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    permissions: role.permissions as string[],
    isSystem: role.isSystem,
    userCount: role._count.userRoles,
  }));
}

/**
 * Create a new custom role.
 */
export async function createRole(data: {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
}) {
  const auth = await assertPermission(Permission.ROLE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  // Check for duplicate code
  const existing = await prisma.role.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    return { success: false, error: "A role with this code already exists" };
  }

  try {
    const role = await prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
        permissions: data.permissions,
        isSystem: false,
      },
      include: {
        _count: { select: { userRoles: true } },
      },
    });

    await audit.create("Role", role.id, {
      code: data.code,
      name: data.name,
      permissionCount: data.permissions.length,
    });

    revalidatePath("/settings/roles");

    return {
      success: true,
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        permissions: role.permissions as string[],
        isSystem: role.isSystem,
        userCount: role._count.userRoles,
      },
    };
  } catch (error) {
    console.error("Failed to create role:", error);
    return { success: false, error: "Failed to create role" };
  }
}

/**
 * Update an existing role's name, description, and/or permissions.
 */
export async function updateRole(
  roleId: string,
  data: {
    name?: string;
    description?: string | null;
    permissions?: string[];
  }
) {
  const auth = await assertPermission(Permission.ROLE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    return { success: false, error: "Role not found" };
  }

  try {
    const updated = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name ?? role.name,
        description: data.description !== undefined ? data.description : role.description,
        permissions: data.permissions ?? (role.permissions as string[]),
      },
    });

    await audit.update(
      "Role",
      roleId,
      role as unknown as Record<string, unknown>,
      data as Record<string, unknown>
    );

    revalidatePath("/settings/roles");

    return { success: true, role: updated };
  } catch (error) {
    console.error("Failed to update role:", error);
    return { success: false, error: "Failed to update role" };
  }
}

/**
 * Delete a custom role (hard delete). System roles cannot be deleted.
 */
export async function deleteRole(roleId: string) {
  const auth = await assertPermission(Permission.ROLE_MANAGE);

  const headersList = await headers();
  const audit = createAuditLogger({
    userId: auth.user.id,
    userEmail: auth.user.email,
    ipAddress: headersList.get("x-forwarded-for") ?? undefined,
    userAgent: headersList.get("user-agent") ?? undefined,
  });

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      _count: { select: { userRoles: true } },
    },
  });

  if (!role) {
    return { success: false, error: "Role not found" };
  }

  if (role.isSystem) {
    return { success: false, error: "System roles cannot be deleted" };
  }

  if (role._count.userRoles > 0) {
    return {
      success: false,
      error: `Cannot delete role with ${role._count.userRoles} assigned user(s). Please reassign them first.`,
    };
  }

  try {
    await prisma.role.delete({ where: { id: roleId } });

    await audit.delete("Role", roleId, {
      code: role.code,
      name: role.name,
    });

    revalidatePath("/settings/roles");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete role:", error);
    return { success: false, error: "Failed to delete role" };
  }
}
