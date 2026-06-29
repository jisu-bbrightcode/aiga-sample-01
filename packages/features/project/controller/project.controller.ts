import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { ProjectService } from "../service/project.service";
import { CreateProjectDto, UpdateProjectDto, UploadCoverDto } from "../dto";
import { DeleteResponseDto, ProjectResponseDto } from "../dto";

function getOrganizationId(user: User): string {
  if (typeof user.activeOrganizationId === "string" && user.activeOrganizationId.length > 0) {
    return user.activeOrganizationId;
  }
  throw new BadRequestException("활성 워크스페이스가 필요합니다.");
}

@ApiTags("Projects")
@Controller("projects")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: "내 프로젝트 목록 조회" })
  @ApiResponse({ status: 200, description: "프로젝트 목록 반환", type: ProjectResponseDto, isArray: true })
  async list(@CurrentUser() user: User) {
    return this.projectService.list(user.id, getOrganizationId(user));
  }

  @Get(":id")
  @ApiOperation({ summary: "프로젝트 상세 조회" })
  @ApiParam({ name: "id", description: "프로젝트 ID" })
  @ApiResponse({ status: 200, description: "프로젝트 상세 정보", type: ProjectResponseDto })
  @ApiResponse({ status: 404, description: "프로젝트를 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.projectService.getById(id, user.id, getOrganizationId(user));
  }

  @Post()
  @ApiOperation({ summary: "프로젝트 생성" })
  @ApiResponse({ status: 201, description: "프로젝트 생성 성공", type: ProjectResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projectService.create(user.id, getOrganizationId(user), dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "프로젝트 수정" })
  @ApiParam({ name: "id", description: "프로젝트 ID" })
  @ApiResponse({ status: 200, description: "수정된 프로젝트", type: ProjectResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, user.id, getOrganizationId(user), dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "프로젝트 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "프로젝트 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.projectService.delete(id, user.id, getOrganizationId(user));
  }

  @Patch(":id/last-opened")
  @ApiOperation({ summary: "마지막 접근 시간 갱신" })
  @ApiParam({ name: "id", description: "프로젝트 ID" })
  @ApiResponse({ status: 200, description: "갱신된 프로젝트", type: ProjectResponseDto })
  async updateLastOpened(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.projectService.updateLastOpened(id, user.id, getOrganizationId(user));
  }

  @Delete(":id/permanently")
  @ApiOperation({ summary: "프로젝트 영구 삭제" })
  @ApiParam({ name: "id", description: "프로젝트 ID" })
  @ApiResponse({ status: 200, description: "영구 삭제 결과", type: DeleteResponseDto })
  async permanentlyDelete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.projectService.permanentlyDelete(id, user.id, getOrganizationId(user));
  }

  @Post(":id/cover")
  @ApiOperation({ summary: "프로젝트 커버 이미지 업로드" })
  @ApiParam({ name: "id", description: "프로젝트 ID" })
  @ApiResponse({ status: 201, description: "업로드된 커버 이미지가 반영된 프로젝트", type: ProjectResponseDto })
  async uploadCover(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UploadCoverDto,
  ) {
    return this.projectService.uploadCover(id, user.id, getOrganizationId(user), dto.dataUrl);
  }
}
