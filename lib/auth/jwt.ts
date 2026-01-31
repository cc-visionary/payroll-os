// =============================================================================
// PeopleOS PH - JWT Utilities
// =============================================================================
// Custom JWT implementation using jose library.
// Chosen over NextAuth for:
// 1. Full control over token structure and claims
// 2. Simpler deployment on Vercel (no database adapter complexity)
// 3. Works seamlessly with server components and server actions
// 4. No session database required (stateless)
// =============================================================================

import { SignJWT, jwtVerify, type JWTPayload as JoseJWTPayload } from "jose";
import { cookies } from "next/headers";
import type { JWTPayload, RefreshTokenPayload, SessionUser, UserCompanyInfo } from "./types";
import type { PermissionValue } from "./permissions";

// Lazy secret initialization to avoid build-time errors
let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (_secret) return _secret;

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }

  _secret = new TextEncoder().encode(JWT_SECRET || "dev-secret-change-in-production");
  return _secret;
}

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

// Cookie names
export const ACCESS_TOKEN_COOKIE = "payrollos_access_token";
export const REFRESH_TOKEN_COOKIE = "payrollos_refresh_token";

/**
 * Generate a unique JWT ID for token tracking/revocation.
 */
function generateJti(): string {
  return crypto.randomUUID();
}

/**
 * Create an access token for a user.
 */
export async function createAccessToken(user: SessionUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    email: user.email,
    companyId: user.companyId,
    employeeId: user.employeeId,
    roles: user.roles,
    permissions: user.permissions,
    companies: user.companies,
  } as JoseJWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setJti(generateJti())
    .sign(getSecret());

  return token;
}

/**
 * Create a refresh token for a user.
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setJti(generateJti())
    .sign(getSecret());

  return token;
}

/**
 * Verify and decode an access token.
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      companyId: payload.companyId as string,
      employeeId: payload.employeeId as string | null,
      roles: payload.roles as string[],
      permissions: payload.permissions as PermissionValue[],
      companies: (payload.companies as UserCompanyInfo[]) || [],
      iat: payload.iat as number,
      exp: payload.exp as number,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}

/**
 * Verify and decode a refresh token.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    return {
      sub: payload.sub as string,
      jti: payload.jti as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/**
 * Set auth cookies (access + refresh tokens).
 */
export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();

  // Access token - shorter expiry, httpOnly, secure
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60, // 15 minutes
  });

  // Refresh token - longer expiry, httpOnly, secure, stricter path
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth", // Only sent to auth endpoints
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Clear auth cookies (logout).
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

/**
 * Get access token from cookies.
 */
export async function getAccessTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

/**
 * Get refresh token from cookies.
 */
export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
