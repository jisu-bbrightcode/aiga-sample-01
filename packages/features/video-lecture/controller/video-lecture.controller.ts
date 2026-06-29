import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import type { FastifyRequest } from "fastify";
import { VideoLectureService } from "../service";
import {
  CreateUploadSessionDto,
  CreateVideoCourseDto,
  CreateVideoLessonDto,
  OkResponseDto,
  PlaybackRequestDto,
  PlaybackResponseDto,
  ProgressRequestDto,
  PublicCourseResponseDto,
  UpdateVideoLectureDto,
  UploadSessionResponseDto,
  VideoAssetResponseDto,
} from "./video-lecture.dto";

@ApiTags("Video Lecture")
@Controller()
export class VideoLectureController {
  constructor(private readonly videoLectureService: VideoLectureService) {}

  @Get("video-courses")
  @ApiOperation({ summary: "List public video courses" })
  @ApiResponse({ status: 200, type: PublicCourseResponseDto, isArray: true })
  listCourses() {
    return this.videoLectureService.listPublicCourses();
  }

  @Get("video-courses/:courseId")
  @ApiOperation({ summary: "Read public video course metadata and curriculum" })
  @ApiResponse({ status: 200, type: PublicCourseResponseDto })
  getCourse(@Param("courseId", ParseUUIDPipe) courseId: string) {
    return this.videoLectureService.getPublicCourse(courseId);
  }

  @Get("video-lessons/:lessonId")
  @ApiOperation({ summary: "Read public video lesson metadata" })
  getLesson(@Param("lessonId", ParseUUIDPipe) lessonId: string, @CurrentUser() user?: User) {
    return this.videoLectureService.getLesson(lessonId, user?.id);
  }

  @Post("video-lessons/:lessonId/playback")
  @ApiOperation({
    summary: "Request signed video playback after visibility and entitlement checks",
  })
  @ApiResponse({ status: 201, type: PlaybackResponseDto })
  playback(
    @Param("lessonId", ParseUUIDPipe) lessonId: string,
    @Body() dto: PlaybackRequestDto,
    @CurrentUser() user?: User,
  ) {
    return this.videoLectureService.requestPlayback(lessonId, user?.id, dto.preview);
  }

  @Post("video-lessons/:lessonId/progress")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Persist throttled video lesson progress" })
  updateProgress(
    @CurrentUser() user: User,
    @Param("lessonId", ParseUUIDPipe) lessonId: string,
    @Body() dto: ProgressRequestDto,
  ) {
    return this.videoLectureService.updateProgress(lessonId, user.id, dto);
  }

  @Get("me/video-progress")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List current user's video progress" })
  myProgress(@CurrentUser() user: User) {
    return this.videoLectureService.getMyProgress(user.id);
  }
}

@ApiTags("Admin Video Lecture")
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@ApiBearerAuth()
@Controller("admin/video-lectures")
export class VideoLectureAdminController {
  constructor(private readonly videoLectureService: VideoLectureService) {}

  @Post("courses")
  @ApiOperation({ summary: "Create a video course shell" })
  createCourse(@Body() dto: CreateVideoCourseDto) {
    return this.videoLectureService.createCourse(dto);
  }

  @Post("lessons")
  @ApiOperation({ summary: "Create a video lesson shell" })
  createLesson(@Body() dto: CreateVideoLessonDto) {
    return this.videoLectureService.createLesson(dto);
  }

  @Post("uploads")
  @ApiOperation({ summary: "Create a Cloudflare Stream direct or tus upload session" })
  @ApiResponse({ status: 201, type: UploadSessionResponseDto })
  createUpload(@CurrentUser() user: User, @Body() dto: CreateUploadSessionDto) {
    return this.videoLectureService.createUploadSession(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List video lecture assets" })
  @ApiResponse({ status: 200, type: VideoAssetResponseDto, isArray: true })
  list(@Query("status") status?: string) {
    return this.videoLectureService.listAdminAssets(status);
  }

  @Get("events")
  @ApiOperation({ summary: "List Cloudflare Stream webhook and audit events" })
  events() {
    return this.videoLectureService.listEvents();
  }

  @Get(":id")
  @ApiOperation({ summary: "Read video lecture asset detail" })
  detail(@Param("id", ParseUUIDPipe) id: string) {
    return this.videoLectureService.getAdminAsset(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update video lecture metadata and lesson mapping" })
  update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateVideoLectureDto,
  ) {
    return this.videoLectureService.updateAdminAsset(user.id, id, { ...dto });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Cloudflare Stream video and mark asset deleted" })
  delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.videoLectureService.deleteAdminAsset(user.id, id);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Archive a video lecture asset locally" })
  archive(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.videoLectureService.archiveAdminAsset(user.id, id);
  }

  @Post(":id/retry")
  @ApiOperation({ summary: "Record retry intent for failed processing replacement flow" })
  @ApiResponse({ status: 201, type: OkResponseDto })
  async retry(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    await this.videoLectureService.updateAdminAsset(user.id, id, {});
    return { ok: true };
  }

  @Get(":id/progress")
  @ApiOperation({ summary: "Read progress summary for a video lecture asset" })
  progress(@Param("id", ParseUUIDPipe) id: string) {
    return this.videoLectureService.getProgressSummary(id);
  }
}

@ApiTags("Video Lecture Webhook")
@Controller("webhooks/cloudflare-stream")
export class CloudflareStreamWebhookController {
  constructor(private readonly videoLectureService: VideoLectureService) {}

  @Post()
  @ApiOperation({ summary: "Receive Cloudflare Stream processing webhook" })
  @ApiResponse({ status: 201, type: OkResponseDto })
  handle(
    @Req() request: FastifyRequest & { rawBody?: string },
    @Headers("webhook-signature") signature?: string,
  ) {
    const rawBody = request.rawBody
      ? Buffer.from(request.rawBody, "utf8")
      : Buffer.from(JSON.stringify(request.body ?? {}), "utf8");
    return this.videoLectureService.handleWebhook(rawBody, signature);
  }
}
