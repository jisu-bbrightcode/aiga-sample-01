import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  AdminDomainResourceDetailDto,
  AdminDomainResourceDetailParamDto,
  AdminDomainResourceLifecycleDto,
  AdminDomainResourceListDto,
  AdminDomainResourceQueryDto,
} from "../dto";
import { ServiceDomainService } from "../service";

/**
 * Admin domain resource list + detail API (PB-ADMIN-DOMAIN-API-001 / BBR-761,
 * PB-ADMIN-DOMAIN-READ-001 / BBR-679).
 *
 * `GET /api/admin/domain/resources` — the unified list/search the admin domain
 * console (BBR-678, contract-first UI) consumes.
 * `GET /api/admin/domain/resources/:type/:id` — the read-one detail the admin
 * detail screen (BBR-679) consumes: full operational state + related entities,
 * sensitive identifiers masked.
 * `POST /api/admin/domain/resources/:type/:id/archive` + `/restore` — the
 * 비활성/archive lifecycle (BBR-682): take a record off the public surface
 * without deleting it (연결 데이터 보존), audited to `admin_audit_log`.
 *
 * Both are gated by BetterAuthGuard then BetterAuthAdminGuard (owner/admin),
 * identical to the other admin routes. Kept on its own `admin/domain` base path
 * (distinct from the editorial CRUD controller's `service/admin`) so it matches
 * the committed contract URL exactly. Sibling create/update/delete endpoints
 * (BBR-680..682) will hang off this same base.
 */
@ApiTags("Admin Domain Resources")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/domain")
export class ServiceDomainAdminResourcesController {
  constructor(private readonly service: ServiceDomainService) {}

  @Get("resources")
  @ApiOperation({ summary: "도메인 리소스 목록/검색 (의사·병원 통합)" })
  @ApiResponse({ status: 200, type: AdminDomainResourceListDto })
  listResources(@Query() query: AdminDomainResourceQueryDto) {
    return this.service.listAdminDomainResources(query);
  }

  @Get("resources/:type/:id")
  @ApiOperation({ summary: "도메인 리소스 상세 (운영 필드 + 관련 정보, 민감정보 마스킹)" })
  @ApiResponse({ status: 200, type: AdminDomainResourceDetailDto })
  getResourceDetail(@Param() params: AdminDomainResourceDetailParamDto) {
    return this.service.getAdminDomainResourceDetail(params.type, params.id);
  }

  @Post("resources/:type/:id/archive")
  @ApiOperation({ summary: "도메인 리소스 비활성/archive (공개 노출 차단, 연결 데이터 보존)" })
  @ApiResponse({ status: 201, type: AdminDomainResourceLifecycleDto })
  @ApiResponse({ status: 404, description: "리소스를 찾을 수 없음" })
  archiveResource(@CurrentUser() user: User, @Param() params: AdminDomainResourceDetailParamDto) {
    return this.service.archiveDomainResource(user.id, params.type, params.id);
  }

  @Post("resources/:type/:id/restore")
  @ApiOperation({ summary: "archive 된 도메인 리소스 복구 (비공개 draft 로)" })
  @ApiResponse({ status: 201, type: AdminDomainResourceLifecycleDto })
  @ApiResponse({ status: 404, description: "리소스를 찾을 수 없음" })
  restoreResource(@CurrentUser() user: User, @Param() params: AdminDomainResourceDetailParamDto) {
    return this.service.restoreDomainResource(user.id, params.type, params.id);
  }
}
