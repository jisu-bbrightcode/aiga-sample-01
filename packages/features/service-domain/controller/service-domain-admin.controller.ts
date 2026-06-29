import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import {
  AdminDoctorCredentialDto,
  AdminDoctorDto,
  AdminHospitalDto,
  AdminHospitalHoursDto,
  ChangeStatusDto,
  CreateDoctorCredentialDto,
  CreateDoctorDto,
  CreateHospitalDto,
  CreateHospitalHoursDto,
  CreateHospitalSpecialtyDto,
  DeleteResultDto,
  HospitalSpecialtyLinkDto,
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

  @Post("doctors/:id/credentials")
  @ApiOperation({ summary: "의사 프로필 이력 생성 (학력/경력/자격/수상)" })
  @ApiResponse({ status: 201, type: AdminDoctorCredentialDto })
  @ApiResponse({ status: 404, description: "의사를 찾을 수 없음" })
  createDoctorCredential(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateDoctorCredentialDto,
  ) {
    return this.service.createDoctorCredential(user.id, id, dto);
  }

  // ---- hospitals ----

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

  @Post("hospitals/:id/specialties")
  @ApiOperation({ summary: "병원 진료과 추가" })
  @ApiResponse({ status: 201, type: HospitalSpecialtyLinkDto })
  @ApiResponse({ status: 404, description: "병원 또는 진료과를 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "이미 등록된 진료과" })
  addHospitalSpecialty(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateHospitalSpecialtyDto,
  ) {
    return this.service.addHospitalSpecialty(user.id, id, dto);
  }

  @Post("hospitals/:id/hours")
  @ApiOperation({ summary: "병원 운영시간 추가 (요일별)" })
  @ApiResponse({ status: 201, type: AdminHospitalHoursDto })
  @ApiResponse({ status: 404, description: "병원을 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "해당 요일 운영시간 중복" })
  addHospitalHours(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateHospitalHoursDto,
  ) {
    return this.service.addHospitalHours(user.id, id, dto);
  }
}
