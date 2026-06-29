import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  PreconditionFailedException,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import { SettingsProjectsService } from "../service";
import { SettingsProjectDetailDto, SettingsProjectListItemDto } from "../dto";

function getActiveOrganizationId(user: User): string {
  if (typeof user.activeOrganizationId === "string" && user.activeOrganizationId.length > 0) {
    return user.activeOrganizationId;
  }
  throw new PreconditionFailedException(
    "활성 워크스페이스가 필요합니다. 먼저 워크스페이스를 선택해 주세요.",
  );
}

@ApiTags("Settings Projects")
@ApiExtraModels(SettingsProjectDetailDto)
@Controller("settings-projects")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class SettingsProjectsController {
  constructor(private readonly settingsProjectsService: SettingsProjectsService) {}

  @Get()
  @ApiOperation({ summary: "설정 화면 프로젝트 목록 조회" })
  @ApiQuery({ name: "filter", required: false, enum: ["active", "starred", "archived"] })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "설정 화면 프로젝트 목록",
    type: SettingsProjectListItemDto,
    isArray: true,
  })
  list(
    @CurrentUser() user: User,
    @Query("filter") filter?: "active" | "starred" | "archived",
    @Query("search") search?: string,
  ) {
    return this.settingsProjectsService.list(user.id, getActiveOrganizationId(user), {
      filter,
      search,
    });
  }

  @Get(":projectId")
  @ApiOperation({ summary: "설정 화면 프로젝트 상세 조회" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({
    status: 200,
    description: "프로젝트 상세. 찾을 수 없으면 null",
    schema: { nullable: true, allOf: [{ $ref: getSchemaPath(SettingsProjectDetailDto) }] },
  })
  byId(@CurrentUser() user: User, @Param("projectId", ParseUUIDPipe) projectId: string) {
    return this.settingsProjectsService.byId(user.id, getActiveOrganizationId(user), projectId);
  }
}
