import { BetterAuthAdminGuard, BetterAuthGuard } from "@repo/core/nestjs/auth";
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AdminUsersService } from "../service";
import { AdminUserListResponseDto } from "../dto";

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

@ApiTags("Admin Users")
@Controller("admin/users")
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: "관리자 사용자 메타 목록 조회" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "사용자 메타 목록",
    type: AdminUserListResponseDto,
  })
  list(@Query("limit") limit?: string, @Query("offset") offset?: string) {
    return this.adminUsersService.list({
      limit: parseNonNegativeInt(limit, 20),
      offset: parseNonNegativeInt(offset, 0),
    });
  }
}
