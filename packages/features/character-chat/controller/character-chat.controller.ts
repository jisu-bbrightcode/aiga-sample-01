import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import {
  Body,
  Controller,
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
import { ActorService } from "../service/actor.service";
import { ThreadService } from "../service/thread.service";
import {
  CreateCharacterChatSessionDto,
  CreateCharacterChatThreadDto,
  characterChatObjectListOpenApiSchema,
  characterChatObjectOpenApiSchema,
  chatSessionOpenApiSchema,
  HideCharacterChatListItemDto,
  hiddenActorIdsOpenApiSchema,
  lastOpenedThreadOpenApiSchema,
  nullableCharacterChatObjectOpenApiSchema,
  PrepareCharacterActorDto,
  SetCharacterChatLastOpenedDto,
  ShowCharacterChatListItemDto,
} from "./character-chat.dto";

@ApiTags("Operator Chat Legacy Compatibility")
@Controller("character-chat")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class CharacterChatController {
  constructor(
    private readonly actorService: ActorService,
    private readonly threadService: ThreadService,
  ) {}

  @Post("actors/prepare")
  @ApiOperation({ summary: "Legacy operator actor 준비/재활성화" })
  @ApiResponse({
    status: 201,
    description: "준비된 legacy operator actor",
    schema: characterChatObjectOpenApiSchema,
  })
  prepareActor(@CurrentUser() user: User, @Body() dto: PrepareCharacterActorDto) {
    return this.actorService.prepareActor({ ...dto, userId: user.id });
  }

  @Get("actors/by-character/:characterId")
  @ApiOperation({ summary: "Legacy character ID 기반 operator actor 조회" })
  @ApiParam({ name: "characterId", description: "호환 저장소의 캐릭터 ID" })
  @ApiResponse({
    status: 200,
    description: "Legacy operator actor. 없으면 null",
    schema: nullableCharacterChatObjectOpenApiSchema,
  })
  getActorByCharacter(@Param("characterId", ParseUUIDPipe) characterId: string) {
    return this.actorService.getActorByCharacter(characterId);
  }

  @Post("actors/:actorId/disable")
  @ApiOperation({ summary: "Legacy operator actor 비활성화" })
  @ApiParam({ name: "actorId", description: "Actor ID" })
  @ApiResponse({
    status: 201,
    description: "비활성화된 legacy operator actor",
    schema: characterChatObjectOpenApiSchema,
  })
  disableActor(@Param("actorId", ParseUUIDPipe) actorId: string) {
    return this.actorService.disableActor(actorId);
  }

  @Get("actors")
  @ApiOperation({ summary: "프로젝트 legacy operator actor 목록 조회" })
  @ApiQuery({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({
    status: 200,
    description: "프로젝트 legacy operator actor 목록",
    schema: characterChatObjectListOpenApiSchema,
  })
  listActors(@Query("projectId", ParseUUIDPipe) projectId: string) {
    return this.actorService.listActors(projectId);
  }

  @Post("chat-list/hide")
  @ApiOperation({ summary: "Legacy operator chat 목록 항목 숨김" })
  @ApiResponse({
    status: 201,
    description: "Legacy operator chat 목록 preference",
    schema: characterChatObjectOpenApiSchema,
  })
  hideChatListItem(@CurrentUser() user: User, @Body() dto: HideCharacterChatListItemDto) {
    return this.threadService.hideChatItem({ ...dto, userId: user.id });
  }

  @Post("chat-list/show")
  @ApiOperation({ summary: "Legacy operator chat 목록 항목 표시" })
  @ApiResponse({ status: 201, description: "Legacy operator chat 목록 항목 표시 완료" })
  showChatListItem(@CurrentUser() user: User, @Body() dto: ShowCharacterChatListItemDto) {
    return this.threadService.showChatItem({ userId: user.id, actorId: dto.actorId });
  }

  @Get("chat-list/hidden-actor-ids")
  @ApiOperation({ summary: "숨긴 legacy operator actor ID 목록 조회" })
  @ApiQuery({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({
    status: 200,
    description: "숨긴 legacy operator actor ID 목록",
    schema: hiddenActorIdsOpenApiSchema,
  })
  async hiddenActorIds(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
  ) {
    const actorIds = await this.threadService.getHiddenActorIds(user.id, projectId);
    return { actorIds };
  }

  @Put("chat-list/last-opened")
  @ApiOperation({ summary: "마지막으로 연 legacy operator chat thread 저장" })
  @ApiResponse({ status: 200, description: "마지막으로 연 thread 저장 완료" })
  setLastOpenedThread(@CurrentUser() user: User, @Body() dto: SetCharacterChatLastOpenedDto) {
    return this.threadService.setLastOpenedThread({ ...dto, userId: user.id });
  }

  @Get("chat-list/last-opened")
  @ApiOperation({ summary: "마지막으로 연 legacy operator chat thread 조회" })
  @ApiQuery({ name: "actorId", description: "Actor ID" })
  @ApiResponse({
    status: 200,
    description: "마지막으로 연 thread ID",
    schema: lastOpenedThreadOpenApiSchema,
  })
  async getLastOpenedThread(
    @CurrentUser() user: User,
    @Query("actorId", ParseUUIDPipe) actorId: string,
  ) {
    const threadId = await this.threadService.getLastOpenedThread(user.id, actorId);
    return { threadId };
  }

  @Get("threads")
  @ApiOperation({ summary: "Legacy operator chat thread 목록 조회" })
  @ApiQuery({ name: "projectId", description: "프로젝트 ID" })
  @ApiQuery({ name: "characterId", description: "호환 저장소의 캐릭터 ID" })
  @ApiResponse({
    status: 200,
    description: "Legacy operator chat thread 목록",
    schema: characterChatObjectListOpenApiSchema,
  })
  listThreads(
    @CurrentUser() user: User,
    @Query("projectId", ParseUUIDPipe) projectId: string,
    @Query("characterId", ParseUUIDPipe) characterId: string,
  ) {
    return this.threadService.listThreads(projectId, characterId, user.id);
  }

  @Post("threads")
  @ApiOperation({ summary: "Legacy operator chat thread 생성" })
  @ApiResponse({
    status: 201,
    description: "생성된 legacy operator chat thread",
    schema: characterChatObjectOpenApiSchema,
  })
  createThread(@CurrentUser() user: User, @Body() dto: CreateCharacterChatThreadDto) {
    return this.threadService.createThread({ ...dto, userId: user.id });
  }

  @Get("threads/:threadId/messages")
  @ApiOperation({ summary: "Legacy operator chat 메시지 목록 조회" })
  @ApiParam({ name: "threadId", description: "Thread ID" })
  @ApiResponse({
    status: 200,
    description: "Legacy operator chat 메시지 목록",
    schema: characterChatObjectListOpenApiSchema,
  })
  listMessages(@CurrentUser() user: User, @Param("threadId", ParseUUIDPipe) threadId: string) {
    return this.threadService.listMessages(threadId, user.id);
  }

  @Post("chat-sessions")
  @ApiOperation({ summary: "Legacy operator chat 세션 생성" })
  @ApiResponse({
    status: 201,
    description: "Legacy operator chat 세션 생성 결과",
    schema: chatSessionOpenApiSchema,
  })
  createChatSession(@CurrentUser() user: User, @Body() dto: CreateCharacterChatSessionDto) {
    return this.threadService.createChatSession({ ...dto, userId: user.id });
  }
}
