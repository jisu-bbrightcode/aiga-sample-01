/**
 * Comment Feature - REST Controller
 *
 * tRPC 프로시저와 1:1 대응하는 REST 엔드포인트를 제공합니다.
 * - Public: 댓글 목록 조회, 대댓글 조회, 댓글 상세 조회, 댓글 개수 조회
 * - Auth: 댓글 생성, 댓글 수정, 댓글 삭제
 */

import { BetterAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import {
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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { CreateCommentInput, UpdateCommentInput } from "../service/comment.service";
import { CommentService } from "../service/comment.service";
import {
  CommentCountDto,
  CommentDeleteResponseDto,
  CommentResponseDto,
  CommentWithAuthorDto,
  PaginatedCommentsDto,
} from "../dto";

const COMMENT_TARGET_TYPES = ["board_post", "community_post", "blog_post", "page"] as const;
type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];

@ApiTags("Comment")
@Controller("comment")
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  // ============================================================================
  // Public Endpoints
  // ============================================================================

  /** GET /api/comment - 댓글 목록 조회 (타겟별) */
  @Get()
  @ApiOperation({ summary: "댓글 목록 조회 (타겟별)" })
  @ApiQuery({
    name: "targetType",
    required: true,
    enum: COMMENT_TARGET_TYPES,
    description: "대상 엔티티 타입",
  })
  @ApiQuery({ name: "targetId", required: true, description: "대상 엔티티 UUID" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "페이지 번호 (기본값: 1)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "페이지당 개수 (기본값: 20, 최대: 100)",
  })
  @ApiResponse({
    status: 200,
    description: "댓글 목록 반환 (페이지네이션)",
    type: PaginatedCommentsDto,
  })
  async list(
    @Query("targetType")
    targetType: CommentTargetType,
    @Query("targetId", ParseUUIDPipe) targetId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return await this.commentService.findByTarget({
      targetType,
      targetId,
      page,
      limit,
      sortOrder: "asc",
    });
  }

  /** GET /api/comment/replies/:parentId - 대댓글 조회 */
  @Get("replies/:parentId")
  @ApiOperation({ summary: "대댓글 조회" })
  @ApiParam({ name: "parentId", description: "부모 댓글 UUID" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "조회 개수 (기본값: 20)" })
  @ApiResponse({
    status: 200,
    description: "대댓글 목록 반환",
    type: CommentWithAuthorDto,
    isArray: true,
  })
  async getReplies(
    @Param("parentId", ParseUUIDPipe) parentId: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return await this.commentService.findReplies(parentId, limit);
  }

  /** GET /api/comment/count - 댓글 개수 조회 */
  @Get("count")
  @ApiOperation({ summary: "댓글 개수 조회" })
  @ApiQuery({
    name: "targetType",
    required: true,
    enum: COMMENT_TARGET_TYPES,
    description: "대상 엔티티 타입",
  })
  @ApiQuery({ name: "targetId", required: true, description: "대상 엔티티 UUID" })
  @ApiResponse({ status: 200, description: "댓글 개수 반환", type: CommentCountDto })
  async count(
    @Query("targetType") targetType: string,
    @Query("targetId", ParseUUIDPipe) targetId: string,
  ) {
    const total = await this.commentService.getCount(targetType, targetId);
    return { count: total };
  }

  /** GET /api/comment/:id - 댓글 상세 조회 */
  @Get(":id")
  @ApiOperation({ summary: "댓글 상세 조회" })
  @ApiParam({ name: "id", description: "댓글 UUID" })
  @ApiResponse({ status: 200, description: "댓글 정보 반환", type: CommentResponseDto })
  @ApiResponse({ status: 404, description: "댓글을 찾을 수 없음" })
  async get(@Param("id", ParseUUIDPipe) id: string) {
    const comment = await this.commentService.findById(id);
    if (!comment) {
      throw new NotFoundException("댓글을 찾을 수 없습니다");
    }
    return comment;
  }

  // ============================================================================
  // Auth Endpoints (인증 필요)
  // ============================================================================

  /** POST /api/comment - 댓글 생성 */
  @Post()
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 생성" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        targetType: {
          type: "string",
          enum: [...COMMENT_TARGET_TYPES],
          description: "대상 엔티티 타입",
        },
        targetId: { type: "string", format: "uuid", description: "대상 엔티티 UUID" },
        content: { type: "string", description: "댓글 내용", minLength: 1, maxLength: 5000 },
        parentId: { type: "string", format: "uuid", description: "부모 댓글 UUID (대댓글 시)" },
        mentions: {
          type: "array",
          items: { type: "string", format: "uuid" },
          description: "멘션 대상 사용자 UUID 목록",
        },
      },
      required: ["targetType", "targetId", "content"],
    },
  })
  @ApiResponse({ status: 201, description: "댓글 생성 성공", type: CommentResponseDto })
  @ApiResponse({ status: 400, description: "최대 대댓글 깊이 초과 또는 유효하지 않은 부모 댓글" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  async create(@CurrentUser() user: User, @Body() body: CreateCommentInput) {
    return await this.commentService.create(body, user.id);
  }

  /** PUT /api/comment/:id - 댓글 수정 */
  @Put(":id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 수정" })
  @ApiParam({ name: "id", description: "댓글 UUID" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "댓글 내용", minLength: 1, maxLength: 5000 },
        mentions: {
          type: "array",
          items: { type: "string", format: "uuid" },
          description: "멘션 대상 사용자 UUID 목록",
        },
      },
      required: ["content"],
    },
  })
  @ApiResponse({ status: 200, description: "댓글 수정 성공", type: CommentResponseDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "본인 댓글만 수정 가능" })
  @ApiResponse({ status: 404, description: "댓글을 찾을 수 없음" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() body: UpdateCommentInput,
  ) {
    return await this.commentService.update(id, body, user.id);
  }

  /** DELETE /api/comment/:id - 댓글 삭제 (소프트 삭제) */
  @Delete(":id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 삭제 (소프트 삭제)" })
  @ApiParam({ name: "id", description: "댓글 UUID" })
  @ApiResponse({ status: 200, description: "댓글 삭제 성공", type: CommentDeleteResponseDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "본인 댓글만 삭제 가능" })
  @ApiResponse({ status: 404, description: "댓글을 찾을 수 없음" })
  async delete(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return await this.commentService.delete(id, user.id);
  }
}
