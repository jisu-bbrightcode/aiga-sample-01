import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import type { User } from "@repo/core/nestjs/auth";
import {
  AdminUserGradeDto,
  AdminUserGradeListDto,
  AssignUserGradeDto,
  ListUserGradesQueryDto,
} from "../dto";
import { UserGradeService } from "../service";

/**
 * FR-001 사용자 — admin user-grade API (PB-FEAT-FR001-API-CREATE / BBR-528).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin role). Grade assignment is a privileged operation — an
 * unauthenticated or non-admin request never reaches the service.
 *
 * `:userId` is the user's profile id (text, better-auth id); not a uuid, so no
 * ParseUUIDPipe.
 */
@ApiTags("User Grade (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin")
export class UserGradeAdminController {
  constructor(private readonly service: UserGradeService) {}

  @Post("users/:userId/grade")
  @ApiOperation({ summary: "사용자 등급 부여 (생성)" })
  @ApiResponse({ status: 201, type: AdminUserGradeDto })
  @ApiResponse({ status: 400, description: "필수 필드 누락 / 비활성 등급" })
  @ApiResponse({ status: 404, description: "대상 사용자 또는 등급을 찾을 수 없음" })
  @ApiResponse({ status: 409, description: "이미 등급이 부여된 사용자" })
  assign(
    @CurrentUser() user: User,
    @Param("userId") userId: string,
    @Body() dto: AssignUserGradeDto,
  ) {
    return this.service.assignGrade(user.id, userId, dto);
  }

  @Get("users/:userId/grade")
  @ApiOperation({ summary: "사용자 등급 조회 (상세)" })
  @ApiResponse({ status: 200, type: AdminUserGradeDto })
  @ApiResponse({ status: 404, description: "등급 정보 없음" })
  get(@Param("userId") userId: string) {
    return this.service.getUserGrade(userId);
  }

  @Get("user-grades")
  @ApiOperation({ summary: "사용자 등급 목록 (페이지네이션)" })
  @ApiResponse({ status: 200, type: AdminUserGradeListDto })
  list(@Query() query: ListUserGradesQueryDto) {
    return this.service.listUserGrades(query);
  }
}
