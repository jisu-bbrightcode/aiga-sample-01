import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { AdminDomainResourceListDto, AdminDomainResourceQueryDto } from "../dto";
import { ServiceDomainService } from "../service";

/**
 * Admin domain resource list API (PB-ADMIN-DOMAIN-API-001 / BBR-761).
 *
 * `GET /api/admin/domain/resources` — the unified list/search the admin domain
 * console (BBR-678, contract-first UI) consumes. Gated by BetterAuthGuard then
 * BetterAuthAdminGuard (owner/admin), identical to the other admin routes.
 *
 * Kept on its own `admin/domain` base path (distinct from the editorial CRUD
 * controller's `service/admin`) so it matches the committed contract URL
 * exactly. Sibling read/create/update/delete endpoints (BBR-679..682) will hang
 * off this same base.
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
}
