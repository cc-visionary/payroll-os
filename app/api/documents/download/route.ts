// =============================================================================
// PeopleOS PH - Direct Document Download API Route
// =============================================================================
// Serves documents by direct path with authentication checks.
// Used for applicant documents and other non-employee documents.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { existsSync } from "fs";

// Document storage base path (configurable via env)
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/documents";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get path from query param
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get("path");

    if (!relativePath) {
      return NextResponse.json(
        { success: false, error: "Path is required" },
        { status: 400 }
      );
    }

    // Security: Prevent directory traversal
    if (relativePath.includes("..") || relativePath.startsWith("/")) {
      return NextResponse.json(
        { success: false, error: "Invalid path" },
        { status: 400 }
      );
    }

    // Permission check: User must have hiring:view for applicant docs
    // or document:view for employee docs
    const isApplicantDoc = relativePath.startsWith("applicants/");
    const hasPermission = isApplicantDoc
      ? session.user.permissions.includes("hiring:view")
      : session.user.permissions.includes("document:view");

    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    // Resolve file path
    const filePath = join(DOCUMENT_STORAGE_PATH, relativePath);

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`Document file not found: ${filePath}`);
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Read file content
    const content = await readFile(filePath);

    // Audit log the document access
    const headersList = await headers();
    const audit = createAuditLogger({
      userId: session.user.id,
      userEmail: session.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    await audit.export("Document", {
      path: relativePath,
      source: isApplicantDoc ? "applicant" : "other",
    });

    // Determine MIME type from extension
    const fileName = basename(relativePath);
    const extension = fileName.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    };
    const mimeType = mimeTypes[extension || ""] || "application/octet-stream";

    // Determine content disposition based on query param
    const download = searchParams.get("download") === "true";
    const disposition = download ? "attachment" : "inline";

    // Return file with appropriate headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Content-Length": content.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Document retrieval error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve document" },
      { status: 500 }
    );
  }
}
