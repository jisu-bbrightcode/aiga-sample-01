import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import {
  AdminDomainResourceDetailDto,
  AdminDomainResourceDetailParamDto,
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
}
