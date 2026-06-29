import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { AdminUserDto, AdminUserListDto, ListAdminUsersQueryDto } from "../dto";
import { UserDirectoryService } from "../service";

/**
 * 사용자 관리 API — 관리자 티어 (FR-001, BBR-526).
 *
 * Gated by BetterAuthGuard (authenticated) then BetterAuthAdminGuard
 * (owner/admin). Exposes the full user record incl. email/인증수단/활성여부/
 * 소프트삭제 부기 and the resolved grade (출처/일일한도/만료) plus operational
 * filters (활성여부·인증수단·삭제포함). Public surfaces never reach this controller.
 */
@ApiTags("Users (Admin)")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/users")
export class UserDirectoryAdminController {
  constructor(private readonly service: UserDirectoryService) {}

  @Get()
  @ApiOperation({ summary: "사용자 목록/검색 (관리자, 전체 필드/필터)" })
  @ApiResponse({ status: 200, type: AdminUserListDto })
  listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.service.listAdminUsers(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "사용자 상세 (관리자, profile id 기준)" })
  @ApiResponse({ status: 200, type: AdminUserDto })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  getUser(@Param("id") id: string) {
    return this.service.getAdminUser(id);
  }
}
