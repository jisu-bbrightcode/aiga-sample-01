import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  AdminSearchDetailDto,
  AdminSearchQueryDto,
  AdminSearchResultDto,
  ArchiveResultDto,
} from "../dto";
import { ADMIN_VIEWER_STATE } from "../mappers";
import { ServiceSearchService } from "../service";

/**
 * 통합검색 admin API (FR-003 / BBR-531, archive BBR-535).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role). The admin view exposes the index/ranking internals
 * (body, keywords, weight, isPublished, sourceUpdatedAt) and accepts a
 * `published` filter so an editor can audit unpublished documents — neither is
 * reachable from the public controller. Admin searches are never logged.
 *
 * It also owns the archive lifecycle (BBR-535): DELETE soft-deletes a document
 * (노출 차단, connected data preserved), POST .../restore brings it back. Both
 * are idempotent.
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

  @Delete(":entityType/:entityId")
  @HttpCode(200)
  @ApiOperation({
    summary: "통합 검색 문서 archive (soft delete) — 노출 차단",
    description:
      "(entityType, entityId)로 검색 문서를 soft delete 한다. 행은 보존되어 공개/앱/관리자 " +
      "검색에서만 제외되며(노출 차단), 원본 entityId에 연결된 결제/이력/감사 데이터는 보존된다. " +
      "복구는 restore 엔드포인트로 가능. 이미 archive된 문서면 멱등 성공. 미인증=401, " +
      "비관리자=403, 없는 문서=404.",
  })
  @ApiParam({ name: "entityType", enum: ["doctor", "hospital", "specialty", "region"] })
  @ApiParam({ name: "entityId", format: "uuid" })
  @ApiResponse({ status: 200, type: ArchiveResultDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "없는 검색 문서" })
  archive(
    @CurrentUser() user: User,
    @Param("entityType") entityType: string,
    @Param("entityId", ParseUUIDPipe) entityId: string,
  ): Promise<ArchiveResultDto> {
    return this.service.archiveDocument(user.id, entityType, entityId);
  }

  @Post(":entityType/:entityId/restore")
  @HttpCode(200)
  @ApiOperation({
    summary: "통합 검색 문서 복구 (restore) — archive 해제",
    description:
      "archive된 검색 문서를 복구해 다시 노출되도록 한다. 이미 복구(미archive) 상태면 멱등 성공. " +
      "미인증=401, 비관리자=403, 없는 문서=404.",
  })
  @ApiParam({ name: "entityType", enum: ["doctor", "hospital", "specialty", "region"] })
  @ApiParam({ name: "entityId", format: "uuid" })
  @ApiResponse({ status: 200, type: ArchiveResultDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "없는 검색 문서" })
  restore(
    @CurrentUser() user: User,
    @Param("entityType") entityType: string,
    @Param("entityId", ParseUUIDPipe) entityId: string,
  ): Promise<ArchiveResultDto> {
    return this.service.restoreDocument(user.id, entityType, entityId);
  }
}
