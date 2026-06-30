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
  AdminDoctorDto,
  AdminDomainResourceDetailDto,
  AdminDomainResourceDetailParamDto,
  AdminDomainResourceHistoryDto,
  AdminDomainResourceHistoryQueryDto,
  AdminDomainResourceLifecycleDto,
  AdminDomainResourceListDto,
  AdminDomainResourceQueryDto,
  AdminHospitalDto,
  ChangeStatusDto,
  CreateDoctorDto,
  CreateHospitalDto,
  UpdateDoctorDto,
  UpdateHospitalDto,
} from "../dto";
import { ServiceDomainService } from "../service";

/**
 * Admin domain resource list + detail + create API
 * (PB-ADMIN-DOMAIN-API-001 / BBR-761, PB-ADMIN-DOMAIN-READ-001 / BBR-679,
 * PB-ADMIN-DOMAIN-CREATE-001 / BBR-680).
 *
 * `GET /api/admin/domain/resources` — the unified list/search the admin domain
 * console (BBR-678, contract-first UI) consumes.
 * `GET /api/admin/domain/resources/:type/:id` — the read-one detail the admin
 * detail screen (BBR-679) consumes: full operational state + related entities,
 * sensitive identifiers masked.
 * `POST /api/admin/domain/resources/:type/:id/archive` + `/restore` — the
 * 비활성/archive lifecycle (BBR-682): take a record off the public surface
 * without deleting it (연결 데이터 보존), audited to `admin_audit_log`.
 * `POST /api/admin/domain/resources/doctors|hospitals` — create a catalog
 * record from the admin console (BBR-680). A record is created in its initial
 * lifecycle state (defaults to draft) and the action is recorded in the audit
 * log; sensitive operational fields are validated separately from the public
 * fields at the DTO boundary.
 * `PATCH /api/admin/domain/resources/doctors|hospitals/:id` — edit a record
 * (BBR-681); `POST /api/admin/domain/resources/:type/:id/status` — change its
 * publish status (허용된 전이만), and `GET .../:type/:id/history` — read its
 * 변경 이력 (audit trail). Both mutations append to `admin_audit_log`.
 *
 * All are gated by BetterAuthGuard then BetterAuthAdminGuard (owner/admin),
 * identical to the other admin routes. Kept on its own `admin/domain` base path
 * (distinct from the editorial CRUD controller's `service/admin`) so it matches
 * the committed contract URL exactly.
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

  @Post("resources/doctors")
  @ApiOperation({ summary: "도메인 리소스 생성 — 의사 (기본 draft, 감사 로그 기록)" })
  @ApiResponse({ status: 201, type: AdminDoctorDto })
  @ApiResponse({ status: 409, description: "slug 중복" })
  createDoctor(@CurrentUser() user: User, @Body() dto: CreateDoctorDto) {
    return this.service.createDoctor(user.id, dto);
  }

  @Post("resources/hospitals")
  @ApiOperation({ summary: "도메인 리소스 생성 — 병원 (기본 draft, 감사 로그 기록)" })
  @ApiResponse({ status: 201, type: AdminHospitalDto })
  @ApiResponse({ status: 409, description: "slug 중복" })
  createHospital(@CurrentUser() user: User, @Body() dto: CreateHospitalDto) {
    return this.service.createHospital(user.id, dto);
  }

  // ---- update / status / history (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681) ----

  @Patch("resources/doctors/:id")
  @ApiOperation({ summary: "도메인 리소스 수정 — 의사 (감사 로그 기록)" })
  @ApiResponse({ status: 200, type: AdminDoctorDto })
  @ApiResponse({ status: 404, description: "의사를 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "slug 중복" })
  updateDoctor(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.service.updateDoctor(user.id, id, dto);
  }

  @Patch("resources/hospitals/:id")
  @ApiOperation({ summary: "도메인 리소스 수정 — 병원 (감사 로그 기록)" })
  @ApiResponse({ status: 200, type: AdminHospitalDto })
  @ApiResponse({ status: 404, description: "병원을 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "slug 중복" })
  updateHospital(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return this.service.updateHospital(user.id, id, dto);
  }

  @Post("resources/:type/:id/status")
  @ApiOperation({ summary: "도메인 리소스 상태 변경 (허용된 전이만, 감사 로그 기록)" })
  @ApiResponse({ status: 201, type: AdminDomainResourceLifecycleDto })
  @ApiResponse({ status: 404, description: "리소스를 찾을 수 없음" })
  @ApiResponse({ status: 422, description: "허용되지 않은 상태 전이" })
  changeStatus(
    @CurrentUser() user: User,
    @Param() params: AdminDomainResourceDetailParamDto,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.service.changeDomainResourceStatus(user.id, params.type, params.id, dto.status);
  }

  @Get("resources/:type/:id/history")
  @ApiOperation({ summary: "도메인 리소스 변경 이력 (감사 로그, 최신순)" })
  @ApiResponse({ status: 200, type: AdminDomainResourceHistoryDto })
  getResourceHistory(
    @Param() params: AdminDomainResourceDetailParamDto,
    @Query() query: AdminDomainResourceHistoryQueryDto,
  ) {
    return this.service.getDomainResourceHistory(params.type, params.id, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
