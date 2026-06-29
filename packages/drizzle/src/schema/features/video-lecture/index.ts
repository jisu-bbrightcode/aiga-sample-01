import { baseColumns, user } from "@repo/drizzle/schema";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const videoLectureProviderEnum = pgEnum("video_lecture_provider", ["cloudflare_stream"]);
export const videoLectureStatusEnum = pgEnum("video_lecture_status", [
  "pending",
  "uploading",
  "processing",
  "ready",
  "failed",
  "archived",
  "deleted",
]);
export const videoLectureVisibilityEnum = pgEnum("video_lecture_visibility", [
  "public",
  "preview",
  "protected",
  "private",
]);
export const videoLectureEntitlementEnum = pgEnum("video_lecture_entitlement", [
  "none",
  "login",
  "purchase",
  "subscription",
]);
export const videoLectureEventTypeEnum = pgEnum("video_lecture_event_type", [
  "upload_created",
  "webhook_processing",
  "webhook_ready",
  "webhook_failed",
  "metadata_updated",
  "archive_requested",
  "delete_requested",
  "playback_issued",
  "progress_updated",
]);

export const videoCourses = pgTable(
  "video_courses",
  {
    ...baseColumns(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    visibility: videoLectureVisibilityEnum("visibility").notNull().default("public"),
    entitlementRequirement: videoLectureEntitlementEnum("entitlement_requirement")
      .notNull()
      .default("none"),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [uniqueIndex("video_courses_slug_unique").on(table.slug)],
);

export const videoLessons = pgTable("video_lessons", {
  ...baseColumns(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => videoCourses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  durationSeconds: integer("duration_seconds"),
  thumbnailUrl: text("thumbnail_url"),
  visibility: videoLectureVisibilityEnum("visibility").notNull().default("protected"),
  entitlementRequirement: videoLectureEntitlementEnum("entitlement_requirement")
    .notNull()
    .default("purchase"),
  freePreviewSeconds: integer("free_preview_seconds").notNull().default(0),
});

export const videoAssets = pgTable(
  "video_assets",
  {
    ...baseColumns(),
    lessonId: uuid("lesson_id").references(() => videoLessons.id, { onDelete: "set null" }),
    provider: videoLectureProviderEnum("provider").notNull().default("cloudflare_stream"),
    providerAssetId: text("provider_asset_id").notNull(),
    playbackUid: text("playback_uid"),
    uploadMethod: text("upload_method").notNull(),
    uploadUrl: text("upload_url"),
    uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }),
    status: videoLectureStatusEnum("status").notNull().default("pending"),
    readyToStream: boolean("ready_to_stream").notNull().default(false),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    captionsState: text("captions_state").notNull().default("none"),
    visibility: videoLectureVisibilityEnum("visibility").notNull().default("protected"),
    entitlementRequirement: videoLectureEntitlementEnum("entitlement_requirement")
      .notNull()
      .default("purchase"),
    requireSignedUrls: boolean("require_signed_urls").notNull().default(true),
    uploadedById: text("uploaded_by_id").references(() => user.id, { onDelete: "set null" }),
    processingErrorCode: text("processing_error_code"),
    processingErrorMessage: text("processing_error_message"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown> | null>(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("video_assets_provider_asset_unique").on(table.provider, table.providerAssetId),
  ],
);

export const videoAssetEvents = pgTable(
  "video_asset_events",
  {
    ...baseColumns(),
    assetId: uuid("asset_id").references(() => videoAssets.id, { onDelete: "cascade" }),
    providerAssetId: text("provider_asset_id").notNull(),
    eventType: videoLectureEventTypeEnum("event_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("video_asset_events_idempotency_unique").on(table.idempotencyKey)],
);

export const videoPlaybackSessions = pgTable("video_playback_sessions", {
  ...baseColumns(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => videoAssets.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => videoLessons.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  policy: videoLectureEntitlementEnum("policy").notNull().default("login"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  issuedTokenHash: text("issued_token_hash"),
});

export const videoProgress = pgTable(
  "video_progress",
  {
    ...baseColumns(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => videoLessons.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    totalSeconds: integer("total_seconds").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    lastPositionSeconds: integer("last_position_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    watchedSegments: jsonb("watched_segments").$type<Array<{ start: number; end: number }>>(),
  },
  (table) => [uniqueIndex("video_progress_lesson_user_unique").on(table.lessonId, table.userId)],
);

export const videoEntitlementRules = pgTable("video_entitlement_rules", {
  ...baseColumns(),
  courseId: uuid("course_id").references(() => videoCourses.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => videoLessons.id, { onDelete: "cascade" }),
  requirement: videoLectureEntitlementEnum("requirement").notNull().default("purchase"),
  externalProductId: text("external_product_id"),
  externalPlanId: text("external_plan_id"),
  active: boolean("active").notNull().default(true),
});

export const videoAdminActions = pgTable("video_admin_actions", {
  ...baseColumns(),
  assetId: uuid("asset_id").references(() => videoAssets.id, { onDelete: "set null" }),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  result: text("result").notNull(),
  details: jsonb("details").$type<Record<string, unknown> | null>(),
});

export type VideoCourse = typeof videoCourses.$inferSelect;
export type VideoLesson = typeof videoLessons.$inferSelect;
export type VideoAsset = typeof videoAssets.$inferSelect;
export type VideoAssetEvent = typeof videoAssetEvents.$inferSelect;
export type VideoProgress = typeof videoProgress.$inferSelect;
export type VideoLectureStatus = (typeof videoLectureStatusEnum.enumValues)[number];
export type VideoLectureVisibility = (typeof videoLectureVisibilityEnum.enumValues)[number];
export type VideoLectureEntitlement = (typeof videoLectureEntitlementEnum.enumValues)[number];
