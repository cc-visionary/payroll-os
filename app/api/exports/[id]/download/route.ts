// =============================================================================
// PeopleOS PH - Export Download API Route
// =============================================================================
// Handles downloading export artifacts with authentication and audit logging.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getExportArtifactContent } from "@/lib/exports/storage";
import { createAuditLogger } from "@/lib/audit";
import { headers } from "next/headers";

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

    // Get artifact content
    const artifact = await getExportArtifactContent(id, session.user.companyId);

    if (!artifact) {
      return NextResponse.json(
        { success: false, error: "Export not found" },
        { status: 404 }
      );
    }

    // Audit log the download
    const headersList = await headers();
    const audit = createAuditLogger({
      userId: session.user.id,
      userEmail: session.user.email,
      ipAddress: headersList.get("x-forwarded-for") ?? undefined,
      userAgent: headersList.get("user-agent") ?? undefined,
    });

    await audit.export("ExportDownload", {
      artifactId: id,
      fileName: artifact.fileName,
      contentHash: artifact.contentHash,
    });

    // Return file with appropriate headers
    const contentBuffer = Buffer.from(artifact.content);
    return new NextResponse(contentBuffer, {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        "Content-Length": contentBuffer.length.toString(),
        "X-Content-Hash": artifact.contentHash,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Export download error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to download export" },
      { status: 500 }
    );
  }
}
