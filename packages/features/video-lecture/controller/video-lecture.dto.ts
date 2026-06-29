import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const videoVisibilitySchema = z.enum(["public", "preview", "protected", "private"]);
export const videoEntitlementSchema = z.enum(["none", "login", "purchase", "subscription"]);
export const videoStatusSchema = z.enum([
  "pending",
  "uploading",
  "processing",
  "ready",
  "failed",
  "archived",
  "deleted",
]);

export const createVideoCourseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  visibility: videoVisibilitySchema.optional(),
  entitlementRequirement: videoEntitlementSchema.optional(),
  isPublished: z.boolean().optional(),
});

export const createVideoLessonSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  visibility: videoVisibilitySchema.optional(),
  entitlementRequirement: videoEntitlementSchema.optional(),
  freePreviewSeconds: z.number().int().min(0).optional(),
});

export const createUploadSessionSchema = z.object({
  lessonId: z.string().uuid().optional(),
  method: z.enum(["direct", "tus"]).default("direct"),
  maxDurationSeconds: z.number().int().min(1).max(86_400),
  uploadLength: z.number().int().positive().optional(),
  uploadMetadata: z.string().max(4000).optional(),
  requireSignedUrls: z.boolean().default(true),
  visibility: videoVisibilitySchema.default("protected"),
  entitlementRequirement: videoEntitlementSchema.default("purchase"),
});

export const updateVideoLectureSchema = z.object({
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  visibility: videoVisibilitySchema.optional(),
  entitlementRequirement: videoEntitlementSchema.optional(),
  freePreviewSeconds: z.number().int().min(0).optional(),
  requireSignedUrls: z.boolean().optional(),
});

export const playbackRequestSchema = z.object({
  preview: z.boolean().optional(),
});

export const progressRequestSchema = z.object({
  currentTimeSeconds: z.number().nonnegative(),
  totalSeconds: z.number().nonnegative(),
  completed: z.boolean().optional(),
  watchedSegments: z
    .array(z.object({ start: z.number().nonnegative(), end: z.number().nonnegative() }))
    .optional(),
});

export const okResponseSchema = z.object({ ok: z.boolean() });

export const publicCourseResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  visibility: videoVisibilitySchema,
  entitlementRequirement: videoEntitlementSchema,
  isPublished: z.boolean(),
  lessons: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        slug: z.string(),
        description: z.string().nullable(),
        durationSeconds: z.number().nullable(),
        thumbnailUrl: z.string().nullable(),
        visibility: z.enum(["public", "preview", "protected", "private"]),
        entitlementRequirement: z.enum(["none", "login", "purchase", "subscription"]),
        freePreviewSeconds: z.number(),
        playbackAvailable: z.boolean(),
      }),
    )
    .optional(),
});

export const videoAssetResponseSchema = z.object({
  id: z.string(),
  lessonId: z.string().nullable(),
  provider: z.literal("cloudflare_stream"),
  providerAssetId: z.string(),
  playbackUid: z.string().nullable(),
  uploadMethod: z.string(),
  uploadUrl: z.string().nullable(),
  status: videoStatusSchema,
  readyToStream: z.boolean(),
  durationSeconds: z.number().nullable(),
  thumbnailUrl: z.string().nullable(),
  visibility: videoVisibilitySchema,
  entitlementRequirement: videoEntitlementSchema,
  requireSignedUrls: z.boolean(),
  processingErrorCode: z.string().nullable(),
  processingErrorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const uploadSessionResponseSchema = z.object({
  asset: videoAssetResponseSchema,
  method: z.enum(["direct", "tus"]),
  uploadUrl: z.string(),
  providerAssetId: z.string(),
  uploadHeaders: z.record(z.string()).optional(),
});

export const playbackResponseSchema = z.object({
  state: z.enum([
    "not_logged_in",
    "purchase_required",
    "subscription_required",
    "preview_only",
    "processing",
    "failed",
    "archived_private",
    "ready",
  ]),
  tokenExpiresAt: z.string().nullable(),
  iframeUrl: z.string().nullable(),
  hlsUrl: z.string().nullable(),
  messageCode: z.string(),
});

export class CreateVideoCourseDto extends createZodDto(createVideoCourseSchema) {}
export class CreateVideoLessonDto extends createZodDto(createVideoLessonSchema) {}
export class CreateUploadSessionDto extends createZodDto(createUploadSessionSchema) {}
export class UpdateVideoLectureDto extends createZodDto(updateVideoLectureSchema) {}
export class PlaybackRequestDto extends createZodDto(playbackRequestSchema) {}
export class ProgressRequestDto extends createZodDto(progressRequestSchema) {}
export class OkResponseDto extends createZodDto(okResponseSchema) {}
export class PublicCourseResponseDto extends createZodDto(publicCourseResponseSchema) {}
export class VideoAssetResponseDto extends createZodDto(videoAssetResponseSchema) {}
export class UploadSessionResponseDto extends createZodDto(uploadSessionResponseSchema) {}
export class PlaybackResponseDto extends createZodDto(playbackResponseSchema) {}

export type CreateUploadSessionInput = z.infer<typeof createUploadSessionSchema>;
export type ProgressRequestInput = z.infer<typeof progressRequestSchema>;
