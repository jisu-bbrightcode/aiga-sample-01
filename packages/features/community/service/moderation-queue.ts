/**
 * Unified moderation-queue normalization (PB-COMM-MODERATION-API-LIST-001).
 *
 * The admin moderation queue (`GET /admin/community/moderation`) lets an admin
 * track 신고/필터/숨김/차단 in one screen (AC#2). Those live in three distinct
 * first-class moderation tables with different status vocabularies:
 *
 *   - `community_reports`      → kind "report" (신고)
 *   - `community_filter_logs`  → kind "filter" (필터 후보 `blocked` + 숨김 후보 `hidden_for_review`)
 *   - `community_bans`         → kind "ban"    (차단)
 *
 * This module is the pure (DB-free) projection layer: it maps each heterogeneous
 * row into a single {@link ModerationQueueItem} shape carrying both a normalized
 * `state` (open/resolved) for cross-source filtering AND the raw source `status`
 * so the precise processing state stays trackable. Merge + pagination across the
 * sources is done here too, so it can be unit-tested without a database.
 */

/** Source table a queue item originates from. */
export type ModerationKind = "report" | "filter" | "ban";

/**
 * Normalized cross-source lifecycle state. Each source has its own status
 * vocabulary; `state` collapses them to a single open/resolved axis so an admin
 * can filter "still needs attention" vs "already handled" across all kinds.
 */
export type ModerationState = "open" | "resolved";

/** A single normalized moderation-queue entry. */
export interface ModerationQueueItem {
  kind: ModerationKind;
  /** Source row id. */
  id: string;
  communityId: string;
  /** Content/user the action targets (post/comment/user). null when unknown. */
  targetType: string | null;
  targetId: string | null;
  /**
   * The user this entry is "about" from a moderator's view: the reporter for a
   * report, the content author for a filter log, the banned user for a ban.
   */
  subjectId: string | null;
  /** Normalized open/resolved state for cross-source filtering. */
  state: ModerationState;
  /** Raw source status string (report status / filter reviewStatus / ban active|expired). */
  status: string;
  /** Report severity (low/medium/high/critical). null for non-report kinds. */
  severity: string | null;
  /** Free-text reason/description, when present. */
  reason: string | null;
  /** Filter rule type (keyword/link/attachment/moderation). null for non-filter kinds. */
  ruleType: string | null;
  /** Filter action (blocked/hidden_for_review). null for non-filter kinds. */
  action: string | null;
  /** Creation timestamp as ISO-8601 string (used as the global sort key). */
  createdAt: string;
}

// ── Minimal row input shapes ────────────────────────────────────────────────
// Only the columns the projection reads, so the helpers stay decoupled from the
// full Drizzle row types (which also keeps the unit tests lightweight).

type TimestampLike = Date | string | null;

export interface ReportRowInput {
  id: string;
  communityId: string;
  reporterId: string;
  targetType: string | null;
  targetId: string | null;
  status: string;
  severity: string | null;
  description: string | null;
  createdAt: TimestampLike;
}

export interface FilterRowInput {
  id: string;
  communityId: string;
  authorId: string;
  targetType: string | null;
  targetId: string | null;
  reviewStatus: string;
  ruleType: string | null;
  action: string | null;
  reason: string | null;
  createdAt: TimestampLike;
}

export interface BanRowInput {
  id: string;
  communityId: string;
  userId: string;
  bannedBy: string | null;
  reason: string | null;
  isPermanent: boolean;
  expiresAt: TimestampLike;
  createdAt: TimestampLike;
}

/** Report statuses that still require moderator attention. */
const OPEN_REPORT_STATUSES = new Set(["pending", "reviewing"]);
/** Filter review status that still requires moderator attention. */
const OPEN_FILTER_STATUS = "pending";

/** Coerce a timestamp-ish value to an ISO string (epoch 0 when absent). */
function toIso(value: TimestampLike): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date(0).toISOString();
}

/** report: pending/reviewing → open; resolved/dismissed → resolved. */
export function deriveReportState(status: string): ModerationState {
  return OPEN_REPORT_STATUSES.has(status) ? "open" : "resolved";
}

/** filter: pending → open; approved/rejected → resolved. */
export function deriveFilterState(reviewStatus: string): ModerationState {
  return reviewStatus === OPEN_FILTER_STATUS ? "open" : "resolved";
}

/**
 * ban: active → open; expired → resolved. A ban is active when it is permanent
 * or has no/future expiry. `now` is injected so the helper stays pure/testable.
 */
export function deriveBanActive(
  row: Pick<BanRowInput, "isPermanent" | "expiresAt">,
  now: Date,
): boolean {
  if (row.isPermanent) return true;
  if (!row.expiresAt) return true;
  const expires = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
  return expires.getTime() > now.getTime();
}

export function normalizeReport(row: ReportRowInput): ModerationQueueItem {
  return {
    kind: "report",
    id: row.id,
    communityId: row.communityId,
    targetType: row.targetType,
    targetId: row.targetId,
    subjectId: row.reporterId,
    state: deriveReportState(row.status),
    status: row.status,
    severity: row.severity,
    reason: row.description,
    ruleType: null,
    action: null,
    createdAt: toIso(row.createdAt),
  };
}

export function normalizeFilter(row: FilterRowInput): ModerationQueueItem {
  return {
    kind: "filter",
    id: row.id,
    communityId: row.communityId,
    targetType: row.targetType,
    targetId: row.targetId,
    subjectId: row.authorId,
    state: deriveFilterState(row.reviewStatus),
    status: row.reviewStatus,
    severity: null,
    reason: row.reason,
    ruleType: row.ruleType,
    action: row.action,
    createdAt: toIso(row.createdAt),
  };
}

export function normalizeBan(row: BanRowInput, now: Date): ModerationQueueItem {
  const active = deriveBanActive(row, now);
  return {
    kind: "ban",
    id: row.id,
    communityId: row.communityId,
    targetType: "user",
    targetId: row.userId,
    subjectId: row.bannedBy,
    state: active ? "open" : "resolved",
    status: active ? "active" : "expired",
    severity: null,
    reason: row.reason,
    ruleType: null,
    action: null,
    createdAt: toIso(row.createdAt),
  };
}

/**
 * Sort newest-first by createdAt, with a stable id tiebreak so equal timestamps
 * paginate deterministically. Returns a new array (no mutation of the input).
 */
export function sortByCreatedAtDesc(items: readonly ModerationQueueItem[]): ModerationQueueItem[] {
  return [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    // Equal timestamps: stable id tiebreak (desc) for deterministic pagination.
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * Slice the global page window out of an already-merged item list.
 *
 * Callers fetch up to `page * limit` rows from EACH source (a superset of any
 * source's contribution to the true global top `page * limit`), merge, sort,
 * then take the `[offset, offset + limit)` window — which is exact for the
 * requested page even though each source was queried independently.
 */
export function paginateSlice(
  items: readonly ModerationQueueItem[],
  page: number,
  limit: number,
): ModerationQueueItem[] {
  const offset = (page - 1) * limit;
  return items.slice(offset, offset + limit);
}
