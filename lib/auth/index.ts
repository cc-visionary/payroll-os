// =============================================================================
// PeopleOS PH - Auth Module Exports
// =============================================================================

// Types
export type {
  SessionUser,
  AuthSession,
  AuthContext,
  LoginCredentials,
  LoginResult,
  JWTPayload,
  UserCompanyInfo,
} from "./types";

// Permissions
export { Permission, RolePermissions, PermissionGroups } from "./permissions";
export type { PermissionValue, PermissionKey } from "./permissions";

// Session management
export {
  getSession,
  requireAuth,
  getAuthContext,
  requireAuthContext,
  createAuthContext,
} from "./session";

// Login/Logout
export { login, logout, logoutAllDevices } from "./login";

// Password utilities
export { hashPassword, verifyPassword, validatePasswordStrength } from "./password";

// JWT utilities (for advanced use cases)
export {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "./jwt";
