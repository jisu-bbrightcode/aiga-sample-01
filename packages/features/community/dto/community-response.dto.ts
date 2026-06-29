/**
 * Community Feature — Response DTOs
 *
 * Wire shapes for all non-admin community endpoints.
 * Timestamp columns are Date in Drizzle but Fastify JSON-serialises them to
 * ISO strings, so every date field uses z.string() here.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

// ============================================================================
// Shared sub-schemas
// ============================================================================

const automodConfigSchema = z
  .object({
    enableSpamFilter: z.boolean().optional(),
    enableKeywordFilter: z.boolean().optional(),
    keywordFilterAction: z.enum(["block", "review"]).optional(),
    minKarmaToPost: z.number().optional(),
    minAccountAge: z.number().optional(),
  })
  .nullable()
  .optional();

const ruleItemSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const moderatorPermissionsSchema = z.object({
  managePosts: z.boolean(),
  manageComments: z.boolean(),
  manageUsers: z.boolean(),
  manageFlairs: z.boolean(),
  manageRules: z.boolean(),
  manageSettings: z.boolean(),
  manageModerators: z.boolean(),
  viewModLog: z.boolean(),
  viewReports: z.boolean(),
});

const pollDataSchema = z
  .object({
    options: z.array(
      z.object({ id: z.string(), text: z.string(), voteCount: z.number() }),
    ),
    multipleChoice: z.boolean(),
    expiresAt: z.string().optional(),
  })
  .nullable()
  .optional();

const linkPreviewSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    siteName: z.string().optional(),
  })
  .nullable()
  .optional();

// ============================================================================
// Community
// ============================================================================

export const communityResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  iconUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  ownerId: z.string(),
  type: z.enum(["public", "restricted", "private"]),
  isOfficial: z.boolean(),
  isNsfw: z.boolean(),
  allowImages: z.boolean(),
  allowVideos: z.boolean(),
  allowPolls: z.boolean(),
  allowCrosspost: z.boolean(),
  memberCount: z.number(),
  postCount: z.number(),
  onlineCount: z.number(),
  rules: z.array(ruleItemSchema).nullable(),
  automodConfig: automodConfigSchema,
  bannedWords: z.array(z.string()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class CommunityResponseDto extends createZodDto(communityResponseSchema) {}

export const communityListResponseSchema = z.object({
  items: z.array(communityResponseSchema),
  nextCursor: z.string().nullable(),
});

export class CommunityListResponseDto extends createZodDto(communityListResponseSchema) {}

// ============================================================================
// Post
// ============================================================================

/**
 * Base post row shape — matches bare Drizzle select / insert returning rows.
 * authorName/authorAvatar are absent on create/update/pin/lock/remove/crosspost
 * (those service methods return the raw row without author join), so they are
 * optional here.  Enrich routes (findById, findAll) always populate them.
 */
export const postResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable().optional(),
  authorAvatar: z.string().nullable().optional(),
  title: z.string(),
  content: z.string().nullable(),
  type: z.enum(["text", "link", "image", "video", "poll"]),
  linkUrl: z.string().nullable(),
  linkPreview: linkPreviewSchema,
  mediaUrls: z.array(z.string()).nullable(),
  pollData: pollDataSchema,
  flairId: z.string().nullable(),
  isNsfw: z.boolean(),
  isSpoiler: z.boolean(),
  isOc: z.boolean(),
  contentRating: z.enum(["general", "sensitive", "nsfw", "violence"]),
  status: z.enum(["draft", "published", "hidden", "removed", "deleted"]),
  isPinned: z.boolean(),
  isLocked: z.boolean(),
  removalReason: z.string().nullable(),
  removedBy: z.string().nullable(),
  viewCount: z.number(),
  upvoteCount: z.number(),
  downvoteCount: z.number(),
  voteScore: z.number(),
  commentCount: z.number(),
  shareCount: z.number(),
  crosspostParentId: z.string().nullable(),
  hotScore: z.number(),
  lastActivityAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class PostResponseDto extends createZodDto(postResponseSchema) {}

export const postListResponseSchema = z.object({
  items: z.array(postResponseSchema),
  nextCursor: z.string().nullable(),
});

export class PostListResponseDto extends createZodDto(postListResponseSchema) {}

// ============================================================================
// Comment
// ============================================================================

/**
 * Base comment row shape — matches bare Drizzle select / insert returning rows.
 * authorName/authorAvatar absent on create/update/remove/sticky/distinguish
 * (those service methods return the raw row without author join), so they are
 * optional here.  findByPost enriches with author data.
 *
 * Class name is CommunityCommentResponseDto (not CommentResponseDto) to avoid
 * Swagger schema-name collision with packages/features/comment/dto
 * CommentResponseDto (different shape: targetType/status/mentions vs
 * postId/depth/voteScore).  Both CommentModule and CommunityModule are
 * registered in app.module.ts — @nestjs/swagger keys schemas by class name and
 * last-write-wins, so the rename is required.
 */
export const commentResponseSchema = z.object({
  id: z.string(),
  postId: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable().optional(),
  authorAvatar: z.string().nullable().optional(),
  parentId: z.string().nullable(),
  content: z.string(),
  depth: z.number(),
  isDeleted: z.boolean(),
  isRemoved: z.boolean(),
  removalReason: z.string().nullable(),
  removedBy: z.string().nullable(),
  isEdited: z.boolean(),
  editedAt: z.string().nullable(),
  upvoteCount: z.number(),
  downvoteCount: z.number(),
  voteScore: z.number(),
  replyCount: z.number(),
  isStickied: z.boolean(),
  distinguished: z.enum(["moderator", "admin"]).nullable(),
  isHidden: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class CommunityCommentResponseDto extends createZodDto(commentResponseSchema) {}

export const commentListResponseSchema = z.object({
  items: z.array(commentResponseSchema),
  nextCursor: z.string().nullable(),
});

export class CommunityCommentListResponseDto extends createZodDto(commentListResponseSchema) {}

// ============================================================================
// Vote
// ============================================================================

export const voteResultResponseSchema = z.object({
  voteScore: z.number(),
  upvoteCount: z.number(),
  downvoteCount: z.number(),
  userVote: z.number().nullable(),
});

export class VoteResultResponseDto extends createZodDto(voteResultResponseSchema) {}

// ============================================================================
// Karma
// ============================================================================

export const karmaResponseSchema = z.object({
  userId: z.string(),
  postKarma: z.number(),
  commentKarma: z.number(),
  totalKarma: z.number(),
});

export class KarmaResponseDto extends createZodDto(karmaResponseSchema) {}

// ============================================================================
// Membership
// ============================================================================

export const membershipResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  role: z.enum(["member", "moderator", "admin", "owner"]),
  joinedAt: z.string(),
  isBanned: z.boolean(),
  bannedAt: z.string().nullable(),
  bannedReason: z.string().nullable(),
  bannedBy: z.string().nullable(),
  banExpiresAt: z.string().nullable(),
  isMuted: z.boolean(),
  mutedUntil: z.string().nullable(),
  notificationsEnabled: z.boolean(),
  flairText: z.string().nullable(),
  flairColor: z.string().nullable(),
  tier: z.enum(["newcomer", "member", "contributor", "trusted", "leader"]),
  onboardingCompletedAt: z.string().nullable(),
  rulesAcceptedAt: z.string().nullable(),
});

export class MembershipResponseDto extends createZodDto(membershipResponseSchema) {}

export const memberListResponseSchema = z.object({
  items: z.array(membershipResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export class MemberListResponseDto extends createZodDto(memberListResponseSchema) {}

// ============================================================================
// Moderator
// ============================================================================

export const moderatorResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  permissions: moderatorPermissionsSchema,
  appointedBy: z.string(),
  appointedAt: z.string(),
});

export class ModeratorResponseDto extends createZodDto(moderatorResponseSchema) {}

// ============================================================================
// Feed
// ============================================================================

/**
 * feedPopular returns a bare CommunityPost[] array (no pagination wrapper,
 * no author join, no communitySlug).  Wire it as postResponseSchema[] so the
 * generated client types match runtime.
 *
 * feedAll/feedHome go through getFeed() which returns a FeedResponseDto
 * pagination object with items that include communitySlug but also lack author
 * fields — postResponseSchema (author optional) covers them correctly.
 */
const feedPostSchema = postResponseSchema.extend({
  communitySlug: z.string().nullable().optional(),
});

export const feedResponseSchema = z.object({
  items: z.array(feedPostSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export class FeedResponseDto extends createZodDto(feedResponseSchema) {}

// ============================================================================
// Report
// ============================================================================

export const reportResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  reporterId: z.string(),
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.string(),
  reason: z.enum([
    "spam",
    "harassment",
    "hate_speech",
    "misinformation",
    "nsfw",
    "violence",
    "copyright",
    "other",
  ]),
  ruleViolated: z.number().nullable(),
  description: z.string().nullable(),
  status: z.enum(["pending", "reviewing", "resolved", "dismissed"]),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolution: z.string().nullable(),
  actionTaken: z.enum(["removed", "banned", "warned", "dismissed"]).nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  firstResponseAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class ReportResponseDto extends createZodDto(reportResponseSchema) {}

export const modQueueResponseSchema = z.object({
  reports: z.array(reportResponseSchema),
  // spam/removed are hardcoded to [] in CommunityModerationService.getModQueue
  // (community-moderation.service.ts:224-228). Typed as never[] literal until
  // the service actually populates them — avoids z.unknown per guide rules.
  spam: z.array(z.never()),
  removed: z.array(z.never()),
});

export class ModQueueResponseDto extends createZodDto(modQueueResponseSchema) {}

// ============================================================================
// Ban
// ============================================================================

export const banResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  userId: z.string(),
  bannedBy: z.string(),
  reason: z.string(),
  note: z.string().nullable(),
  isPermanent: z.boolean(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

export class BanResponseDto extends createZodDto(banResponseSchema) {}

// ============================================================================
// Rule
// ============================================================================

export const ruleResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  title: z.string(),
  description: z.string(),
  appliesTo: z.enum(["posts", "comments", "both"]),
  violationAction: z.enum(["flag", "remove", "warn"]).nullable(),
  displayOrder: z.number(),
  createdAt: z.string(),
});

export class RuleResponseDto extends createZodDto(ruleResponseSchema) {}

// ============================================================================
// Flair
// ============================================================================

export const flairResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  type: z.enum(["post", "user"]),
  text: z.string(),
  color: z.string(),
  backgroundColor: z.string(),
  modOnly: z.boolean(),
  displayOrder: z.number(),
  createdAt: z.string(),
});

export class FlairResponseDto extends createZodDto(flairResponseSchema) {}

// ============================================================================
// Mod Log
// ============================================================================

export const modLogResponseSchema = z.object({
  id: z.string(),
  communityId: z.string(),
  moderatorId: z.string(),
  action: z.enum([
    "remove_post",
    "remove_comment",
    "ban_user",
    "unban_user",
    "pin_post",
    "lock_post",
    "add_flair",
    "edit_rules",
    "other",
  ]),
  targetType: z
    .enum(["post", "comment", "user", "community"])
    .nullable(),
  targetId: z.string().nullable(),
  details: z.record(z.unknown()).nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});

export class ModLogResponseDto extends createZodDto(modLogResponseSchema) {}

export const modLogListResponseSchema = z.object({
  items: z.array(modLogResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

export class ModLogListResponseDto extends createZodDto(modLogListResponseSchema) {}

// ============================================================================
// Delete / Success
// ============================================================================

export const deleteResponseSchema = z.object({ success: z.boolean() });

export class DeleteResponseDto extends createZodDto(deleteResponseSchema) {}

// ============================================================================
// Admin — Community List
// ============================================================================

/**
 * adminFindAll returns { data, total, page, limit, totalPages }
 * where data = bare community rows (full schema).
 */
export const adminCommunityListResponseSchema = z.object({
  data: z.array(communityResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export class AdminCommunityListResponseDto extends createZodDto(adminCommunityListResponseSchema) {}

// ============================================================================
// Admin — System Stats
// ============================================================================

export const systemStatsResponseSchema = z.object({
  totalCommunities: z.number(),
  totalMembers: z.number(),
  totalPosts: z.number(),
  totalComments: z.number(),
});

export class SystemStatsResponseDto extends createZodDto(systemStatsResponseSchema) {}

// ============================================================================
// Admin — Reports List
// ============================================================================

/**
 * getAllReports returns { data, total, page, limit, totalPages }
 * where data = bare report rows (full reportResponseSchema).
 */
export const adminReportListResponseSchema = z.object({
  data: z.array(reportResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export class AdminReportListResponseDto extends createZodDto(adminReportListResponseSchema) {}

// ============================================================================
// Admin — Report Stats
// ============================================================================

export const reportStatsResponseSchema = z.object({
  pending: z.number(),
  reviewing: z.number(),
  resolved: z.number(),
  dismissed: z.number(),
});

export class ReportStatsResponseDto extends createZodDto(reportStatsResponseSchema) {}
