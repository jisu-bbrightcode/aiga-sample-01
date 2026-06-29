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

@ApiTags("Operator Chat")
@Controller("operator-chat")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class OperatorChatController {
  constructor(
    private readonly actorService: ActorService,
    private readonly threadService: ThreadService,
  ) {}

  @Post("actors/prepare")
  @ApiOperation({ summary: "운영 오퍼레이터 준비/재활성화" })
  @ApiResponse({
    status: 201,
    description: "준비된 operator actor",
    schema: characterChatObjectOpenApiSchema,
  })
  prepareActor(@CurrentUser() user: User, @Body() dto: PrepareCharacterActorDto) {
    return this.actorService.prepareActor({ ...dto, userId: user.id });
  }

  @Get("actors/by-character/:characterId")
  @ApiOperation({ summary: "캐릭터 기반 오퍼레이터 조회" })
  @ApiParam({ name: "characterId", description: "캐릭터 ID" })
  @ApiResponse({
    status: 200,
    description: "오퍼레이터 actor. 없으면 null",
    schema: nullableCharacterChatObjectOpenApiSchema,
  })
  getActorByCharacter(@Param("characterId", ParseUUIDPipe) characterId: string) {
    return this.actorService.getActorByCharacter(characterId);
  }

  @Post("actors/:actorId/disable")
  @ApiOperation({ summary: "운영 오퍼레이터 비활성화" })
  @ApiParam({ name: "actorId", description: "Actor ID" })
  @ApiResponse({
    status: 201,
    description: "비활성화된 operator actor",
    schema: characterChatObjectOpenApiSchema,
  })
  disableActor(@Param("actorId", ParseUUIDPipe) actorId: string) {
    return this.actorService.disableActor(actorId);
  }

  @Get("actors")
  @ApiOperation({ summary: "프로젝트 오퍼레이터 목록 조회" })
  @ApiQuery({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({
    status: 200,
    description: "프로젝트 오퍼레이터 목록",
    schema: characterChatObjectListOpenApiSchema,
  })
  listActors(@Query("projectId", ParseUUIDPipe) projectId: string) {
    return this.actorService.listActors(projectId);
  }

  @Post("chat-list/hide")
  @ApiOperation({ summary: "오퍼레이터 챗 목록 항목 숨김" })
  @ApiResponse({
    status: 201,
    description: "오퍼레이터 챗 목록 preference",
    schema: characterChatObjectOpenApiSchema,
  })
  hideChatListItem(@CurrentUser() user: User, @Body() dto: HideCharacterChatListItemDto) {
    return this.threadService.hideChatItem({ ...dto, userId: user.id });
  }

  @Post("chat-list/show")
  @ApiOperation({ summary: "오퍼레이터 챗 목록 항목 표시" })
  @ApiResponse({ status: 201, description: "오퍼레이터 챗 목록 항목 표시 완료" })
  showChatListItem(@CurrentUser() user: User, @Body() dto: ShowCharacterChatListItemDto) {
    return this.threadService.showChatItem({ userId: user.id, actorId: dto.actorId });
  }

  @Get("chat-list/hidden-actor-ids")
  @ApiOperation({ summary: "숨긴 오퍼레이터 actor ID 목록 조회" })
  @ApiQuery({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({
    status: 200,
    description: "숨긴 operator actor ID 목록",
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
  @ApiOperation({ summary: "마지막으로 연 오퍼레이터 챗 thread 저장" })
  @ApiResponse({ status: 200, description: "마지막으로 연 thread 저장 완료" })
  setLastOpenedThread(@CurrentUser() user: User, @Body() dto: SetCharacterChatLastOpenedDto) {
    return this.threadService.setLastOpenedThread({ ...dto, userId: user.id });
  }

  @Get("chat-list/last-opened")
  @ApiOperation({ summary: "마지막으로 연 오퍼레이터 챗 thread 조회" })
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
  @ApiOperation({ summary: "오퍼레이터 챗 thread 목록 조회" })
  @ApiQuery({ name: "projectId", description: "프로젝트 ID" })
  @ApiQuery({ name: "characterId", description: "현재 호환 저장소의 캐릭터 ID" })
  @ApiResponse({
    status: 200,
    description: "오퍼레이터 챗 thread 목록",
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
  @ApiOperation({ summary: "오퍼레이터 챗 thread 생성" })
  @ApiResponse({
    status: 201,
    description: "생성된 오퍼레이터 챗 thread",
    schema: characterChatObjectOpenApiSchema,
  })
  createThread(@CurrentUser() user: User, @Body() dto: CreateCharacterChatThreadDto) {
    return this.threadService.createThread({ ...dto, userId: user.id });
  }

  @Get("threads/:threadId/messages")
  @ApiOperation({ summary: "오퍼레이터 챗 메시지 목록 조회" })
  @ApiParam({ name: "threadId", description: "Thread ID" })
  @ApiResponse({
    status: 200,
    description: "오퍼레이터 챗 메시지 목록",
    schema: characterChatObjectListOpenApiSchema,
  })
  listMessages(@CurrentUser() user: User, @Param("threadId", ParseUUIDPipe) threadId: string) {
    return this.threadService.listMessages(threadId, user.id);
  }

  @Post("chat-sessions")
  @ApiOperation({ summary: "오퍼레이터 챗 세션 생성" })
  @ApiResponse({
    status: 201,
    description: "오퍼레이터 챗 세션 생성 결과",
    schema: chatSessionOpenApiSchema,
  })
  createChatSession(@CurrentUser() user: User, @Body() dto: CreateCharacterChatSessionDto) {
    return this.threadService.createChatSession({ ...dto, userId: user.id });
  }
}
