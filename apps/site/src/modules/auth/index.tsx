import type { SiteModule } from "@/modules/types";
import { AuthProvider } from "./auth-provider";
import { LoginButton } from "./login-button";

/**
 * Auth module — modal-based sign in / sign up reusing @repo/core/auth
 * (better-auth) against the shared API. Enabled and configured via
 * `site.config.ts` → `modules.auth`.
 */
export const authModule: SiteModule = {
  id: "auth",
  isEnabled: (config) => config.modules.auth?.enabled ?? false,
  Provider: AuthProvider,
  navItems: () => [
    { id: "auth-actions", slot: "actions", render: () => <LoginButton /> },
  ],
};
