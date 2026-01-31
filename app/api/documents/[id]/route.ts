// =============================================================================
// PeopleOS PH - Document Download/View API Route
// =============================================================================
// Serves employee documents with authentication and authorization checks.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Document storage base path (configurable via env)
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || "./storage/documents";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get the document with employee info for authorization
    const document = await prisma.employeeDocument.findFirst({
      where: {
        id,
      },
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            userId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Authorization check:
    // 1. User must be in the same company
    // 2. User must either be the employee OR have document view permission
    const isOwnDocument = document.employee.userId === session.user.id;
    const isSameCompany = document.employee.companyId === session.user.companyId;
    const hasViewPermission = session.user.permissions.includes("document:view");

    if (!isSameCompany) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    if (!isOwnDocument && !hasViewPermission) {
      return NextResponse.json(
        { success: false, error: "Not authorized to view this document" },
        { status: 403 }
      );
    }

    // Resolve file path
    const filePath = document.filePath.startsWith("/")
      ? document.filePath
      : join(DOCUMENT_STORAGE_PATH, document.filePath);

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`Document file not found: ${filePath}`);
      return NextResponse.json(
        { success: false, error: "Document file not found" },
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

    await audit.export("EmployeeDocument", {
      documentId: document.id,
      employeeId: document.employeeId,
      documentType: document.documentType,
      fileName: document.fileName,
    });

    // Determine content disposition based on query param or mime type
    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "true";
    const disposition = download ? "attachment" : "inline";

    // Return file with appropriate headers
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${document.fileName}"`,
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
