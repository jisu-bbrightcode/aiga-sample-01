// Feature-specific hooks

// Re-export from @repo/core/auth (prefer using @repo/core/auth directly)
export { useAuthStateSync, useProfileSync } from "@repo/core/auth";
export { useAdminSignIn } from "./use-admin-sign-in";
export { useSignInWithEmailAndPassword } from "./use-sign-in-with-email-and-password";
export { useSignInWithOAuth } from "./use-sign-in-with-oauth";
export { useSignUpWithEmailAndPassword } from "./use-sign-up-with-email-and-password";
export { useTokenAuthAction } from "./use-token-auth-action";
