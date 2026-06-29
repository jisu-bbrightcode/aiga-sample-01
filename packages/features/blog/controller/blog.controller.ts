import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { BlogService } from "../service/blog.service";
import {
  BlogBookmarkResponseDto,
  BlogClapResponseDto,
  BlogDeleteResponseDto,
  BlogPostDetailResponseDto,
  BlogPostListResponseDto,
  BlogPostResponseDto,
  BlogResponseResponseDto,
  ClapPostDto,
  CreateBlogPostDto,
  CreateResponseDto,
  UpdateBlogPostDto,
} from "../dto";

@ApiTags("Blog")
@Controller("blog")
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get("posts")
  @ApiOperation({ summary: "Get blog posts" })
  @ApiResponse({ status: 200, description: "블로그 포스트 목록", type: BlogPostListResponseDto })
  async getPosts(
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query("cursor") cursor?: string,
    @Query("authorId") authorId?: string,
  ) {
    return this.blogService.getPosts({ limit, cursor, authorId });
  }

  @Get("posts/:slug")
  @ApiOperation({ summary: "Get a post by slug" })
  @ApiResponse({ status: 200, description: "포스트 상세", type: BlogPostDetailResponseDto })
  async getPostBySlug(@Param("slug") slug: string, @CurrentUser() user?: User) {
    return this.blogService.getPostBySlug(slug, user?.id);
  }

  @Post("posts")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new blog post" })
  @ApiResponse({ status: 201, description: "생성된 포스트", type: BlogPostResponseDto })
  async createPost(@CurrentUser() user: User, @Body() dto: CreateBlogPostDto) {
    return this.blogService.createPost(user.id, dto);
  }

  @Put("posts/:id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update an existing blog post" })
  @ApiResponse({ status: 200, description: "수정된 포스트", type: BlogPostResponseDto })
  async updatePost(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateBlogPostDto,
  ) {
    return this.blogService.updatePost(user.id, id, dto);
  }

  @Delete("posts/:id")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a blog post" })
  @ApiResponse({ status: 200, description: "삭제 결과", type: BlogDeleteResponseDto })
  async deletePost(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.blogService.deletePost(user.id, id);
  }

  @Post("clap")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Clap for a post (1-50)" })
  @ApiResponse({ status: 201, description: "박수 결과", type: BlogClapResponseDto })
  async clapPost(@CurrentUser() user: User, @Body() dto: ClapPostDto) {
    return this.blogService.clapPost(user.id, dto);
  }

  @Post("responses")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add a response/comment to a post" })
  @ApiResponse({ status: 201, description: "생성된 응답", type: BlogResponseResponseDto })
  async createResponse(@CurrentUser() user: User, @Body() dto: CreateResponseDto) {
    return this.blogService.createResponse(user.id, dto);
  }

  @Get("posts/:id/responses")
  @ApiOperation({ summary: "Get responses for a post" })
  @ApiResponse({ status: 200, description: "포스트 응답 목록", type: BlogResponseResponseDto, isArray: true })
  async getResponses(@Param("id", ParseUUIDPipe) id: string) {
    return this.blogService.getResponses(id);
  }

  @Post("posts/:id/bookmark")
  @UseGuards(BetterAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Toggle bookmark for a post" })
  @ApiResponse({ status: 201, description: "북마크 토글 결과", type: BlogBookmarkResponseDto })
  async toggleBookmark(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.blogService.toggleBookmark(user.id, id);
  }
}
