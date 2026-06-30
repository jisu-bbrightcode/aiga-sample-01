/**
 * Pending personalization intent — return-to-attempted-action (FR-002 / BBR-729).
 *
 * When a logged-out visitor triggers a protected action (저장/관심) we persist the
 * intended action here, then route them through sign-in carrying the page as
 * `next`. After login they land back on the page and {@link readPendingIntent}
 * lets the page replay the exact action they attempted — so the click is not
 * lost across the auth redirect. The intent lives in `sessionStorage` (cleared
 * when the tab closes, never shared across tabs) and is single-use: replay it,
 * then {@link clearPendingIntent}.
 *
 * Stored data is untrusted on read-back (a user could hand-edit it), so
 * {@link readPendingIntent} validates the shape and silently drops anything
 * malformed rather than acting on a bad payload.
 */

import type { ServiceTargetType } from "../api/types";

const STORAGE_KEY = "aiga.service-flow.pending-intent";

export type PendingIntentKind = "save" | "interest";

export interface PendingIntent {
  kind: PendingIntentKind;
  targetType: ServiceTargetType;
  targetId: string;
}

const KINDS: readonly PendingIntentKind[] = ["save", "interest"];
const TARGET_TYPES: readonly ServiceTargetType[] = ["doctor", "hospital"];

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** Persist the action the user attempted while logged out. */
export function storePendingIntent(intent: PendingIntent): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Storage full / disabled (private mode) — degrade gracefully; the user can
    // simply click again after login. Never throw out of a gating click.
  }
}

/** Read + validate the pending intent, or `null` when absent/malformed. */
export function readPendingIntent(): PendingIntent | null {
  if (!hasSessionStorage()) return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const kind = parsed.kind as PendingIntentKind;
    const targetType = parsed.targetType as ServiceTargetType;
    const targetId = parsed.targetId;
    if (
      KINDS.includes(kind) &&
      TARGET_TYPES.includes(targetType) &&
      typeof targetId === "string" &&
      targetId.length > 0
    ) {
      return { kind, targetType, targetId };
    }
  } catch {
    // Malformed JSON — fall through to null.
  }
  return null;
}

/** Remove the pending intent (after a successful replay, or to discard it). */
export function clearPendingIntent(): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort cleanup.
  }
}
