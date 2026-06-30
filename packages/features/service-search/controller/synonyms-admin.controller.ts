import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  CreateSynonymDto,
  ListSynonymsQueryDto,
  SynonymDto,
  SynonymHistoryListDto,
  SynonymHistoryQueryDto,
  SynonymListDto,
  UpdateSynonymDto,
  UpdateSynonymStatusDto,
} from "../dto";
import { ServiceSearchSynonymsService } from "../service";

/**
 * 통합검색 synonym admin API (FR-003 create — BBR-533, update — BBR-534).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role): an unauthenticated request gets 401, a non-admin 403.
 * Synonyms only affect ranking/recall and are never shown to public visitors,
 * so the whole controller lives behind the admin gate. Mounted under
 * `service/admin/search/synonyms` (distinct from the list controller's
 * `service/search/admin`).
 *
 * Write surface: create (`POST`), partial content edit (`PATCH :id`), status
 * transition (`PATCH :id/status`), and the per-resource change history
 * (`GET :id/history`).
 */
@ApiTags("Service Search Synonyms (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("service/admin/search/synonyms")
export class ServiceSearchSynonymsAdminController {
  constructor(private readonly service: ServiceSearchSynonymsService) {}

  @Post()
  @ApiOperation({ summary: "검색 동의어 생성" })
  @ApiResponse({ status: 201, type: SynonymDto })
  @ApiResponse({ status: 409, description: "이미 등록된 검색어" })
  createSynonym(@CurrentUser() user: User, @Body() dto: CreateSynonymDto) {
    return this.service.createSynonym(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "검색 동의어 목록" })
  @ApiResponse({ status: 200, type: SynonymListDto })
  listSynonyms(@Query() query: ListSynonymsQueryDto) {
    return this.service.listSynonyms(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "검색 동의어 상세" })
  @ApiResponse({ status: 200, type: SynonymDto })
  @ApiResponse({ status: 404, description: "검색 동의어를 찾을 수 없음" })
  getSynonym(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getSynonymById(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "검색 동의어 수정 (부분 업데이트)" })
  @ApiResponse({ status: 200, type: SynonymDto })
  @ApiResponse({ status: 400, description: "수정할 항목이 없거나 유효하지 않음" })
  @ApiResponse({ status: 404, description: "검색 동의어를 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "이미 등록된 검색어 / 유효한 확장어 없음" })
  updateSynonym(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSynonymDto,
  ) {
    return this.service.updateSynonym(user.id, id, dto);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "검색 동의어 상태 변경 (활성/비활성)" })
  @ApiResponse({ status: 200, type: SynonymDto })
  @ApiResponse({ status: 400, description: "허용되지 않은 상태값" })
  @ApiResponse({ status: 404, description: "검색 동의어를 찾을 수 없음" })
  updateSynonymStatus(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSynonymStatusDto,
  ) {
    return this.service.setSynonymStatus(user.id, id, dto.status, dto.reason);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "검색 동의어 변경 이력" })
  @ApiResponse({ status: 200, type: SynonymHistoryListDto })
  @ApiResponse({ status: 404, description: "검색 동의어를 찾을 수 없음" })
  listSynonymHistory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: SynonymHistoryQueryDto,
  ) {
    return this.service.listSynonymHistory(id, { limit: query.limit, cursor: query.cursor });
  }
}
