import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  PopularQueryDto,
  PopularTermDto,
  PublicSearchDetailDto,
  RecentQueryDto,
  RecentSearchDto,
  SearchQueryDto,
  SearchResultDto,
} from "../dto";
import { publicViewerState } from "../mappers";
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

  // NOTE: declared LAST so the parametric two-segment route never shadows the
  // single-segment literals above (`popular`/`recent`). entityId is validated
  // as a UUID (malformed → 400); an unknown entityType → 404 (no such resource).
  @Get(":entityType/:entityId")
  @ApiOperation({
    summary: "통합 상세 조회 (공개) — 게시된 검색 리소스 + viewer state",
    description:
      "통합검색 결과 1건을 (entityType, entityId)로 조회한다. 공개 surface는 published 문서만 " +
      "노출하므로 없는 리소스와 비공개(미게시) 리소스는 모두 404로 동일하게 응답한다 " +
      "(존재 여부 비노출). viewer 블록은 로그인 여부 등 요청자 상태를 담는다.",
  })
  @ApiParam({ name: "entityType", enum: ["doctor", "hospital", "specialty", "region"] })
  @ApiParam({ name: "entityId", format: "uuid" })
  @ApiResponse({ status: 200, type: PublicSearchDetailDto })
  @ApiResponse({ status: 404, description: "없는 리소스 또는 비공개 리소스" })
  async detail(
    @Param("entityType") entityType: string,
    @Param("entityId", ParseUUIDPipe) entityId: string,
    @OptionalUser() user?: User,
  ): Promise<PublicSearchDetailDto> {
    const hit = await this.service.getPublicDetail(entityType, entityId);
    return { ...hit, viewer: publicViewerState(Boolean(user)) };
  }
}
