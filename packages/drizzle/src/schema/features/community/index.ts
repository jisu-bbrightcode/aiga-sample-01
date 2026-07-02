/**
 * Community Feature Schema
 * Reddit-style communities with posts, comments, voting, and moderation
 */
import { baseColumns, user } from "@repo/drizzle/schema";
import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const communityTypeEnum = pgEnum("community_type", ["public", "restricted", "private"]);

export const postTypeEnum = pgEnum("community_post_type", [
  "text",
  "link",
  "image",
  "video",
  "poll",
]);

export const postStatusEnum = pgEnum("community_post_status", [
  "draft",
  "published",
  "hidden",
  "removed",
  "deleted",
]);

export const contentRatingEnum = pgEnum("community_content_rating", [
  "general",
  "sensitive",
  "nsfw",
  "violence",
]);

export const distinguishedEnum = pgEnum("community_comment_distinguished", ["moderator", "admin"]);

export const voteTargetTypeEnum = pgEnum("community_vote_target_type", ["post", "comment"]);

export const memberRoleEnum = pgEnum("community_member_role", [
  "member",
  "moderator",
  "admin",
  "owner",
]);

/**
 * Moderator appointment lifecycle status.
 * - pending: invited, awaiting the invitee's accept/decline
 * - active: invite accepted, moderator powers effective
 * - declined: invitee rejected the invite
 * - revoked: appointment removed by an authorized user
 */
export const moderatorStatusEnum = pgEnum("community_moderator_status", [
  "pending",
  "active",
  "declined",
  "revoked",
]);

export const ruleAppliesTo = pgEnum("community_rule_applies_to", ["posts", "comments", "both"]);

export const ruleViolationActionEnum = pgEnum("community_rule_violation_action", [
  "flag",
  "remove",
  "warn",
]);

export const flairTypeEnum = pgEnum("community_flair_type", ["post", "user"]);

export const communityReportTargetTypeEnum = pgEnum("community_report_target_type", [
  "post",
  "comment",
  "user",
]);

export const communityReportReasonEnum = pgEnum("community_report_reason", [
  "spam",
  "harassment",
  "hate_speech",
  "misinformation",
  "nsfw",
  "violence",
  "copyright",
  "other",
]);

export const communityReportStatusEnum = pgEnum("community_report_status", [
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const communityReportSeverityEnum = pgEnum("community_report_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const communityReportActionEnum = pgEnum("community_report_action", [
  "removed",
  "banned",
  "warned",
  "dismissed",
]);

export const modActionEnum = pgEnum("community_mod_action", [
  "remove_post",
  "remove_comment",
  "ban_user",
  "unban_user",
  "pin_post",
  "lock_post",
  "add_flair",
  "edit_rules",
  "other",
]);

export const modLogTargetTypeEnum = pgEnum("community_mod_log_target_type", [
  "post",
  "comment",
  "user",
  "community",
]);

export const memberTierEnum = pgEnum("community_member_tier", [
  "newcomer",
  "member",
  "contributor",
  "trusted",
  "leader",
]);

export const sanctionTypeEnum = pgEnum("community_sanction_type", [
  "warning",
  "official_warning",
  "suspension",
  "permanent_ban",
]);

export const sanctionStatusEnum = pgEnum("community_sanction_status", [
  "active",
  "expired",
  "appealed",
  "overturned",
]);

export const appealStatusEnum = pgEnum("community_appeal_status", [
  "pending",
  "under_review",
  "upheld",
  "overturned",
  "modified",
]);

export const hiddenContentTargetTypeEnum = pgEnum("community_hidden_target_type", [
  "post",
  "comment",
]);

// Automated content-filter audit (PB-COMM-FILTER-API-001).
export const filterRuleTypeEnum = pgEnum("community_filter_rule_type", [
  "keyword",
  "link",
  "attachment",
  "moderation",
]);

export const filterActionEnum = pgEnum("community_filter_action", [
  "blocked",
  "hidden_for_review",
]);

export const filterReviewStatusEnum = pgEnum("community_filter_review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const filterTargetTypeEnum = pgEnum("community_filter_target_type", [
  "post",
  "comment",
]);

// ============================================================================
// Types
// ============================================================================

export interface AutomodConfig {
  enableSpamFilter?: boolean;
  enableKeywordFilter?: boolean;
  keywordFilterAction?: "block" | "review";
  minKarmaToPost?: number;
  minAccountAge?: number;

  // Link policy (PB-COMM-FILTER-API-001): URL 정책 필터.
  enableLinkFilter?: boolean;
  linkFilterAction?: "block" | "review";
  // "allow_all" (default): 모든 링크 허용 / "block_all": 모든 링크 차단 /
  // "domain_list": blockedDomains 차단(+ allowedDomains 가 있으면 화이트리스트).
  linkPolicy?: "allow_all" | "block_all" | "domain_list";
  blockedDomains?: string[];
  allowedDomains?: string[];

  // Attachment policy (PB-COMM-FILTER-API-001): 첨부(mediaUrls) 정책 필터.
  enableAttachmentFilter?: boolean;
  attachmentFilterAction?: "block" | "review";
  maxAttachments?: number;
  allowedAttachmentExtensions?: string[];

  // Rules acceptance gate (PB-COMM-RULES-FLAIR-API-001): true 이면 멤버가
  // 커뮤니티 규칙에 동의(communityMemberships.rulesAcceptedAt)하기 전에는
  // 게시글/댓글을 작성할 수 없다.
  requireRulesAcceptance?: boolean;
}

export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface PollData {
  options: Array<{ id: string; text: string; voteCount: number }>;
  multipleChoice: boolean;
  expiresAt?: string;
}

export interface ModeratorPermissions {
  managePosts: boolean;
  manageComments: boolean;
  manageUsers: boolean;
  manageFlairs: boolean;
  manageRules: boolean;
  manageSettings: boolean;
  manageModerators: boolean;
  viewModLog: boolean;
  viewReports: boolean;
}

// ============================================================================
// Tables
// ============================================================================

/**
 * Communities Table
 */
export const communities = pgTable(
  "community_communities",
  {
    ...baseColumns(),

    // Basic info
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    iconUrl: text("icon_url"),
    bannerUrl: text("banner_url"),

    // Ownership
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Settings
    type: communityTypeEnum("type").notNull().default("public"),
    isOfficial: boolean("is_official").notNull().default(false),
    isNsfw: boolean("is_nsfw").notNull().default(false),
    allowImages: boolean("allow_images").notNull().default(true),
    allowVideos: boolean("allow_videos").notNull().default(true),
    allowPolls: boolean("allow_polls").notNull().default(true),
    allowCrosspost: boolean("allow_crosspost").notNull().default(true),

    // Statistics (cached)
    memberCount: integer("member_count").notNull().default(0),
    postCount: integer("post_count").notNull().default(0),
    onlineCount: integer("online_count").notNull().default(0),

    // Moderation
    rules: jsonb("rules").$type<Array<{ title: string; description: string }>>().default([]),
    automodConfig: jsonb("automod_config").$type<AutomodConfig>().default({}),
    bannedWords: text("banned_words").array().default([]),
  },
  (table) => [
    index("idx_communities_slug").on(table.slug),
    index("idx_communities_owner").on(table.ownerId),
    index("idx_communities_type").on(table.type),
    index("idx_communities_member_count").on(table.memberCount),
  ],
);

/**
 * Community Posts Table
 */
export const communityPosts = pgTable(
  "community_posts",
  {
    ...baseColumns(),

    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Basic info
    title: text("title").notNull(),
    content: text("content"),
    type: postTypeEnum("type").notNull().default("text"),

    // Type-specific data
    linkUrl: text("link_url"),
    linkPreview: jsonb("link_preview").$type<LinkPreview>(),
    mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
    pollData: jsonb("poll_data").$type<PollData>().default({ options: [], multipleChoice: false }),

    // Metadata
    flairId: uuid("flair_id"),
    isNsfw: boolean("is_nsfw").notNull().default(false),
    isSpoiler: boolean("is_spoiler").notNull().default(false),
    isOc: boolean("is_oc").notNull().default(false),
    contentRating: contentRatingEnum("content_rating").notNull().default("general"),

    // Status
    status: postStatusEnum("status").notNull().default("published"),
    isPinned: boolean("is_pinned").notNull().default(false),
    isLocked: boolean("is_locked").notNull().default(false),
    removalReason: text("removal_reason"),
    removedBy: text("removed_by").references(() => user.id),

    // Statistics
    viewCount: integer("view_count").notNull().default(0),
    upvoteCount: integer("upvote_count").notNull().default(0),
    downvoteCount: integer("downvote_count").notNull().default(0),
    voteScore: integer("vote_score").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    shareCount: integer("share_count").notNull().default(0),

    // Crosspost
    crosspostParentId: uuid("crosspost_parent_id"),

    // Algorithm
    hotScore: doublePrecision("hot_score").notNull().default(0),

    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_posts_community").on(table.communityId),
    index("idx_posts_author").on(table.authorId),
    index("idx_posts_status").on(table.status),
    index("idx_posts_created").on(table.createdAt),
    index("idx_posts_hot_score").on(table.hotScore),
    index("idx_posts_vote_score").on(table.voteScore),
    index("idx_posts_community_status").on(table.communityId, table.status),
    index("idx_posts_status_created_id").on(table.status, table.createdAt, table.id),
    index("idx_posts_community_status_created_id").on(
      table.communityId,
      table.status,
      table.createdAt,
      table.id,
    ),
    index("idx_posts_community_status_hot_activity_id").on(
      table.communityId,
      table.status,
      table.hotScore,
      table.lastActivityAt,
      table.id,
    ),
    index("idx_posts_community_status_vote_created_id").on(
      table.communityId,
      table.status,
      table.voteScore,
      table.createdAt,
      table.id,
    ),
    index("idx_posts_community_status_activity_comments_id").on(
      table.communityId,
      table.status,
      table.lastActivityAt,
      table.commentCount,
      table.id,
    ),
  ],
);

/**
 * Community Comments Table
 */
export const communityComments = pgTable(
  "community_comments",
  {
    ...baseColumns(),

    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),

    // Content
    content: text("content").notNull(),
    depth: integer("depth").notNull().default(0),

    // Status
    isDeleted: boolean("is_deleted").notNull().default(false),
    isRemoved: boolean("is_removed").notNull().default(false),
    removalReason: text("removal_reason"),
    removedBy: text("removed_by").references(() => user.id),
    isEdited: boolean("is_edited").notNull().default(false),
    editedAt: timestamp("edited_at", { withTimezone: true }),

    // Statistics
    upvoteCount: integer("upvote_count").notNull().default(0),
    downvoteCount: integer("downvote_count").notNull().default(0),
    voteScore: integer("vote_score").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),

    // Moderator features
    isStickied: boolean("is_stickied").notNull().default(false),
    distinguished: distinguishedEnum("distinguished"),

    // Keyword filter
    isHidden: boolean("is_hidden").notNull().default(false),
  },
  (table) => [
    index("idx_community_comments_post").on(table.postId),
    index("idx_community_comments_author").on(table.authorId),
    index("idx_community_comments_parent").on(table.parentId),
    index("idx_community_comments_vote_score").on(table.voteScore),
    index("idx_community_comments_created").on(table.createdAt),
  ],
);

/**
 * Community Votes Table
 */
export const communityVotes = pgTable(
  "community_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: voteTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),

    // 1 = upvote, -1 = downvote
    vote: integer("vote").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("community_votes_unique").on(table.userId, table.targetType, table.targetId),
    index("idx_votes_target").on(table.targetType, table.targetId),
    index("idx_votes_user").on(table.userId),
  ],
);

/**
 * Community Memberships Table
 */
export const communityMemberships = pgTable(
  "community_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Role
    role: memberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),

    // Ban status
    isBanned: boolean("is_banned").notNull().default(false),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedReason: text("banned_reason"),
    bannedBy: text("banned_by").references(() => user.id),
    banExpiresAt: timestamp("ban_expires_at", { withTimezone: true }),

    // Mute status
    isMuted: boolean("is_muted").notNull().default(false),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),

    // User settings
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    flairText: text("flair_text"),
    flairColor: text("flair_color"),

    // Member tier & onboarding
    tier: memberTierEnum("tier").notNull().default("newcomer"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    rulesAcceptedAt: timestamp("rules_accepted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("community_memberships_unique").on(table.communityId, table.userId),
    index("idx_memberships_community").on(table.communityId),
    index("idx_memberships_user").on(table.userId),
    index("idx_memberships_role").on(table.role),
  ],
);

/**
 * Community Moderators Table
 */
export const communityModerators = pgTable(
  "community_moderators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Permissions
    permissions: jsonb("permissions").$type<ModeratorPermissions>().notNull().default({
      managePosts: true,
      manageComments: true,
      manageUsers: true,
      manageFlairs: false,
      manageRules: false,
      manageSettings: false,
      manageModerators: false,
      viewModLog: true,
      viewReports: true,
    }),

    appointedBy: text("appointed_by")
      .notNull()
      .references(() => user.id),
    appointedAt: timestamp("appointed_at", { withTimezone: true }).notNull().defaultNow(),

    // Invite lifecycle
    status: moderatorStatusEnum("status").notNull().default("active"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("community_moderators_unique").on(table.communityId, table.userId),
    index("idx_moderators_community").on(table.communityId),
    index("idx_moderators_user").on(table.userId),
    index("idx_moderators_status").on(table.status),
  ],
);

/**
 * Community Rules Table
 */
export const communityRules = pgTable(
  "community_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description").notNull(),

    // Enforcement
    appliesTo: ruleAppliesTo("applies_to").notNull().default("both"),
    violationAction: ruleViolationActionEnum("violation_action"),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_rules_community").on(table.communityId)],
);

/**
 * Community Flairs Table
 */
export const communityFlairs = pgTable(
  "community_flairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),

    type: flairTypeEnum("type").notNull(),
    text: text("text").notNull(),
    color: text("color").notNull().default("#ffffff"),
    backgroundColor: text("background_color").notNull().default("#0079d3"),

    // Restrictions
    modOnly: boolean("mod_only").notNull().default(false),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_flairs_community").on(table.communityId),
    index("idx_flairs_type").on(table.type),
  ],
);

/**
 * Community Reports Table
 */
export const communityReports = pgTable(
  "community_reports",
  {
    ...baseColumns(),

    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    targetType: communityReportTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),

    reason: communityReportReasonEnum("reason").notNull(),
    ruleViolated: integer("rule_violated"),
    description: text("description"),

    // Resolution
    status: communityReportStatusEnum("status").notNull().default("pending"),
    resolvedBy: text("resolved_by").references(() => user.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    actionTaken: communityReportActionEnum("action_taken"),
    severity: communityReportSeverityEnum("severity").notNull().default("medium"),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_reports_community").on(table.communityId),
    index("idx_reports_status").on(table.status),
    index("idx_reports_target").on(table.targetType, table.targetId),
    index("idx_reports_reporter").on(table.reporterId),
    index("idx_reports_severity").on(table.severity),
    // Duplicate report policy (BBR-614): at most one ACTIVE (pending/reviewing)
    // report per reporter per target. Resolved/dismissed reports free the slot.
    uniqueIndex("uq_community_reports_active_dedup")
      .on(table.reporterId, table.communityId, table.targetType, table.targetId)
      .where(sql`${table.status} IN ('pending', 'reviewing')`),
  ],
);

/**
 * Community Bans Table
 */
export const communityBans = pgTable(
  "community_bans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    bannedBy: text("banned_by")
      .notNull()
      .references(() => user.id),

    reason: text("reason").notNull(),
    note: text("note"),

    // Ban type
    isPermanent: boolean("is_permanent").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("community_bans_unique").on(table.communityId, table.userId),
    index("idx_bans_community").on(table.communityId),
    index("idx_bans_user").on(table.userId),
  ],
);

/**
 * Community Mod Logs Table
 */
export const communityModLogs = pgTable(
  "community_mod_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id")
      .notNull()
      .references(() => user.id),

    action: modActionEnum("action").notNull(),
    targetType: modLogTargetTypeEnum("target_type"),
    targetId: text("target_id"),

    details: jsonb("details").$type<Record<string, unknown>>().default({}),
    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_mod_logs_community").on(table.communityId),
    index("idx_mod_logs_moderator").on(table.moderatorId),
    index("idx_mod_logs_action").on(table.action),
    index("idx_mod_logs_created").on(table.createdAt),
  ],
);

/**
 * Community Saved Posts Table
 */
export const communitySavedPosts = pgTable(
  "community_saved_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("community_saved_posts_unique").on(table.userId, table.postId),
    index("idx_saved_posts_user").on(table.userId),
    index("idx_saved_posts_post").on(table.postId),
  ],
);

/**
 * User Karma Table
 */
export const userKarma = pgTable("community_user_karma", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  postKarma: integer("post_karma").notNull().default(0),
  commentKarma: integer("comment_karma").notNull().default(0),
  totalKarma: integer("total_karma").notNull().default(0),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Community Sanctions Table — 단계적 제재
 */
export const communitySanctions = pgTable(
  "community_sanctions",
  {
    ...baseColumns(),

    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: sanctionTypeEnum("type").notNull(),
    status: sanctionStatusEnum("status").notNull().default("active"),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // 관련 신고
    reportId: uuid("report_id"),
  },
  (table) => [
    index("idx_sanctions_community_user").on(table.communityId, table.userId),
    index("idx_sanctions_status").on(table.status),
    index("idx_sanctions_expires").on(table.expiresAt),
  ],
);

/**
 * Community Appeals Table — 이의신청
 */
export const communityAppeals = pgTable(
  "community_appeals",
  {
    ...baseColumns(),

    sanctionId: uuid("sanction_id")
      .notNull()
      .references(() => communitySanctions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    reason: text("reason").notNull(),
    status: appealStatusEnum("status").notNull().default("pending"),

    // 리뷰어 (원래 제재자와 다른 모더레이터)
    reviewerId: text("reviewer_id").references(() => user.id),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_appeals_sanction").on(table.sanctionId),
    index("idx_appeals_status").on(table.status),
    index("idx_appeals_reviewer").on(table.reviewerId),
  ],
);

/**
 * User Blocks Table — 양방향 유저 차단
 */
export const communityUserBlocks = pgTable(
  "community_user_blocks",
  {
    ...baseColumns(),

    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("community_user_blocks_unique").on(table.blockerId, table.blockedId),
    index("idx_user_blocks_blocker").on(table.blockerId),
    index("idx_user_blocks_blocked").on(table.blockedId),
  ],
);

/**
 * Community Hidden Content Table
 *
 * 사용자별 콘텐츠 숨김(per-viewer mute). 관리자 전역 숨김(post.status='hidden',
 * comment.is_hidden)과 달리, 이 테이블은 "이 뷰어에게만" 특정 게시글/댓글을
 * 노출 제외한다. (user_id, target_type, target_id) 유니크로 멱등 보장.
 */
export const communityHiddenContent = pgTable(
  "community_hidden_content",
  {
    ...baseColumns(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: hiddenContentTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason"),
  },
  (table) => [
    uniqueIndex("community_hidden_content_unique").on(
      table.userId,
      table.targetType,
      table.targetId,
    ),
    index("idx_hidden_content_user").on(table.userId),
    index("idx_hidden_content_target").on(table.targetType, table.targetId),
  ],
);

/**
 * Community Filter Logs Table (PB-COMM-FILTER-API-001)
 *
 * Append-only audit of automated content-filter actions (금칙어/URL/첨부/moderation).
 * Each automated `blocked`/`hidden_for_review` decision is recorded here so that
 * filter actions AND the subsequent moderator review result are auditable (AC#2).
 * `hidden_for_review` rows with `reviewStatus = 'pending'` form the manual review
 * queue that connects auto-hidden candidates to moderators (AC#1).
 */
export const communityFilterLogs = pgTable(
  "community_filter_logs",
  {
    ...baseColumns(),

    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),

    // Content author whose submission triggered the filter.
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Target content. null when `action = 'blocked'` (content was never persisted).
    targetType: filterTargetTypeEnum("target_type"),
    targetId: uuid("target_id"),

    ruleType: filterRuleTypeEnum("rule_type").notNull(),
    action: filterActionEnum("action").notNull(),
    matchedTerms: text("matched_terms").array().default([]),
    reason: text("reason"),

    // Manual review lifecycle. blocked rows are terminal (rejected); hidden rows
    // start `pending` and transition to approved/rejected by a moderator.
    reviewStatus: filterReviewStatusEnum("review_status").notNull().default("pending"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
  },
  (table) => [
    index("idx_filter_logs_community").on(table.communityId),
    index("idx_filter_logs_community_review").on(table.communityId, table.reviewStatus),
    index("idx_filter_logs_queue").on(table.communityId, table.action, table.reviewStatus),
    index("idx_filter_logs_target").on(table.targetType, table.targetId),
    index("idx_filter_logs_author").on(table.authorId),
    index("idx_filter_logs_created").on(table.createdAt),
  ],
);

// ============================================================================
// Type Exports
// ============================================================================

export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;
export type CommunityType = "public" | "restricted" | "private";

export type CommunityPost = typeof communityPosts.$inferSelect;
export type NewCommunityPost = typeof communityPosts.$inferInsert;
export type PostType = "text" | "link" | "image" | "video" | "poll";
export type PostStatus = "draft" | "published" | "hidden" | "removed" | "deleted";

export type CommunityComment = typeof communityComments.$inferSelect;
export type NewCommunityComment = typeof communityComments.$inferInsert;
export type Distinguished = "moderator" | "admin" | null;

export type CommunityVote = typeof communityVotes.$inferSelect;
export type NewCommunityVote = typeof communityVotes.$inferInsert;
export type VoteTargetType = "post" | "comment";

export type CommunityMembership = typeof communityMemberships.$inferSelect;
export type NewCommunityMembership = typeof communityMemberships.$inferInsert;
export type MemberRole = "member" | "moderator" | "admin" | "owner";

export type CommunityModerator = typeof communityModerators.$inferSelect;
export type NewCommunityModerator = typeof communityModerators.$inferInsert;

export type CommunityRule = typeof communityRules.$inferSelect;
export type NewCommunityRule = typeof communityRules.$inferInsert;
export type RuleAppliesTo = "posts" | "comments" | "both";
export type RuleViolationAction = "flag" | "remove" | "warn" | null;

export type CommunityFlair = typeof communityFlairs.$inferSelect;
export type NewCommunityFlair = typeof communityFlairs.$inferInsert;
export type FlairType = "post" | "user";

export type CommunityReport = typeof communityReports.$inferSelect;
export type NewCommunityReport = typeof communityReports.$inferInsert;
export type CommunityReportTargetType = "post" | "comment" | "user";
export type CommunityReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "misinformation"
  | "nsfw"
  | "violence"
  | "copyright"
  | "other";
export type CommunityReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";
export type CommunityReportAction = "removed" | "banned" | "warned" | "dismissed" | null;

export type CommunityBan = typeof communityBans.$inferSelect;
export type NewCommunityBan = typeof communityBans.$inferInsert;

export type CommunityModLog = typeof communityModLogs.$inferSelect;
export type NewCommunityModLog = typeof communityModLogs.$inferInsert;
export type ModAction =
  | "remove_post"
  | "remove_comment"
  | "ban_user"
  | "unban_user"
  | "pin_post"
  | "lock_post"
  | "add_flair"
  | "edit_rules"
  | "other";
export type ModLogTargetType = "post" | "comment" | "user" | "community" | null;

export type CommunitySavedPost = typeof communitySavedPosts.$inferSelect;
export type NewCommunitySavedPost = typeof communitySavedPosts.$inferInsert;

export type UserKarma = typeof userKarma.$inferSelect;
export type NewUserKarma = typeof userKarma.$inferInsert;

export type CommunityUserBlock = typeof communityUserBlocks.$inferSelect;
export type NewCommunityUserBlock = typeof communityUserBlocks.$inferInsert;

export type CommunityHiddenContent = typeof communityHiddenContent.$inferSelect;
export type NewCommunityHiddenContent = typeof communityHiddenContent.$inferInsert;
export type HiddenContentTargetType = "post" | "comment";


export type CommunitySanction = typeof communitySanctions.$inferSelect;
export type NewCommunitySanction = typeof communitySanctions.$inferInsert;
export type SanctionType = "warning" | "official_warning" | "suspension" | "permanent_ban";
export type SanctionStatus = "active" | "expired" | "appealed" | "overturned";

export type CommunityAppeal = typeof communityAppeals.$inferSelect;
export type NewCommunityAppeal = typeof communityAppeals.$inferInsert;
export type AppealStatus = "pending" | "under_review" | "upheld" | "overturned" | "modified";

export type CommunityFilterLog = typeof communityFilterLogs.$inferSelect;
export type NewCommunityFilterLog = typeof communityFilterLogs.$inferInsert;
export type FilterRuleType = "keyword" | "link" | "attachment" | "moderation";
export type FilterAction = "blocked" | "hidden_for_review";
export type FilterReviewStatus = "pending" | "approved" | "rejected";
export type FilterTargetType = "post" | "comment";
