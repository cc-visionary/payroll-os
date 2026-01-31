// =============================================================================
// PeopleOS PH - Audit Logging
// =============================================================================
// Centralized audit logging for all write operations.
// All audit logs are append-only and immutable.
// =============================================================================

import { prisma } from "@/lib/db";
import type { AuditAction } from "@/app/generated/prisma";

/**
 * Audit log entry input.
 */
export interface AuditLogInput {
  userId?: string | null;
  userEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Create an audit log entry.
 * This is a fire-and-forget operation - errors are logged but not thrown.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues ? JSON.parse(JSON.stringify(input.oldValues)) : undefined,
        newValues: input.newValues ? JSON.parse(JSON.stringify(input.newValues)) : undefined,
        description: input.description,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should not break operations
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Audit context for tracking changes within a request.
 */
export interface AuditContext {
  userId: string;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a scoped audit logger for a specific context.
 */
export function createAuditLogger(context: AuditContext) {
  return {
    /**
     * Log a CREATE action.
     */
    create: async (
      entityType: string,
      entityId: string,
      newValues: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "CREATE",
        entityType,
        entityId,
        newValues,
        description: description ?? `Created ${entityType}`,
      });
    },

    /**
     * Log an UPDATE action.
     */
    update: async (
      entityType: string,
      entityId: string,
      oldValues: Record<string, unknown>,
      newValues: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "UPDATE",
        entityType,
        entityId,
        oldValues,
        newValues,
        description: description ?? `Updated ${entityType}`,
      });
    },

    /**
     * Log a DELETE action.
     */
    delete: async (
      entityType: string,
      entityId: string,
      oldValues: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "DELETE",
        entityType,
        entityId,
        oldValues,
        description: description ?? `Deleted ${entityType}`,
      });
    },

    /**
     * Log an APPROVE action.
     */
    approve: async (
      entityType: string,
      entityId: string,
      metadata?: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "APPROVE",
        entityType,
        entityId,
        metadata,
        description: description ?? `Approved ${entityType}`,
      });
    },

    /**
     * Log a REJECT action.
     */
    reject: async (
      entityType: string,
      entityId: string,
      metadata?: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "REJECT",
        entityType,
        entityId,
        metadata,
        description: description ?? `Rejected ${entityType}`,
      });
    },

    /**
     * Log an EXPORT action.
     */
    export: async (
      entityType: string,
      metadata?: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "EXPORT",
        entityType,
        metadata,
        description: description ?? `Exported ${entityType}`,
      });
    },

    /**
     * Log an IMPORT action.
     */
    import: async (
      entityType: string,
      metadata?: Record<string, unknown>,
      description?: string
    ) => {
      await createAuditLog({
        ...context,
        action: "IMPORT",
        entityType,
        metadata,
        description: description ?? `Imported ${entityType}`,
      });
    },
  };
}

/**
 * Utility to compute diff between old and new values.
 * Only returns fields that changed.
 */
export function computeChanges(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): {
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
} {
  const changedOld: Record<string, unknown> = {};
  const changedNew: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Compare as JSON to handle objects/arrays
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedOld[key] = oldVal;
      changedNew[key] = newVal;
    }
  }

  return { oldValues: changedOld, newValues: changedNew };
}

/**
 * Sensitive fields that should be masked in audit logs.
 */
const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "sssNumber",
  "tinNumber",
  "philhealthNumber",
  "pagibigNumber",
  "accountNumber",
  "mfaSecret",
];

/**
 * Mask sensitive fields in an object for audit logging.
 */
export function maskSensitiveFields(
  values: Record<string, unknown>
): Record<string, unknown> {
  const masked = { ...values };

  for (const field of SENSITIVE_FIELDS) {
    if (field in masked && masked[field]) {
      masked[field] = "[REDACTED]";
    }
  }

  return masked;
}
