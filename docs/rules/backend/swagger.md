---
description: Swagger/OpenAPI setup, decorators, and NestJS module structure
globs: "apps/server/**/*.ts, packages/features/**/controller/**/*.ts"
alwaysApply: false
---

# Swagger/OpenAPI & NestJS 모듈 규칙

> NestJS 11+ / Fastify 5+ / Drizzle ORM 1.0+ / PostgreSQL
>
> **REST + OpenAPI 구현 원칙, codegen workflow**: `api-strategy.md`, `openapi-codegen.md` 참조

---

## REST API 경로 규칙

> **Global prefix `api`가 자동 적용**되므로 `@Controller()`에 `api/`를 포함하지 않는다.

| 유형           | 경로 패턴                    | 예시                    |
| -------------- | ---------------------------- | ----------------------- |
| **Public API** | `/api/{feature}/...`         | `/api/blog/posts`       |
| **Auth API**   | `/api/{feature}/...` + Guard | `/api/blog/posts`       |
| **Admin API**  | `/api/admin/{feature}/...`   | `/api/admin/blog/posts` |

### Controller 패턴 (Flat Structure)

하나의 컨트롤러 파일에 모든 엔드포인트를 포함하고, `@UseGuards()` 데코레이터로 접근 제어:

```typescript
@ApiTags("Blog")
@Controller("blog")
export class BlogController {
  // Public endpoints
  @Get()
  async findAll() { ... }

  // Auth endpoints
  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() dto: CreatePostDto) { ... }

  // Admin endpoints
  @Get("admin/all")
  @UseGuards(AdminGuard)
  async adminFindAll() { ... }
}
```

---

## AppModule 연결

```typescript
// apps/server/src/app.module.ts
import { BlogModule } from "@repo/features/blog";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    AuthModule,
    BlogModule,
    HelloWorldModule,
  ],
})
export class AppModule {}
```

---

## Swagger (OpenAPI) 스펙

### Swagger 모듈 설정

```typescript
// apps/server/src/main.ts
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { patchNestJsSwagger } from "@repo/shared/zod-nestjs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter());

  // Zod DTO를 Swagger와 연동
  patchNestJsSwagger();

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle("Product Builder API")
    .setDescription("Product Builder Server API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  await app.listen(3000);
}
```

### Controller Swagger 데코레이터

```typescript
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";

@ApiTags("Blog")
@Controller("blog")
export class BlogPublicController {
  @Get()
  @ApiOperation({ summary: "게시물 목록 조회" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "게시물 목록 반환" })
  async findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.blogService.findPublished({ page, limit });
  }

  @Get(":slug")
  @ApiOperation({ summary: "게시물 상세 조회" })
  @ApiParam({ name: "slug", description: "게시물 슬러그" })
  @ApiResponse({ status: 200, description: "게시물 상세 정보" })
  @ApiResponse({ status: 404, description: "게시물을 찾을 수 없음" })
  async findBySlug(@Param("slug") slug: string) {
    return this.blogService.findBySlug(slug);
  }
}

@ApiTags("Blog Admin")
@ApiBearerAuth()
@Controller("admin/blog")
export class BlogAdminController {
  @Post()
  @ApiOperation({ summary: "게시물 생성" })
  @ApiResponse({ status: 201, description: "게시물 생성 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  @ApiResponse({ status: 409, description: "슬러그 중복" })
  async create(@Body() dto: CreatePostDto) {
    return this.blogService.create(dto);
  }
}
```

### Zod DTO와 Swagger 자동 연동

`create-zod-dto`와 `patchNestJsSwagger()`를 함께 사용하면 Zod 스키마가 자동으로 Swagger 스펙에 반영됩니다.

> DTO 정의 패턴은 `naming-dto.md`를 참조. Swagger 연동 시 `.describe()` 추가.

### Swagger 데코레이터 참조

| 데코레이터        | 용도                     |
| :---------------- | :----------------------- |
| `@ApiTags()`      | API 그룹 태그            |
| `@ApiOperation()` | 엔드포인트 설명          |
| `@ApiResponse()`  | 응답 상태 및 설명        |
| `@ApiParam()`     | Path 파라미터 설명       |
| `@ApiQuery()`     | Query 파라미터 설명      |
| `@ApiBody()`      | Request Body 설명        |
| `@ApiBearerAuth()`| Bearer 인증 필요 표시    |
| `@ApiProperty()`  | DTO 프로퍼티 설명 (수동) |

---

## Swagger 접속 경로

| 항목 | URL |
|------|-----|
| Swagger UI | `http://localhost:3002/api-docs` |
| OpenAPI JSON | `http://localhost:3002/api-docs/json` |

---

## NestJS 모듈 구조

### Feature Module

Feature 단위로 모듈을 구성하며, `controller`, `service`, `dto` 등을 포함합니다.

```typescript
// packages/features/blog/server/blog.module.ts
import { Module } from "@nestjs/common";
import { BlogService } from "./service/blog.service";
import { BlogPublicController } from "./controller/public/blog-public.controller";
import { BlogAdminController } from "./controller/admin/blog-admin.controller";

@Module({
  controllers: [BlogPublicController, BlogAdminController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
```
