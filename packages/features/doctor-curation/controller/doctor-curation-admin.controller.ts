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
import {
  AdminCollectionDetailDto,
  AdminCollectionListDto,
  CreateCollectionDto,
  ListCollectionsQueryDto,
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
  @ApiOperation({ summary: "명의 컬렉션 상세 (admin)" })
  @ApiResponse({ status: 200, type: AdminCollectionDetailDto })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  getCollection(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getCollectionById(id);
  }
}
