/**
 * invite-policy — pure validation rules for admin operator invitations
 * (PB-ADMIN-USERS-CREATE-001 / BBR-687).
 *
 * Kept side-effect free so the two acceptance criteria — "중복 이메일과 잘못된
 * role은 validation으로 차단된다" — can be unit-tested without a database. The
 * service layer composes these with the duplicate-email lookup; this module
 * owns the role allow-list, email normalization, and the invitation TTL.
 */

/**
 * Initial roles an admin may grant when inviting an operator. `owner` is
 * intentionally excluded — ownership transfer is a separate, higher-privilege
 * flow and must never be reachable through the invite form.
 */
export const INVITABLE_ROLES = ["admin", "member"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Default invitation lifetime: 7 days (만료 정책). */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Pragmatic, non-exhaustive email shape check. Real deliverability is verified
// by the invitation email actually arriving; this only blocks obvious garbage.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Narrow an arbitrary value to an invitable role, rejecting `owner`/unknown. */
export function isInvitableRole(value: unknown): value is InvitableRole {
  return typeof value === "string" && (INVITABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Normalize an email for invitation: trim + lowercase. Returns `null` when the
 * value is missing or not a plausible email so the caller can fail with a 400.
 */
export function normalizeInviteEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** Compute an invitation expiry timestamp from a reference `now`. */
export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}
