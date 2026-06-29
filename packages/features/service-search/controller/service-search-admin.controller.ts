import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { AdminSearchQueryDto, AdminSearchResultDto } from "../dto";
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
}
