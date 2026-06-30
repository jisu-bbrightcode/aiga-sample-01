/**
 * Community Admin REST Controller
 *
 * 시스템 관리자 전용 커뮤니티 관리 엔드포인트
 */
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { CommunityModerationService, CommunityPostService, CommunityService } from "../service";
import type { BanUserDto, ResolveReportDto } from "../dto";
import {
  AdminCommunityListResponseDto,
  AdminPostListResponseDto,
  AdminReportListResponseDto,
  BanResponseDto,
  CommunityResponseDto,
  DeleteResponseDto,
  ReportResponseDto,
  ReportStatsResponseDto,
  SystemStatsResponseDto,
} from "../dto";
import { ADMIN_POST_VIEWER_STATE, toAdminPostListItem } from "../mappers";

@ApiTags("Community Admin")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/community")
export class CommunityAdminController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly moderationService: CommunityModerationService,
    private readonly postService: CommunityPostService,
  ) {}

  // ==========================================================================
  // 커뮤니티 관리
  // ==========================================================================

  @Get()
  @ApiOperation({ summary: "커뮤니티 목록 (관리자용)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "type", required: false, enum: ["public", "restricted", "private"] })
  @ApiResponse({ status: 200, description: "커뮤니티 목록 반환", type: AdminCommunityListResponseDto })
  async list(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("type") type?: "public" | "restricted" | "private",
  ) {
    return this.communityService.adminFindAll({ page, limit, search, type });
  }

  @Delete(":id")
  @ApiOperation({
    summary: "커뮤니티 보관 (관리자 강제)",
    description:
      "관리자 강제 조치로 커뮤니티를 보관 처리한다. 실제 삭제가 아니며 게시글/댓글/멤버십/신고/감사 이력은 보존된다. 복구 가능.",
  })
  @ApiParam({ name: "id", description: "커뮤니티 ID" })
  @ApiBody({
    required: false,
    schema: {
      type: "object",
      properties: { reason: { type: "string", maxLength: 1000, description: "보관 사유" } },
    },
  })
  @ApiResponse({ status: 200, description: "커뮤니티 보관 성공", type: CommunityResponseDto })
  @ApiResponse({ status: 404, description: "커뮤니티를 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "이미 보관된 커뮤니티" })
  async archive(
    @Param("id", ParseUUIDPipe) communityId: string,
    @CurrentUser() user: User,
    @Body() body?: { reason?: string },
  ) {
    return this.communityService.adminArchive(communityId, user.id, body?.reason);
  }

  @Post(":id/restore")
  @ApiOperation({
    summary: "커뮤니티 복구 (관리자 강제)",
    description: "보관된 커뮤니티를 관리자 권한으로 복구한다.",
  })
  @ApiParam({ name: "id", description: "커뮤니티 ID" })
  @ApiResponse({ status: 200, description: "커뮤니티 복구 성공", type: CommunityResponseDto })
  @ApiResponse({ status: 404, description: "커뮤니티를 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "보관된 커뮤니티가 아님" })
  async restore(@Param("id", ParseUUIDPipe) communityId: string, @CurrentUser() user: User) {
    return this.communityService.adminRestore(communityId, user.id);
  }

  @Get("stats")
  @ApiOperation({ summary: "전체 통계" })
  @ApiResponse({ status: 200, description: "전체 통계 반환", type: SystemStatsResponseDto })
  async stats() {
    return this.communityService.getSystemStats();
  }

  // ==========================================================================
  // 게시글 관리
  // ==========================================================================

  @Get("posts")
  @ApiOperation({
    summary: "게시글 목록 (관리자용)",
    description:
      "공개 피드와 달리 미게시/숨김/제거/삭제 게시글까지 모두 조회되고, 모더레이션 " +
      "내부필드(removalReason, removedBy)를 포함한다. status 로 상태 필터 가능.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "제목/본문 부분일치 검색",
  })
  @ApiQuery({ name: "communityId", required: false, type: String })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "published", "hidden", "removed", "deleted"],
  })
  @ApiResponse({ status: 200, description: "게시글 목록 반환", type: AdminPostListResponseDto })
  async posts(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("communityId") communityId?: string,
    @Query("status") status?: "draft" | "published" | "hidden" | "removed" | "deleted",
  ) {
    const result = await this.postService.adminFindAll({
      page,
      limit,
      search,
      communityId,
      status,
    });

    return {
      items: result.items.map(toAdminPostListItem),
      total: result.total,
      page: result.page,
      limit: result.limit,
      viewer: ADMIN_POST_VIEWER_STATE,
    };
  }

  // ==========================================================================
  // 신고 관리
  // ==========================================================================

  @Get("reports")
  @ApiOperation({ summary: "전체 신고 목록 (cross-community)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["pending", "reviewing", "resolved", "dismissed"],
  })
  @ApiResponse({ status: 200, description: "전체 신고 목록 반환", type: AdminReportListResponseDto })
  async reports(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: "pending" | "reviewing" | "resolved" | "dismissed",
  ) {
    return this.moderationService.getAllReports({ page, limit, status });
  }

  @Get("reports/stats")
  @ApiOperation({ summary: "신고 통계" })
  @ApiResponse({ status: 200, description: "신고 통계 반환", type: ReportStatsResponseDto })
  async reportStats() {
    return this.moderationService.getReportStats();
  }

  @Post("reports/resolve")
  @ApiOperation({ summary: "신고 처리 (관리자)" })
  @ApiResponse({ status: 200, description: "신고 처리 완료", type: ReportResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["reportId", "action"],
      properties: {
        reportId: { type: "string", format: "uuid", description: "신고 ID" },
        action: {
          type: "string",
          enum: ["removed", "banned", "warned", "dismissed"],
          description: "처리 조치",
        },
        reason: { type: "string", maxLength: 1000, description: "처리 사유" },
      },
    },
  })
  async resolveReport(@Body() dto: ResolveReportDto, @CurrentUser() user: User) {
    return this.moderationService.resolveReport(dto, user.id);
  }

  // ==========================================================================
  // 사용자 밴 관리
  // ==========================================================================

  @Post("ban")
  @ApiOperation({ summary: "사용자 밴 (관리자)" })
  @ApiResponse({ status: 200, description: "사용자 밴 성공", type: BanResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "userId", "reason"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        userId: { type: "string", format: "uuid", description: "사용자 ID" },
        reason: { type: "string", maxLength: 1000, description: "밴 사유" },
        note: { type: "string", maxLength: 1000, description: "모더레이터 메모" },
        isPermanent: { type: "boolean", default: true, description: "영구 밴 여부" },
        durationDays: { type: "integer", minimum: 1, description: "밴 기간 (일)" },
      },
    },
  })
  async banUser(@Body() dto: BanUserDto, @CurrentUser() user: User) {
    return this.moderationService.banUser(dto, user.id);
  }

  @Post("unban")
  @ApiOperation({ summary: "밴 해제 (관리자)" })
  @ApiResponse({ status: 200, description: "밴 해제 성공", type: DeleteResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "userId"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        userId: { type: "string", format: "uuid", description: "사용자 ID" },
      },
    },
  })
  async unbanUser(@Body() dto: { communityId: string; userId: string }, @CurrentUser() user: User) {
    await this.moderationService.unbanUser(dto.communityId, dto.userId, user.id);
    return { success: true };
  }
}
