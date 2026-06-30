/**
 * Community Moderation Policy Delta (PB-COMM-DATA-001 / BBR-586)
 *
 * EXTEND over the product-builder-base community capability
 * (`./index.ts`). The base already models author blocking
 * (`communityUserBlocks`, per-user), community bans (`communityBans`,
 * community-global), global mod removal (`community_post_status` /
 * `community_comments.is_removed`) and embedded global automod config
 * (`communities.automod_config` / `banned_words`).
 *
 * This file adds the missing customer delta required by BBR-586 AC#3 —
 * "작성자 차단, 콘텐츠 숨김, 필터 결과가 사용자별/전역 정책으로 구분된다":
 *
 *  1. Per-user content hide (`communityHiddenContents`) — a user hiding a
 *     specific post/comment from their own feed, distinct from a moderator
 *     globally removing it.
 *  2. First-class content filters (`communityContentFilters`) with an
 *     explicit `policy_scope` (user | global) so keyword/pattern filters
 *     are stored, not just embedded as community config.
 *  3. Filter results (`communityFilterMatches`) — each match carries the
 *     originating scope so "필터 결과" itself is per-user/global separable.
 *
 * Together with the base block/ban tables this gives a clean
 * per-user-vs-global axis for the three moderation surfaces, and backs the
 * App Store / Google Play UGC-safety requirement to let users filter and
 * hide objectionable content (alongside the existing report/block models).
 */
import { baseColumns, user } from "@repo/drizzle/schema";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { communities } from "./index";

// ============================================================================
// Enums
// ============================================================================

/**
 * Policy ownership scope — the core axis required by AC#3.
 * - `user`: belongs to a single member (personal mute / hide / filter)
 * - `global`: enforced for everyone in the community (operator policy)
 */
export const policyScopeEnum = pgEnum("community_policy_scope", ["user", "global"]);

/**
 * Content a member can hide from their own feed.
 */
export const hiddenContentTargetTypeEnum = pgEnum("community_hidden_content_target_type", [
  "post",
  "comment",
]);

/**
 * How a filter pattern is matched.
 */
export const contentFilterMatchTypeEnum = pgEnum("community_content_filter_match_type", [
  "keyword", // case-insensitive substring / token
  "regex", // regular expression
  "domain", // link host
]);

/**
 * What a filter does when it matches.
 */
export const contentFilterActionEnum = pgEnum("community_content_filter_action", [
  "hide", // remove from the affected feed (user or global)
  "flag", // surface to the user / mod queue, keep visible
  "review", // hold for moderator review (global only)
]);

/**
 * Content surface a filter inspects.
 */
export const contentFilterTargetTypeEnum = pgEnum("community_content_filter_target_type", [
  "post",
  "comment",
]);

// ============================================================================
// Tables
// ============================================================================

/**
 * Per-user Content Hide — 사용자별 콘텐츠 숨김
 *
 * A member hiding a post/comment from their own view. This is the
 * per-user counterpart to global moderator removal
 * (`community_posts.status = 'hidden' | 'removed'`,
 * `community_comments.is_removed`), keeping user-generated content and
 * operator action history separate (AC#1).
 */
export const communityHiddenContents = pgTable(
  "community_hidden_contents",
  {
    ...baseColumns(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    targetType: hiddenContentTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),

    // Denormalized community for cheap per-community feed exclusion.
    communityId: uuid("community_id").references(() => communities.id, { onDelete: "cascade" }),

    // Optional provenance — e.g. "blocked_author" | "filter_match" | "manual".
    reason: text("reason"),
  },
  (table) => [
    uniqueIndex("community_hidden_contents_unique").on(
      table.userId,
      table.targetType,
      table.targetId,
    ),
    index("idx_hidden_contents_user").on(table.userId),
    index("idx_hidden_contents_target").on(table.targetType, table.targetId),
    index("idx_hidden_contents_user_community").on(table.userId, table.communityId),
  ],
);

/**
 * Content Filters — 필터 정책 (사용자별/전역)
 *
 * Keyword/regex/domain filters, scoped either to a single user
 * (personal mute list) or to a whole community (operator policy). The
 * `scope` column is the explicit per-user/global distinction AC#3 asks
 * for; it replaces relying on the embedded `communities.automod_config`
 * for everything.
 *
 * Scope invariants (enforced in the service / API layer, documented here):
 * - `scope = 'user'`  → `ownerId` set, `communityId` optional (null = all communities the user is in)
 * - `scope = 'global'`→ `ownerId` null, `communityId` set (operator policy for that community)
 */
export const communityContentFilters = pgTable(
  "community_content_filters",
  {
    ...baseColumns(),

    scope: policyScopeEnum("scope").notNull(),

    // Owner of a per-user filter (null for global filters).
    ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
    // Community a global filter belongs to (null for cross-community user filters).
    communityId: uuid("community_id").references(() => communities.id, { onDelete: "cascade" }),

    matchType: contentFilterMatchTypeEnum("match_type").notNull().default("keyword"),
    pattern: text("pattern").notNull(),
    appliesTo: contentFilterTargetTypeEnum("applies_to")
      .array()
      .notNull()
      .default(["post", "comment"]),
    action: contentFilterActionEnum("action").notNull().default("hide"),

    isActive: boolean("is_active").notNull().default(true),
    // Who created/owns the policy record (operator for global, owner for user).
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("idx_content_filters_scope").on(table.scope),
    index("idx_content_filters_owner").on(table.ownerId),
    index("idx_content_filters_community").on(table.communityId),
  ],
);

/**
 * Filter Matches — 필터 결과 (사용자별/전역 구분 저장)
 *
 * One row per content item a filter acted on. Each match carries its
 * originating `scope`, so filter *results* are themselves separable into
 * per-user vs global policy outcomes (the literal AC#3 wording, "필터
 * 결과가 사용자별/전역 정책으로 구분된다"). This is operator/automation
 * action history and stays separate from the user content itself (AC#1).
 */
export const communityFilterMatches = pgTable(
  "community_filter_matches",
  {
    ...baseColumns(),

    filterId: uuid("filter_id")
      .notNull()
      .references(() => communityContentFilters.id, { onDelete: "cascade" }),

    // Denormalized from the filter so results can be queried by scope/user
    // even after the originating filter is deleted-then-readded.
    scope: policyScopeEnum("scope").notNull(),
    // The user a per-user match applies to (null for global matches).
    affectedUserId: text("affected_user_id").references(() => user.id, { onDelete: "cascade" }),

    targetType: contentFilterTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),

    action: contentFilterActionEnum("action").notNull(),
    // Optional excerpt of what matched (for the mod queue / user review).
    matchedExcerpt: text("matched_excerpt"),

    matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_filter_matches_filter").on(table.filterId),
    index("idx_filter_matches_scope").on(table.scope),
    index("idx_filter_matches_affected_user").on(table.affectedUserId),
    index("idx_filter_matches_target").on(table.targetType, table.targetId),
  ],
);

// ============================================================================
// Type Exports
// ============================================================================

export type PolicyScope = "user" | "global";

export type CommunityHiddenContent = typeof communityHiddenContents.$inferSelect;
export type NewCommunityHiddenContent = typeof communityHiddenContents.$inferInsert;
export type HiddenContentTargetType = "post" | "comment";

export type CommunityContentFilter = typeof communityContentFilters.$inferSelect;
export type NewCommunityContentFilter = typeof communityContentFilters.$inferInsert;
export type ContentFilterMatchType = "keyword" | "regex" | "domain";
export type ContentFilterAction = "hide" | "flag" | "review";
export type ContentFilterTargetType = "post" | "comment";

export type CommunityFilterMatch = typeof communityFilterMatches.$inferSelect;
export type NewCommunityFilterMatch = typeof communityFilterMatches.$inferInsert;
