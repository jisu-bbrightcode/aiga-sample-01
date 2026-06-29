import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  PopularQueryDto,
  PopularTermDto,
  RecentQueryDto,
  RecentSearchDto,
  SearchQueryDto,
  SearchResultDto,
} from "../dto";
import { OptionalUser } from "../optional-user.decorator";
import { ServiceSearchService } from "../service";

/**
 * 통합검색 public API (FR-003 / BBR-531).
 *
 * `GET /service/search` is the unified list/search over the published catalog —
 * browsable without login. It returns ONLY public fields and always scopes to
 * `is_published = true`; index internals and unpublished documents live on the
 * admin controller. The 인기 검색어 aggregate is public; 최근 검색어 is gated to
 * the signed-in user (their own history only).
 */
@ApiTags("Service Search")
@Controller("service/search")
export class ServiceSearchController {
  constructor(private readonly service: ServiceSearchService) {}

  @Get()
  @ApiOperation({
    summary: "통합 검색 (공개) — 의사/병원/진료과/지역 통합 목록/검색",
    description:
      "전문(full-text) + 트라이그램(오타/부분일치) 랭킹. type/regionId/specialtyId 필터, " +
      "sort(relevance|rating|featured), page/limit 페이지네이션. published 문서만 노출.",
  })
  @ApiResponse({ status: 200, type: SearchResultDto })
  search(@Query() query: SearchQueryDto, @OptionalUser() user?: User) {
    return this.service.search(query, user?.id);
  }

  @Get("popular")
  @ApiOperation({ summary: "인기 검색어 (공개, 집계 카운트만 — 개별 로그 비노출)" })
  @ApiResponse({ status: 200, type: PopularTermDto, isArray: true })
  popular(@Query() query: PopularQueryDto) {
    return this.service.popularTerms(query);
  }

  @Get("recent")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "최근 검색어 (로그인 사용자 — 본인 검색 기록만)" })
  @ApiResponse({ status: 200, type: RecentSearchDto, isArray: true })
  @ApiResponse({ status: 401, description: "인증 필요" })
  recent(@CurrentUser() user: User, @Query() query: RecentQueryDto) {
    return this.service.recentTerms(user.id, query);
  }
}
