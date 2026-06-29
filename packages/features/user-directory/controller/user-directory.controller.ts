import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { ListUsersQueryDto, PublicUserDto, SelfUserDto, UserListDto } from "../dto";
import { UserDirectoryService } from "../service";

/**
 * 사용자 목록/검색 API — 공개 + 본인(self) 티어 (FR-001, BBR-526).
 *
 * `/users` and `/users/{handle}` are unauthenticated and return ONLY the public
 * directory projection (handle/name/bio/avatar + 등급 배지) for active members
 * who opted into a public handle. `/users/me` is authenticated and returns the
 * caller's OWN record with the extra self-tier fields (email/인증수단/동의시점).
 * Operator-only fields and the full user list live on the admin controller.
 */
@ApiTags("Users")
@Controller("users")
export class UserDirectoryController {
  constructor(private readonly service: UserDirectoryService) {}

  @Get()
  @ApiOperation({ summary: "사용자 목록/검색 (공개, 핸들 보유 활성 회원만)" })
  @ApiResponse({ status: 200, type: UserListDto })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.service.listUsers(query);
  }

  // Declared before `:handle` so the literal route always wins.
  @Get("me")
  @ApiBearerAuth()
  @UseGuards(BetterAuthGuard)
  @ApiOperation({ summary: "내 정보 (본인, 등급 포함)" })
  @ApiResponse({ status: 200, type: SelfUserDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  getMe(@CurrentUser() user: User) {
    return this.service.getSelf(user.id);
  }

  @Get(":handle")
  @ApiOperation({ summary: "사용자 상세 (공개, 핸들 기준)" })
  @ApiResponse({ status: 200, type: PublicUserDto })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  getByHandle(@Param("handle") handle: string) {
    return this.service.getByHandle(handle);
  }
}
