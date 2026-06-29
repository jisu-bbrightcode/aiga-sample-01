# Feature Catalog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SaaS Feature 마켓플레이스의 첫 단계 — 고객이 Feature를 탐색·선택하고 의존성을 검증할 수 있는 카탈로그 구현

**Architecture:** Page Feature 패턴. DB 테이블 2개(`catalog_features`, `catalog_dependencies`), NestJS Module + tRPC Router + REST Controller, 공개 카탈로그 페이지(`/features`, `/features/:slug`) + Admin 관리 페이지

**Tech Stack:** Drizzle ORM, NestJS 11, tRPC 11, React 19, TanStack Router/Query, shadcn/Base-UI, Jotai

**Design doc:** `docs/plans/2026-03-10-feature-catalog-design.md`

---

## Task 1: Schema 정의

**Files:**
- Create: `packages/drizzle/src/schema/features/feature-catalog/index.ts`

**Step 1: 스키마 파일 작성**

```typescript
// packages/drizzle/src/schema/features/feature-catalog/index.ts
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "../../utils/columns";

// ============================================================================
// Enums
// ============================================================================
export const catalogGroupEnum = pgEnum("catalog_group", [
  "core",
  "content",
  "commerce",
  "system",
]);

export const dependencyTypeEnum = pgEnum("catalog_dependency_type", [
  "required",
  "recommended",
  "optional",
]);

// ============================================================================
// Types
// ============================================================================
export type TechStack = {
  server?: string[];
  client?: string[];
};

// ============================================================================
// Tables
// ============================================================================
export const catalogFeatures = pgTable("catalog_features", {
  ...baseColumns(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  group: catalogGroupEnum("group").notNull().default("content"),
  tags: jsonb("tags").$type<string[]>().default([]),
  previewImages: jsonb("preview_images").$type<string[]>().default([]),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  techStack: jsonb("tech_stack").$type<TechStack>(),
  isCore: boolean("is_core").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(false),
  order: integer("order").notNull().default(0),
});

export const catalogDependencies = pgTable(
  "catalog_dependencies",
  {
    ...baseColumns(),
    featureId: uuid("feature_id")
      .notNull()
      .references(() => catalogFeatures.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id")
      .notNull()
      .references(() => catalogFeatures.id, { onDelete: "cascade" }),
    dependencyType: dependencyTypeEnum("dependency_type")
      .notNull()
      .default("required"),
  },
  (t) => [unique("uq_catalog_dep").on(t.featureId, t.dependsOnId)],
);

// ============================================================================
// Relations
// ============================================================================
export const catalogFeaturesRelations = relations(
  catalogFeatures,
  ({ many }) => ({
    dependencies: many(catalogDependencies, {
      relationName: "featureDependencies",
    }),
    dependedBy: many(catalogDependencies, {
      relationName: "featureDependedBy",
    }),
  }),
);

export const catalogDependenciesRelations = relations(
  catalogDependencies,
  ({ one }) => ({
    feature: one(catalogFeatures, {
      fields: [catalogDependencies.featureId],
      references: [catalogFeatures.id],
      relationName: "featureDependencies",
    }),
    dependsOn: one(catalogFeatures, {
      fields: [catalogDependencies.dependsOnId],
      references: [catalogFeatures.id],
      relationName: "featureDependedBy",
    }),
  }),
);

// ============================================================================
// Type Exports
// ============================================================================
export type CatalogFeature = typeof catalogFeatures.$inferSelect;
export type NewCatalogFeature = typeof catalogFeatures.$inferInsert;
export type CatalogDependency = typeof catalogDependencies.$inferSelect;
export type NewCatalogDependency = typeof catalogDependencies.$inferInsert;
```

**Step 2: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: PASS

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/features/feature-catalog/
git commit -m "feat(feature-catalog): add schema for catalog_features and catalog_dependencies"
```

---

## Task 2: Schema 등록

**Files:**
- Modify: `packages/drizzle/src/schema/index.ts`
- Modify: `packages/drizzle/drizzle.config.ts`

**Step 1: Schema Index에 re-export 추가**

`packages/drizzle/src/schema/index.ts`에 추가:
```typescript
export * from "./features/feature-catalog";
```

**Step 2: Drizzle Config tablesFilter에 테이블 추가**

`packages/drizzle/drizzle.config.ts`의 `tablesFilter` 배열 끝에 추가:
```typescript
    // features/feature-catalog
    "catalog_features",
    "catalog_dependencies",
```

**Step 3: 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: PASS

**Step 4: 커밋**

```bash
git add packages/drizzle/src/schema/index.ts packages/drizzle/drizzle.config.ts
git commit -m "feat(feature-catalog): register schema in index and drizzle config"
```

---

## Task 3: DTO 정의

**Files:**
- Create: `packages/features/feature-catalog/server/dto/index.ts`
- Create: `packages/features/feature-catalog/server/dto/create-catalog-feature.dto.ts`
- Create: `packages/features/feature-catalog/server/dto/update-catalog-feature.dto.ts`

**Step 1: Create DTO 작성**

```typescript
// packages/features/feature-catalog/server/dto/create-catalog-feature.dto.ts
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createCatalogFeatureSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .describe("Feature slug (kebab-case)"),
  name: z.string().min(1).max(200).describe("Feature 표시명"),
  description: z.string().optional().describe("Feature 설명"),
  icon: z.string().max(50).optional().describe("lucide 아이콘명"),
  group: z
    .enum(["core", "content", "commerce", "system"])
    .default("content")
    .describe("Feature 그룹"),
  tags: z.array(z.string()).default([]).describe("검색/필터 태그"),
  previewImages: z.array(z.string().url()).default([]).describe("스크린샷 URL"),
  capabilities: z.array(z.string()).default([]).describe("기능 목록"),
  techStack: z
    .object({
      server: z.array(z.string()).optional(),
      client: z.array(z.string()).optional(),
    })
    .optional()
    .describe("기술 스택"),
  isCore: z.boolean().default(false).describe("필수 Feature 여부"),
  isPublished: z.boolean().default(false).describe("카탈로그 노출 여부"),
  order: z.number().int().default(0).describe("표시 순서"),
});

export class CreateCatalogFeatureDto extends createZodDto(
  createCatalogFeatureSchema,
) {}
```

**Step 2: Update DTO 작성**

```typescript
// packages/features/feature-catalog/server/dto/update-catalog-feature.dto.ts
import { createZodDto } from "@repo/shared/zod-nestjs";
import { createCatalogFeatureSchema } from "./create-catalog-feature.dto";

export const updateCatalogFeatureSchema =
  createCatalogFeatureSchema.partial();

export class UpdateCatalogFeatureDto extends createZodDto(
  updateCatalogFeatureSchema,
) {}
```

**Step 3: DTO index 작성**

```typescript
// packages/features/feature-catalog/server/dto/index.ts
export * from "./create-catalog-feature.dto";
export * from "./update-catalog-feature.dto";
```

**Step 4: 커밋**

```bash
git add packages/features/feature-catalog/server/dto/
git commit -m "feat(feature-catalog): add create and update DTOs with Zod validation"
```

---

## Task 4: Service 구현

**Files:**
- Create: `packages/features/feature-catalog/server/service/feature-catalog.service.ts`
- Create: `packages/features/feature-catalog/server/service/index.ts`

**Step 1: Service 작성**

```typescript
// packages/features/feature-catalog/server/service/feature-catalog.service.ts
import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import {
  catalogFeatures,
  catalogDependencies,
} from "@repo/drizzle";
import { eq, and, ilike, inArray, asc, count } from "drizzle-orm";
import { createLogger } from "@repo/core/logger";
import type { NewCatalogFeature } from "@repo/drizzle";

const logger = createLogger("feature-catalog");

@Injectable()
export class FeatureCatalogService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /** Public: 공개된 Feature 목록 조회 */
  async findPublished(input?: {
    group?: string;
    search?: string;
    tags?: string[];
  }) {
    const conditions = [eq(catalogFeatures.isPublished, true)];

    if (input?.group) {
      conditions.push(
        eq(catalogFeatures.group, input.group as "core" | "content" | "commerce" | "system"),
      );
    }
    if (input?.search) {
      conditions.push(ilike(catalogFeatures.name, `%${input.search}%`));
    }

    const data = await this.db.query.catalogFeatures.findMany({
      where: and(...conditions),
      orderBy: [asc(catalogFeatures.order), asc(catalogFeatures.name)],
    });

    // tag 필터링 (JSONB 배열 교집합)
    if (input?.tags?.length) {
      return data.filter((f) =>
        input.tags!.some((tag) => (f.tags ?? []).includes(tag)),
      );
    }

    return data;
  }

  /** Public: slug로 상세 조회 */
  async findBySlug(slug: string) {
    const feature = await this.db.query.catalogFeatures.findFirst({
      where: and(
        eq(catalogFeatures.slug, slug),
        eq(catalogFeatures.isPublished, true),
      ),
      with: {
        dependencies: {
          with: { dependsOn: true },
        },
      },
    });

    if (!feature) {
      throw new NotFoundException(`Feature not found: ${slug}`);
    }

    return feature;
  }

  /** Public: 의존성 그래프 해석 */
  async getDependencyGraph(slugs: string[]) {
    const features = await this.db.query.catalogFeatures.findMany({
      where: inArray(catalogFeatures.slug, slugs),
    });

    const featureIds = features.map((f) => f.id);
    const resolved = new Set<string>(featureIds);
    const required: string[] = [];
    const recommended: string[] = [];

    // 재귀적으로 required 의존성 해석
    const queue = [...featureIds];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const deps = await this.db.query.catalogDependencies.findMany({
        where: eq(catalogDependencies.featureId, currentId),
        with: { dependsOn: true },
      });

      for (const dep of deps) {
        if (dep.dependencyType === "required" && !resolved.has(dep.dependsOnId)) {
          resolved.add(dep.dependsOnId);
          required.push(dep.dependsOnId);
          queue.push(dep.dependsOnId);
        }
        if (dep.dependencyType === "recommended" && !resolved.has(dep.dependsOnId)) {
          recommended.push(dep.dependsOnId);
        }
      }
    }

    const requiredFeatures = required.length
      ? await this.db.query.catalogFeatures.findMany({
          where: inArray(catalogFeatures.id, required),
        })
      : [];

    const recommendedFeatures = recommended.length
      ? await this.db.query.catalogFeatures.findMany({
          where: inArray(catalogFeatures.id, recommended),
        })
      : [];

    return {
      selected: features,
      required: requiredFeatures,
      recommended: recommendedFeatures,
    };
  }

  /** Public: 선택 조합 검증 */
  async validateSelection(slugs: string[]) {
    const graph = await this.getDependencyGraph(slugs);
    const selectedSlugs = new Set(slugs);
    const missing = graph.required.filter((f) => !selectedSlugs.has(f.slug));

    return {
      valid: missing.length === 0,
      missing,
      recommended: graph.recommended,
    };
  }

  /** Admin: 전체 목록 (비공개 포함) */
  async adminFindAll() {
    return this.db.query.catalogFeatures.findMany({
      orderBy: [asc(catalogFeatures.order), asc(catalogFeatures.name)],
      with: {
        dependencies: {
          with: { dependsOn: true },
        },
      },
    });
  }

  /** Admin: ID로 조회 */
  async findById(id: string) {
    const feature = await this.db.query.catalogFeatures.findFirst({
      where: eq(catalogFeatures.id, id),
      with: {
        dependencies: {
          with: { dependsOn: true },
        },
      },
    });

    if (!feature) {
      throw new NotFoundException(`Feature not found: ${id}`);
    }

    return feature;
  }

  /** Admin: Feature 생성 */
  async create(input: NewCatalogFeature) {
    const existing = await this.db.query.catalogFeatures.findFirst({
      where: eq(catalogFeatures.slug, input.slug),
    });

    if (existing) {
      throw new ConflictException(`Slug already exists: ${input.slug}`);
    }

    const [feature] = await this.db
      .insert(catalogFeatures)
      .values(input)
      .returning();

    logger.info("Catalog feature created", {
      "catalog.feature_id": feature.id,
      "catalog.slug": feature.slug,
    });

    return feature;
  }

  /** Admin: Feature 수정 */
  async update(id: string, input: Partial<NewCatalogFeature>) {
    await this.findById(id);

    await this.db
      .update(catalogFeatures)
      .set(input)
      .where(eq(catalogFeatures.id, id));

    logger.info("Catalog feature updated", {
      "catalog.feature_id": id,
    });

    return this.findById(id);
  }

  /** Admin: 순서 변경 */
  async reorder(items: { id: string; order: number }[]) {
    await Promise.all(
      items.map((item) =>
        this.db
          .update(catalogFeatures)
          .set({ order: item.order })
          .where(eq(catalogFeatures.id, item.id)),
      ),
    );

    logger.info("Catalog features reordered", {
      "catalog.count": items.length,
    });

    return { success: true };
  }

  /** Admin: 의존성 추가 */
  async addDependency(
    featureId: string,
    dependsOnId: string,
    dependencyType: "required" | "recommended" | "optional" = "required",
  ) {
    await this.findById(featureId);
    await this.findById(dependsOnId);

    const [dep] = await this.db
      .insert(catalogDependencies)
      .values({ featureId, dependsOnId, dependencyType })
      .returning();

    logger.info("Catalog dependency added", {
      "catalog.feature_id": featureId,
      "catalog.depends_on_id": dependsOnId,
      "catalog.dependency_type": dependencyType,
    });

    return dep;
  }

  /** Admin: 의존성 삭제 */
  async removeDependency(dependencyId: string) {
    await this.db
      .delete(catalogDependencies)
      .where(eq(catalogDependencies.id, dependencyId));

    logger.info("Catalog dependency removed", {
      "catalog.dependency_id": dependencyId,
    });

    return { success: true };
  }
}
```

**Step 2: index.ts 작성**

```typescript
// packages/features/feature-catalog/server/service/index.ts
export { FeatureCatalogService } from "./feature-catalog.service";
```

**Step 3: 커밋**

```bash
git add packages/features/feature-catalog/server/service/
git commit -m "feat(feature-catalog): implement service with CRUD, dependency graph, and validation"
```

---

## Task 5: tRPC Router

**Files:**
- Create: `packages/features/feature-catalog/server/trpc/router.ts`
- Create: `packages/features/feature-catalog/server/trpc/index.ts`

**Step 1: Router 작성**

```typescript
// packages/features/feature-catalog/server/trpc/router.ts
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "@repo/core/trpc";
import { FeatureCatalogService } from "../service";
import { createCatalogFeatureSchema, updateCatalogFeatureSchema } from "../dto";

let featureCatalogService: FeatureCatalogService;
export const setFeatureCatalogService = (service: FeatureCatalogService) => {
  featureCatalogService = service;
};

export const featureCatalogRouter = router({
  // === Public ===
  list: publicProcedure
    .input(
      z
        .object({
          group: z.enum(["core", "content", "commerce", "system"]).optional(),
          search: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return featureCatalogService.findPublished(input);
    }),

  getBySlug: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return featureCatalogService.findBySlug(input);
    }),

  getDependencyGraph: publicProcedure
    .input(z.array(z.string()).min(1))
    .query(async ({ input }) => {
      return featureCatalogService.getDependencyGraph(input);
    }),

  validateSelection: publicProcedure
    .input(z.array(z.string()).min(1))
    .query(async ({ input }) => {
      return featureCatalogService.validateSelection(input);
    }),

  // === Admin ===
  adminList: adminProcedure.query(async () => {
    return featureCatalogService.adminFindAll();
  }),

  adminCreate: adminProcedure
    .input(createCatalogFeatureSchema)
    .mutation(async ({ input }) => {
      return featureCatalogService.create(input);
    }),

  adminUpdate: adminProcedure
    .input(z.object({ id: z.string().uuid(), data: updateCatalogFeatureSchema }))
    .mutation(async ({ input }) => {
      return featureCatalogService.update(input.id, input.data);
    }),

  adminReorder: adminProcedure
    .input(z.array(z.object({ id: z.string().uuid(), order: z.number().int() })))
    .mutation(async ({ input }) => {
      return featureCatalogService.reorder(input);
    }),

  adminAddDependency: adminProcedure
    .input(
      z.object({
        featureId: z.string().uuid(),
        dependsOnId: z.string().uuid(),
        dependencyType: z.enum(["required", "recommended", "optional"]).default("required"),
      }),
    )
    .mutation(async ({ input }) => {
      return featureCatalogService.addDependency(
        input.featureId,
        input.dependsOnId,
        input.dependencyType,
      );
    }),

  adminRemoveDependency: adminProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return featureCatalogService.removeDependency(input);
    }),
});

export type FeatureCatalogRouter = typeof featureCatalogRouter;
```

**Step 2: index.ts 작성**

```typescript
// packages/features/feature-catalog/server/trpc/index.ts
export { featureCatalogRouter, setFeatureCatalogService } from "./router";
export type { FeatureCatalogRouter } from "./router";
```

**Step 3: 커밋**

```bash
git add packages/features/feature-catalog/server/trpc/
git commit -m "feat(feature-catalog): add tRPC router with public and admin procedures"
```

---

## Task 6: REST Controller + Swagger

**Files:**
- Create: `packages/features/feature-catalog/server/controller/feature-catalog.controller.ts`
- Create: `packages/features/feature-catalog/server/controller/index.ts`

**Step 1: Controller 작성**

```typescript
// packages/features/feature-catalog/server/controller/feature-catalog.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, NestAdminGuard } from "@repo/core/nestjs/auth";
import { FeatureCatalogService } from "../service";
import { CreateCatalogFeatureDto } from "../dto/create-catalog-feature.dto";
import { UpdateCatalogFeatureDto } from "../dto/update-catalog-feature.dto";

@ApiTags("Feature Catalog")
@Controller("feature-catalog")
export class FeatureCatalogController {
  constructor(private readonly service: FeatureCatalogService) {}

  // === Public ===

  @Get()
  @ApiOperation({ summary: "공개 Feature 목록 조회" })
  @ApiQuery({ name: "group", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiResponse({ status: 200, description: "Feature 목록" })
  async findPublished(
    @Query("group") group?: string,
    @Query("search") search?: string,
  ) {
    return this.service.findPublished({ group, search });
  }

  @Get(":slug")
  @ApiOperation({ summary: "Feature 상세 조회 (slug)" })
  @ApiParam({ name: "slug" })
  @ApiResponse({ status: 200, description: "Feature 상세" })
  @ApiResponse({ status: 404, description: "Feature 없음" })
  async findBySlug(@Param("slug") slug: string) {
    return this.service.findBySlug(slug);
  }

  // === Admin ===

  @Get("admin/all")
  @UseGuards(JwtAuthGuard, NestAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] 전체 Feature 목록" })
  async adminFindAll() {
    return this.service.adminFindAll();
  }

  @Post("admin")
  @UseGuards(JwtAuthGuard, NestAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Feature 생성" })
  @ApiResponse({ status: 201, description: "Feature 생성 성공" })
  @ApiResponse({ status: 409, description: "Slug 중복" })
  async create(@Body() dto: CreateCatalogFeatureDto) {
    return this.service.create(dto);
  }

  @Put("admin/:id")
  @UseGuards(JwtAuthGuard, NestAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "[Admin] Feature 수정" })
  @ApiParam({ name: "id" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogFeatureDto,
  ) {
    return this.service.update(id, dto);
  }
}
```

**Step 2: index.ts 작성**

```typescript
// packages/features/feature-catalog/server/controller/index.ts
export { FeatureCatalogController } from "./feature-catalog.controller";
```

**Step 3: 커밋**

```bash
git add packages/features/feature-catalog/server/controller/
git commit -m "feat(feature-catalog): add REST controller with Swagger decorators"
```

---

## Task 7: NestJS Module + Feature index.ts

**Files:**
- Create: `packages/features/feature-catalog/server/feature-catalog.module.ts`
- Create: `packages/features/feature-catalog/server/index.ts`
- Create: `packages/features/feature-catalog/index.ts`

**Step 1: Module 작성**

```typescript
// packages/features/feature-catalog/server/feature-catalog.module.ts
import { Module, OnModuleInit } from "@nestjs/common";
import { FeatureCatalogService } from "./service";
import { FeatureCatalogController } from "./controller";
import { setFeatureCatalogService } from "./trpc";

@Module({
  controllers: [FeatureCatalogController],
  providers: [FeatureCatalogService],
  exports: [FeatureCatalogService],
})
export class FeatureCatalogModule implements OnModuleInit {
  constructor(private readonly service: FeatureCatalogService) {}

  onModuleInit() {
    setFeatureCatalogService(this.service);
  }
}
```

**Step 2: server/index.ts 작성**

```typescript
// packages/features/feature-catalog/server/index.ts
export { FeatureCatalogModule } from "./feature-catalog.module";
export { FeatureCatalogService } from "./service";
export { featureCatalogRouter, setFeatureCatalogService } from "./trpc";
export type { FeatureCatalogRouter } from "./trpc";
export * from "./dto";
```

**Step 3: Feature index.ts 작성**

```typescript
// packages/features/feature-catalog/index.ts
export * from "./server";
```

**Step 4: 커밋**

```bash
git add packages/features/feature-catalog/
git commit -m "feat(feature-catalog): add NestJS module with service injection"
```

---

## Task 8: Server 등록 (3곳)

**Files:**
- Modify: `apps/server/src/app.module.ts`
- Modify: `packages/features/app-router.ts`
- Modify: `apps/server/src/trpc/router.ts`

**Step 1: NestJS Module 등록**

`apps/server/src/app.module.ts`에서:
- import 추가: `import { FeatureCatalogModule } from '@repo/features/feature-catalog';`
- `imports` 배열의 `// [/ATLAS:MODULES]` 직전에 `FeatureCatalogModule,` 추가

**Step 2: tRPC 타입 등록**

`packages/features/app-router.ts`에서:
- import 추가: `import { featureCatalogRouter } from "./feature-catalog";`
- `_appRouter` 객체에 `featureCatalog: featureCatalogRouter,` 추가

**Step 3: tRPC 런타임 등록**

`apps/server/src/trpc/router.ts`에서:
- import 추가: `import { featureCatalogRouter } from "@repo/features/feature-catalog";`
- `trpcRouter` 객체에 `featureCatalog: featureCatalogRouter,` 추가

**Step 4: 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: PASS

**Step 5: 커밋**

```bash
git add apps/server/src/app.module.ts packages/features/app-router.ts apps/server/src/trpc/router.ts
git commit -m "feat(feature-catalog): register module, tRPC type and runtime routers"
```

---

## Task 9: DB Migration 생성

**Step 1: Migration 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`
Expected: Migration 파일 생성 (catalog_features, catalog_dependencies 테이블)

**Step 2: Migration 적용**

Run: `cd packages/drizzle && pnpm drizzle-kit push`
Expected: 테이블 생성 성공

**Step 3: 커밋**

```bash
git add packages/drizzle/migrations/
git commit -m "feat(feature-catalog): add database migration"
```

---

## Task 10: Client — Query/Mutation Hooks

**Files:**
- Create: `apps/app/src/features/feature-catalog/hooks/use-catalog-queries.ts`
- Create: `apps/app/src/features/feature-catalog/hooks/use-catalog-mutations.ts`
- Create: `apps/app/src/features/feature-catalog/hooks/index.ts`

**Step 1: Query Hooks 작성**

```typescript
// apps/app/src/features/feature-catalog/hooks/use-catalog-queries.ts
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useCatalogFeatures(input?: {
  group?: string;
  search?: string;
  tags?: string[];
}) {
  const trpc = useTRPC();
  return useQuery(trpc.featureCatalog.list.queryOptions(input));
}

export function useCatalogFeatureBySlug(slug: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.featureCatalog.getBySlug.queryOptions(slug, {
      enabled: !!slug,
    }),
  );
}

export function useDependencyGraph(slugs: string[]) {
  const trpc = useTRPC();
  return useQuery(
    trpc.featureCatalog.getDependencyGraph.queryOptions(slugs, {
      enabled: slugs.length > 0,
    }),
  );
}

export function useValidateSelection(slugs: string[]) {
  const trpc = useTRPC();
  return useQuery(
    trpc.featureCatalog.validateSelection.queryOptions(slugs, {
      enabled: slugs.length > 0,
    }),
  );
}
```

**Step 2: index.ts 작성**

```typescript
// apps/app/src/features/feature-catalog/hooks/index.ts
export * from "./use-catalog-queries";
```

**Step 3: 커밋**

```bash
git add apps/app/src/features/feature-catalog/hooks/
git commit -m "feat(feature-catalog): add client query hooks"
```

---

## Task 11: Client — 카탈로그 목록 페이지

**Files:**
- Create: `apps/app/src/features/feature-catalog/pages/catalog-list.tsx`
- Create: `apps/app/src/features/feature-catalog/components/catalog-card.tsx`
- Create: `apps/app/src/features/feature-catalog/components/catalog-filter.tsx`
- Create: `apps/app/src/features/feature-catalog/components/index.ts`

**Step 1: CatalogCard 컴포넌트 작성**

```typescript
// apps/app/src/features/feature-catalog/components/catalog-card.tsx
import { Link } from "@tanstack/react-router";
import { Badge } from "@repo/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import type { CatalogFeature } from "@repo/drizzle";

interface Props {
  feature: CatalogFeature;
}

export function CatalogCard({ feature }: Props) {
  return (
    <Link to="/features/$slug" params={{ slug: feature.slug }}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {feature.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feature.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {feature.description}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{feature.group}</Badge>
            {(feature.tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: CatalogFilter 컴포넌트 작성**

```typescript
// apps/app/src/features/feature-catalog/components/catalog-filter.tsx
import { Input } from "@repo/ui/shadcn/input";
import { Button } from "@repo/ui/shadcn/button";
import { cn } from "@repo/ui/lib/utils";

const GROUPS = [
  { value: undefined, label: "전체" },
  { value: "core", label: "Core" },
  { value: "content", label: "Content" },
  { value: "commerce", label: "Commerce" },
  { value: "system", label: "System" },
] as const;

interface Props {
  group?: string;
  search: string;
  onGroupChange: (group?: string) => void;
  onSearchChange: (search: string) => void;
}

export function CatalogFilter({
  group,
  search,
  onGroupChange,
  onSearchChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Input
        placeholder="Feature 검색..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <Button
            key={g.label}
            variant={group === g.value ? "default" : "outline"}
            size="sm"
            onClick={() => onGroupChange(g.value)}
          >
            {g.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: components/index.ts 작성**

```typescript
// apps/app/src/features/feature-catalog/components/index.ts
export { CatalogCard } from "./catalog-card";
export { CatalogFilter } from "./catalog-filter";
```

**Step 4: CatalogList 페이지 작성**

```typescript
// apps/app/src/features/feature-catalog/pages/catalog-list.tsx
import { useState } from "react";
import { Feature } from "@repo/ui/components/feature";
import { FeatureHeader } from "@repo/ui/components/feature-header";
import { FeatureContents } from "@repo/ui/components/feature-contents";
import { useCatalogFeatures } from "../hooks";
import { CatalogCard } from "../components/catalog-card";
import { CatalogFilter } from "../components/catalog-filter";
import { Skeleton } from "@repo/ui/shadcn/skeleton";

export function CatalogListPage() {
  const [group, setGroup] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const { data: features, isLoading } = useCatalogFeatures({
    group,
    search: search || undefined,
  });

  return (
    <Feature>
      <FeatureHeader
        title="Feature Catalog"
        description="프로젝트에 추가할 Feature를 탐색하세요"
      />
      <FeatureContents>
        <div className="space-y-6">
          <CatalogFilter
            group={group}
            search={search}
            onGroupChange={setGroup}
            onSearchChange={setSearch}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))
              : (features ?? []).map((feature) => (
                  <CatalogCard key={feature.id} feature={feature} />
                ))}
          </div>
          {!isLoading && (features ?? []).length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              조건에 맞는 Feature가 없습니다
            </p>
          ) : null}
        </div>
      </FeatureContents>
    </Feature>
  );
}
```

**Step 5: 커밋**

```bash
git add apps/app/src/features/feature-catalog/pages/ apps/app/src/features/feature-catalog/components/
git commit -m "feat(feature-catalog): add catalog list page with card grid and filters"
```

---

## Task 12: Client — 상세 페이지

**Files:**
- Create: `apps/app/src/features/feature-catalog/pages/catalog-detail.tsx`

**Step 1: 상세 페이지 작성**

```typescript
// apps/app/src/features/feature-catalog/pages/catalog-detail.tsx
import { Feature } from "@repo/ui/components/feature";
import { FeatureHeader } from "@repo/ui/components/feature-header";
import { FeatureContents } from "@repo/ui/components/feature-contents";
import { Badge } from "@repo/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { useCatalogFeatureBySlug } from "../hooks";

interface Props {
  slug: string;
}

export function CatalogDetailPage({ slug }: Props) {
  const { data: feature, isLoading } = useCatalogFeatureBySlug(slug);

  if (isLoading) {
    return (
      <Feature>
        <FeatureHeader title="" />
        <FeatureContents>
          <Skeleton className="h-64" />
        </FeatureContents>
      </Feature>
    );
  }

  if (!feature) {
    return (
      <Feature>
        <FeatureHeader title="Feature를 찾을 수 없습니다" />
        <FeatureContents>
          <p className="text-muted-foreground">존재하지 않는 Feature입니다.</p>
        </FeatureContents>
      </Feature>
    );
  }

  const deps = feature.dependencies ?? [];
  const requiredDeps = deps.filter((d) => d.dependencyType === "required");
  const recommendedDeps = deps.filter((d) => d.dependencyType === "recommended");

  return (
    <Feature>
      <FeatureHeader
        title={feature.name}
        description={feature.description ?? undefined}
      />
      <FeatureContents>
        <div className="space-y-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{feature.group}</Badge>
            {(feature.tags ?? []).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Capabilities */}
          {(feature.capabilities ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">포함 기능</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {(feature.capabilities ?? []).map((cap) => (
                    <li key={cap}>{cap}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Dependencies */}
          {requiredDeps.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">필수 의존성</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {requiredDeps.map((d) => (
                    <Badge key={d.id}>{d.dependsOn.name}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {recommendedDeps.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">추천 의존성</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {recommendedDeps.map((d) => (
                    <Badge key={d.id} variant="secondary">
                      {d.dependsOn.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Screenshots */}
          {(feature.previewImages ?? []).length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">스크린샷</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(feature.previewImages ?? []).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`${feature.name} screenshot ${i + 1}`}
                      className="rounded-lg border"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </FeatureContents>
    </Feature>
  );
}
```

**Step 2: 커밋**

```bash
git add apps/app/src/features/feature-catalog/pages/catalog-detail.tsx
git commit -m "feat(feature-catalog): add catalog detail page with dependencies and screenshots"
```

---

## Task 13: Client — Routes + Feature index

**Files:**
- Create: `apps/app/src/features/feature-catalog/routes/index.ts`
- Create: `apps/app/src/features/feature-catalog/index.ts`
- Modify: `apps/app/src/router.tsx`

**Step 1: Route 생성 함수 작성**

```typescript
// apps/app/src/features/feature-catalog/routes/index.ts
import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { CatalogListPage } from "../pages/catalog-list";
import { CatalogDetailPage } from "../pages/catalog-detail";

export const CATALOG_PATH = "/features";
export const CATALOG_DETAIL_PATH = "/features/$slug";

export function createFeatureCatalogRoutes<T extends AnyRoute>(parentRoute: T) {
  const listRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/features",
    component: CatalogListPage,
  });

  const detailRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/features/$slug",
    component: () => {
      // useParams는 라우트 컴포넌트 내에서 사용
      const { slug } = detailRoute.useParams();
      return <CatalogDetailPage slug={slug} />;
    },
  });

  return [listRoute, detailRoute];
}
```

**Step 2: Feature index.ts 작성**

```typescript
// apps/app/src/features/feature-catalog/index.ts
export { createFeatureCatalogRoutes, CATALOG_PATH, CATALOG_DETAIL_PATH } from "./routes";
export * from "./hooks";
```

**Step 3: router.tsx에 라우트 등록**

`apps/app/src/router.tsx`에서:
- import 추가: `import { createFeatureCatalogRoutes } from "@features/feature-catalog";`
- `routeTree`의 적절한 위치에 `...createFeatureCatalogRoutes(rootRoute),` 추가 (public 라우트)

**Step 4: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 5: 커밋**

```bash
git add apps/app/src/features/feature-catalog/ apps/app/src/router.tsx
git commit -m "feat(feature-catalog): add client routes and register in app router"
```

---

## Task 14: Admin — 목록 + 편집 페이지

**Files:**
- Create: `apps/system-admin/src/features/feature-catalog/pages/admin-catalog-list.tsx`
- Create: `apps/system-admin/src/features/feature-catalog/routes/index.ts`
- Create: `apps/system-admin/src/features/feature-catalog/hooks/use-admin-catalog.ts`
- Create: `apps/system-admin/src/features/feature-catalog/hooks/index.ts`
- Create: `apps/system-admin/src/features/feature-catalog/index.ts`
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

이 Task에서는 Admin 목록 페이지, Admin Hook, 라우트, 메뉴 등록을 모두 구현합니다.
기존 Admin Feature들의 패턴을 참고하여 작성합니다.

**핵심 구현 사항:**
- `useAdminCatalogFeatures()` — Admin 전체 목록 조회 Hook
- `useAdminCatalogMutations()` — Create/Update/Reorder Mutation Hook
- `AdminCatalogListPage` — 테이블 형태의 Feature 관리 페이지
- `createFeatureCatalogAdminRoutes()` — Admin 라우트 생성 함수
- `feature-config.ts`에 메뉴 등록: `{ id: "feature-catalog", label: "Feature Catalog", path: "/admin/feature-catalog", icon: Package, order: 5 }`

**Step N: 빌드 확인**

Run: `cd apps/system-admin && pnpm tsc --noEmit`
Expected: PASS

**Step N+1: 커밋**

```bash
git add apps/system-admin/src/features/feature-catalog/ apps/system-admin/src/router.tsx apps/system-admin/src/feature-config.ts
git commit -m "feat(feature-catalog): add admin list page with CRUD and menu registration"
```

---

## Task 15: 빌드 검증 + Reference 문서 업데이트

**Step 1: 전체 TypeScript 빌드 확인**

Run (순서대로):
```bash
cd packages/drizzle && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```
Expected: 모두 PASS

**Step 2: Reference 문서 업데이트**

- `docs/reference/features-backend.md` — feature-catalog 서버 모듈/서비스/라우터 추가
- `docs/reference/features-frontend.md` — feature-catalog 클라이언트 페이지/훅 추가
- `docs/reference/database-schema.md` — catalog_features, catalog_dependencies 테이블 추가
- `docs/reference/server-registry.md` — tRPC/REST 엔드포인트 추가

**Step 3: 커밋**

```bash
git add docs/reference/
git commit -m "docs: update reference docs with feature-catalog module"
```

---

## Task 16: Runtime Verification

> `.claude/rules/runtime-verification.md` 절차 필수

**Step 1: 서버 시작 확인**

서버가 실행 중인지 확인. 실행 중이 아니면 사용자에게 서버 시작 요청.

**Step 2: REST API 검증**

```bash
# Public 목록
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/feature-catalog
# Expected: 200

# 없는 slug 조회
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/feature-catalog/nonexistent
# Expected: 404
```

**Step 3: tRPC 검증**

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/trpc/featureCatalog.list"
# Expected: 200
```

**Step 4: 브라우저 검증 (Playwright MCP)**

- `http://localhost:3000/features` 접속 → 카탈로그 페이지 렌더링 확인
- 콘솔 에러 없음 확인

**Step 5: Admin 검증**

- `http://localhost:3001/admin/feature-catalog` 접속 → Admin 목록 페이지 확인
