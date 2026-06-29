import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { StoryService } from "../service/story.service";
import {
  AddEntityTagDto,
  AddEntityTagResponseDto,
  CharacterResponseDto,
  CodexResponseDto,
  CreateCharacterDto,
  CreateCodexDto,
  CreateDraftDto,
  CreateFactionDto,
  CreateLocationDto,
  CreateRelationDto,
  CreateTagDto,
  CreateWorldDto,
  DeleteResponseDto,
  DraftResponseDto,
  EntityPropertyResponseDto,
  EntityTagResponseDto,
  FactionResponseDto,
  LocationResponseDto,
  RelationListResponseDto,
  RelationResponseDto,
  TagResponseDto,
  UpdateCharacterDto,
  UpdateCodexDto,
  UpdateDraftDto,
  UpdateFactionDto,
  UpdateLocationDto,
  UpdateWorldDto,
  UploadEntityImageSmallDto,
  UploadImageSmallResponseDto,
  UpsertEntityPropertyDto,
  WorldResponseDto,
} from "../dto";

// ============================================================================
// Worlds
// ============================================================================

@ApiTags("Story - Worlds")
@Controller("story/worlds")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryWorldController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "세계관 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, enum: ["latest", "name", "modified"] })
  @ApiResponse({ status: 200, description: "세계관 목록 반환", type: WorldResponseDto, isArray: true })
  async list(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "latest" | "name" | "modified",
  ) {
    return this.storyService.listWorlds(projectId, user.id, search, sortBy);
  }

  @Get(":id")
  @ApiOperation({ summary: "세계관 상세 조회" })
  @ApiParam({ name: "id", description: "세계관 ID" })
  @ApiResponse({ status: 200, description: "세계관 상세 정보", type: WorldResponseDto })
  @ApiResponse({ status: 404, description: "세계관을 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.getWorld(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "세계관 생성" })
  @ApiResponse({ status: 201, description: "세계관 생성 성공", type: WorldResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateWorldDto) {
    return this.storyService.createWorld(user.id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "세계관 수정" })
  @ApiParam({ name: "id", description: "세계관 ID" })
  @ApiResponse({ status: 200, description: "세계관 수정 성공", type: WorldResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorldDto,
  ) {
    return this.storyService.updateWorld(id, user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "세계관 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "세계관 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteWorld(id, user.id);
  }
}

// ============================================================================
// Characters
// ============================================================================

@ApiTags("Story - Characters")
@Controller("story/characters")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryCharacterController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "캐릭터 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, enum: ["latest", "name", "modified"] })
  @ApiResponse({ status: 200, description: "캐릭터 목록 반환", type: CharacterResponseDto, isArray: true })
  async list(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "latest" | "name" | "modified",
  ) {
    return this.storyService.listCharacters(projectId, user.id, search, sortBy);
  }

  @Get(":id")
  @ApiOperation({ summary: "캐릭터 상세 조회" })
  @ApiParam({ name: "id", description: "캐릭터 ID" })
  @ApiResponse({ status: 200, description: "캐릭터 상세 정보", type: CharacterResponseDto })
  @ApiResponse({ status: 404, description: "캐릭터를 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.getCharacter(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "캐릭터 생성" })
  @ApiResponse({ status: 201, description: "캐릭터 생성 성공", type: CharacterResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateCharacterDto) {
    return this.storyService.createCharacter(user.id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "캐릭터 수정" })
  @ApiParam({ name: "id", description: "캐릭터 ID" })
  @ApiResponse({ status: 200, description: "캐릭터 수정 성공", type: CharacterResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCharacterDto,
  ) {
    return this.storyService.updateCharacter(id, user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "캐릭터 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "캐릭터 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteCharacter(id, user.id);
  }
}

// ============================================================================
// Locations
// ============================================================================

@ApiTags("Story - Locations")
@Controller("story/locations")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryLocationController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "장소 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, enum: ["latest", "name", "modified"] })
  @ApiResponse({ status: 200, description: "장소 목록 반환", type: LocationResponseDto, isArray: true })
  async list(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "latest" | "name" | "modified",
  ) {
    return this.storyService.listLocations(projectId, user.id, search, sortBy);
  }

  @Get(":id")
  @ApiOperation({ summary: "장소 상세 조회" })
  @ApiParam({ name: "id", description: "장소 ID" })
  @ApiResponse({ status: 200, description: "장소 상세 정보", type: LocationResponseDto })
  @ApiResponse({ status: 404, description: "장소를 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.getLocation(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "장소 생성" })
  @ApiResponse({ status: 201, description: "장소 생성 성공", type: LocationResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateLocationDto) {
    return this.storyService.createLocation(user.id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "장소 수정" })
  @ApiParam({ name: "id", description: "장소 ID" })
  @ApiResponse({ status: 200, description: "장소 수정 성공", type: LocationResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.storyService.updateLocation(id, user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "장소 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "장소 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteLocation(id, user.id);
  }
}

// ============================================================================
// Factions
// ============================================================================

@ApiTags("Story - Factions")
@Controller("story/factions")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryFactionController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "세력 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, enum: ["latest", "name", "modified"] })
  @ApiResponse({ status: 200, description: "세력 목록 반환", type: FactionResponseDto, isArray: true })
  async list(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "latest" | "name" | "modified",
  ) {
    return this.storyService.listFactions(projectId, user.id, search, sortBy);
  }

  @Get(":id")
  @ApiOperation({ summary: "세력 상세 조회" })
  @ApiParam({ name: "id", description: "세력 ID" })
  @ApiResponse({ status: 200, description: "세력 상세 정보", type: FactionResponseDto })
  @ApiResponse({ status: 404, description: "세력을 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.getFaction(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "세력 생성" })
  @ApiResponse({ status: 201, description: "세력 생성 성공", type: FactionResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateFactionDto) {
    return this.storyService.createFaction(user.id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "세력 수정" })
  @ApiParam({ name: "id", description: "세력 ID" })
  @ApiResponse({ status: 200, description: "세력 수정 성공", type: FactionResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFactionDto,
  ) {
    return this.storyService.updateFaction(id, user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "세력 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "세력 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteFaction(id, user.id);
  }
}

// ============================================================================
// Codex
// ============================================================================

@ApiTags("Story - Codex")
@Controller("story/codex")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryCodexController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "코덱스 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, enum: ["latest", "name", "modified"] })
  @ApiResponse({ status: 200, description: "코덱스 목록 반환", type: CodexResponseDto, isArray: true })
  async list(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "latest" | "name" | "modified",
  ) {
    return this.storyService.listCodex(projectId, user.id, search, sortBy);
  }

  @Get(":id")
  @ApiOperation({ summary: "코덱스 상세 조회" })
  @ApiParam({ name: "id", description: "코덱스 ID" })
  @ApiResponse({ status: 200, description: "코덱스 상세 정보", type: CodexResponseDto })
  @ApiResponse({ status: 404, description: "코덱스를 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.getCodexEntry(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "코덱스 생성" })
  @ApiResponse({ status: 201, description: "코덱스 생성 성공", type: CodexResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateCodexDto) {
    return this.storyService.createCodexEntry(user.id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "코덱스 수정" })
  @ApiParam({ name: "id", description: "코덱스 ID" })
  @ApiResponse({ status: 200, description: "코덱스 수정 성공", type: CodexResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCodexDto,
  ) {
    return this.storyService.updateCodexEntry(id, user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "코덱스 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "코덱스 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteCodexEntry(id, user.id);
  }
}

// ============================================================================
// Drafts
// ============================================================================

@ApiTags("Story - Drafts")
@Controller("story/drafts")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryDraftController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "초안 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, enum: ["latest", "name", "modified"] })
  @ApiResponse({ status: 200, description: "초안 목록 반환", type: DraftResponseDto, isArray: true })
  async list(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: "latest" | "name" | "modified",
  ) {
    return this.storyService.listDrafts(projectId, user.id, search, sortBy);
  }

  @Get(":id")
  @ApiOperation({ summary: "초안 상세 조회" })
  @ApiParam({ name: "id", description: "초안 ID" })
  @ApiResponse({ status: 200, description: "초안 상세 정보", type: DraftResponseDto })
  @ApiResponse({ status: 404, description: "초안을 찾을 수 없음" })
  async getById(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.getDraft(id, user.id);
  }

  @Post()
  @ApiOperation({ summary: "초안 생성" })
  @ApiResponse({ status: 201, description: "초안 생성 성공", type: DraftResponseDto })
  async create(@CurrentUser() user: User, @Body() dto: CreateDraftDto) {
    return this.storyService.createDraft(user.id, dto);
  }

  @Put(":id")
  @ApiOperation({ summary: "초안 수정" })
  @ApiParam({ name: "id", description: "초안 ID" })
  @ApiResponse({ status: 200, description: "초안 수정 성공", type: DraftResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDraftDto,
  ) {
    return this.storyService.updateDraft(id, user.id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "초안 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "초안 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteDraft(id, user.id);
  }
}

// ============================================================================
// Tags
// ============================================================================

@ApiTags("Story - Tags")
@Controller("story/tags")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryTagController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "태그 목록 조회" })
  @ApiQuery({ name: "projectId", required: true, type: String })
  @ApiResponse({ status: 200, description: "태그 목록 반환", type: TagResponseDto, isArray: true })
  async list(@Query("projectId", ParseUUIDPipe) projectId: string) {
    return this.storyService.listTags(projectId);
  }

  @Post()
  @ApiOperation({ summary: "태그 생성" })
  @ApiResponse({ status: 201, description: "태그 생성 성공", type: TagResponseDto })
  async create(@Body() dto: CreateTagDto) {
    return this.storyService.createTag(dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "태그 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "태그 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteTag(id);
  }
}

// ============================================================================
// Entity Tags  (GET/POST /story/entity-tags, DELETE /story/entity-tags/:id)
// Distinct from /story/tags (project-level tag list).
// ============================================================================

@ApiTags("Story - Entity Tags")
@Controller("story/entity-tags")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryEntityTagController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "엔티티 태그 목록 조회" })
  @ApiQuery({ name: "entityId", required: true, type: String })
  @ApiQuery({
    name: "entityType",
    required: true,
    enum: ["world", "character", "location", "faction", "codex", "draft"],
  })
  @ApiResponse({
    status: 200,
    description: "엔티티 태그 목록 반환",
    type: EntityTagResponseDto,
    isArray: true,
  })
  async list(
    @Query("entityId", ParseUUIDPipe) entityId: string,
    @Query("entityType") entityType: string,
  ) {
    return this.storyService.getEntityTags(entityId, entityType);
  }

  @Post()
  @ApiOperation({ summary: "엔티티 태그 추가" })
  @ApiResponse({ status: 201, description: "태그 추가 성공", type: AddEntityTagResponseDto })
  async add(@Body() dto: AddEntityTagDto) {
    return this.storyService.addEntityTag(dto.entityId, dto.entityType, dto.tagId, dto.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "엔티티 태그 제거 (soft delete)" })
  @ApiParam({ name: "id", description: "엔티티 태그 ID" })
  @ApiResponse({ status: 200, description: "제거 결과", type: DeleteResponseDto })
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.removeEntityTag(id);
  }
}

// ============================================================================
// Entity Properties  (GET/POST/PUT /story/entity-properties)
// ============================================================================

@ApiTags("Story - Entity Properties")
@Controller("story/entity-properties")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryEntityPropertyController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "엔티티 속성 조회" })
  @ApiQuery({ name: "entityId", required: true, type: String })
  @ApiQuery({
    name: "entityType",
    required: true,
    enum: ["world", "character", "location", "faction", "codex", "draft"],
  })
  @ApiResponse({ status: 200, description: "엔티티 속성 반환", type: EntityPropertyResponseDto })
  async list(
    @CurrentUser() user: User,
    @Query("entityId", ParseUUIDPipe) entityId: string,
    @Query("entityType") entityType: "world" | "character" | "location" | "faction" | "codex" | "draft",
  ) {
    return this.storyService.getEntityProperties(entityId, entityType, user.id);
  }

  @Put()
  @ApiOperation({ summary: "엔티티 속성 upsert" })
  @ApiResponse({ status: 200, description: "속성 upsert 결과", type: EntityPropertyResponseDto })
  async upsert(@CurrentUser() user: User, @Body() dto: UpsertEntityPropertyDto) {
    return this.storyService.upsertEntityProperty({ ...dto, ownerId: user.id });
  }

  @Post("upload-image-small")
  @ApiOperation({ summary: "엔티티 이미지 업로드 (base64 JSON)" })
  @ApiResponse({
    status: 201,
    description: "이미지 업로드 성공 — imageSmallUrl 반환",
    type: UploadImageSmallResponseDto,
  })
  async uploadImageSmall(@CurrentUser() user: User, @Body() dto: UploadEntityImageSmallDto) {
    return this.storyService.uploadEntityImageSmall({ ...dto, ownerId: user.id });
  }
}

// ============================================================================
// Relations
// ============================================================================

@ApiTags("Story - Relations")
@Controller("story/relations")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class StoryRelationController {
  constructor(private readonly storyService: StoryService) {}

  @Get()
  @ApiOperation({ summary: "엔티티 관계 목록 조회" })
  @ApiQuery({ name: "entityId", required: true, type: String })
  @ApiQuery({
    name: "entityType",
    required: true,
    enum: ["world", "character", "location", "faction", "codex", "draft"],
  })
  @ApiResponse({
    status: 200,
    description: "관계 목록 반환",
    type: RelationListResponseDto,
    isArray: true,
  })
  async list(
    @Query("entityId", ParseUUIDPipe) entityId: string,
    @Query("entityType") entityType: string,
  ) {
    return this.storyService.listRelations(entityId, entityType);
  }

  @Post()
  @ApiOperation({ summary: "엔티티 관계 생성" })
  @ApiResponse({ status: 201, description: "관계 생성 성공", type: RelationResponseDto })
  async create(@Body() dto: CreateRelationDto) {
    return this.storyService.createRelation(dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "엔티티 관계 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "관계 ID" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: DeleteResponseDto })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.storyService.deleteRelation(id);
  }
}
