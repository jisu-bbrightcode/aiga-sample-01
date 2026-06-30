/**
 * Return-to-intent helper for gated actions (PB-WEB-002 / BBR-580, AC#2).
 *
 * A visitor who triggers a protected action (저장/내 활동) while logged out is
 * sent to the sign-in page with their current location encoded as `next`. The
 * sign-in page already honours `next` and navigates back after login, so the
 * user returns to exactly where they intended to act. This composes the shared
 * `auth-next-path` primitives into one documented call so the gating sites have
 * a single, tested contract.
 */

import { authPathWithNext, sanitizeAuthNextPath } from "@/lib/auth-next-path";

const SIGN_IN_PATH = "/sign-in";

/**
 * Build the sign-in URL that returns the user to `intendedPath` after login.
 * The path is sanitized (only same-origin absolute paths survive) before being
 * attached, so a malformed/empty intent degrades to a plain sign-in.
 */
export function buildSignInIntentPath(intendedPath: string | null | undefined): string {
  const next = sanitizeAuthNextPath(intendedPath);
  return authPathWithNext(SIGN_IN_PATH, next);
}
