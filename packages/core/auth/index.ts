/**
 * @repo/core/auth
 *
 * 인증 관련 핵심 모듈
 * - 모든 Feature와 App에서 참조 가능
 * - Better Auth 기반
 */

// Auth Client
export { getAuthClient, initAuthClient } from "./auth-client";
export {
  AUTH_ERROR_CODES,
  type AuthErrorCode,
  type AuthErrorLike,
  isAuthErrorCode,
  normalizeAuthErrorCode,
  withNormalizedAuthErrorCode,
} from "./error-codes";
export { AdminGuard, type AdminRole } from "./guards/admin-guard";
// Guards (Client)
export { AuthGuard } from "./guards/auth-guard";
// Hooks
export { useAnalyticsIdentity } from "./hooks/use-analytics-identity";
export { useAuthStateSync } from "./hooks/use-auth-state-sync";
export { useProfileSync } from "./hooks/use-profile-sync";
// Session Refresh
export {
  isUnauthorizedError,
  refreshSessionToken,
  setAuthApiUrl,
} from "./session-refresh";
// Store (Jotai Atoms)
export {
  authenticatedAtom,
  type BetterAuthSession,
  // Types
  type Profile,
  profileAtom,
  sessionAtom,
  // Constants
  TOKEN_STORAGE_KEY,
  // Atoms
  tokenAtom,
  userRoleAtom,
} from "./store";

// NestJS Guards & Decorators — import from "@repo/core/nestjs/auth" directly
// DO NOT re-export server modules here — it pulls Node.js deps into Vite client bundles
