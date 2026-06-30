/**
 * Community REST Controller
 *
 * 커뮤니티, 게시글, 댓글, 투표, 피드, 모더레이션 공개/인증 엔드포인트
 */

import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import type {
  BanUserDto,
  CastPollVoteDto,
  CreateCommentDto,
  CreateCommunityDto,
  CreateFlairDto,
  CreatePostDto,
  CreateReportDto,
  CreateRuleDto,
  InviteModeratorDto,
  RemoveVoteDto,
  ResolveReportDto,
  UpdateCommunityDto,
  UpdatePostDto,
  VoteDto,
} from "../dto";
import {
  BanResponseDto,
  CommunityCommentListResponseDto,
  CommunityCommentResponseDto,
  CommunityListResponseDto,
  CommunityResponseDto,
  DeleteResponseDto,
  FeedResponseDto,
  FlairResponseDto,
  KarmaResponseDto,
  MemberListResponseDto,
  MembershipResponseDto,
  ModeratorResponseDto,
  ModLogListResponseDto,
  ModQueueResponseDto,
  PostResponseDto,
  PublicPostListResponseDto,
  ReportResponseDto,
  RuleResponseDto,
  VoteResultResponseDto,
} from "../dto";
import { OptionalUser } from "../optional-user.decorator";
import {
  CommunityBlockService,
  CommunityCommentService,
  CommunityFeedService,
  CommunityKarmaService,
  CommunityModerationService,
  CommunityPollService,
  CommunityPostService,
  CommunityService,
  CommunityVoteService,
} from "../service";
import {
  DEFAULT_POST_LIST_LIMIT,
  normalizePostListLimit,
  POST_SORTS,
  parsePostSort,
} from "../service/post-list-options";
import { publicPostViewerState, toPublicPostListItem } from "../mappers";

@ApiTags("Community")
@Controller("community")
export class CommunityController {
  // biome-ignore lint/complexity/useMaxParams: NestJS controller receives explicitly injected providers.
  constructor(
    private readonly communityService: CommunityService,
    private readonly postService: CommunityPostService,
    private readonly commentService: CommunityCommentService,
    private readonly voteService: CommunityVoteService,
    private readonly pollService: CommunityPollService,
    private readonly karmaService: CommunityKarmaService,
    private readonly moderationService: CommunityModerationService,
    private readonly feedService: CommunityFeedService,
    private readonly blockService: CommunityBlockService,
  ) {}

  // ==========================================================================
  // 커뮤니티 — Public
  // ==========================================================================

  @Get()
  @ApiOperation({ summary: "커뮤니티 목록 조회" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "type", required: false, enum: ["public", "restricted", "private"] })
  @ApiQuery({ name: "sort", required: false, enum: ["newest", "popular", "name"] })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "커뮤니티 목록 반환", type: CommunityListResponseDto })
  async list(
    @OptionalUser() user: User | undefined,
    @Query("search") search?: string,
    @Query("type") type?: "public" | "restricted" | "private",
    @Query("sort") sort: "newest" | "popular" | "name" = "newest",
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.communityService.findAllForViewer({ search, type, sort, cursor, limit }, user?.id);
  }

  @Get("popular")
  @ApiOperation({ summary: "인기 커뮤니티 조회" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "인기 커뮤니티 목록 반환",
    type: CommunityResponseDto,
    isArray: true,
  })
  async popular(
    @OptionalUser() user: User | undefined,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.communityService.findPopularForViewer(limit, user?.id);
  }

  @Get("karma")
  @ApiOperation({ summary: "사용자 카르마 조회" })
  @ApiQuery({ name: "userId", required: true, type: String })
  @ApiResponse({ status: 200, description: "사용자 카르마 반환", type: KarmaResponseDto })
  async karma(@Query("userId") userId: string) {
    return this.karmaService.getKarma(userId);
  }

  @Get("karma/batch")
  @ApiOperation({ summary: "사용자 카르마 배치 조회" })
  @ApiQuery({
    name: "userIds",
    required: true,
    type: String,
    description: "쉼표로 구분된 userId 목록",
  })
  @ApiResponse({
    status: 200,
    description: "사용자 카르마 목록 반환",
    type: KarmaResponseDto,
    isArray: true,
  })
  async batchKarma(@Query("userIds") userIds: string) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const parsedUserIds = [
      ...new Set(
        userIds
          .split(",")
          .map((id) => id.trim())
          .filter((id) => UUID_REGEX.test(id)),
      ),
    ].slice(0, 50);

    if (parsedUserIds.length === 0) {
      return [];
    }
    return this.karmaService.getBatchKarma(parsedUserIds);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Slug로 커뮤니티 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiResponse({ status: 200, description: "커뮤니티 상세 정보", type: CommunityResponseDto })
  @ApiResponse({ status: 404, description: "커뮤니티를 찾을 수 없음" })
  async bySlug(@Param("slug") slug: string, @OptionalUser() user: User | undefined) {
    const community = await this.communityService.findBySlugForViewer(slug, user?.id);
    if (!community) throw new NotFoundException("커뮤니티를 찾을 수 없음");
    return community;
  }

  @Get(":slug/members")
  @ApiOperation({ summary: "커뮤니티 멤버 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "멤버 목록 반환", type: MemberListResponseDto })
  async members(
    @Param("slug") slug: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.communityService.getMembers(slug, { page, limit });
  }

  @Get(":slug/moderators")
  @ApiOperation({ summary: "모더레이터 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiResponse({
    status: 200,
    description: "모더레이터 목록 반환",
    type: ModeratorResponseDto,
    isArray: true,
  })
  async moderators(@Param("slug") slug: string) {
    return this.communityService.getModerators(slug);
  }

  // ==========================================================================
  // 커뮤니티 — Auth
  // ==========================================================================

  @Post()
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 생성" })
  @ApiResponse({ status: 201, description: "커뮤니티 생성 성공", type: CommunityResponseDto })
  @ApiResponse({ status: 409, description: "슬러그 중복" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "slug", "description"],
      properties: {
        name: { type: "string", minLength: 3, maxLength: 100, description: "커뮤니티 이름" },
        slug: {
          type: "string",
          minLength: 3,
          maxLength: 50,
          pattern: "^[a-z0-9-]+$",
          description: "URL 슬러그",
        },
        description: {
          type: "string",
          minLength: 10,
          maxLength: 5000,
          description: "커뮤니티 설명",
        },
        iconUrl: { type: "string", format: "uri", description: "아이콘 URL" },
        bannerUrl: { type: "string", format: "uri", description: "배너 URL" },
        type: {
          type: "string",
          enum: ["public", "restricted", "private"],
          default: "public",
          description: "커뮤니티 유형",
        },
        isNsfw: { type: "boolean", default: false, description: "NSFW 여부" },
        allowImages: { type: "boolean", default: true },
        allowVideos: { type: "boolean", default: true },
        allowPolls: { type: "boolean", default: true },
        allowCrosspost: { type: "boolean", default: true },
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, description: { type: "string" } },
          },
          description: "커뮤니티 규칙",
        },
      },
    },
  })
  async create(@Body() dto: CreateCommunityDto, @CurrentUser() user: User) {
    return this.communityService.create(dto, user.id);
  }

  @Put(":slug")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 수정" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiResponse({ status: 200, description: "커뮤니티 수정 성공", type: CommunityResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "커뮤니티 이름" },
        description: { type: "string", description: "커뮤니티 설명" },
        iconUrl: { type: "string", format: "uri" },
        bannerUrl: { type: "string", format: "uri" },
        type: { type: "string", enum: ["public", "restricted", "private"] },
        isNsfw: { type: "boolean" },
        automodConfig: {
          type: "object",
          properties: {
            enableSpamFilter: { type: "boolean" },
            enableKeywordFilter: { type: "boolean" },
            minKarmaToPost: { type: "integer" },
            minAccountAge: { type: "integer" },
          },
        },
        bannedWords: { type: "array", items: { type: "string" } },
      },
    },
  })
  async update(
    @Param("slug") slug: string,
    @Body() dto: UpdateCommunityDto,
    @CurrentUser() user: User,
  ) {
    return this.communityService.update(slug, dto, user.id);
  }

  @Delete(":slug")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 삭제" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiResponse({ status: 200, description: "커뮤니티 삭제 성공", type: DeleteResponseDto })
  async delete(@Param("slug") slug: string, @CurrentUser() user: User) {
    await this.communityService.delete(slug, user.id);
    return { success: true };
  }

  @Get("me/membership/:slug")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "현재 사용자의 멤버십 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiExtraModels(MembershipResponseDto)
  @ApiResponse({
    status: 200,
    description: "멤버십 정보 반환 또는 없음",
    schema: {
      nullable: true,
      allOf: [{ $ref: getSchemaPath(MembershipResponseDto) }],
    },
  })
  async myMembership(@Param("slug") slug: string, @CurrentUser() user: User) {
    const community = await this.communityService.findBySlug(slug);
    if (!community) return null;
    return this.communityService.getMembership(community.id, user.id);
  }

  @Post(":slug/join")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 가입" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiResponse({ status: 200, description: "가입 성공", type: MembershipResponseDto })
  async join(@Param("slug") slug: string, @CurrentUser() user: User) {
    return this.communityService.join(slug, user.id);
  }

  @Post(":slug/leave")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 탈퇴" })
  @ApiParam({ name: "slug", description: "커뮤니티 슬러그" })
  @ApiResponse({ status: 200, description: "탈퇴 성공", type: DeleteResponseDto })
  async leave(@Param("slug") slug: string, @CurrentUser() user: User) {
    await this.communityService.leave(slug, user.id);
    return { success: true };
  }

  @Get("me/subscriptions")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "내 구독 커뮤니티 목록" })
  @ApiResponse({
    status: 200,
    description: "구독 커뮤니티 목록 반환",
    type: CommunityResponseDto,
    isArray: true,
  })
  async mySubscriptions(@CurrentUser() user: User) {
    return this.communityService.findUserSubscriptions(user.id);
  }

  // ==========================================================================
  // 게시글 — Public
  // ==========================================================================

  @Get("posts")
  @ApiOperation({
    summary: "게시물 목록 조회",
    description:
      "공개/로그인 게시글 피드. status='published' 만 노출되고(숨김/제거/삭제 제외), " +
      "로그인 시 차단한 작성자의 글이 제외된다. 모더레이션 내부필드는 반환하지 않는다.",
  })
  @ApiQuery({ name: "communitySlug", required: false, type: String })
  @ApiQuery({ name: "communityId", required: false, type: String })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: POST_SORTS,
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "제목/본문 부분일치 검색",
  })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "게시물 목록 반환", type: PublicPostListResponseDto })
  async postList(
    @OptionalUser() user?: User,
    @Query("communitySlug") communitySlug?: string,
    @Query("communityId") communityId?: string,
    @Query("sort") sort?: string,
    @Query("search") search?: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(DEFAULT_POST_LIST_LIMIT), ParseIntPipe) limit?: number,
  ) {
    if (communitySlug && communityId) {
      throw new BadRequestException("communitySlug와 communityId는 동시에 사용할 수 없습니다.");
    }

    // 로그인 사용자는 차단(양방향) 작성자의 글을 피드에서 제외한다 (AC#1).
    const blockedUserIds = user ? await this.blockService.getBlockedUserIds(user.id) : undefined;

    const page = await this.postService.findAll({
      communitySlug,
      communityId,
      sort: parsePostSort(sort),
      search,
      cursor,
      limit: normalizePostListLimit(limit),
      blockedUserIds,
    });

    return {
      items: page.items.map(toPublicPostListItem),
      nextCursor: page.nextCursor,
      viewer: publicPostViewerState(Boolean(user)),
    };
  }

  @Get("posts/:id")
  @ApiOperation({ summary: "게시물 상세 조회" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "게시물 상세 정보", type: PostResponseDto })
  @ApiResponse({ status: 404, description: "게시물을 찾을 수 없음" })
  async postById(@Param("id", ParseUUIDPipe) id: string) {
    const post = await this.postService.findById(id);
    if (!post) throw new NotFoundException("게시물을 찾을 수 없음");
    return post;
  }

  @Get("posts/:id/comments")
  @ApiOperation({ summary: "게시물의 댓글 조회" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiQuery({ name: "sort", required: false, enum: ["old", "new"] })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "댓글 목록 반환",
    type: CommunityCommentListResponseDto,
  })
  async postComments(
    @Param("id", ParseUUIDPipe) postId: string,
    @Query("sort") sort: "old" | "new" = "old",
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.commentService.findByPost({ postId, sort, cursor, limit });
  }

  // ==========================================================================
  // 게시글 — Auth
  // ==========================================================================

  @Post("posts")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 생성" })
  @ApiResponse({ status: 201, description: "게시물 생성 성공", type: PostResponseDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "커뮤니티 미가입 또는 금지어 차단" })
  @ApiResponse({ status: 429, description: "작성 레이트 리밋 초과" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "title", "type"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        title: { type: "string", maxLength: 300, description: "게시물 제목" },
        type: {
          type: "string",
          enum: ["text", "link", "image", "video", "poll"],
          description: "게시물 유형",
        },
        content: { type: "string", description: "텍스트 내용" },
        linkUrl: { type: "string", format: "uri", description: "링크 URL" },
        mediaUrls: {
          type: "array",
          items: { type: "string", format: "uri" },
          description: "미디어 URL",
        },
        pollData: {
          type: "object",
          properties: {
            options: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, text: { type: "string" } },
              },
            },
            multipleChoice: { type: "boolean" },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
        flairId: { type: "string", format: "uuid" },
        isNsfw: { type: "boolean", default: false },
        isSpoiler: { type: "boolean", default: false },
        isOc: { type: "boolean", default: false },
      },
    },
  })
  async createPost(@Body() dto: CreatePostDto, @CurrentUser() user: User) {
    return this.postService.create(dto, user.id);
  }

  @Put("posts/:id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 수정" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "게시물 수정 성공", type: PostResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 300, description: "게시물 제목" },
        content: { type: "string", description: "텍스트 내용" },
        isNsfw: { type: "boolean" },
        isSpoiler: { type: "boolean" },
        flairId: { type: "string", format: "uuid", nullable: true },
      },
    },
  })
  async updatePost(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: User,
  ) {
    return this.postService.update(id, dto, user.id);
  }

  @Delete("posts/:id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 삭제" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "게시물 삭제 성공", type: DeleteResponseDto })
  async deletePost(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.postService.delete(id, user.id);
    return { success: true };
  }

  @Post("posts/:id/pin")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 고정 (모더레이터)" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "게시물 고정 토글 완료", type: PostResponseDto })
  async pinPost(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postService.pin(id, user.id);
  }

  @Post("posts/:id/lock")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 잠금 (모더레이터)" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "게시물 잠금 토글 완료", type: PostResponseDto })
  async lockPost(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.postService.lock(id, user.id);
  }

  @Post("posts/:id/remove")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 제거 (모더레이터)" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "게시물 제거 완료", type: PostResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason"],
      properties: { reason: { type: "string", description: "제거 사유" } },
    },
  })
  async removePost(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.postService.remove(id, dto.reason, user.id);
  }

  @Post("posts/:id/crosspost")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "교차 게시" })
  @ApiParam({ name: "id", description: "원본 게시물 ID" })
  @ApiResponse({ status: 201, description: "교차 게시 성공", type: PostResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["targetCommunityId"],
      properties: {
        targetCommunityId: { type: "string", format: "uuid", description: "대상 커뮤니티 ID" },
      },
    },
  })
  async crosspost(
    @Param("id", ParseUUIDPipe) postId: string,
    @Body() dto: { targetCommunityId: string },
    @CurrentUser() user: User,
  ) {
    return this.postService.crosspost(postId, dto.targetCommunityId, user.id);
  }

  // ==========================================================================
  // 댓글 — Auth
  // ==========================================================================

  @Post("comments")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 생성" })
  @ApiResponse({ status: 201, description: "댓글 생성 성공", type: CommunityCommentResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["postId", "content"],
      properties: {
        postId: { type: "string", format: "uuid", description: "게시물 ID" },
        content: { type: "string", minLength: 1, maxLength: 10000, description: "댓글 내용" },
        parentId: { type: "string", format: "uuid", description: "부모 댓글 ID (답글)" },
      },
    },
  })
  async createComment(@Body() dto: CreateCommentDto, @CurrentUser() user: User) {
    return this.commentService.create(dto, user.id);
  }

  @Put("comments/:id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 수정" })
  @ApiParam({ name: "id", description: "댓글 ID" })
  @ApiResponse({ status: 200, description: "댓글 수정 성공", type: CommunityCommentResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["content"],
      properties: { content: { type: "string", description: "댓글 내용" } },
    },
  })
  async updateComment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { content: string },
    @CurrentUser() user: User,
  ) {
    return this.commentService.update(id, dto.content, user.id);
  }

  @Delete("comments/:id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 삭제" })
  @ApiParam({ name: "id", description: "댓글 ID" })
  @ApiResponse({ status: 200, description: "댓글 삭제 성공", type: DeleteResponseDto })
  async deleteComment(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    await this.commentService.delete(id, user.id);
    return { success: true };
  }

  @Post("comments/:id/remove")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 제거 (모더레이터)" })
  @ApiParam({ name: "id", description: "댓글 ID" })
  @ApiResponse({ status: 200, description: "댓글 제거 완료", type: CommunityCommentResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["reason"],
      properties: { reason: { type: "string", description: "제거 사유" } },
    },
  })
  async removeComment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.commentService.remove(id, dto.reason, user.id);
  }

  @Post("comments/:id/sticky")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 고정 (모더레이터)" })
  @ApiParam({ name: "id", description: "댓글 ID" })
  @ApiResponse({
    status: 200,
    description: "댓글 고정 토글 완료",
    type: CommunityCommentResponseDto,
  })
  async stickyComment(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.commentService.sticky(id, user.id);
  }

  @Post("comments/:id/distinguish")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "모더레이터 표시 토글" })
  @ApiParam({ name: "id", description: "댓글 ID" })
  @ApiResponse({
    status: 200,
    description: "모더레이터 표시 토글 완료",
    type: CommunityCommentResponseDto,
  })
  async distinguishComment(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.commentService.distinguish(id, user.id);
  }

  // ==========================================================================
  // 투표 — Auth
  // ==========================================================================

  @Post("votes")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "투표하기" })
  @ApiResponse({ status: 200, description: "투표 성공", type: VoteResultResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["targetType", "targetId", "vote"],
      properties: {
        targetType: { type: "string", enum: ["post", "comment"], description: "투표 대상 유형" },
        targetId: { type: "string", format: "uuid", description: "투표 대상 ID" },
        vote: { type: "integer", enum: [1, -1], description: "1=upvote, -1=downvote" },
      },
    },
  })
  async castVote(@Body() dto: VoteDto, @CurrentUser() user: User) {
    return this.voteService.vote(dto, user.id);
  }

  @Delete("votes")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "투표 취소" })
  @ApiResponse({ status: 200, description: "투표 취소 성공", type: VoteResultResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["targetType", "targetId"],
      properties: {
        targetType: { type: "string", enum: ["post", "comment"], description: "투표 대상 유형" },
        targetId: { type: "string", format: "uuid", description: "투표 대상 ID" },
      },
    },
  })
  async removeVote(@Body() dto: RemoveVoteDto, @CurrentUser() user: User) {
    return this.voteService.removeVote(dto, user.id);
  }

  // ==========================================================================
  // 게시글 투표(Poll) — Public 조회 / Auth cast·remove
  // ==========================================================================

  @Get("posts/:id/poll")
  @ApiOperation({ summary: "게시글 투표 결과 조회" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "투표 결과 반환" })
  @ApiResponse({ status: 400, description: "투표 게시글이 아님" })
  @ApiResponse({ status: 404, description: "게시글 없음" })
  async getPoll(
    @Param("id", ParseUUIDPipe) id: string,
    @OptionalUser() user: User | undefined,
  ) {
    return this.pollService.getPoll(id, user?.id);
  }

  @Post("posts/:id/poll/votes")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시글 투표하기 (cast)" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 201, description: "투표 성공, 결과 반환" })
  @ApiResponse({ status: 400, description: "투표 게시글 아님 / 선택지 오류" })
  @ApiResponse({ status: 403, description: "미가입·차단·잠금" })
  @ApiResponse({ status: 404, description: "게시글 없음" })
  @ApiResponse({ status: 409, description: "중복 투표 또는 종료된 투표" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["optionIds"],
      properties: {
        optionIds: {
          type: "array",
          items: { type: "string" },
          description: "선택한 투표 항목 ID (단일 선택은 1개)",
        },
      },
    },
  })
  async castPollVote(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CastPollVoteDto,
    @CurrentUser() user: User,
  ) {
    return this.pollService.castVote(id, user.id, dto?.optionIds ?? []);
  }

  @Delete("posts/:id/poll/votes")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시글 투표 취소 (remove)" })
  @ApiParam({ name: "id", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "투표 취소 성공, 결과 반환" })
  @ApiResponse({ status: 404, description: "게시글 없음" })
  @ApiResponse({ status: 409, description: "종료된 투표" })
  async removePollVote(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.pollService.removeVote(id, user.id);
  }

  // ==========================================================================
  // 피드 — Public/Auth
  // ==========================================================================

  @Get("feed/all")
  @ApiOperation({ summary: "전체 피드 (모든 공개 커뮤니티)" })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["hot", "new", "top", "rising", "controversial"],
  })
  @ApiQuery({
    name: "timeFilter",
    required: false,
    enum: ["hour", "day", "week", "month", "year", "all"],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "전체 피드 반환", type: FeedResponseDto })
  async feedAll(
    @Query("sort") sort: "hot" | "new" | "top" | "rising" | "controversial" = "hot",
    @Query("timeFilter") timeFilter: "hour" | "day" | "week" | "month" | "year" | "all" = "day",
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.feedService.getAllFeed({ sort, timeFilter, page, limit });
  }

  @Get("feed/popular")
  @ApiOperation({ summary: "인기 피드" })
  @ApiQuery({
    name: "timeFilter",
    required: false,
    enum: ["hour", "day", "week", "month", "year", "all"],
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "인기 피드 반환", type: PostResponseDto, isArray: true })
  async feedPopular(
    @Query("timeFilter") timeFilter: "hour" | "day" | "week" | "month" | "year" | "all" = "day",
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.feedService.getPopularFeed({ timeFilter, limit });
  }

  @Get("feed/home")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "홈 피드 (구독 커뮤니티)" })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["hot", "new", "top", "rising", "controversial"],
  })
  @ApiQuery({
    name: "timeFilter",
    required: false,
    enum: ["hour", "day", "week", "month", "year", "all"],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "홈 피드 반환", type: FeedResponseDto })
  async feedHome(
    @CurrentUser() user: User,
    @Query("sort") sort: "hot" | "new" | "top" | "rising" | "controversial" = "hot",
    @Query("timeFilter") timeFilter: "hour" | "day" | "week" | "month" | "year" | "all" = "day",
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    const blockedUserIds = await this.blockService.getBlockedUserIds(user.id);
    return this.feedService.getHomeFeed(user.id, {
      sort,
      timeFilter,
      page,
      limit,
      blockedUserIds,
    });
  }

  // ==========================================================================
  // 모더레이션 — Auth
  // ==========================================================================

  @Post("reports")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "신고 생성" })
  @ApiResponse({ status: 201, description: "신고 생성 성공", type: ReportResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "targetType", "targetId", "reason"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        targetType: {
          type: "string",
          enum: ["post", "comment", "user"],
          description: "신고 대상 유형",
        },
        targetId: { type: "string", format: "uuid", description: "신고 대상 ID" },
        reason: {
          type: "string",
          enum: [
            "spam",
            "harassment",
            "hate_speech",
            "misinformation",
            "nsfw",
            "violence",
            "copyright",
            "other",
          ],
          description: "신고 사유",
        },
        ruleViolated: { type: "integer", description: "위반 규칙 번호" },
        description: { type: "string", maxLength: 1000, description: "상세 설명" },
      },
    },
  })
  async createReport(@Body() dto: CreateReportDto, @CurrentUser() user: User) {
    return this.moderationService.createReport(dto, user.id);
  }

  @Get("moderation/:communityId/queue")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mod Queue 조회" })
  @ApiParam({ name: "communityId", description: "커뮤니티 ID" })
  @ApiResponse({ status: 200, description: "Mod Queue 반환", type: ModQueueResponseDto })
  async modQueue(@Param("communityId", ParseUUIDPipe) communityId: string) {
    return this.moderationService.getModQueue(communityId);
  }

  @Get("moderation/:communityId/reports")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "신고 목록 조회" })
  @ApiParam({ name: "communityId", description: "커뮤니티 ID" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["pending", "reviewing", "resolved", "dismissed"],
  })
  @ApiResponse({
    status: 200,
    description: "신고 목록 반환",
    type: ReportResponseDto,
    isArray: true,
  })
  async reports(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Query("status") status?: "pending" | "reviewing" | "resolved" | "dismissed",
  ) {
    return this.moderationService.getReports(communityId, status);
  }

  @Post("moderation/reports/resolve")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "신고 처리" })
  @ApiResponse({ status: 200, description: "신고 처리 완료", type: ReportResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["reportId", "action"],
      properties: {
        reportId: { type: "string", format: "uuid", description: "신고 ID" },
        action: {
          type: "string",
          enum: ["removed", "banned", "warned", "dismissed"],
          description: "처리 조치",
        },
        reason: { type: "string", maxLength: 1000, description: "처리 사유" },
      },
    },
  })
  async resolveReport(@Body() dto: ResolveReportDto, @CurrentUser() user: User) {
    return this.moderationService.resolveReport(dto, user.id);
  }

  @Post("moderation/ban")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "사용자 밴" })
  @ApiResponse({ status: 200, description: "사용자 밴 성공", type: BanResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "userId", "reason"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        userId: { type: "string", format: "uuid", description: "사용자 ID" },
        reason: { type: "string", maxLength: 1000, description: "밴 사유" },
        note: { type: "string", maxLength: 1000, description: "모더레이터 메모" },
        isPermanent: { type: "boolean", default: true, description: "영구 밴 여부" },
        durationDays: { type: "integer", minimum: 1, description: "밴 기간 (일)" },
      },
    },
  })
  async banUser(@Body() dto: BanUserDto, @CurrentUser() user: User) {
    return this.moderationService.banUser(dto, user.id);
  }

  @Post("moderation/unban")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "밴 해제" })
  @ApiResponse({ status: 200, description: "밴 해제 성공", type: DeleteResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "userId"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        userId: { type: "string", format: "uuid", description: "사용자 ID" },
      },
    },
  })
  async unbanUser(@Body() dto: { communityId: string; userId: string }, @CurrentUser() user: User) {
    await this.moderationService.unbanUser(dto.communityId, dto.userId, user.id);
    return { success: true };
  }

  @Get("moderation/:communityId/banned")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "밴된 사용자 목록" })
  @ApiParam({ name: "communityId", description: "커뮤니티 ID" })
  @ApiResponse({
    status: 200,
    description: "밴된 사용자 목록 반환",
    type: BanResponseDto,
    isArray: true,
  })
  async bannedUsers(@Param("communityId", ParseUUIDPipe) communityId: string) {
    return this.moderationService.getBannedUsers(communityId);
  }

  @Post("moderation/rules")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "규칙 생성" })
  @ApiResponse({ status: 201, description: "규칙 생성 성공", type: RuleResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "title", "description"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        title: { type: "string", maxLength: 100, description: "규칙 제목" },
        description: { type: "string", maxLength: 500, description: "규칙 설명" },
        appliesTo: {
          type: "string",
          enum: ["posts", "comments", "both"],
          default: "both",
          description: "적용 대상",
        },
        violationAction: {
          type: "string",
          enum: ["flag", "remove", "warn"],
          description: "위반 시 조치",
        },
      },
    },
  })
  async createRule(@Body() dto: CreateRuleDto, @CurrentUser() user: User) {
    return this.moderationService.createRule(dto, user.id);
  }

  @Get("moderation/:communityId/rules")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "규칙 목록" })
  @ApiParam({ name: "communityId", description: "커뮤니티 ID" })
  @ApiResponse({ status: 200, description: "규칙 목록 반환", type: RuleResponseDto, isArray: true })
  async rules(@Param("communityId", ParseUUIDPipe) communityId: string) {
    return this.moderationService.getRules(communityId);
  }

  @Post("moderation/flairs")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "플레어 생성" })
  @ApiResponse({ status: 201, description: "플레어 생성 성공", type: FlairResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "type", "text"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        type: { type: "string", enum: ["post", "user"], description: "플레어 유형" },
        text: { type: "string", maxLength: 50, description: "플레어 텍스트" },
        color: {
          type: "string",
          pattern: "^#[0-9A-Fa-f]{6}$",
          default: "#ffffff",
          description: "텍스트 색상",
        },
        backgroundColor: {
          type: "string",
          pattern: "^#[0-9A-Fa-f]{6}$",
          default: "#0079d3",
          description: "배경 색상",
        },
        modOnly: { type: "boolean", default: false, description: "모더레이터 전용" },
      },
    },
  })
  async createFlair(@Body() dto: CreateFlairDto, @CurrentUser() user: User) {
    return this.moderationService.createFlair(dto, user.id);
  }

  @Get("moderation/:communityId/flairs")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "플레어 목록" })
  @ApiParam({ name: "communityId", description: "커뮤니티 ID" })
  @ApiQuery({ name: "type", required: false, enum: ["post", "user"] })
  @ApiResponse({
    status: 200,
    description: "플레어 목록 반환",
    type: FlairResponseDto,
    isArray: true,
  })
  async flairs(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Query("type") type?: "post" | "user",
  ) {
    return this.moderationService.getFlairs(communityId, type);
  }

  @Post("moderation/moderators/invite")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "모더레이터 초대" })
  @ApiResponse({ status: 200, description: "모더레이터 초대 성공", type: ModeratorResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "userId", "permissions"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        userId: { type: "string", format: "uuid", description: "사용자 ID" },
        permissions: {
          type: "object",
          properties: {
            managePosts: { type: "boolean", default: true },
            manageComments: { type: "boolean", default: true },
            manageUsers: { type: "boolean", default: true },
            manageFlairs: { type: "boolean", default: false },
            manageRules: { type: "boolean", default: false },
            manageSettings: { type: "boolean", default: false },
            manageModerators: { type: "boolean", default: false },
            viewModLog: { type: "boolean", default: true },
            viewReports: { type: "boolean", default: true },
          },
          description: "모더레이터 권한",
        },
      },
    },
  })
  async inviteModerator(@Body() dto: InviteModeratorDto, @CurrentUser() user: User) {
    return this.moderationService.inviteModerator(dto, user.id);
  }

  @Post("moderation/moderators/remove")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "모더레이터 제거" })
  @ApiResponse({ status: 200, description: "모더레이터 제거 성공", type: DeleteResponseDto })
  @ApiBody({
    schema: {
      type: "object",
      required: ["communityId", "userId"],
      properties: {
        communityId: { type: "string", format: "uuid", description: "커뮤니티 ID" },
        userId: { type: "string", format: "uuid", description: "사용자 ID" },
      },
    },
  })
  async removeModerator(
    @Body() dto: { communityId: string; userId: string },
    @CurrentUser() user: User,
  ) {
    await this.moderationService.removeModerator(dto.communityId, dto.userId, user.id);
    return { success: true };
  }

  @Get("moderation/:communityId/logs")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mod Log 조회" })
  @ApiParam({ name: "communityId", description: "커뮤니티 ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Mod Log 반환", type: ModLogListResponseDto })
  async modLogs(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.moderationService.getModLogs(communityId, page, limit);
  }
}
