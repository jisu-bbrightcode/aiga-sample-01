---
description: Naming conventions (Frontend & Backend), DTO definitions, and Validation Pipes
globs: "apps/app/**/*.ts, apps/app/**/*.tsx, packages/ui/**/*.tsx, apps/server/**/*.ts, packages/features/**/*.ts"
alwaysApply: false
---

# 네이밍 & DTO 규칙

---

## 0. Frontend 네이밍 컨벤션

> React 19+ / TanStack Router / TanStack Query / Jotai / Tailwind CSS

사내 컨벤션을 우선적으로 따릅니다.

| 유형                   | 패턴                       | 예시                                                                           |
| :--------------------- | :------------------------- | :----------------------------------------------------------------------------- |
| **파일/디렉토리**      | **kebab-case**             | `use-blog-list.ts`, `blog-list-item.tsx`                                       |
| **컴포넌트 함수**      | **PascalCase**             | `export function BlogList() {}`                                                |
| **Hook 함수**          | **camelCase**              | `export function useBlogList() {}`                                             |
| **타입/인터페이스**    | **PascalCase**             | `type Post = ...`                                                              |
| **Entities 모델 타입** | **I-접두사 / Type-접미사** | `interface IPost {}` or `type PostType = ...`<br>_(컴포넌트명과 충돌 시 필수)_ |
| **상수**               | **UPPER_SNAKE_CASE**       | `API_TIMEOUT_MS`                                                               |

> Feature 유형(Page/Widget/Agent) 및 디렉토리 구조는 `../feature/definition.md` 참조.

---

## 1. Backend 파일 네이밍 (Naming)

> NestJS 11+ / Fastify 5+ / Drizzle ORM 1.0+ / PostgreSQL

Frontend와 일관성을 유지하기 위해 **kebab-case**를 사용합니다.

| 유형           | 패턴                       | 예시                 |
| :------------- | :------------------------- | :------------------- |
| **Module**     | `{name}.module.ts`         | `blog.module.ts`     |
| **Controller** | `{name}.controller.ts`     | `blog.controller.ts` |
| **Service**    | `{name}.service.ts`        | `blog.service.ts`    |
| **Schema**     | `{name}.schema.ts`         | `posts.schema.ts`    |
| **DTO**        | `{action}-{entity}.dto.ts` | `create-post.dto.ts` |

---

## 2. API 및 DTO 규칙

### DTO 정의

- `create-zod-dto`를 사용하여 Zod 스키마로부터 DTO 클래스를 생성합니다.
- 파일명은 `kebab-case`를 따릅니다.

```typescript
// dto/create-post.dto.ts
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  isPublished: z.boolean().default(false),
});

export class CreatePostDto extends createZodDto(createPostSchema) {}
```

---

## 3. Validation Pipe 설정

### Global Pipe 설정

애플리케이션 전역에서 요청 데이터 검증을 위해 `ZodValidationPipe`를 사용합니다.

```typescript
// apps/server/src/main.ts
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ZodValidationPipe } from "@repo/shared/zod-nestjs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter());

  // Global Validation Pipe
  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(3000);
}
```

### Controller에서 DTO 사용

```typescript
// controller/admin/blog-admin.controller.ts
import { Controller, Post, Body, Param, ParseUUIDPipe } from "@nestjs/common";
import { CreatePostDto } from "../../dto/create-post.dto";

@Controller("admin/blog")
export class BlogAdminController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  async create(@Body() dto: CreatePostDto) {
    // dto는 자동으로 Zod 스키마로 검증됨
    return this.blogService.create(dto);
  }

  @Get(":id")
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    // ParseUUIDPipe로 UUID 형식 검증
    return this.blogService.findById(id);
  }
}
```

### 내장 Pipe 활용

| Pipe              | 용도                           | 예시                              |
| :---------------- | :----------------------------- | :-------------------------------- |
| `ParseUUIDPipe`   | UUID 형식 검증                 | `@Param('id', ParseUUIDPipe)`     |
| `ParseIntPipe`    | 정수 변환 및 검증              | `@Param('page', ParseIntPipe)`    |
| `ParseBoolPipe`   | Boolean 변환                   | `@Query('active', ParseBoolPipe)` |
| `DefaultValuePipe`| 기본값 설정                    | `@Query('page', new DefaultValuePipe(1))` |

### 복합 Pipe 사용

```typescript
@Get()
async findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return this.blogService.findAll({ page, limit });
}
```
