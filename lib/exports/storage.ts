// =============================================================================
// PeopleOS PH - Export Storage
// =============================================================================
// Handles storage of export artifacts in DB or Vercel Blob
// =============================================================================

import { prisma } from "@/lib/db";
import type { ExportArtifactInput, ExportHistoryItem, StorageStrategy } from "./types";
import { DEFAULT_EXPORT_STORAGE_CONFIG } from "./types";
import type { ExportType } from "@/app/generated/prisma";

/**
 * Determine storage strategy based on file size
 */
export function determineStorageStrategy(fileSizeBytes: number): StorageStrategy {
  return fileSizeBytes <= DEFAULT_EXPORT_STORAGE_CONFIG.maxDbStorageSize
    ? "database"
    : "blob";
}

/**
 * Store export artifact in database
 */
export async function storeExportArtifact(
  input: ExportArtifactInput
): Promise<{ id: string; downloadUrl: string }> {
  const strategy = determineStorageStrategy(input.content.length);

  let blobUrl: string | null = null;
  let fileContent: Uint8Array<ArrayBuffer> | null = null;

  if (strategy === "database") {
    // Store in database - convert Buffer to Uint8Array for Prisma
    const arrayBuffer = input.content.buffer.slice(
      input.content.byteOffset,
      input.content.byteOffset + input.content.byteLength
    ) as ArrayBuffer;
    fileContent = new Uint8Array(arrayBuffer);
  } else {
    // For Vercel Blob storage, we would use @vercel/blob
    // For now, fall back to database with a warning if file is too large
    if (input.content.length > 10 * 1024 * 1024) {
      // 10MB hard limit
      throw new Error("File too large for storage. Maximum size is 10MB.");
    }
    // Store in database anyway for now (Vercel Blob requires setup)
    const arrayBuffer = input.content.buffer.slice(
      input.content.byteOffset,
      input.content.byteOffset + input.content.byteLength
    ) as ArrayBuffer;
    fileContent = new Uint8Array(arrayBuffer);
    console.warn(
      `File ${input.fileName} (${input.content.length} bytes) exceeds recommended DB storage size. ` +
        "Consider configuring Vercel Blob for production."
    );
  }

  const artifact = await prisma.exportArtifact.create({
    data: {
      companyId: input.companyId,
      payrollRunId: input.payrollRunId,
      exportType: input.exportType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.content.length,
      blobUrl,
      fileContent,
      contentHash: input.contentHash,
      recordCount: input.recordCount,
      totalAmount: input.totalAmount,
      dataSnapshot: input.dataSnapshot ? JSON.parse(JSON.stringify(input.dataSnapshot)) : undefined,
      generatedById: input.generatedById,
      expiresAt: DEFAULT_EXPORT_STORAGE_CONFIG.defaultExpirationDays > 0
        ? new Date(
            Date.now() +
              DEFAULT_EXPORT_STORAGE_CONFIG.defaultExpirationDays * 24 * 60 * 60 * 1000
          )
        : null,
    },
  });

  return {
    id: artifact.id,
    downloadUrl: `/api/exports/${artifact.id}/download`,
  };
}

/**
 * Get export artifact content by ID
 */
export async function getExportArtifactContent(
  artifactId: string,
  companyId: string
): Promise<{
  content: Buffer;
  fileName: string;
  mimeType: string;
  contentHash: string;
} | null> {
  const artifact = await prisma.exportArtifact.findFirst({
    where: {
      id: artifactId,
      companyId,
    },
    select: {
      fileContent: true,
      blobUrl: true,
      fileName: true,
      mimeType: true,
      contentHash: true,
    },
  });

  if (!artifact) {
    return null;
  }

  let content: Buffer;

  if (artifact.fileContent) {
    // Convert Uint8Array back to Buffer
    content = Buffer.from(artifact.fileContent);
  } else if (artifact.blobUrl) {
    // Fetch from Vercel Blob
    // For now, throw an error since Blob is not configured
    throw new Error("Blob storage not configured");
  } else {
    throw new Error("Export artifact has no content");
  }

  return {
    content,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    contentHash: artifact.contentHash,
  };
}

/**
 * Get export history for a payroll run
 */
export async function getExportHistory(
  payrollRunId: string,
  companyId: string
): Promise<ExportHistoryItem[]> {
  const artifacts = await prisma.exportArtifact.findMany({
    where: {
      payrollRunId,
      companyId,
    },
    select: {
      id: true,
      exportType: true,
      fileName: true,
      fileSizeBytes: true,
      recordCount: true,
      totalAmount: true,
      generatedAt: true,
      generatedBy: {
        select: { email: true },
      },
    },
    orderBy: { generatedAt: "desc" },
  });

  return artifacts.map((a) => ({
    id: a.id,
    exportType: a.exportType,
    fileName: a.fileName,
    fileSizeBytes: a.fileSizeBytes,
    recordCount: a.recordCount,
    totalAmount: a.totalAmount ? Number(a.totalAmount) : null,
    generatedAt: a.generatedAt,
    generatedBy: a.generatedBy.email,
  }));
}

/**
 * Check if an export artifact already exists with the same content hash
 */
export async function findExistingExport(
  payrollRunId: string,
  exportType: ExportType,
  contentHash: string
): Promise<{ id: string; fileName: string } | null> {
  const existing = await prisma.exportArtifact.findFirst({
    where: {
      payrollRunId,
      exportType,
      contentHash,
    },
    select: {
      id: true,
      fileName: true,
    },
  });

  return existing;
}

/**
 * Delete expired export artifacts
 */
export async function cleanupExpiredExports(): Promise<number> {
  const result = await prisma.exportArtifact.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Get total storage used by a company
 */
export async function getCompanyStorageUsage(companyId: string): Promise<{
  totalBytes: number;
  artifactCount: number;
}> {
  const result = await prisma.exportArtifact.aggregate({
    where: { companyId },
    _sum: { fileSizeBytes: true },
    _count: true,
  });

  return {
    totalBytes: result._sum.fileSizeBytes || 0,
    artifactCount: result._count,
  };
}
