import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  InterestListDto,
  ListQueryDto,
  SavedItemDto,
  SavedItemListDto,
  SearchHistoryListDto,
} from "../dto";
import { PersonalizationService } from "../service";

/**
 * Personalization list API (FR-002 / BBR-724).
 *
 * Every route is guarded by {@link BetterAuthGuard}: unauthenticated callers get
 * 401 and never see any data (인증 필수). The owner is taken from the
 * authenticated session via {@link CurrentUser} — never from a query/body param
 * — so a caller can only ever read their own records (소유자 스코프 강제). Each
 * list is newest-first with cursor pagination; an empty list is a normal 200.
 */
@ApiTags("Personalization")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller()
export class PersonalizationController {
  constructor(private readonly service: PersonalizationService) {}

  @Get("saved-items")
  @ApiOperation({ summary: "내 저장 목록 (최근순, cursor 페이지네이션, 로그인 필요)" })
  @ApiResponse({ status: 200, type: SavedItemListDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  listSavedItems(@CurrentUser() user: User, @Query() query: ListQueryDto) {
    return this.service.listSavedItems(user.id, query);
  }

  @Get("saved-items/:id")
  @ApiOperation({ summary: "내 저장 항목 단건 조회 (소유자 전용, 로그인 필요)" })
  @ApiParam({ name: "id", format: "uuid", description: "저장 항목 id" })
  @ApiResponse({ status: 200, type: SavedItemDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 404, description: "저장 항목 없음 또는 타인 소유" })
  getSavedItem(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.getSavedItem(user.id, id);
  }

  @Get("interests")
  @ApiOperation({ summary: "내 관심 목록 (최근순, cursor 페이지네이션, 로그인 필요)" })
  @ApiResponse({ status: 200, type: InterestListDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  listInterests(@CurrentUser() user: User, @Query() query: ListQueryDto) {
    return this.service.listInterests(user.id, query);
  }

  @Get("search-history")
  @ApiOperation({ summary: "내 검색 히스토리 (최근순, cursor 페이지네이션, 로그인 필요)" })
  @ApiResponse({ status: 200, type: SearchHistoryListDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  listSearchHistory(@CurrentUser() user: User, @Query() query: ListQueryDto) {
    return this.service.listSearchHistory(user.id, query);
  }
}
