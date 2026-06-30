import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { AdminSearchDetailDto, AdminSearchQueryDto, AdminSearchResultDto } from "../dto";
import { ADMIN_VIEWER_STATE } from "../mappers";
import { ServiceSearchService } from "../service";

/**
 * 통합검색 admin API (FR-003 / BBR-531).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role). The admin view exposes the index/ranking internals
 * (body, keywords, weight, isPublished, sourceUpdatedAt) and accepts a
 * `published` filter so an editor can audit unpublished documents — neither is
 * reachable from the public controller. Admin searches are never logged.
 */
@ApiTags("Service Search (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("service/search/admin")
export class ServiceSearchAdminController {
  constructor(private readonly service: ServiceSearchService) {}

  @Get()
  @ApiOperation({
    summary: "통합 검색 (관리자) — 인덱스 내부필드 + 미게시 문서 포함",
    description: "published=true/false 로 게시상태 필터. 생략 시 게시+미게시 모두 반환.",
  })
  @ApiResponse({ status: 200, type: AdminSearchResultDto })
  search(@Query() query: AdminSearchQueryDto) {
    return this.service.adminSearch(query);
  }

  @Get(":entityType/:entityId")
  @ApiOperation({
    summary: "통합 상세 조회 (관리자) — 인덱스 내부필드 + 미게시 포함",
    description:
      "(entityType, entityId)로 검색 문서 1건을 조회한다. 공개 surface와 달리 게시상태와 무관하게 " +
      "조회되고 인덱스 내부필드까지 반환한다. 미인증=401, 비관리자=403, 없는 문서=404.",
  })
  @ApiParam({ name: "entityType", enum: ["doctor", "hospital", "specialty", "region"] })
  @ApiParam({ name: "entityId", format: "uuid" })
  @ApiResponse({ status: 200, type: AdminSearchDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "없는 검색 문서" })
  async detail(
    @Param("entityType") entityType: string,
    @Param("entityId", ParseUUIDPipe) entityId: string,
  ): Promise<AdminSearchDetailDto> {
    const hit = await this.service.getAdminDetail(entityType, entityId);
    return { ...hit, viewer: ADMIN_VIEWER_STATE };
  }
}
