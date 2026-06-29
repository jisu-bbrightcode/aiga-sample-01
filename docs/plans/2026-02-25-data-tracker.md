# Data Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin이 정의한 트래커 템플릿으로 사용자가 데이터를 등록하고 차트로 조회하는 분석형 관리 feature 구현

**Architecture:** JSONB 플랫 패턴 — 트래커 정의(trackers) + 컬럼 정의(columns) + 데이터 행(entries, date+jsonb). Admin이 트래커/컬럼/차트 설정을 관리하고, 사용자가 데이터를 입력(수동/CSV/API)하며 Recharts로 시각화.

**Tech Stack:** NestJS, Drizzle ORM (PostgreSQL JSONB), tRPC + REST (Swagger), TanStack Router/Query, Recharts, Zod, Jotai

**Design Doc:** `docs/plans/2026-02-25-data-tracker-design.md`

---

## Task 1: DB Schema 정의

**Files:**
- Create: `packages/drizzle/src/schema/features/data-tracker/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: Schema 파일 생성**

```typescript
// packages/drizzle/src/schema/features/data-tracker/index.ts
import { baseColumnsWithSoftDelete, baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const dataTrackerChartTypeEnum = pgEnum("data_tracker_chart_type", [
  "line",
  "bar",
  "pie",
]);

export const dataTrackerScopeEnum = pgEnum("data_tracker_scope", [
  "personal",
  "organization",
  "all",
]);

export const dataTrackerColumnTypeEnum = pgEnum("data_tracker_column_type", [
  "text",
  "number",
]);

export const dataTrackerSourceEnum = pgEnum("data_tracker_source", [
  "manual",
  "csv_import",
  "api",
]);

// ============================================================================
// Types (JSONB)
// ============================================================================

export type DataTrackerChartConfig = {
  yAxisKey?: string;
  groupByKey?: string;
  categoryKey?: string;
  valueKey?: string;
  aggregation: "sum" | "avg" | "count" | "min" | "max";
};

// ============================================================================
// Tables
// ============================================================================

export const dataTrackerTrackers = pgTable("data_tracker_trackers", {
  ...baseColumnsWithSoftDelete(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 200 }).unique().notNull(),
  chartType: dataTrackerChartTypeEnum("chart_type").notNull(),
  chartConfig: jsonb("chart_config").$type<DataTrackerChartConfig>().notNull(),
  scope: dataTrackerScopeEnum("scope").notNull().default("all"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const dataTrackerColumns = pgTable(
  "data_tracker_columns",
  {
    ...baseColumns(),
    trackerId: uuid("tracker_id")
      .notNull()
      .references(() => dataTrackerTrackers.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    dataType: dataTrackerColumnTypeEnum("data_type").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    index("idx_data_tracker_columns_tracker_order").on(
      table.trackerId,
      table.sortOrder,
    ),
  ],
);

export const dataTrackerEntries = pgTable(
  "data_tracker_entries",
  {
    ...baseColumnsWithSoftDelete(),
    trackerId: uuid("tracker_id")
      .notNull()
      .references(() => dataTrackerTrackers.id, { onDelete: "cascade" }),
    date: date("date", { mode: "date" }).notNull(),
    data: jsonb("data").$type<Record<string, string | number>>().notNull(),
    source: dataTrackerSourceEnum("source").notNull().default("manual"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_data_tracker_entries_tracker_date").on(
      table.trackerId,
      table.date,
    ),
    index("idx_data_tracker_entries_tracker_user").on(
      table.trackerId,
      table.createdById,
    ),
  ],
);

// ============================================================================
// Relations
// ============================================================================

import { relations } from "drizzle-orm";

export const dataTrackerTrackersRelations = relations(
  dataTrackerTrackers,
  ({ many, one }) => ({
    columns: many(dataTrackerColumns),
    entries: many(dataTrackerEntries),
    createdBy: one(profiles, {
      fields: [dataTrackerTrackers.createdById],
      references: [profiles.id],
    }),
  }),
);

export const dataTrackerColumnsRelations = relations(
  dataTrackerColumns,
  ({ one }) => ({
    tracker: one(dataTrackerTrackers, {
      fields: [dataTrackerColumns.trackerId],
      references: [dataTrackerTrackers.id],
    }),
  }),
);

export const dataTrackerEntriesRelations = relations(
  dataTrackerEntries,
  ({ one }) => ({
    tracker: one(dataTrackerTrackers, {
      fields: [dataTrackerEntries.trackerId],
      references: [dataTrackerTrackers.id],
    }),
    createdBy: one(profiles, {
      fields: [dataTrackerEntries.createdById],
      references: [profiles.id],
    }),
  }),
);

// ============================================================================
// Type Exports
// ============================================================================

export type DataTrackerTracker = typeof dataTrackerTrackers.$inferSelect;
export type NewDataTrackerTracker = typeof dataTrackerTrackers.$inferInsert;

export type DataTrackerColumn = typeof dataTrackerColumns.$inferSelect;
export type NewDataTrackerColumn = typeof dataTrackerColumns.$inferInsert;

export type DataTrackerEntry = typeof dataTrackerEntries.$inferSelect;
export type NewDataTrackerEntry = typeof dataTrackerEntries.$inferInsert;
```

**Step 2: Schema Index에 등록**

`packages/drizzle/src/schema/index.ts` 끝에 추가:
```typescript
export * from "./features/data-tracker";
```

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/features/data-tracker/index.ts packages/drizzle/src/schema/index.ts
git commit -m "feat(data-tracker): DB 스키마 정의 (trackers, columns, entries)"
```

---

## Task 2: Server Feature — Service

**Files:**
- Create: `packages/features/data-tracker/service/data-tracker.service.ts`
- Create: `packages/features/data-tracker/service/index.ts`

**Step 1: Service 구현**

```typescript
// packages/features/data-tracker/service/data-tracker.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { eq, and, desc, asc, count, gte, lte, sql } from "drizzle-orm";
import {
  dataTrackerTrackers,
  dataTrackerColumns,
  dataTrackerEntries,
} from "@repo/drizzle";
import type {
  DataTrackerChartConfig,
  DataTrackerColumn,
} from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";

const logger = createLogger("data-tracker");

@Injectable()
export class DataTrackerService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  // ========================================================================
  // Admin — Tracker CRUD
  // ========================================================================

  async adminList() {
    return this.db.query.dataTrackerTrackers.findMany({
      where: eq(dataTrackerTrackers.isDeleted, false),
      orderBy: [desc(dataTrackerTrackers.createdAt)],
      with: { columns: { orderBy: [asc(dataTrackerColumns.sortOrder)] } },
    });
  }

  async adminGetById(id: string) {
    const tracker = await this.db.query.dataTrackerTrackers.findFirst({
      where: and(
        eq(dataTrackerTrackers.id, id),
        eq(dataTrackerTrackers.isDeleted, false),
      ),
      with: { columns: { orderBy: [asc(dataTrackerColumns.sortOrder)] } },
    });
    if (!tracker) throw new NotFoundException(`Tracker not found: ${id}`);
    return tracker;
  }

  async adminCreate(
    input: {
      name: string;
      description?: string;
      chartType: "line" | "bar" | "pie";
      chartConfig: DataTrackerChartConfig;
      scope: "personal" | "organization" | "all";
      columns: { key: string; label: string; dataType: "text" | "number"; isRequired: boolean; sortOrder: number }[];
    },
    createdById: string,
  ) {
    const slug = this.generateSlug(input.name);
    const existing = await this.db.query.dataTrackerTrackers.findFirst({
      where: eq(dataTrackerTrackers.slug, slug),
    });
    if (existing) throw new ConflictException(`Slug already exists: ${slug}`);

    const [tracker] = await this.db
      .insert(dataTrackerTrackers)
      .values({
        name: input.name,
        description: input.description,
        slug,
        chartType: input.chartType,
        chartConfig: input.chartConfig,
        scope: input.scope,
        createdById,
      })
      .returning();

    if (input.columns.length > 0) {
      await this.db.insert(dataTrackerColumns).values(
        input.columns.map((col) => ({ ...col, trackerId: tracker.id })),
      );
    }

    logger.info("Tracker created", {
      "data_tracker.tracker_id": tracker.id,
      "data_tracker.slug": slug,
      "user.id": createdById,
    });

    return this.adminGetById(tracker.id);
  }

  async adminUpdate(
    id: string,
    input: {
      name?: string;
      description?: string;
      chartType?: "line" | "bar" | "pie";
      chartConfig?: DataTrackerChartConfig;
      scope?: "personal" | "organization" | "all";
      columns?: { key: string; label: string; dataType: "text" | "number"; isRequired: boolean; sortOrder: number }[];
    },
  ) {
    const existing = await this.adminGetById(id);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.chartType !== undefined) updateData.chartType = input.chartType;
    if (input.chartConfig !== undefined) updateData.chartConfig = input.chartConfig;
    if (input.scope !== undefined) updateData.scope = input.scope;

    if (input.name && input.name !== existing.name) {
      const slug = this.generateSlug(input.name);
      updateData.slug = slug;
    }

    if (Object.keys(updateData).length > 0) {
      await this.db
        .update(dataTrackerTrackers)
        .set(updateData)
        .where(eq(dataTrackerTrackers.id, id));
    }

    if (input.columns !== undefined) {
      await this.db
        .delete(dataTrackerColumns)
        .where(eq(dataTrackerColumns.trackerId, id));
      if (input.columns.length > 0) {
        await this.db.insert(dataTrackerColumns).values(
          input.columns.map((col) => ({ ...col, trackerId: id })),
        );
      }
    }

    logger.info("Tracker updated", { "data_tracker.tracker_id": id });
    return this.adminGetById(id);
  }

  async adminDelete(id: string) {
    await this.adminGetById(id);
    await this.db
      .update(dataTrackerTrackers)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(dataTrackerTrackers.id, id));

    logger.info("Tracker deleted", { "data_tracker.tracker_id": id });
    return { success: true };
  }

  async adminToggleActive(id: string) {
    const tracker = await this.adminGetById(id);
    await this.db
      .update(dataTrackerTrackers)
      .set({ isActive: !tracker.isActive })
      .where(eq(dataTrackerTrackers.id, id));

    logger.info("Tracker toggled", {
      "data_tracker.tracker_id": id,
      "data_tracker.is_active": !tracker.isActive,
    });
    return this.adminGetById(id);
  }

  // ========================================================================
  // User — Tracker List / Detail
  // ========================================================================

  async list() {
    return this.db.query.dataTrackerTrackers.findMany({
      where: and(
        eq(dataTrackerTrackers.isActive, true),
        eq(dataTrackerTrackers.isDeleted, false),
      ),
      orderBy: [asc(dataTrackerTrackers.name)],
      with: { columns: { orderBy: [asc(dataTrackerColumns.sortOrder)] } },
    });
  }

  async getBySlug(slug: string) {
    const tracker = await this.db.query.dataTrackerTrackers.findFirst({
      where: and(
        eq(dataTrackerTrackers.slug, slug),
        eq(dataTrackerTrackers.isActive, true),
        eq(dataTrackerTrackers.isDeleted, false),
      ),
      with: { columns: { orderBy: [asc(dataTrackerColumns.sortOrder)] } },
    });
    if (!tracker) throw new NotFoundException(`Tracker not found: ${slug}`);
    return tracker;
  }

  // ========================================================================
  // User — Entry CRUD
  // ========================================================================

  async addEntry(
    trackerId: string,
    input: { date: Date; data: Record<string, string | number> },
    createdById: string,
    source: "manual" | "csv_import" | "api" = "manual",
  ) {
    const tracker = await this.adminGetById(trackerId);
    if (!tracker.isActive) throw new ForbiddenException("Tracker is not active");

    const [entry] = await this.db
      .insert(dataTrackerEntries)
      .values({
        trackerId,
        date: input.date,
        data: input.data,
        source,
        createdById,
      })
      .returning();

    logger.info("Entry added", {
      "data_tracker.tracker_id": trackerId,
      "data_tracker.entry_id": entry.id,
      "data_tracker.source": source,
      "user.id": createdById,
    });
    return entry;
  }

  async updateEntry(entryId: string, input: { date?: Date; data?: Record<string, string | number> }) {
    const entry = await this.db.query.dataTrackerEntries.findFirst({
      where: and(
        eq(dataTrackerEntries.id, entryId),
        eq(dataTrackerEntries.isDeleted, false),
      ),
    });
    if (!entry) throw new NotFoundException(`Entry not found: ${entryId}`);

    const updateData: Record<string, unknown> = {};
    if (input.date !== undefined) updateData.date = input.date;
    if (input.data !== undefined) updateData.data = input.data;

    await this.db
      .update(dataTrackerEntries)
      .set(updateData)
      .where(eq(dataTrackerEntries.id, entryId));

    logger.info("Entry updated", { "data_tracker.entry_id": entryId });
    return this.db.query.dataTrackerEntries.findFirst({
      where: eq(dataTrackerEntries.id, entryId),
    });
  }

  async deleteEntry(entryId: string) {
    const entry = await this.db.query.dataTrackerEntries.findFirst({
      where: and(
        eq(dataTrackerEntries.id, entryId),
        eq(dataTrackerEntries.isDeleted, false),
      ),
    });
    if (!entry) throw new NotFoundException(`Entry not found: ${entryId}`);

    await this.db
      .update(dataTrackerEntries)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(dataTrackerEntries.id, entryId));

    logger.info("Entry deleted", { "data_tracker.entry_id": entryId });
    return { success: true };
  }

  async getEntries(
    trackerId: string,
    input: { page: number; limit: number; userId?: string },
  ) {
    const { page, limit, userId } = input;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(dataTrackerEntries.trackerId, trackerId),
      eq(dataTrackerEntries.isDeleted, false),
    ];
    if (userId) conditions.push(eq(dataTrackerEntries.createdById, userId));

    const whereCondition = and(...conditions);

    const [data, totalResult] = await Promise.all([
      this.db.query.dataTrackerEntries.findMany({
        where: whereCondition,
        limit,
        offset,
        orderBy: [desc(dataTrackerEntries.date)],
        with: { createdBy: true },
      }),
      this.db
        .select({ count: count() })
        .from(dataTrackerEntries)
        .where(whereCondition),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ========================================================================
  // User — Chart Data
  // ========================================================================

  async getChartData(
    trackerId: string,
    input: { days?: number; userId?: string },
  ) {
    const tracker = await this.adminGetById(trackerId);
    const { days = 30, userId } = input;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conditions = [
      eq(dataTrackerEntries.trackerId, trackerId),
      eq(dataTrackerEntries.isDeleted, false),
      gte(dataTrackerEntries.date, startDate),
    ];
    if (userId) conditions.push(eq(dataTrackerEntries.createdById, userId));

    const entries = await this.db.query.dataTrackerEntries.findMany({
      where: and(...conditions),
      orderBy: [asc(dataTrackerEntries.date)],
    });

    return {
      tracker: {
        chartType: tracker.chartType,
        chartConfig: tracker.chartConfig,
        columns: tracker.columns,
      },
      entries: entries.map((e) => ({
        date: e.date,
        ...e.data,
      })),
    };
  }

  // ========================================================================
  // CSV Import
  // ========================================================================

  async importCsv(
    trackerId: string,
    rows: { date: Date; data: Record<string, string | number> }[],
    createdById: string,
  ) {
    const tracker = await this.adminGetById(trackerId);
    if (!tracker.isActive) throw new ForbiddenException("Tracker is not active");

    const values = rows.map((row) => ({
      trackerId,
      date: row.date,
      data: row.data,
      source: "csv_import" as const,
      createdById,
    }));

    const inserted = await this.db
      .insert(dataTrackerEntries)
      .values(values)
      .returning();

    logger.info("CSV imported", {
      "data_tracker.tracker_id": trackerId,
      "data_tracker.rows_count": inserted.length,
      "user.id": createdById,
    });

    return { success: true, count: inserted.length };
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return `${baseSlug}-${Date.now().toString(36)}`;
  }
}
```

```typescript
// packages/features/data-tracker/service/index.ts
export { DataTrackerService } from "./data-tracker.service";
```

**Step 2: 커밋**

```bash
git add packages/features/data-tracker/service/
git commit -m "feat(data-tracker): Service 구현 (Admin CRUD, Entry CRUD, Chart, CSV import)"
```

---

## Task 3: Server Feature — tRPC Router

**Files:**
- Create: `packages/features/data-tracker/data-tracker.router.ts`

**Step 1: tRPC Router 구현**

```typescript
// packages/features/data-tracker/data-tracker.router.ts
import { z } from "zod";
import {
  router as createTRPCRouter,
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  createSingleServiceContainer,
} from "@repo/core/trpc";
import type { DataTrackerService } from "./service/data-tracker.service";

const { service: getDataTrackerService, inject: injectDataTrackerService } =
  createSingleServiceContainer<DataTrackerService>();

export { injectDataTrackerService };

// ========================================================================
// Zod Schemas
// ========================================================================

const columnSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  dataType: z.enum(["text", "number"]),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0),
});

const chartConfigSchema = z.object({
  yAxisKey: z.string().optional(),
  groupByKey: z.string().optional(),
  categoryKey: z.string().optional(),
  valueKey: z.string().optional(),
  aggregation: z.enum(["sum", "avg", "count", "min", "max"]),
});

const createTrackerSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  chartType: z.enum(["line", "bar", "pie"]),
  chartConfig: chartConfigSchema,
  scope: z.enum(["personal", "organization", "all"]).default("all"),
  columns: z.array(columnSchema).min(1),
});

const updateTrackerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  chartType: z.enum(["line", "bar", "pie"]).optional(),
  chartConfig: chartConfigSchema.optional(),
  scope: z.enum(["personal", "organization", "all"]).optional(),
  columns: z.array(columnSchema).optional(),
});

const entryDataSchema = z.record(z.union([z.string(), z.number()]));

// ========================================================================
// Router
// ========================================================================

export const dataTrackerRouter = createTRPCRouter({
  // Admin
  adminList: adminProcedure.query(async () => {
    return getDataTrackerService().adminList();
  }),

  adminGetById: adminProcedure
    .input(z.string().uuid())
    .query(async ({ input }) => {
      return getDataTrackerService().adminGetById(input);
    }),

  adminCreate: adminProcedure
    .input(createTrackerSchema)
    .mutation(async ({ input, ctx }) => {
      return getDataTrackerService().adminCreate(input, ctx.user.id);
    }),

  adminUpdate: adminProcedure
    .input(updateTrackerSchema)
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return getDataTrackerService().adminUpdate(id, data);
    }),

  adminDelete: adminProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return getDataTrackerService().adminDelete(input);
    }),

  adminToggleActive: adminProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return getDataTrackerService().adminToggleActive(input);
    }),

  // User
  list: protectedProcedure.query(async () => {
    return getDataTrackerService().list();
  }),

  getBySlug: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return getDataTrackerService().getBySlug(input);
    }),

  addEntry: protectedProcedure
    .input(
      z.object({
        trackerId: z.string().uuid(),
        date: z.coerce.date(),
        data: entryDataSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return getDataTrackerService().addEntry(
        input.trackerId,
        { date: input.date, data: input.data },
        ctx.user.id,
      );
    }),

  updateEntry: protectedProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
        date: z.coerce.date().optional(),
        data: entryDataSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { entryId, ...data } = input;
      return getDataTrackerService().updateEntry(entryId, data);
    }),

  deleteEntry: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input }) => {
      return getDataTrackerService().deleteEntry(input);
    }),

  getEntries: protectedProcedure
    .input(
      z.object({
        trackerId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        viewMode: z.enum(["personal", "organization"]).default("personal"),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = input.viewMode === "personal" ? ctx.user.id : undefined;
      return getDataTrackerService().getEntries(input.trackerId, {
        page: input.page,
        limit: input.limit,
        userId,
      });
    }),

  getChartData: protectedProcedure
    .input(
      z.object({
        trackerId: z.string().uuid(),
        days: z.number().int().min(1).max(365).default(30),
        viewMode: z.enum(["personal", "organization"]).default("personal"),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = input.viewMode === "personal" ? ctx.user.id : undefined;
      return getDataTrackerService().getChartData(input.trackerId, {
        days: input.days,
        userId,
      });
    }),

  importCsv: protectedProcedure
    .input(
      z.object({
        trackerId: z.string().uuid(),
        rows: z.array(
          z.object({
            date: z.coerce.date(),
            data: entryDataSchema,
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return getDataTrackerService().importCsv(
        input.trackerId,
        input.rows,
        ctx.user.id,
      );
    }),

  // External API
  pushEntry: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        apiKey: z.string(),
        date: z.coerce.date(),
        data: entryDataSchema,
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const tracker = await getDataTrackerService().getBySlug(input.slug);
      return getDataTrackerService().addEntry(
        tracker.id,
        { date: input.date, data: input.data },
        input.userId,
        "api",
      );
    }),
});

export type DataTrackerRouter = typeof dataTrackerRouter;
```

**Step 2: 커밋**

```bash
git add packages/features/data-tracker/data-tracker.router.ts
git commit -m "feat(data-tracker): tRPC Router 구현"
```

---

## Task 4: Server Feature — REST Controller

**Files:**
- Create: `packages/features/data-tracker/controller/data-tracker.controller.ts`
- Create: `packages/features/data-tracker/controller/index.ts`

**Step 1: Admin + User Controller 구현**

```typescript
// packages/features/data-tracker/controller/data-tracker.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, NestAdminGuard, CurrentUser } from "@repo/core/nestjs/auth";
import { DataTrackerService } from "../service/data-tracker.service";

// ========================================================================
// Admin Controller
// ========================================================================

@ApiTags("DataTracker Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, NestAdminGuard)
@Controller("admin/data-tracker")
export class DataTrackerAdminController {
  constructor(private readonly service: DataTrackerService) {}

  @Get()
  @ApiOperation({ summary: "트래커 목록 조회 (Admin)" })
  @ApiResponse({ status: 200, description: "트래커 목록 반환" })
  async list() {
    return this.service.adminList();
  }

  @Get(":id")
  @ApiOperation({ summary: "트래커 상세 조회 (Admin)" })
  @ApiParam({ name: "id", description: "트래커 ID" })
  @ApiResponse({ status: 200, description: "트래커 상세 반환" })
  @ApiResponse({ status: 404, description: "트래커를 찾을 수 없음" })
  async getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.adminGetById(id);
  }

  @Post()
  @ApiOperation({ summary: "트래커 생성" })
  @ApiResponse({ status: 201, description: "트래커 생성 성공" })
  @ApiResponse({ status: 409, description: "슬러그 중복" })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.service.adminCreate(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "트래커 수정" })
  @ApiParam({ name: "id", description: "트래커 ID" })
  @ApiResponse({ status: 200, description: "트래커 수정 성공" })
  async update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: any) {
    return this.service.adminUpdate(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "트래커 삭제" })
  @ApiParam({ name: "id", description: "트래커 ID" })
  @ApiResponse({ status: 200, description: "트래커 삭제 성공" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.adminDelete(id);
  }

  @Patch(":id/toggle")
  @ApiOperation({ summary: "트래커 활성/비활성 토글" })
  @ApiParam({ name: "id", description: "트래커 ID" })
  @ApiResponse({ status: 200, description: "토글 성공" })
  async toggleActive(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.adminToggleActive(id);
  }
}

// ========================================================================
// User Controller
// ========================================================================

@ApiTags("DataTracker")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("data-tracker")
export class DataTrackerUserController {
  constructor(private readonly service: DataTrackerService) {}

  @Get()
  @ApiOperation({ summary: "활성 트래커 목록 조회" })
  @ApiResponse({ status: 200, description: "트래커 목록 반환" })
  async list() {
    return this.service.list();
  }

  @Get(":slug")
  @ApiOperation({ summary: "트래커 상세 조회" })
  @ApiParam({ name: "slug", description: "트래커 슬러그" })
  @ApiResponse({ status: 200, description: "트래커 상세 반환" })
  async getBySlug(@Param("slug") slug: string) {
    return this.service.getBySlug(slug);
  }

  @Get(":slug/entries")
  @ApiOperation({ summary: "트래커 데이터 목록 조회" })
  @ApiParam({ name: "slug", description: "트래커 슬러그" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "viewMode", required: false, enum: ["personal", "organization"] })
  @ApiResponse({ status: 200, description: "데이터 목록 반환" })
  async getEntries(
    @Param("slug") slug: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("viewMode") viewMode: string = "personal",
    @CurrentUser() user: any,
  ) {
    const tracker = await this.service.getBySlug(slug);
    const userId = viewMode === "personal" ? user.id : undefined;
    return this.service.getEntries(tracker.id, { page, limit, userId });
  }

  @Post(":slug/entries")
  @ApiOperation({ summary: "데이터 입력" })
  @ApiParam({ name: "slug", description: "트래커 슬러그" })
  @ApiResponse({ status: 201, description: "데이터 입력 성공" })
  async addEntry(
    @Param("slug") slug: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    const tracker = await this.service.getBySlug(slug);
    return this.service.addEntry(tracker.id, dto, user.id);
  }

  @Patch(":slug/entries/:entryId")
  @ApiOperation({ summary: "데이터 수정" })
  @ApiResponse({ status: 200, description: "데이터 수정 성공" })
  async updateEntry(
    @Param("entryId", ParseUUIDPipe) entryId: string,
    @Body() dto: any,
  ) {
    return this.service.updateEntry(entryId, dto);
  }

  @Delete(":slug/entries/:entryId")
  @ApiOperation({ summary: "데이터 삭제" })
  @ApiResponse({ status: 200, description: "데이터 삭제 성공" })
  async deleteEntry(@Param("entryId", ParseUUIDPipe) entryId: string) {
    return this.service.deleteEntry(entryId);
  }

  @Post(":slug/import")
  @ApiOperation({ summary: "CSV 벌크 입력" })
  @ApiResponse({ status: 201, description: "벌크 입력 성공" })
  async importCsv(
    @Param("slug") slug: string,
    @Body() dto: any,
    @CurrentUser() user: any,
  ) {
    const tracker = await this.service.getBySlug(slug);
    return this.service.importCsv(tracker.id, dto.rows, user.id);
  }

  @Get(":slug/chart")
  @ApiOperation({ summary: "차트 집계 데이터 조회" })
  @ApiParam({ name: "slug", description: "트래커 슬러그" })
  @ApiQuery({ name: "days", required: false, type: Number })
  @ApiQuery({ name: "viewMode", required: false, enum: ["personal", "organization"] })
  @ApiResponse({ status: 200, description: "차트 데이터 반환" })
  async getChartData(
    @Param("slug") slug: string,
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query("viewMode") viewMode: string = "personal",
    @CurrentUser() user: any,
  ) {
    const tracker = await this.service.getBySlug(slug);
    const userId = viewMode === "personal" ? user.id : undefined;
    return this.service.getChartData(tracker.id, { days, userId });
  }

  @Post(":slug/push")
  @ApiOperation({ summary: "외부 API 데이터 푸시" })
  @ApiResponse({ status: 201, description: "데이터 푸시 성공" })
  async pushEntry(@Param("slug") slug: string, @Body() dto: any) {
    const tracker = await this.service.getBySlug(slug);
    return this.service.addEntry(tracker.id, dto, dto.userId, "api");
  }
}
```

```typescript
// packages/features/data-tracker/controller/index.ts
export { DataTrackerAdminController, DataTrackerUserController } from "./data-tracker.controller";
```

**Step 2: 커밋**

```bash
git add packages/features/data-tracker/controller/
git commit -m "feat(data-tracker): REST Controller + Swagger 데코레이터 구현"
```

---

## Task 5: Server Feature — Module + Index + 등록

**Files:**
- Create: `packages/features/data-tracker/data-tracker.module.ts`
- Create: `packages/features/data-tracker/index.ts`
- Modify: `packages/features/package.json`
- Modify: `packages/features/app-router.ts`
- Modify: `apps/server/src/trpc/router.ts`
- Modify: `apps/server/src/app.module.ts`

**Step 1: Module + Index**

```typescript
// packages/features/data-tracker/data-tracker.module.ts
import { Module, OnModuleInit } from "@nestjs/common";
import { DataTrackerAdminController, DataTrackerUserController } from "./controller";
import { DataTrackerService } from "./service";
import { injectDataTrackerService } from "./data-tracker.router";

@Module({
  controllers: [DataTrackerAdminController, DataTrackerUserController],
  providers: [DataTrackerService],
  exports: [DataTrackerService],
})
export class DataTrackerModule implements OnModuleInit {
  constructor(private readonly dataTrackerService: DataTrackerService) {}

  onModuleInit() {
    injectDataTrackerService(this.dataTrackerService);
  }
}
```

```typescript
// packages/features/data-tracker/index.ts
export { DataTrackerModule } from "./data-tracker.module";
export { DataTrackerAdminController, DataTrackerUserController } from "./controller";
export { dataTrackerRouter, injectDataTrackerService } from "./data-tracker.router";
export type { DataTrackerRouter } from "./data-tracker.router";
export { DataTrackerService } from "./service";
```

**Step 2: package.json에 export 추가**

`packages/features/package.json`의 `exports`에 추가:
```json
"./data-tracker": "./data-tracker/index.ts"
```

**Step 3: tRPC 타입 등록** (`packages/features/app-router.ts`)

import 추가:
```typescript
import { dataTrackerRouter } from './data-tracker';
```
router 객체에 추가:
```typescript
dataTracker: dataTrackerRouter,
```

**Step 4: tRPC 런타임 등록** (`apps/server/src/trpc/router.ts`)

import 추가:
```typescript
import { dataTrackerRouter } from '@repo/features/data-tracker';
```
router 객체에 추가:
```typescript
dataTracker: dataTrackerRouter,
```

**Step 5: NestJS Module 등록** (`apps/server/src/app.module.ts`)

import 추가:
```typescript
import { DataTrackerModule } from '@repo/features/data-tracker';
```
imports 배열에 추가:
```typescript
DataTrackerModule,
```

**Step 6: 커밋**

```bash
git add packages/features/data-tracker/data-tracker.module.ts packages/features/data-tracker/index.ts packages/features/package.json packages/features/app-router.ts apps/server/src/trpc/router.ts apps/server/src/app.module.ts
git commit -m "feat(data-tracker): Module + Index + App 등록 (NestJS, tRPC)"
```

---

## Task 6: Admin UI — Hooks + 트래커 관리 페이지

**Files:**
- Create: `apps/system-admin/src/features/data-tracker/hooks/use-data-tracker.ts`
- Create: `apps/system-admin/src/features/data-tracker/hooks/index.ts`
- Create: `apps/system-admin/src/features/data-tracker/pages/data-tracker-admin-page.tsx`
- Create: `apps/system-admin/src/features/data-tracker/pages/data-tracker-form-page.tsx`
- Create: `apps/system-admin/src/features/data-tracker/pages/index.ts`
- Create: `apps/system-admin/src/features/data-tracker/routes.tsx`
- Create: `apps/system-admin/src/features/data-tracker/index.ts`
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

Admin UI 상세 구현 내용은 설계 문서의 화면 설계 섹션을 따릅니다:
- 트래커 목록 테이블 (이름, 차트타입, scope, 활성, 엔트리 수)
- 트래커 생성/수정 폼 (기본정보 + 동적 컬럼 정의 + 차트 설정)

**커밋:**
```bash
git add apps/system-admin/src/features/data-tracker/ apps/system-admin/src/router.tsx apps/system-admin/src/feature-config.ts
git commit -m "feat(data-tracker): Admin UI — 트래커 관리 페이지 구현"
```

---

## Task 7: User UI — 트래커 목록 + 상세 (차트/데이터 뷰)

**Files:**
- Create: `apps/app/src/features/data-tracker/hooks/use-data-tracker.ts`
- Create: `apps/app/src/features/data-tracker/hooks/index.ts`
- Create: `apps/app/src/features/data-tracker/pages/tracker-list.tsx`
- Create: `apps/app/src/features/data-tracker/pages/tracker-detail.tsx`
- Create: `apps/app/src/features/data-tracker/pages/index.ts`
- Create: `apps/app/src/features/data-tracker/components/tracker-chart.tsx`
- Create: `apps/app/src/features/data-tracker/components/entry-table.tsx`
- Create: `apps/app/src/features/data-tracker/components/entry-form-dialog.tsx`
- Create: `apps/app/src/features/data-tracker/components/csv-import-dialog.tsx`
- Create: `apps/app/src/features/data-tracker/routes/index.ts`
- Create: `apps/app/src/features/data-tracker/routes/tracker-list-page.tsx`
- Create: `apps/app/src/features/data-tracker/routes/tracker-detail-page.tsx`
- Create: `apps/app/src/features/data-tracker/index.ts`
- Modify: `apps/app/src/router.tsx`

사용자 화면 구현 내용:
- 트래커 목록: 카드 그리드
- 트래커 상세: 탭 (차트 뷰 / 데이터 뷰)
- 차트: Recharts (Line/Bar/Pie), 기간 필터, 개인↔조직 토글
- 데이터 뷰: 테이블 + 입력 Dialog + CSV import Dialog

**커밋:**
```bash
git add apps/app/src/features/data-tracker/ apps/app/src/router.tsx
git commit -m "feat(data-tracker): User UI — 트래커 목록/상세 페이지 (차트 + 데이터 뷰)"
```

---

## Task 8: TypeScript 빌드 검증 + Migration

**Step 1: TypeScript 빌드 검증**

```bash
cd packages/drizzle && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```

**Step 2: DB Migration 생성**

```bash
pnpm drizzle-kit generate
```

**Step 3: 다른 Feature 미수정 확인**

```bash
git status
# packages/features/data-tracker/ 와 등록 파일만 변경되었는지 확인
```

**Step 4: 커밋**

```bash
git add .
git commit -m "feat(data-tracker): TypeScript 빌드 검증 + DB migration 생성"
```

---

## Task 9: Reference 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/features-frontend.md`
- Modify: `docs/reference/database-schema.md`

**내용:**
- features-backend.md: DataTracker feature (Module, Service, Controller, Router) 추가
- features-frontend.md: DataTracker client feature (Admin + User) 추가
- database-schema.md: data_tracker_trackers, data_tracker_columns, data_tracker_entries 테이블 추가

**커밋:**
```bash
git add docs/reference/
git commit -m "docs(data-tracker): Reference 문서 업데이트"
```
