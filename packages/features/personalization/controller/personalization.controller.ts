import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  CreateInterestDto,
  CreateSavedItemDto,
  InterestDto,
  InterestListDto,
  ListQueryDto,
  SavedItemDto,
  SavedItemListDto,
  SearchHistoryListDto,
} from "../dto";
import { PersonalizationService } from "../service";

/**
 * Personalization API (FR-002).
 *
 * Owner-scoped 저장/관심/검색 히스토리. Every route is guarded by
 * {@link BetterAuthGuard}: unauthenticated callers get 401 (인증 필수 →
 * 화면 로그인 모달) and never touch any data. The owner is taken from the
 * authenticated session via {@link CurrentUser} — never from a query/body param
 * — so a caller can only ever read or create their own records (소유자 스코프
 * 강제). Lists (BBR-724) are newest-first with cursor pagination; creates
 * (BBR-726) are idempotent per (owner, target).
 */
@ApiTags("Personalization")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller()
export class PersonalizationController {
  constructor(private readonly service: PersonalizationService) {}

  @Post("saved-items")
  @HttpCode(201)
  @ApiOperation({ summary: "저장 추가 — 의사/병원을 내 저장 목록에 추가 (로그인 필요)" })
  @ApiResponse({
    status: 201,
    type: SavedItemDto,
    description: "저장된 항목 (이미 저장돼 있으면 기존 항목을 멱등 반환)",
  })
  @ApiResponse({ status: 400, description: "잘못된 targetType / targetId" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  createSavedItem(@CurrentUser() user: User, @Body() dto: CreateSavedItemDto) {
    return this.service.createSavedItem(user.id, dto);
  }

  @Post("interests")
  @HttpCode(201)
  @ApiOperation({ summary: "관심 추가 — 의사/병원을 내 관심 목록에 추가 (로그인 필요)" })
  @ApiResponse({
    status: 201,
    type: InterestDto,
    description: "관심 항목 (이미 등록돼 있으면 기존 항목을 멱등 반환)",
  })
  @ApiResponse({ status: 400, description: "잘못된 targetType / targetId" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  createInterest(@CurrentUser() user: User, @Body() dto: CreateInterestDto) {
    return this.service.createInterest(user.id, dto);
  }

  @Get("saved-items")
  @ApiOperation({ summary: "내 저장 목록 (최근순, cursor 페이지네이션, 로그인 필요)" })
  @ApiResponse({ status: 200, type: SavedItemListDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  listSavedItems(@CurrentUser() user: User, @Query() query: ListQueryDto) {
    return this.service.listSavedItems(user.id, query);
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
