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
import {
  AdminUserDetailDto,
  AdminUserListResponseDto,
  ChangeUserRoleBodyDto,
  ChangeUserRoleResponseDto,
  ChangeUserStatusBodyDto,
  ChangeUserStatusResponseDto,
} from "../dto";
import { AdminRoleService, AdminUsersService, normalizeUserListQuery } from "../service";

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

const changeStatusSchema = z.object({
  isActive: z.boolean(),
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
  @ApiOperation({ summary: "관리자 사용자 메타 목록 조회/검색/필터/정렬" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiQuery({ name: "q", required: false, type: String, description: "이름/이메일 검색어" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["active", "inactive"],
    description: "계정 상태 필터 (활성/정지)",
  })
  @ApiQuery({
    name: "accessRole",
    required: false,
    enum: ["owner", "admin", "member", "none"],
    description: "접근 역할 필터 (none = 조직 멤버 아님)",
  })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["createdAt", "name", "status", "lastActiveAt"],
    description: "정렬 기준 (가입일/이름/상태/최근활동, 기본 createdAt)",
  })
  @ApiQuery({
    name: "order",
    required: false,
    enum: ["asc", "desc"],
    description: "정렬 방향 (기본 desc)",
  })
  @ApiResponse({
    status: 200,
    description: "사용자 메타 목록",
    type: AdminUserListResponseDto,
  })
  list(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("accessRole") accessRole?: string,
    @Query("sort") sort?: string,
    @Query("order") order?: string,
  ) {
    return this.adminUsersService.list(
      normalizeUserListQuery({ limit, offset, q, status, accessRole, sort, order }),
    );
  }

  @Get(":id/detail")
  @ApiOperation({
    summary:
      "관리자 사용자 상세 (인증 수단/세션·활동 요약/결제·권한 요약/감사 이력). 세션 token·provider secret 등 민감 정보는 노출하지 않습니다.",
  })
  @ApiResponse({ status: 200, type: AdminUserDetailDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 없음" })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  getDetail(@Param("id") id: string) {
    return this.adminUsersService.getDetail(id);
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

  @Patch(":id/status")
  @ApiOperation({
    summary: "계정 상태 변경 (활성/정지). 변경 내역은 감사 로그에 기록됩니다.",
  })
  @ApiResponse({ status: 200, type: ChangeUserStatusResponseDto })
  changeStatus(
    @Param("id") targetUserId: string,
    @Body() body: ChangeUserStatusBodyDto,
    @CurrentUser() actor: User,
    @Req() req: RequestLike,
  ): Promise<ChangeUserStatusResponseDto> {
    const parsed = changeStatusSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("요청 값이 올바르지 않습니다.");
    }
    const input = parsed.data;
    return this.adminUsersService.setActive({
      actorUserId: actor.id,
      targetUserId,
      isActive: input.isActive,
      reason: input.reason,
      ipAddress: req.ip,
      userAgent: headerValue(req, "user-agent"),
    });
  }
}
