import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserPreferenceService } from "../service";
import { CommonSuccessResponseDto, SetUserPreferenceDto } from "../dto";

@ApiTags("User Preferences")
@Controller("user-preferences")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class UserPreferenceController {
  constructor(private readonly userPreferenceService: UserPreferenceService) {}

  @Get()
  @ApiOperation({ summary: "사용자 설정 전체 조회" })
  @ApiResponse({
    status: 200,
    description: "사용자 설정 key-value map",
    schema: { type: "object", additionalProperties: { type: "string" } },
  })
  getAll(@CurrentUser() user: User) {
    return this.userPreferenceService.getAll(user.id);
  }

  @Get(":key")
  @ApiOperation({ summary: "사용자 설정 조회" })
  @ApiParam({ name: "key", description: "설정 키" })
  @ApiResponse({
    status: 200,
    description: "설정 값. 저장된 값이 없으면 null",
    schema: { type: "string", nullable: true },
  })
  get(@CurrentUser() user: User, @Param("key") key: string) {
    return this.userPreferenceService.get(user.id, key);
  }

  @Put(":key")
  @ApiOperation({ summary: "사용자 설정 저장" })
  @ApiParam({ name: "key", description: "설정 키" })
  @ApiResponse({ status: 200, description: "저장 결과", type: CommonSuccessResponseDto })
  set(@CurrentUser() user: User, @Param("key") key: string, @Body() dto: SetUserPreferenceDto) {
    return this.userPreferenceService.set(user.id, key, dto.value);
  }
}
