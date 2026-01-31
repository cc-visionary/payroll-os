// =============================================================================
// PeopleOS PH - Edge Middleware
// =============================================================================
// Handles authentication checks at the edge for protected routes.
// Note: This runs on the Edge Runtime, so we can only do basic JWT validation.
// Full permission checks happen in the route handlers.
// =============================================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/access-denied",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/health",
];

// Static file patterns to skip
const STATIC_PATTERNS = [
  /^\/_next/,
  /^\/favicon\.ico$/,
  /^\/.*\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2)$/,
];

// Cookie name (must match jwt.ts)
const ACCESS_TOKEN_COOKIE = "payrollos_access_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files
  if (STATIC_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get access token from cookie
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    // No token - redirect to login
    return redirectToLogin(request);
  }

  // Verify token at the edge (basic validation only)
  const isValid = await verifyTokenAtEdge(accessToken);

  if (!isValid) {
    // Token invalid/expired - redirect to login
    // The client should have tried refresh first, so this is a hard failure
    return redirectToLogin(request);
  }

  // Token valid - continue
  return NextResponse.next();
}

/**
 * Verify JWT at the edge (lightweight check).
 */
async function verifyTokenAtEdge(token: string): Promise<boolean> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET not set");
      return false;
    }

    const secretKey = new TextEncoder().encode(secret);
    await jwtVerify(token, secretKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Redirect to login with return URL.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);

  // Add return URL for post-login redirect
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set("returnUrl", request.nextUrl.pathname);
  }

  return NextResponse.redirect(loginUrl);
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
