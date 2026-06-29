import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { CreateSynonymDto, ListSynonymsQueryDto, SynonymDto, SynonymListDto } from "../dto";
import { ServiceSearchSynonymsService } from "../service";

/**
 * 통합검색 synonym admin API (FR-003 create — BBR-533).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role): an unauthenticated request gets 401, a non-admin 403.
 * Synonyms only affect ranking/recall and are never shown to public visitors,
 * so the whole controller lives behind the admin gate. Mounted under
 * `service/admin/search/synonyms` (distinct from the list controller's
 * `service/search/admin`).
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
}
