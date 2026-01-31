// =============================================================================
// PeopleOS PH - Logout API Route
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession, logout } from "@/lib/auth";
import { getRefreshTokenFromCookies } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (session) {
      const refreshToken = await getRefreshTokenFromCookies();
      const ipAddress = request.headers.get("x-forwarded-for") ?? undefined;
      const userAgent = request.headers.get("user-agent") ?? undefined;

      await logout(session.user.id, refreshToken ?? undefined, ipAddress, userAgent);
    }

    // Check if this is a form submission (browser) or API call (fetch/ajax)
    const acceptHeader = request.headers.get("accept") || "";
    const contentType = request.headers.get("content-type") || "";

    // If it's a form submission, redirect to login page
    if (contentType.includes("application/x-www-form-urlencoded") ||
        !acceptHeader.includes("application/json")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // For API calls, return JSON
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);

    // Check if this is a form submission
    const acceptHeader = request.headers.get("accept") || "";
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded") ||
        !acceptHeader.includes("application/json")) {
      // Still redirect to login even on error (cookies are cleared anyway)
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.json(
      { success: false, error: "Failed to logout" },
      { status: 500 }
    );
  }
}
