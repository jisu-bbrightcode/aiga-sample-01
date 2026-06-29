import { createHash } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { type DrizzleDB, InjectDrizzle } from "@repo/drizzle";
import {
  videoAdminActions,
  videoAssetEvents,
  videoAssets,
  videoCourses,
  videoLessons,
  videoPlaybackSessions,
  videoProgress,
} from "@repo/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  buildCloudflareIframeUrl,
  CloudflareStreamApiError,
  CloudflareStreamClient,
  computeProgress,
  createDirectCreatorUpload,
  createSignedPlaybackToken,
  createTusCreatorUpload,
  deleteCloudflareStreamVideo,
  loadCloudflareStreamConfig,
  parseCloudflareStreamWebhookPayload,
  shouldPersistProgress,
  updateCloudflareStreamVideoMetadata,
  verifyCloudflareStreamWebhookSignature,
} from "../cloudflare-stream/src";
import type {
  CreateUploadSessionInput,
  ProgressRequestInput,
} from "../controller/video-lecture.dto";
import {
  isPublicLessonMetadataVisible,
  resolveVideoLectureAccess,
  type VideoLectureAccessState,
} from "./access-policy";
import { resolveAdminAssetUpdate } from "./admin-asset-update";
import { deriveWebhookAssetUpdate } from "./asset-status";
import { VideoLectureEntitlementProvider } from "./entitlement-provider";

@Injectable()
export class VideoLectureService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly entitlementProvider: VideoLectureEntitlementProvider,
  ) {}

  async listPublicCourses() {
    const courses = await this.db
      .select()
      .from(videoCourses)
      .where(eq(videoCourses.isPublished, true))
      .orderBy(desc(videoCourses.createdAt))
      .limit(100);

    return Promise.all(
      courses.map(async (course) => ({
        ...course,
        lessons: await this.listPublicLessons(course.id),
      })),
    );
  }

  async getPublicCourse(courseId: string) {
    const [course] = await this.db
      .select()
      .from(videoCourses)
      .where(eq(videoCourses.id, courseId))
      .limit(1);
    if (!course?.isPublished) throw new NotFoundException("VIDEO_COURSE_NOT_FOUND");
    return { ...course, lessons: await this.listPublicLessons(course.id) };
  }

  async getLesson(lessonId: string, viewerId?: string) {
    const lesson = await this.getPublicLessonOrThrow(lessonId);
    const asset = await this.getLessonAsset(lessonId);
    return {
      ...lesson,
      playbackAvailable: Boolean(asset?.readyToStream),
      viewerEntitlement: await this.resolveEntitlementState(lesson, viewerId, false),
      assetStatus: asset?.status ?? "pending",
      providerAssetId: undefined,
    };
  }

  async createCourse(data: {
    title: string;
    slug: string;
    description?: string;
    visibility?: "public" | "preview" | "protected" | "private";
    entitlementRequirement?: "none" | "login" | "purchase" | "subscription";
    isPublished?: boolean;
  }) {
    const [course] = await this.db
      .insert(videoCourses)
      .values({
        title: data.title,
        slug: data.slug,
        description: data.description,
        visibility: data.visibility ?? "public",
        entitlementRequirement: data.entitlementRequirement ?? "none",
        isPublished: data.isPublished ?? false,
        publishedAt: data.isPublished ? new Date() : null,
      })
      .returning();
    return course;
  }

  async createLesson(data: {
    courseId: string;
    title: string;
    slug: string;
    description?: string;
    visibility?: "public" | "preview" | "protected" | "private";
    entitlementRequirement?: "none" | "login" | "purchase" | "subscription";
    freePreviewSeconds?: number;
  }) {
    await this.getCourseOrThrow(data.courseId);
    const [lesson] = await this.db
      .insert(videoLessons)
      .values({
        courseId: data.courseId,
        title: data.title,
        slug: data.slug,
        description: data.description,
        visibility: data.visibility ?? "protected",
        entitlementRequirement: data.entitlementRequirement ?? "purchase",
        freePreviewSeconds: data.freePreviewSeconds ?? 0,
      })
      .returning();
    return lesson;
  }

  async createUploadSession(adminId: string, input: CreateUploadSessionInput) {
    if (input.lessonId) await this.getLessonOrThrow(input.lessonId);

    const client = this.createProviderClient();
    if (input.method === "tus") {
      if (!input.uploadLength)
        throw new BadRequestException("VIDEO_LECTURE_UPLOAD_LENGTH_REQUIRED");
      const session = await this.createTusSession(client, input);
      if (!session.streamMediaId) {
        throw new ServiceUnavailableException("VIDEO_LECTURE_PROVIDER_ASSET_ID_MISSING");
      }
      await this.updateProviderSignedUrlRequirement(
        client,
        session.streamMediaId,
        input.requireSignedUrls,
      );
      const asset = await this.createAssetRecord(adminId, {
        lessonId: input.lessonId,
        providerAssetId: session.streamMediaId,
        uploadMethod: "tus",
        uploadUrl: session.location,
        visibility: input.visibility,
        entitlementRequirement: input.entitlementRequirement,
        requireSignedUrls: input.requireSignedUrls,
      });
      return {
        asset,
        method: "tus" as const,
        uploadUrl: session.location,
        providerAssetId: session.streamMediaId,
        uploadHeaders: { "Tus-Resumable": "1.0.0" },
      };
    }

    const session = await this.createDirectSession(client, input);
    const asset = await this.createAssetRecord(adminId, {
      lessonId: input.lessonId,
      providerAssetId: session.uid,
      uploadMethod: "direct",
      uploadUrl: session.uploadURL,
      visibility: input.visibility,
      entitlementRequirement: input.entitlementRequirement,
      requireSignedUrls: input.requireSignedUrls,
    });
    return {
      asset,
      method: "direct" as const,
      uploadUrl: session.uploadURL,
      providerAssetId: session.uid,
    };
  }

  listAdminAssets(status?: string) {
    const query = this.db.select().from(videoAssets);
    if (status) {
      return query
        .where(eq(videoAssets.status, status as never))
        .orderBy(desc(videoAssets.createdAt))
        .limit(200);
    }
    return query.orderBy(desc(videoAssets.createdAt)).limit(200);
  }

  async getAdminAsset(id: string) {
    const asset = await this.getAssetOrThrow(id);
    const events = await this.db
      .select()
      .from(videoAssetEvents)
      .where(eq(videoAssetEvents.assetId, id))
      .orderBy(desc(videoAssetEvents.receivedAt))
      .limit(100);
    return { asset, events };
  }

  async updateAdminAsset(adminId: string, id: string, data: Record<string, unknown>) {
    const asset = await this.getAssetOrThrow(id);
    const update = resolveAdminAssetUpdate(asset, data);

    if (update.shouldUpdateProviderSignedUrls) {
      await this.updateProviderSignedUrlRequirement(
        this.createProviderClient(),
        asset.providerAssetId,
        update.requireSignedUrls,
      );
    }

    const [updated] = await this.db
      .update(videoAssets)
      .set({
        lessonId: update.lessonId,
        visibility: (data.visibility as never) ?? asset.visibility,
        entitlementRequirement:
          (data.entitlementRequirement as never) ?? asset.entitlementRequirement,
        requireSignedUrls: update.requireSignedUrls,
      })
      .where(eq(videoAssets.id, id))
      .returning();

    if (
      update.lessonMetadataLessonId &&
      (data.title || data.description || data.freePreviewSeconds !== undefined)
    ) {
      await this.db
        .update(videoLessons)
        .set({
          ...(typeof data.title === "string" ? { title: data.title } : {}),
          ...(typeof data.description === "string" ? { description: data.description } : {}),
          ...(typeof data.freePreviewSeconds === "number"
            ? { freePreviewSeconds: data.freePreviewSeconds }
            : {}),
        })
        .where(eq(videoLessons.id, update.lessonMetadataLessonId));
    }

    await this.recordAdminAction({
      actorId: adminId,
      assetId: id,
      action: "metadata_updated",
      result: "ok",
      details: data,
    });
    return updated;
  }

  async archiveAdminAsset(adminId: string, id: string) {
    await this.getAssetOrThrow(id);
    const [asset] = await this.db
      .update(videoAssets)
      .set({ status: "archived", archivedAt: new Date() })
      .where(eq(videoAssets.id, id))
      .returning();
    await this.recordAdminAction({
      actorId: adminId,
      assetId: id,
      action: "archive_requested",
      result: "ok",
      details: null,
    });
    return asset;
  }

  async deleteAdminAsset(adminId: string, id: string) {
    const asset = await this.getAssetOrThrow(id);
    const client = this.createProviderClient();
    await deleteCloudflareStreamVideo(client, asset.providerAssetId);
    const [updated] = await this.db
      .update(videoAssets)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(videoAssets.id, id))
      .returning();
    await this.recordAdminAction({
      actorId: adminId,
      assetId: id,
      action: "delete_requested",
      result: "ok",
      details: null,
    });
    return updated;
  }

  async getProgressSummary(assetId: string) {
    const asset = await this.getAssetOrThrow(assetId);
    if (!asset.lessonId) return { assetId, viewerCount: 0, completionRate: 0, rows: [] };
    const rows = await this.db
      .select()
      .from(videoProgress)
      .where(eq(videoProgress.lessonId, asset.lessonId))
      .limit(500);
    const completed = rows.filter((row) => row.completed).length;
    return {
      assetId,
      viewerCount: rows.length,
      completionRate: rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0,
      rows,
    };
  }

  listEvents() {
    return this.db
      .select()
      .from(videoAssetEvents)
      .orderBy(desc(videoAssetEvents.receivedAt))
      .limit(200);
  }

  async requestPlayback(lessonId: string, viewerId: string | undefined, preview = false) {
    const lesson = await this.getPublicLessonOrThrow(lessonId);
    const asset = await this.getLessonAsset(lessonId);
    if (
      !asset ||
      asset.status === "pending" ||
      asset.status === "uploading" ||
      asset.status === "processing"
    ) {
      return this.playbackState("processing", "VIDEO_LECTURE_PROCESSING");
    }
    if (asset.status === "failed") return this.playbackState("failed", "VIDEO_LECTURE_FAILED");
    if (
      asset.status === "archived" ||
      asset.status === "deleted" ||
      asset.visibility === "private"
    ) {
      return this.playbackState("archived_private", "VIDEO_LECTURE_UNAVAILABLE");
    }
    if (!asset.readyToStream) return this.playbackState("processing", "VIDEO_LECTURE_PROCESSING");

    const entitlement = await this.resolveEntitlementState(lesson, viewerId, preview);
    if (entitlement !== "ready") {
      return this.playbackState(entitlement, `VIDEO_LECTURE_${entitlement.toUpperCase()}`);
    }

    const config = this.loadProviderConfig();
    const token = await this.createPlaybackToken(
      new CloudflareStreamClient(config),
      asset.providerAssetId,
    );
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.db.insert(videoPlaybackSessions).values({
      assetId: asset.id,
      lessonId,
      userId: viewerId,
      policy: lesson.entitlementRequirement,
      tokenExpiresAt: expiresAt,
      issuedTokenHash: createHash("sha256").update(token.token).digest("hex"),
    });
    await this.db.insert(videoAssetEvents).values({
      assetId: asset.id,
      providerAssetId: asset.providerAssetId,
      eventType: "playback_issued",
      idempotencyKey: `playback:${asset.id}:${Date.now()}:${viewerId ?? "anonymous"}`,
      payload: { lessonId, preview },
      actorId: viewerId,
    });

    return {
      state: "ready" as const,
      tokenExpiresAt: expiresAt.toISOString(),
      iframeUrl: config.customerSubdomain
        ? buildCloudflareIframeUrl(config.customerSubdomain, token.token)
        : null,
      hlsUrl: config.customerSubdomain
        ? `https://${config.customerSubdomain}.cloudflarestream.com/${token.token}/manifest/video.m3u8`
        : null,
      messageCode: "VIDEO_LECTURE_READY",
    };
  }

  async updateProgress(lessonId: string, userId: string, input: ProgressRequestInput) {
    await this.getLessonOrThrow(lessonId);
    const [previous] = await this.db
      .select()
      .from(videoProgress)
      .where(and(eq(videoProgress.lessonId, lessonId), eq(videoProgress.userId, userId)))
      .limit(1);

    const computed = computeProgress(input);
    if (
      previous &&
      !shouldPersistProgress(previous.updatedAt, new Date(), {
        force: computed.completed && !previous.completed,
      })
    ) {
      return previous;
    }

    const completedAt = computed.completed ? (previous?.completedAt ?? new Date()) : null;
    const values = {
      lessonId,
      userId,
      ...computed,
      completedAt,
      watchedSegments: input.watchedSegments,
    };

    const [row] = await this.db
      .insert(videoProgress)
      .values(values)
      .onConflictDoUpdate({
        target: [videoProgress.lessonId, videoProgress.userId],
        set: values,
      })
      .returning();
    return row;
  }

  getMyProgress(userId: string) {
    return this.db.select().from(videoProgress).where(eq(videoProgress.userId, userId)).limit(200);
  }

  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined) {
    const config = this.loadProviderConfig();
    if (!signatureHeader) throw new BadRequestException("VIDEO_LECTURE_WEBHOOK_SIGNATURE_MISSING");
    const valid = verifyCloudflareStreamWebhookSignature({
      rawBody,
      signatureHeader,
      secret: config.webhookSecret,
    });
    if (!valid) throw new ForbiddenException("VIDEO_LECTURE_WEBHOOK_SIGNATURE_INVALID");

    const payload = parseCloudflareStreamWebhookPayload(rawBody);
    const assetUpdate = deriveWebhookAssetUpdate(payload);
    const [asset] = await this.db
      .select()
      .from(videoAssets)
      .where(eq(videoAssets.providerAssetId, payload.uid))
      .limit(1);

    const durationSeconds = payload.duration ? Math.round(payload.duration) : null;
    let assetId = asset?.id ?? null;
    if (asset) {
      const [updated] = await this.db
        .update(videoAssets)
        .set({
          status: assetUpdate.status,
          readyToStream: assetUpdate.readyToStream,
          durationSeconds,
          thumbnailUrl: payload.thumbnail ?? null,
          playbackUid: payload.uid,
          processingErrorCode: assetUpdate.errorCode,
          processingErrorMessage: assetUpdate.errorMessage,
          providerPayload: sanitizeProviderPayload(payload),
        })
        .where(eq(videoAssets.id, asset.id))
        .returning();
      assetId = updated?.id ?? asset.id;
      if (asset.lessonId) {
        await this.db
          .update(videoLessons)
          .set({
            durationSeconds,
            thumbnailUrl: payload.thumbnail ?? null,
          })
          .where(eq(videoLessons.id, asset.lessonId));
      }
    }

    const idempotencyKey = `cloudflare-stream:${payload.uid}:${payload.status?.state ?? "unknown"}:${payload.readyToStream}:${payload.status?.pctComplete ?? ""}`;
    await this.db
      .insert(videoAssetEvents)
      .values({
        assetId,
        providerAssetId: payload.uid,
        eventType: assetUpdate.eventType,
        idempotencyKey,
        payload: sanitizeProviderPayload(payload),
      })
      .onConflictDoNothing();

    return { ok: true };
  }

  private async listPublicLessons(courseId: string) {
    const lessons = await this.db
      .select()
      .from(videoLessons)
      .where(eq(videoLessons.courseId, courseId))
      .limit(200);
    return Promise.all(
      lessons.filter(isPublicLessonMetadataVisible).map(async (lesson) => {
        const asset = await this.getLessonAsset(lesson.id);
        return {
          ...lesson,
          playbackAvailable: Boolean(asset?.readyToStream),
          providerAssetId: undefined,
        };
      }),
    );
  }

  private async getCourseOrThrow(courseId: string) {
    const [course] = await this.db
      .select()
      .from(videoCourses)
      .where(eq(videoCourses.id, courseId))
      .limit(1);
    if (!course) throw new NotFoundException("VIDEO_COURSE_NOT_FOUND");
    return course;
  }

  private async getLessonOrThrow(lessonId: string) {
    const [lesson] = await this.db
      .select()
      .from(videoLessons)
      .where(eq(videoLessons.id, lessonId))
      .limit(1);
    if (!lesson) throw new NotFoundException("VIDEO_LESSON_NOT_FOUND");
    return lesson;
  }

  private async getPublicLessonOrThrow(lessonId: string) {
    const lesson = await this.getLessonOrThrow(lessonId);
    const course = await this.getCourseOrThrow(lesson.courseId);
    if (!course.isPublished || !isPublicLessonMetadataVisible(lesson)) {
      throw new NotFoundException("VIDEO_LESSON_NOT_FOUND");
    }
    return lesson;
  }

  private async getAssetOrThrow(assetId: string) {
    const [asset] = await this.db
      .select()
      .from(videoAssets)
      .where(eq(videoAssets.id, assetId))
      .limit(1);
    if (!asset) throw new NotFoundException("VIDEO_ASSET_NOT_FOUND");
    return asset;
  }

  private async getLessonAsset(lessonId: string) {
    const [asset] = await this.db
      .select()
      .from(videoAssets)
      .where(eq(videoAssets.lessonId, lessonId))
      .orderBy(desc(videoAssets.createdAt))
      .limit(1);
    return asset ?? null;
  }

  private async createAssetRecord(
    adminId: string,
    data: {
      lessonId?: string;
      providerAssetId: string;
      uploadMethod: string;
      uploadUrl: string;
      visibility: "public" | "preview" | "protected" | "private";
      entitlementRequirement: "none" | "login" | "purchase" | "subscription";
      requireSignedUrls: boolean;
    },
  ) {
    const [asset] = await this.db
      .insert(videoAssets)
      .values({
        lessonId: data.lessonId,
        providerAssetId: data.providerAssetId,
        uploadMethod: data.uploadMethod,
        uploadUrl: data.uploadUrl,
        status: "uploading",
        visibility: data.visibility,
        entitlementRequirement: data.entitlementRequirement,
        requireSignedUrls: data.requireSignedUrls,
        uploadedById: adminId,
      })
      .returning();

    await this.db.insert(videoAssetEvents).values({
      assetId: asset?.id,
      providerAssetId: data.providerAssetId,
      eventType: "upload_created",
      idempotencyKey: `upload_created:${data.providerAssetId}`,
      payload: { method: data.uploadMethod },
      actorId: adminId,
    });
    return asset;
  }

  private createProviderClient() {
    return new CloudflareStreamClient(this.loadProviderConfig());
  }

  private loadProviderConfig() {
    try {
      return loadCloudflareStreamConfig();
    } catch {
      throw new ServiceUnavailableException("VIDEO_LECTURE_PROVIDER_CONFIG_MISSING");
    }
  }

  private async createDirectSession(
    client: CloudflareStreamClient,
    input: CreateUploadSessionInput,
  ) {
    try {
      return await createDirectCreatorUpload(client, {
        maxDurationSeconds: input.maxDurationSeconds,
        requireSignedURLs: input.requireSignedUrls,
      });
    } catch (error) {
      this.rethrowProviderError(error);
    }
  }

  private async createTusSession(client: CloudflareStreamClient, input: CreateUploadSessionInput) {
    try {
      return await createTusCreatorUpload(client, {
        uploadLength: input.uploadLength ?? 0,
        uploadMetadata: input.uploadMetadata,
      });
    } catch (error) {
      this.rethrowProviderError(error);
    }
  }

  private async createPlaybackToken(client: CloudflareStreamClient, providerAssetId: string) {
    try {
      return await createSignedPlaybackToken(client, providerAssetId);
    } catch (error) {
      this.rethrowProviderError(error);
    }
  }

  private async updateProviderSignedUrlRequirement(
    client: CloudflareStreamClient,
    providerAssetId: string,
    requireSignedURLs: boolean,
  ) {
    try {
      await updateCloudflareStreamVideoMetadata(client, providerAssetId, { requireSignedURLs });
    } catch (error) {
      this.rethrowProviderError(error);
    }
  }

  private rethrowProviderError(error: unknown): never {
    if (error instanceof CloudflareStreamApiError) {
      throw new ServiceUnavailableException("VIDEO_LECTURE_PROVIDER_REQUEST_FAILED");
    }
    throw error;
  }

  private async resolveEntitlementState(
    lesson: {
      id: string;
      courseId: string;
      visibility: string;
      entitlementRequirement: string;
      freePreviewSeconds: number;
    },
    viewerId: string | undefined,
    preview: boolean,
  ): Promise<VideoLectureAccessState> {
    let entitlementGranted = false;
    if (
      viewerId &&
      (lesson.entitlementRequirement === "purchase" ||
        lesson.entitlementRequirement === "subscription")
    ) {
      entitlementGranted = await this.entitlementProvider.hasEntitlement({
        userId: viewerId,
        lessonId: lesson.id,
        courseId: lesson.courseId,
        requirement: lesson.entitlementRequirement,
      });
    }

    return resolveVideoLectureAccess(lesson, {
      viewerId,
      preview,
      entitlementGranted,
    });
  }

  private playbackState(
    state:
      | "not_logged_in"
      | "purchase_required"
      | "subscription_required"
      | "preview_only"
      | "processing"
      | "failed"
      | "archived_private",
    messageCode: string,
  ) {
    return {
      state,
      tokenExpiresAt: null,
      iframeUrl: null,
      hlsUrl: null,
      messageCode,
    };
  }

  private async recordAdminAction(input: {
    actorId: string;
    assetId: string;
    action: string;
    result: string;
    details: Record<string, unknown> | null;
  }) {
    const { actorId, assetId, action, result, details } = input;
    await this.db.insert(videoAdminActions).values({ actorId, assetId, action, result, details });
  }
}

function sanitizeProviderPayload(payload: Record<string, unknown>) {
  const { token: _token, ...safe } = payload;
  return safe;
}
