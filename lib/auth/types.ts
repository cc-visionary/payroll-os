// =============================================================================
// PeopleOS PH - Auth Types
// =============================================================================

import type { PermissionValue } from "./permissions";

/**
 * Available company for the user (from UserCompany join table).
 */
export interface UserCompanyInfo {
  id: string;       // Company ID
  code: string;
  name: string;
  isDefault: boolean;
}

/**
 * Session user - the authenticated user's data available in the session.
 */
export interface SessionUser {
  id: string;
  email: string;
  companyId: string;           // Current active company
  employeeId: string | null;   // Employee ID in current company (if any)
  roles: string[];
  permissions: PermissionValue[];
  companies: UserCompanyInfo[]; // All companies user can access
}

/**
 * JWT payload structure.
 */
export interface JWTPayload {
  sub: string; // User ID
  email: string;
  companyId: string;
  employeeId: string | null;
  roles: string[];
  permissions: PermissionValue[];
  companies: UserCompanyInfo[];  // All companies user can access
  iat: number;
  exp: number;
  jti: string; // JWT ID for token revocation
}

/**
 * Refresh token payload.
 */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Auth session returned from getSession().
 */
export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  expiresAt: Date;
}

/**
 * Login credentials.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login result.
 */
export interface LoginResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: SessionUser;
  error?: string;
}

/**
 * Token refresh result.
 */
export interface RefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

/**
 * Auth context for request handlers.
 */
export interface AuthContext {
  user: SessionUser;
  hasPermission: (permission: PermissionValue) => boolean;
  hasAnyPermission: (permissions: PermissionValue[]) => boolean;
  hasAllPermissions: (permissions: PermissionValue[]) => boolean;
}
