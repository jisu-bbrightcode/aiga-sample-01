# Phase 1: 운영 안정 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SaaS 운영에 필요한 Scheduled Job, Audit Log, Analytics Dashboard 3개 Feature를 구현한다.

**Architecture:** 3개 Feature를 독립 모듈로 구현하되, Analytics의 일별 집계가 Scheduler에 의존하므로 Scheduled Job → Audit Log → Analytics 순서로 구현한다. 모든 Feature는 `packages/features/` 서버 모듈 + `apps/system-admin/` Admin UI 패턴을 따른다.

**Tech Stack:** NestJS + `@nestjs/schedule` (Cron), Drizzle ORM, tRPC v11, React + TanStack Router/Query, Recharts, shadcn/ui

**Design doc:** `docs/plans/2026-02-15-ops-phase1-design.md`

---

## Phase A: Scheduled Job

### Task 1: `@nestjs/schedule` 의존성 설치

**Files:**
- Modify: `apps/server/package.json`

**Step 1: 패키지 설치**

```bash
cd apps/server && pnpm add @nestjs/schedule
```

**Step 2: 커밋**

```bash
git add apps/server/package.json ../../pnpm-lock.yaml
git commit -m "chore: @nestjs/schedule 의존성 추가"
```

---

### Task 2: Scheduled Job DB 스키마

**Files:**
- Create: `packages/drizzle/src/schema/features/scheduled-job/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: 스키마 작성**

```typescript
// packages/drizzle/src/schema/features/scheduled-job/index.ts
import { baseColumns } from "../../../utils";
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const systemJobRunStatusEnum = pgEnum("system_job_run_status", [
  "running",
  "success",
  "failed",
]);

// ============================================================================
// Tables
// ============================================================================

export const systemScheduledJobs = pgTable("system_scheduled_jobs", {
  ...baseColumns(),
  jobKey: text("job_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  cronExpression: text("cron_expression").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export const systemJobRuns = pgTable("system_job_runs", {
  ...baseColumns(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => systemScheduledJobs.id, { onDelete: "cascade" }),
  status: systemJobRunStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SystemScheduledJob = typeof systemScheduledJobs.$inferSelect;
export type NewSystemScheduledJob = typeof systemScheduledJobs.$inferInsert;

export type SystemJobRun = typeof systemJobRuns.$inferSelect;
export type NewSystemJobRun = typeof systemJobRuns.$inferInsert;
```

**Step 2: schema/index.ts에 등록**

`packages/drizzle/src/schema/index.ts`의 Feature Schemas 블록 끝에 추가:

```typescript
export * from "./features/scheduled-job";
```

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/features/scheduled-job/ packages/drizzle/src/schema/index.ts
git commit -m "feat(scheduled-job): DB 스키마 추가 (system_scheduled_jobs, system_job_runs)"
```

---

### Task 3: ScheduledJobService 구현

**Files:**
- Create: `packages/features/scheduled-job/service/scheduled-job.service.ts`
- Create: `packages/features/scheduled-job/service/index.ts`

**Step 1: 서비스 작성**

```typescript
// packages/features/scheduled-job/service/scheduled-job.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDrizzle, type DrizzleDB } from '@repo/drizzle';
import { eq, desc, count } from 'drizzle-orm';
import {
  systemScheduledJobs,
  systemJobRuns,
} from '@repo/drizzle';

@Injectable()
export class ScheduledJobService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 잡 목록 조회
   */
  async listJobs() {
    return this.db.query.systemScheduledJobs.findMany({
      orderBy: [desc(systemScheduledJobs.createdAt)],
    });
  }

  /**
   * 잡 실행 이력 조회 (페이지네이션)
   */
  async getJobRuns(jobId: string, input: { page: number; limit: number }) {
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    const [data, totalResult] = await Promise.all([
      this.db.query.systemJobRuns.findMany({
        where: eq(systemJobRuns.jobId, jobId),
        limit,
        offset,
        orderBy: [desc(systemJobRuns.startedAt)],
      }),
      this.db
        .select({ count: count() })
        .from(systemJobRuns)
        .where(eq(systemJobRuns.jobId, jobId)),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 잡 활성/비활성 토글
   */
  async toggleJob(jobId: string) {
    const job = await this.db.query.systemScheduledJobs.findFirst({
      where: eq(systemScheduledJobs.id, jobId),
    });

    if (!job) throw new Error('Job not found');

    const [updated] = await this.db
      .update(systemScheduledJobs)
      .set({ isActive: !job.isActive })
      .where(eq(systemScheduledJobs.id, jobId))
      .returning();

    return updated;
  }

  /**
   * 실행 시작 기록
   */
  async recordRunStart(jobKey: string) {
    const job = await this.db.query.systemScheduledJobs.findFirst({
      where: eq(systemScheduledJobs.jobKey, jobKey),
    });

    if (!job) return null;

    const now = new Date();

    const [run] = await this.db
      .insert(systemJobRuns)
      .values({
        jobId: job.id,
        status: 'running',
        startedAt: now,
      })
      .returning();

    await this.db
      .update(systemScheduledJobs)
      .set({ lastRunAt: now })
      .where(eq(systemScheduledJobs.id, job.id));

    return run;
  }

  /**
   * 실행 완료 기록
   */
  async recordRunComplete(
    runId: string,
    status: 'success' | 'failed',
    result?: Record<string, unknown>,
    errorMessage?: string,
  ) {
    const now = new Date();
    const run = await this.db.query.systemJobRuns.findFirst({
      where: eq(systemJobRuns.id, runId),
    });

    const durationMs = run ? now.getTime() - run.startedAt.getTime() : 0;

    const [updated] = await this.db
      .update(systemJobRuns)
      .set({
        status,
        completedAt: now,
        durationMs,
        result: result ?? null,
        errorMessage: errorMessage ?? null,
      })
      .where(eq(systemJobRuns.id, runId))
      .returning();

    return updated;
  }

  /**
   * 잡 키로 활성 여부 확인
   */
  async isJobActive(jobKey: string): Promise<boolean> {
    const job = await this.db.query.systemScheduledJobs.findFirst({
      where: eq(systemScheduledJobs.jobKey, jobKey),
    });
    return job?.isActive ?? false;
  }

  /**
   * 초기 잡 시드 (upsert)
   */
  async seedJob(input: {
    jobKey: string;
    displayName: string;
    description?: string;
    cronExpression: string;
  }) {
    const [result] = await this.db
      .insert(systemScheduledJobs)
      .values(input)
      .onConflictDoUpdate({
        target: systemScheduledJobs.jobKey,
        set: {
          displayName: input.displayName,
          description: input.description,
          cronExpression: input.cronExpression,
        },
      })
      .returning();

    return result;
  }
}
```

```typescript
// packages/features/scheduled-job/service/index.ts
export { ScheduledJobService } from './scheduled-job.service';
```

**Step 2: 커밋**

```bash
git add packages/features/scheduled-job/service/
git commit -m "feat(scheduled-job): ScheduledJobService 구현"
```

---

### Task 4: CronRunnerService 구현 (실제 잡 실행)

**Files:**
- Create: `packages/features/scheduled-job/service/cron-runner.service.ts`
- Modify: `packages/features/scheduled-job/service/index.ts`

**Step 1: CronRunnerService 작성**

크레딧 월 갱신, 마케팅 예약 발행, 데이터 정리 3개 잡을 `@Cron` 데코레이터로 실행합니다. 각 잡은 실행 전 `isJobActive()` 확인, 실행 전후 `recordRunStart/Complete`로 이력 기록합니다.

```typescript
// packages/features/scheduled-job/service/cron-runner.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDrizzle, type DrizzleDB } from '@repo/drizzle';
import { eq, and, lt, lte } from 'drizzle-orm';
import {
  paymentCreditBalances,
  paymentCreditTransactions,
  paymentPlans,
} from '@repo/drizzle';
import { ScheduledJobService } from './scheduled-job.service';

@Injectable()
export class CronRunnerService {
  private readonly logger = new Logger(CronRunnerService.name);

  // 외부 서비스 주입용 (OnModuleInit에서 설정)
  private marketingScheduler: { processScheduledPublications: () => Promise<void>; retryFailedPublications: () => Promise<void> } | null = null;

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly jobService: ScheduledJobService,
  ) {}

  setMarketingScheduler(scheduler: {
    processScheduledPublications: () => Promise<void>;
    retryFailedPublications: () => Promise<void>;
  }) {
    this.marketingScheduler = scheduler;
  }

  /**
   * 크레딧 월 갱신 — 매일 자정
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async creditMonthlyRenewal() {
    await this.runJob('credit_monthly_renewal', async () => {
      const now = new Date();
      let processedCount = 0;

      // currentPeriodEnd가 지난 사용자 조회
      const expiredBalances = await this.db
        .select()
        .from(paymentCreditBalances)
        .where(lte(paymentCreditBalances.currentPeriodEnd, now));

      for (const balance of expiredBalances) {
        if (!balance.planId) continue;

        // 플랜 조회
        const plan = await this.db.query.paymentPlans.findFirst({
          where: eq(paymentPlans.id, balance.planId),
        });

        if (!plan) continue;

        const balanceBefore = balance.balance;
        const newBalance = plan.monthlyCredits;

        // 잔액 리셋
        const periodStart = now;
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await this.db
          .update(paymentCreditBalances)
          .set({
            balance: newBalance,
            monthlyAllocation: plan.monthlyCredits,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            lastRechargedAt: now,
          })
          .where(eq(paymentCreditBalances.userId, balance.userId));

        // 트랜잭션 로그
        await this.db
          .insert(paymentCreditTransactions)
          .values({
            userId: balance.userId,
            type: 'allocation',
            amount: newBalance,
            balanceBefore,
            balanceAfter: newBalance,
            description: `월간 크레딧 갱신: ${plan.name}`,
          });

        processedCount++;
      }

      return { processedCount };
    });
  }

  /**
   * 마케팅 예약 발행 — 매분
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async marketingScheduledPublish() {
    if (!this.marketingScheduler) return;

    await this.runJob('marketing_scheduled_publish', async () => {
      await this.marketingScheduler!.processScheduledPublications();
      await this.marketingScheduler!.retryFailedPublications();
      return { status: 'processed' };
    });
  }

  /**
   * 데이터 정리 — 매일 03:00
   */
  @Cron('0 3 * * *')
  async dataCleanup() {
    await this.runJob('data_cleanup', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      // soft-deleted 레코드가 있는 테이블 목록
      // 각 Feature의 soft delete 테이블을 직접 참조
      // 여기서는 범용적으로 SQL 직접 실행
      const tables = [
        'board_posts',
        'comment_comments',
        'community_posts',
        'community_comments',
        'graph_content_graphs',
        'graph_content_nodes',
        'agent_agents',
        'agent_threads',
      ];

      let totalDeleted = 0;

      for (const table of tables) {
        try {
          const result = await this.db.execute(
            `DELETE FROM ${table} WHERE is_deleted = true AND deleted_at < $1`,
            // @ts-expect-error raw SQL params
            [cutoffDate],
          );
          totalDeleted += (result as { rowCount?: number }).rowCount ?? 0;
        } catch {
          // 테이블이 없거나 is_deleted 컬럼이 없으면 무시
        }
      }

      return { totalDeleted, cutoffDate: cutoffDate.toISOString() };
    });
  }

  // ==========================================================================
  // Helper: 잡 실행 래퍼
  // ==========================================================================

  private async runJob(
    jobKey: string,
    fn: () => Promise<Record<string, unknown>>,
  ) {
    const isActive = await this.jobService.isJobActive(jobKey);
    if (!isActive) return;

    const run = await this.jobService.recordRunStart(jobKey);
    if (!run) return;

    try {
      const result = await fn();
      await this.jobService.recordRunComplete(run.id, 'success', result);
      this.logger.log(`[${jobKey}] 완료: ${JSON.stringify(result)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      await this.jobService.recordRunComplete(run.id, 'failed', undefined, message);
      this.logger.error(`[${jobKey}] 실패: ${message}`);
    }
  }
}
```

**Step 2: service/index.ts 업데이트**

```typescript
export { ScheduledJobService } from './scheduled-job.service';
export { CronRunnerService } from './cron-runner.service';
```

**Step 3: 커밋**

```bash
git add packages/features/scheduled-job/service/
git commit -m "feat(scheduled-job): CronRunnerService 구현 (크레딧 갱신, 마케팅 발행, 데이터 정리)"
```

---

### Task 5: Module + tRPC Router + index.ts

**Files:**
- Create: `packages/features/scheduled-job/scheduled-job.module.ts`
- Create: `packages/features/scheduled-job/scheduled-job.router.ts`
- Create: `packages/features/scheduled-job/index.ts`

**Step 1: tRPC Router 작성**

```typescript
// packages/features/scheduled-job/scheduled-job.router.ts
import { router, adminProcedure } from '@repo/core/trpc';
import { z } from 'zod';
import type { ScheduledJobService } from './service/scheduled-job.service';
import type { CronRunnerService } from './service/cron-runner.service';

// 서비스 컨테이너
let services: {
  scheduledJobService: ScheduledJobService;
  cronRunnerService: CronRunnerService;
} | null = null;

export function setScheduledJobServices(s: typeof services) {
  services = s;
}

export const scheduledJobRouter = router({
  listJobs: adminProcedure.query(async () => {
    return services!.scheduledJobService.listJobs();
  }),

  getJobRuns: adminProcedure
    .input(z.object({
      jobId: z.string().uuid(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return services!.scheduledJobService.getJobRuns(input.jobId, {
        page: input.page,
        limit: input.limit,
      });
    }),

  toggleJob: adminProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return services!.scheduledJobService.toggleJob(input.jobId);
    }),

  runJobNow: adminProcedure
    .input(z.object({ jobKey: z.string() }))
    .mutation(async ({ input }) => {
      const runner = services!.cronRunnerService;
      switch (input.jobKey) {
        case 'credit_monthly_renewal':
          await runner.creditMonthlyRenewal();
          break;
        case 'marketing_scheduled_publish':
          await runner.marketingScheduledPublish();
          break;
        case 'data_cleanup':
          await runner.dataCleanup();
          break;
        default:
          throw new Error(`Unknown job: ${input.jobKey}`);
      }
      return { success: true };
    }),
});

export type ScheduledJobRouter = typeof scheduledJobRouter;
```

**Step 2: Module 작성**

```typescript
// packages/features/scheduled-job/scheduled-job.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledJobService } from './service/scheduled-job.service';
import { CronRunnerService } from './service/cron-runner.service';
import { setScheduledJobServices } from './scheduled-job.router';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ScheduledJobService, CronRunnerService],
  exports: [ScheduledJobService, CronRunnerService],
})
export class ScheduledJobModule implements OnModuleInit {
  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly cronRunnerService: CronRunnerService,
  ) {}

  async onModuleInit() {
    // tRPC 서비스 주입
    setScheduledJobServices({
      scheduledJobService: this.scheduledJobService,
      cronRunnerService: this.cronRunnerService,
    });

    // 기본 잡 시드
    await this.scheduledJobService.seedJob({
      jobKey: 'credit_monthly_renewal',
      displayName: '크레딧 월간 갱신',
      description: '플랜별 월 크레딧 자동 충전 (매일 00:00)',
      cronExpression: '0 0 * * *',
    });

    await this.scheduledJobService.seedJob({
      jobKey: 'marketing_scheduled_publish',
      displayName: '마케팅 예약 발행',
      description: '예약된 마케팅 콘텐츠 자동 발행 (매분)',
      cronExpression: '* * * * *',
    });

    await this.scheduledJobService.seedJob({
      jobKey: 'data_cleanup',
      displayName: '데이터 정리',
      description: '90일 이상 삭제된 데이터 물리 삭제 (매일 03:00)',
      cronExpression: '0 3 * * *',
    });
  }
}
```

**Step 3: index.ts 작성**

```typescript
// packages/features/scheduled-job/index.ts
export { ScheduledJobModule } from './scheduled-job.module';
export { scheduledJobRouter, setScheduledJobServices } from './scheduled-job.router';
export type { ScheduledJobRouter } from './scheduled-job.router';
export { ScheduledJobService } from './service/scheduled-job.service';
export { CronRunnerService } from './service/cron-runner.service';
```

**Step 4: 커밋**

```bash
git add packages/features/scheduled-job/
git commit -m "feat(scheduled-job): Module + tRPC Router + index 생성"
```

---

### Task 6: Server 등록 (app.module + app-router + router)

**Files:**
- Modify: `apps/server/src/app.module.ts`
- Modify: `packages/features/app-router.ts`
- Modify: `apps/server/src/trpc/router.ts`

**Step 1: app.module.ts에 ScheduledJobModule 추가**

import 블록에 추가:
```typescript
import { ScheduledJobModule } from '@repo/features/scheduled-job';
```

`// [/ATLAS:MODULES]` 위에 추가:
```typescript
ScheduledJobModule,
```

**Step 2: app-router.ts에 타입 등록**

import 추가:
```typescript
import { scheduledJobRouter } from './scheduled-job';
```

`_appRouter` 객체에 추가:
```typescript
scheduledJob: scheduledJobRouter,
```

**Step 3: router.ts에 런타임 등록**

import 추가:
```typescript
import { scheduledJobRouter } from '@repo/features/scheduled-job';
```

`trpcRouter` 객체에 추가:
```typescript
scheduledJob: scheduledJobRouter,
```

**Step 4: 커밋**

```bash
git add apps/server/src/app.module.ts packages/features/app-router.ts apps/server/src/trpc/router.ts
git commit -m "feat(scheduled-job): Server 등록 (Module + tRPC)"
```

---

### Task 7: Admin UI — Scheduled Job 관리 페이지

**Files:**
- Create: `apps/system-admin/src/features/scheduled-job/hooks/use-scheduled-jobs.ts`
- Create: `apps/system-admin/src/features/scheduled-job/hooks/index.ts`
- Create: `apps/system-admin/src/features/scheduled-job/pages/ScheduledJobPage.tsx`
- Create: `apps/system-admin/src/features/scheduled-job/pages/index.ts`
- Create: `apps/system-admin/src/features/scheduled-job/routes.tsx`
- Create: `apps/system-admin/src/features/scheduled-job/index.ts`
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

**구현 내용:**
- `useScheduledJobs()` — 잡 목록 조회
- `useJobRuns(jobId)` — 실행 이력 조회
- `useToggleJob()` — 활성/비활성 토글
- `useRunJobNow()` — 수동 실행
- `ScheduledJobPage` — 잡 목록 테이블 + 실행 이력 Sheet + Switch/Button
- 라우트: `/admin/scheduler`
- feature-config: `Timer` 아이콘, order: 35

**Step 1: hooks, pages, routes, index 파일 생성**

(기존 payment Admin UI 패턴과 동일하게 구현)

**Step 2: router.tsx에 라우트 등록**

```typescript
import { createScheduledJobAdminRoutes } from "./features/scheduled-job";
// adminLayoutRoute.addChildren에 추가:
...createScheduledJobAdminRoutes(adminLayoutRoute),
```

**Step 3: feature-config.ts에 메뉴 등록**

```typescript
import { SCHEDULER_ADMIN_PATH } from "./features/scheduled-job";
import { Timer } from "lucide-react";
// featureAdminMenus에 추가:
{
  id: "scheduler",
  label: "스케줄러",
  path: SCHEDULER_ADMIN_PATH,
  icon: Timer,
  order: 35,
},
```

**Step 4: 커밋**

```bash
git add apps/system-admin/src/features/scheduled-job/ apps/system-admin/src/router.tsx apps/system-admin/src/feature-config.ts
git commit -m "feat(scheduled-job): Admin UI 페이지 추가"
```

---

## Phase B: Audit Log

### Task 8: Audit Log DB 스키마

**Files:**
- Create: `packages/drizzle/src/schema/features/audit-log/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: 스키마 작성**

```typescript
// packages/drizzle/src/schema/features/audit-log/index.ts
import { baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";
import { jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const systemAuditActionEnum = pgEnum("system_audit_action", [
  "create",
  "update",
  "delete",
  "assign",
  "adjust",
  "sync",
  "config_change",
]);

// ============================================================================
// Tables
// ============================================================================

export const systemAuditLogs = pgTable("system_audit_logs", {
  ...baseColumns(),

  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  action: systemAuditActionEnum("action").notNull(),

  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  description: text("description").notNull(),

  changes: jsonb("changes").$type<{
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }>(),
  metadata: jsonb("metadata").$type<{
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  }>(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type NewSystemAuditLog = typeof systemAuditLogs.$inferInsert;
```

**Step 2: schema/index.ts에 등록**

```typescript
export * from "./features/audit-log";
```

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/features/audit-log/ packages/drizzle/src/schema/index.ts
git commit -m "feat(audit-log): DB 스키마 추가 (system_audit_logs)"
```

---

### Task 9: AuditLogService 구현

**Files:**
- Create: `packages/features/audit-log/service/audit-log.service.ts`
- Create: `packages/features/audit-log/service/index.ts`

**Step 1: 서비스 작성**

```typescript
// packages/features/audit-log/service/audit-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectDrizzle, type DrizzleDB } from '@repo/drizzle';
import { eq, and, desc, count, gte, lte } from 'drizzle-orm';
import { systemAuditLogs } from '@repo/drizzle';
import type { NewSystemAuditLog } from '@repo/drizzle';

@Injectable()
export class AuditLogService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 감사 로그 기록
   */
  async log(input: Omit<NewSystemAuditLog, 'id' | 'createdAt' | 'updatedAt'>) {
    const [log] = await this.db
      .insert(systemAuditLogs)
      .values(input)
      .returning();

    return log;
  }

  /**
   * 로그 목록 조회 (필터 + 페이지네이션)
   */
  async listLogs(input: {
    page: number;
    limit: number;
    userId?: string;
    action?: string;
    resourceType?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { page, limit, userId, action, resourceType, startDate, endDate } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (userId) conditions.push(eq(systemAuditLogs.userId, userId));
    if (action) conditions.push(eq(systemAuditLogs.action, action as any));
    if (resourceType) conditions.push(eq(systemAuditLogs.resourceType, resourceType));
    if (startDate) conditions.push(gte(systemAuditLogs.createdAt, startDate));
    if (endDate) conditions.push(lte(systemAuditLogs.createdAt, endDate));

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalResult] = await Promise.all([
      this.db.query.systemAuditLogs.findMany({
        where: whereCondition,
        limit,
        offset,
        orderBy: [desc(systemAuditLogs.createdAt)],
      }),
      this.db
        .select({ count: count() })
        .from(systemAuditLogs)
        .where(whereCondition),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * 로그 상세 조회
   */
  async getLog(id: string) {
    return this.db.query.systemAuditLogs.findFirst({
      where: eq(systemAuditLogs.id, id),
    });
  }
}
```

```typescript
// packages/features/audit-log/service/index.ts
export { AuditLogService } from './audit-log.service';
```

**Step 2: 커밋**

```bash
git add packages/features/audit-log/service/
git commit -m "feat(audit-log): AuditLogService 구현"
```

---

### Task 10: Audit Log Module + tRPC Router + index.ts

**Files:**
- Create: `packages/features/audit-log/audit-log.module.ts`
- Create: `packages/features/audit-log/audit-log.router.ts`
- Create: `packages/features/audit-log/index.ts`

(Task 5와 동일 패턴. adminProcedure로 listLogs, getLog 2개 프로시저.)

**Step 1: 커밋**

```bash
git add packages/features/audit-log/
git commit -m "feat(audit-log): Module + tRPC Router + index 생성"
```

---

### Task 11: Server 등록 + 기존 서비스에 audit 로깅 연동

**Files:**
- Modify: `apps/server/src/app.module.ts` — AuditLogModule 추가
- Modify: `packages/features/app-router.ts` — auditLog 라우터 추가
- Modify: `apps/server/src/trpc/router.ts` — auditLog 라우터 추가
- Modify: `packages/features/payment/service/plan.service.ts` — audit log 호출 추가
- Modify: `packages/features/payment/service/credit.service.ts` — adjustBalance에 audit log
- Modify: `packages/features/payment/service/model-pricing.service.ts` — upsert에 audit log

**핵심**: 기존 서비스의 Admin 메서드에 `auditLogService.log()` 1줄 추가. AuditLogService를 DI로 주입받아 사용.

**Step 1: 커밋**

```bash
git add apps/server/src/app.module.ts packages/features/app-router.ts apps/server/src/trpc/router.ts packages/features/payment/
git commit -m "feat(audit-log): Server 등록 + Payment 서비스 audit 로깅 연동"
```

---

### Task 12: Admin UI — Audit Log 페이지

**Files:**
- Create: `apps/system-admin/src/features/audit-log/` (hooks, pages, routes, index)
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

**구현 내용:**
- `useAuditLogs(filters)` — 필터+페이지네이션 로그 조회
- `useAuditLog(id)` — 상세 조회
- `AuditLogPage` — 필터 바 (날짜, 사용자, 액션, 리소스) + 로그 테이블 + 상세 Sheet (변경 전/후 JSON)
- 라우트: `/admin/audit-log`
- feature-config: `ScrollText` 아이콘, order: 36

**Step 1: 커밋**

```bash
git add apps/system-admin/src/features/audit-log/ apps/system-admin/src/router.tsx apps/system-admin/src/feature-config.ts
git commit -m "feat(audit-log): Admin UI 페이지 추가"
```

---

## Phase C: Analytics Dashboard

### Task 13: Recharts 설치

**Files:**
- Modify: `apps/system-admin/package.json`

**Step 1: 패키지 설치**

```bash
cd apps/system-admin && pnpm add recharts
```

**Step 2: 커밋**

```bash
git add apps/system-admin/package.json ../../pnpm-lock.yaml
git commit -m "chore: recharts 의존성 추가"
```

---

### Task 14: Analytics DB 스키마

**Files:**
- Create: `packages/drizzle/src/schema/features/analytics/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: 스키마 작성**

```typescript
// packages/drizzle/src/schema/features/analytics/index.ts
import { baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";
import { date, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// ============================================================================
// Tables
// ============================================================================

export const systemAnalyticsEvents = pgTable("system_analytics_events", {
  ...baseColumns(),

  eventType: text("event_type").notNull(),
  userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  eventData: jsonb("event_data").$type<Record<string, unknown>>(),
});

export const systemDailyMetrics = pgTable("system_daily_metrics", {
  ...baseColumns(),

  date: date("date", { mode: "date" }).notNull(),
  metricKey: text("metric_key").notNull(),
  value: integer("value").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
}, (table) => [
  unique("uq_daily_metrics_date_key").on(table.date, table.metricKey),
]);

// ============================================================================
// Type Exports
// ============================================================================

export type SystemAnalyticsEvent = typeof systemAnalyticsEvents.$inferSelect;
export type NewSystemAnalyticsEvent = typeof systemAnalyticsEvents.$inferInsert;

export type SystemDailyMetric = typeof systemDailyMetrics.$inferSelect;
export type NewSystemDailyMetric = typeof systemDailyMetrics.$inferInsert;
```

**Step 2: schema/index.ts에 등록**

```typescript
export * from "./features/analytics";
```

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/features/analytics/ packages/drizzle/src/schema/index.ts
git commit -m "feat(analytics): DB 스키마 추가 (system_analytics_events, system_daily_metrics)"
```

---

### Task 15: AnalyticsService 구현

**Files:**
- Create: `packages/features/analytics/service/analytics.service.ts`
- Create: `packages/features/analytics/service/index.ts`

**Step 1: 서비스 작성**

`track()` — 이벤트 기록, `getOverview()` — KPI 4개, `getTrend()` — 기간별 트렌드, `getDistribution()` — 분포, `aggregateDaily()` — 일별 집계 (Cron에서 호출)

**Step 2: 커밋**

```bash
git add packages/features/analytics/service/
git commit -m "feat(analytics): AnalyticsService 구현"
```

---

### Task 16: Analytics Module + tRPC Router + index.ts

**Files:**
- Create: `packages/features/analytics/analytics.module.ts`
- Create: `packages/features/analytics/analytics.router.ts`
- Create: `packages/features/analytics/index.ts`

(adminProcedure로 getOverview, getTrend, getDistribution 3개 프로시저.)

**Step 1: 커밋**

```bash
git add packages/features/analytics/
git commit -m "feat(analytics): Module + tRPC Router + index 생성"
```

---

### Task 17: Server 등록 + Scheduled Job에 집계 Job 추가

**Files:**
- Modify: `apps/server/src/app.module.ts` — AnalyticsModule 추가
- Modify: `packages/features/app-router.ts` — analytics 라우터 추가
- Modify: `apps/server/src/trpc/router.ts` — analytics 라우터 추가
- Modify: `packages/features/scheduled-job/service/cron-runner.service.ts` — 일별 집계 Job 추가
- Modify: `packages/features/scheduled-job/scheduled-job.module.ts` — analytics 집계 Job 시드 추가

**Step 1: CronRunnerService에 집계 Job 추가**

```typescript
@Cron('0 1 * * *')
async analyticsDailyAggregate() {
  await this.runJob('analytics_daily_aggregate', async () => {
    await this.analyticsService!.aggregateDaily();
    return { status: 'aggregated' };
  });
}
```

**Step 2: 커밋**

```bash
git add apps/server/src/app.module.ts packages/features/app-router.ts apps/server/src/trpc/router.ts packages/features/scheduled-job/ packages/features/analytics/
git commit -m "feat(analytics): Server 등록 + 일별 집계 Scheduled Job 추가"
```

---

### Task 18: Admin UI — Analytics Dashboard 페이지

**Files:**
- Create: `apps/system-admin/src/features/analytics/` (hooks, pages, components, routes, index)
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

**구현 내용:**
- Hooks: `useOverview()`, `useTrend(metricKey, dateRange)`, `useDistribution()`
- Components: `KpiCard`, `TrendChart` (Recharts LineChart), `DistributionChart` (BarChart + PieChart)
- Page: `AnalyticsDashboardPage` — 날짜 범위 선택 + KPI 4개 + 트렌드 차트 + 분포 차트
- 라우트: `/admin/analytics`
- feature-config: `BarChart3` 아이콘, order: 3

**Step 1: 커밋**

```bash
git add apps/system-admin/src/features/analytics/ apps/system-admin/src/router.tsx apps/system-admin/src/feature-config.ts
git commit -m "feat(analytics): Admin Dashboard UI 추가 (Recharts)"
```

---

### Task 19: 기존 서비스에 이벤트 트래킹 연동

**Files:**
- Modify: `packages/features/payment/service/credit.service.ts` — credit_purchase 이벤트
- Modify: `packages/features/payment/payment.router.ts` — subscription_started 이벤트
- 필요 시: auth, board, community, agent-server에도 track() 추가

핵심 6개 이벤트 트래킹 포인트에 `analyticsService.track()` 1줄 추가.

**Step 1: 커밋**

```bash
git add packages/features/
git commit -m "feat(analytics): 기존 서비스에 이벤트 트래킹 연동 (6개 포인트)"
```

---

## Phase D: 마무리

### Task 20: TypeScript 빌드 검증

```bash
cd packages/drizzle && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```

### Task 21: Reference 문서 업데이트

- `docs/reference/features-backend.md` — scheduled-job, audit-log, analytics 섹션 추가
- `docs/reference/server-registry.md` — 3개 모듈 + 라우터 등록
- `docs/reference/database-schema.md` — 5개 새 테이블 추가
- `docs/reference/features-frontend.md` — Admin UI 3개 페이지 추가

```bash
git add docs/reference/
git commit -m "docs: Phase 1 운영 안정 레퍼런스 문서 업데이트"
```
