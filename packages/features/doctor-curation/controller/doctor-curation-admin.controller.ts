import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  AdminCollectionDetailDto,
  AdminCollectionListDto,
  CollectionChangeStatusDto,
  CollectionHistoryDto,
  CollectionHistoryQueryDto,
  CreateCollectionDto,
  ListCollectionsQueryDto,
  UpdateCollectionDto,
} from "../dto";
import { DoctorCurationService } from "../service";

/**
 * 명의 큐레이션 admin API — FR-004 (BBR-538).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role): an unauthenticated or non-admin create request is
 * rejected before validation runs (acceptance criteria — 권한 없는 생성 검증).
 * The create result is immediately readable through the list/detail endpoints
 * below, keeping create ↔ read consistent.
 */
@ApiTags("Doctor Curation (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("service/curation/admin/collections")
export class DoctorCurationAdminController {
  constructor(private readonly service: DoctorCurationService) {}

  @Post()
  @ApiOperation({ summary: "명의 컬렉션 생성" })
  @ApiResponse({ status: 201, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 400, description: "필수 필드 누락 또는 유효성 오류" })
  @ApiResponse({ status: 409, description: "slug 중복" })
  createCollection(@CurrentUser() user: User, @Body() dto: CreateCollectionDto) {
    return this.service.createCollection(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "명의 컬렉션 목록 (admin)" })
  @ApiResponse({ status: 200, type: AdminCollectionListDto })
  listCollections(@Query() query: ListCollectionsQueryDto) {
    return this.service.listCollections(query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "명의 컬렉션 상세 (admin)",
    description:
      "관리자(owner/admin)만 접근 가능하며 미게시(draft) 컬렉션도 조회된다. viewerState.role=admin, " +
      "canManage=true. 비로그인은 401, 권한 없는 사용자는 403, 없는 id는 404.",
  })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  getCollection(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getCollectionById(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "명의 컬렉션 수정 (부분 업데이트)",
    description:
      "허용된 필드만 부분 수정한다(생략한 필드는 유지, nullable 필드는 null로 비울 수 있음). " +
      "상태(status)는 여기서 바꿀 수 없고 상태 변경 액션을 사용한다. 변경 내용은 admin_audit_log에 " +
      "before/after로 기록된다.",
  })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 400, description: "유효성 오류 또는 kind↔scope 불일치" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "slug 중복" })
  updateCollection(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.service.updateCollection(user.id, id, dto);
  }

  @Post(":id/status")
  @ApiOperation({
    summary: "명의 컬렉션 상태 변경 (발행/비공개/보관)",
    description:
      "허용된 상태 전이만 적용된다(예: draft→published, published→archived). 허용되지 않은 전이는 422. " +
      "published 진입 시 publishedAt이 기록되고, 전이 결과가 변경 이력에 남는다.",
  })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  @ApiResponse({ status: 422, description: "허용되지 않은 상태 전이" })
  changeStatus(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CollectionChangeStatusDto,
  ) {
    return this.service.changeStatus(user.id, id, dto);
  }

  @Get(":id/history")
  @ApiOperation({
    summary: "명의 컬렉션 변경 이력",
    description: "수정/상태 변경 감사 로그를 최신순(cursor pagination)으로 조회한다.",
  })
  @ApiResponse({ status: 200, type: CollectionHistoryDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  getCollectionHistory(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: CollectionHistoryQueryDto,
  ) {
    return this.service.listCollectionHistory(id, query);
  }

  @Post(":id/archive")
  @HttpCode(200)
  @ApiOperation({
    summary: "명의 컬렉션 archive (노출 차단)",
    description:
      "게시를 내려 공개/앱 노출을 차단하고 관리자 관리 대상으로 유지한다(status=archived). " +
      "수록 의사 등 연결 데이터는 보존되며 restore 로 복구 가능. 이미 archived 면 멱등하게 200.",
  })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  archiveCollection(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.archiveCollection(user.id, id);
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({
    summary: "명의 컬렉션 삭제 (soft delete)",
    description:
      "행을 물리 삭제하지 않고 isDeleted 플래그로 숨긴다. 수록 의사 등 연결 데이터는 보존되고 " +
      "restore 로 복구 가능. 이미 삭제된 경우에도 멱등하게 200, 존재하지 않으면 404.",
  })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  deleteCollection(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteCollection(user.id, id);
  }

  @Post(":id/restore")
  @HttpCode(200)
  @ApiOperation({
    summary: "명의 컬렉션 복구",
    description:
      "삭제/archive 된 컬렉션을 안전한 draft 상태로 되살린다. 자동 재게시는 하지 않으며, " +
      "이미 활성 상태면 멱등하게 현재 상태를 반환한다. 존재하지 않으면 404.",
  })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  restoreCollection(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.restoreCollection(user.id, id);
  }
}
