import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  BetterAuthAdminGuard,
  BetterAuthGuard,
  CurrentUser,
  type User,
} from "@repo/core/nestjs/auth";
import { z } from "zod";
import { AdminUserListResponseDto, ChangeUserRoleBodyDto, ChangeUserRoleResponseDto } from "../dto";
import { AdminRoleService, AdminUsersService } from "../service";

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function headerValue(req: RequestLike, name: string): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === "string" ? raw : undefined;
}

const changeRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
  reason: z.string().trim().max(500).optional(),
});

@ApiTags("Admin Users")
@Controller("admin/users")
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@ApiBearerAuth()
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminRoleService: AdminRoleService,
  ) {}

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

  @Patch(":id/role")
  @ApiOperation({
    summary: "관리자 접근 역할 변경 (admin/member). 변경 내역은 감사 로그에 기록됩니다.",
  })
  @ApiResponse({ status: 200, type: ChangeUserRoleResponseDto })
  changeRole(
    @Param("id") targetUserId: string,
    @Body() body: ChangeUserRoleBodyDto,
    @CurrentUser() actor: User,
    @Req() req: RequestLike,
  ): Promise<ChangeUserRoleResponseDto> {
    const parsed = changeRoleSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("요청 값이 올바르지 않습니다.");
    }
    const input = parsed.data;
    return this.adminRoleService.changeRole({
      actorUserId: actor.id,
      targetUserId,
      role: input.role,
      reason: input.reason,
      ipAddress: req.ip,
      userAgent: headerValue(req, "user-agent"),
    });
  }
}
