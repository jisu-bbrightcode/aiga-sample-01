// Config

// Re-export from @repo/core/auth for convenience
// (prefer using @repo/core/auth directly)
export {
  AdminGuard,
  type AdminRole,
  // Guards
  AuthGuard,
  authenticatedAtom,
  profileAtom,
  // Store
  tokenAtom,
  // Hooks
  useAuthStateSync,
  useProfileSync,
  userRoleAtom,
} from "@repo/core/auth";
export { type AuthUiVariant, authConfig } from "./config";

// Hooks (Feature-specific hooks)
export {
  useAdminSignIn,
  useSignInWithEmailAndPassword,
  useSignInWithOAuth,
  useSignUpWithEmailAndPassword,
  useTokenAuthAction,
} from "./hooks";

// UI - Public
export {
  AdminSignInForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  SignInForm,
  SignUpForm,
} from "./pages";
// Routes (code-based routing)
export {
  createAdminLoginRoute,
  createAuthAdminRoutes,
  createAuthRoutes,
  createSignInRoute,
  createSignUpRoute,
} from "./routes";
