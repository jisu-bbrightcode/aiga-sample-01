/**
 * Frontend mirror of the backend publish-status transition policy
 * (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681 AC#1).
 *
 * The server is authoritative — it rejects a disallowed transition with a 422 —
 * but the console only offers the transitions the server will accept, so an
 * operator never sees an action that is bound to fail. Keep this table in sync
 * with `packages/features/service-domain/transitions.ts`.
 */
import type { DomainResourceStatus } from "./types";

/** Allowed next states for each current state (excludes the no-op self move). */
export const DOMAIN_STATUS_TRANSITIONS: Record<DomainResourceStatus, DomainResourceStatus[]> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

/** The publish/unpublish status actions surfaced as buttons on the detail page. */
export interface DomainStatusAction {
  /** Target status the action moves the record to. */
  to: DomainResourceStatus;
  /** Button label. */
  label: string;
  /** Short confirmation copy describing the effect. */
  description: string;
}

/**
 * The status actions available for a record in `current` state. archive →
 * published is intentionally absent (a보관 record returns to draft first), and
 * the archive/restore버튼 are owned by {@link ./components/domain-lifecycle-actions},
 * so this only exposes the 공개(published) ↔ 비공개(draft) moves.
 */
export function statusActionsFor(current: DomainResourceStatus): DomainStatusAction[] {
  const actions: DomainStatusAction[] = [];
  const allowed = DOMAIN_STATUS_TRANSITIONS[current];
  if (allowed.includes("published")) {
    actions.push({
      to: "published",
      label: "공개",
      description: "이 리소스를 공개합니다. 공개 페이지와 앱에 노출됩니다.",
    });
  }
  if (current === "published" && allowed.includes("draft")) {
    actions.push({
      to: "draft",
      label: "비공개 전환",
      description: "공개를 내려 비공개(초안) 상태로 전환합니다. 공개/앱 노출에서 제외됩니다.",
    });
  }
  return actions;
}
