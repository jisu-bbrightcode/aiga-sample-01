import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  AdminDoctorDto,
  AdminDoctorListDto,
  AdminHospitalDto,
  AdminHospitalListDto,
  AdminListDoctorsQueryDto,
  AdminListHospitalsQueryDto,
  ChangeStatusDto,
  CreateDoctorDto,
  CreateHospitalDto,
  DeleteResultDto,
  UpdateDoctorDto,
  UpdateHospitalDto,
} from "../dto";
import { ServiceDomainService } from "../service";

/**
 * Admin service-domain API — editorial CRUD + status changes.
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role). The admin views expose the full record including
 * sensitive fields; public surfaces never reach this controller.
 */
@ApiTags("Service Domain (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("service/admin")
export class ServiceDomainAdminController {
  constructor(private readonly service: ServiceDomainService) {}

  // ---- doctors ----

  @Get("doctors")
  @ApiOperation({
    summary: "의사 목록 (관리자, 전체 상태 + 민감 필드)",
    description:
      "공개 목록과 달리 draft/archived를 포함한 모든 상태를 조회하며 status·includeDeleted 필터와 민감 필드를 노출한다.",
  })
  @ApiResponse({ status: 200, type: AdminDoctorListDto })
  listDoctors(@Query() query: AdminListDoctorsQueryDto) {
    return this.service.adminListDoctors(query);
  }

  @Post("doctors")
  @ApiOperation({ summary: "의사 생성" })
  @ApiResponse({ status: 201, type: AdminDoctorDto })
  @ApiResponse({ status: 409, description: "slug 중복" })
  createDoctor(@CurrentUser() user: User, @Body() dto: CreateDoctorDto) {
    return this.service.createDoctor(user.id, dto);
  }

  @Put("doctors/:id")
  @ApiOperation({ summary: "의사 수정" })
  @ApiResponse({ status: 200, type: AdminDoctorDto })
  @ApiResponse({ status: 404, description: "의사를 찾을 수 없음" })
  updateDoctor(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.service.updateDoctor(user.id, id, dto);
  }

  @Patch("doctors/:id/status")
  @ApiOperation({ summary: "의사 상태 변경 (draft/published/archived)" })
  @ApiResponse({ status: 200, type: AdminDoctorDto })
  @ApiResponse({ status: 404, description: "의사를 찾을 수 없음" })
  changeDoctorStatus(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.service.changeDoctorStatus(user.id, id, dto.status);
  }

  @Delete("doctors/:id")
  @ApiOperation({ summary: "의사 삭제 (soft delete)" })
  @ApiResponse({ status: 200, type: DeleteResultDto })
  @ApiResponse({ status: 404, description: "의사를 찾을 수 없음" })
  deleteDoctor(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteDoctor(user.id, id);
  }

  // ---- hospitals ----

  @Get("hospitals")
  @ApiOperation({
    summary: "병원 목록 (관리자, 전체 상태 + 민감 필드)",
    description:
      "공개 목록과 달리 draft/archived를 포함한 모든 상태를 조회하며 status·includeDeleted 필터와 민감 필드를 노출한다.",
  })
  @ApiResponse({ status: 200, type: AdminHospitalListDto })
  listHospitals(@Query() query: AdminListHospitalsQueryDto) {
    return this.service.adminListHospitals(query);
  }

  @Post("hospitals")
  @ApiOperation({ summary: "병원 생성" })
  @ApiResponse({ status: 201, type: AdminHospitalDto })
  @ApiResponse({ status: 409, description: "slug 중복" })
  createHospital(@CurrentUser() user: User, @Body() dto: CreateHospitalDto) {
    return this.service.createHospital(user.id, dto);
  }

  @Put("hospitals/:id")
  @ApiOperation({ summary: "병원 수정" })
  @ApiResponse({ status: 200, type: AdminHospitalDto })
  @ApiResponse({ status: 404, description: "병원을 찾을 수 없음" })
  updateHospital(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return this.service.updateHospital(user.id, id, dto);
  }

  @Patch("hospitals/:id/status")
  @ApiOperation({ summary: "병원 상태 변경 (draft/published/archived)" })
  @ApiResponse({ status: 200, type: AdminHospitalDto })
  @ApiResponse({ status: 404, description: "병원을 찾을 수 없음" })
  changeHospitalStatus(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.service.changeHospitalStatus(user.id, id, dto.status);
  }

  @Delete("hospitals/:id")
  @ApiOperation({ summary: "병원 삭제 (soft delete)" })
  @ApiResponse({ status: 200, type: DeleteResultDto })
  @ApiResponse({ status: 404, description: "병원을 찾을 수 없음" })
  deleteHospital(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteHospital(user.id, id);
  }
}
