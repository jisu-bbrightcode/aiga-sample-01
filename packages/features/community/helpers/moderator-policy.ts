import type { ModeratorPermissions } from "@repo/drizzle/schema";

/**
 * Pure moderator authorization + lifecycle rules (DB-free, unit-testable).
 *
 * Authorization (AC#1): only the owner, a community admin, or an active
 * moderator carrying the `manageModerators` permission may invite, remove, or
 * re-permission moderators. Ownership transfer is owner-only.
 *
 * Lifecycle (AC#2): an appointment moves pending → active/declined on the
 * invitee's response, and active/pending → revoked when removed. Every state
 * is a durable invite-state record paired with an audit log entry.
 */

export type CommunityRole = "owner" | "admin" | "moderator" | "member";
export type ModeratorStatus = "pending" | "active" | "declined" | "revoked";

export const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  managePosts: true,
  manageComments: true,
  manageUsers: true,
  manageFlairs: false,
  manageRules: false,
  manageSettings: false,
  manageModerators: false,
  viewModLog: true,
  viewReports: true,
};

/**
 * Permissions a non-owner/admin moderator can never grant, even with
 * `manageModerators`. Prevents lateral privilege escalation.
 */
const ESCALATED_PERMISSION_KEYS = ["manageModerators", "manageSettings"] as const;

export interface ModeratorActor {
  role: CommunityRole;
  /** Present only for a moderator-role actor (their own appointment row). */
  permissions?: ModeratorPermissions | null;
  /** Status of the actor's own appointment (only meaningful for moderators). */
  status?: ModeratorStatus | null;
}

/**
 * Whether the actor may invite / remove / re-permission moderators.
 * Owner and admin always may; a moderator only via an active appointment that
 * carries `manageModerators`.
 */
export function canManageModerators(actor: ModeratorActor): boolean {
  if (actor.role === "owner" || actor.role === "admin") {
    return true;
  }
  if (actor.role === "moderator") {
    return actor.status === "active" && actor.permissions?.manageModerators === true;
  }
  return false;
}

/** Only the community owner may transfer ownership. */
export function canTransferOwnership(actorRole: CommunityRole): boolean {
  return actorRole === "owner";
}

/** Only a pending appointment can be accepted or declined by the invitee. */
export function canRespondToInvite(status: ModeratorStatus): boolean {
  return status === "pending";
}

/** Resulting status when the invitee accepts (true) or declines (false). */
export function nextStatusForResponse(
  accept: boolean,
): Extract<ModeratorStatus, "active" | "declined"> {
  return accept ? "active" : "declined";
}

/** A pending or active appointment can be revoked; declined/revoked cannot. */
export function canRevokeAppointment(status: ModeratorStatus): boolean {
  return status === "pending" || status === "active";
}

/** Permissions can only be changed on an active appointment. */
export function canUpdatePermissions(status: ModeratorStatus): boolean {
  return status === "active";
}

/** Merge a partial permission patch onto the default permission set. */
export function normalizeModeratorPermissions(
  patch?: Partial<ModeratorPermissions> | null,
): ModeratorPermissions {
  return { ...DEFAULT_MODERATOR_PERMISSIONS, ...(patch ?? {}) };
}

/**
 * Strip escalated permissions when the granting actor is not an owner/admin,
 * so a managing moderator cannot hand out powers above their tier.
 */
export function sanitizeGrantablePermissions(
  actorRole: CommunityRole,
  requested: ModeratorPermissions,
): ModeratorPermissions {
  if (actorRole === "owner" || actorRole === "admin") {
    return requested;
  }
  const result: ModeratorPermissions = { ...requested };
  for (const key of ESCALATED_PERMISSION_KEYS) {
    result[key] = false;
  }
  return result;
}
