# 회원탈퇴 + 유저 환불 + 가족관리 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 3개 Feature 서버(백엔드) 구현 — 회원탈퇴(프로필 확장), 유저 환불 요청(결제 확장), 가족관리(신규 Feature)

**Architecture:** 기존 Profile/Payment Feature를 확장하고, Family를 신규 생성. 모든 Feature는 tRPC + REST(Swagger) 짝으로 구현. Schema는 `packages/drizzle/src/schema/`에 중앙 관리.

**Tech Stack:** NestJS 11, Drizzle ORM, tRPC 11, Zod, PostgreSQL, Fastify

---

## Task 1: 회원탈퇴 — Schema 추가

**Files:**
- Modify: `packages/drizzle/src/schema/core/profiles.ts`
- Create: `packages/drizzle/src/schema/features/profile/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: profiles 테이블에 deletedAt 컬럼 추가**

```typescript
// packages/drizzle/src/schema/core/profiles.ts
// 기존 profiles 테이블에 deletedAt 추가
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

**Step 2: profile_withdrawal_reasons 테이블 생성**

```typescript
// packages/drizzle/src/schema/features/profile/index.ts
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";

export const profileWithdrawalReasonTypeEnum = pgEnum("profile_withdrawal_reason_type", [
  "no_longer_use", "lack_features", "difficult_to_use",
  "too_expensive", "found_alternative", "other",
]);

export const profileWithdrawalReasons = pgTable("profile_withdrawal_reasons", {
  ...baseColumns(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  reasonType: profileWithdrawalReasonTypeEnum("reason_type").notNull(),
  reasonDetail: text("reason_detail"),
});

export type ProfileWithdrawalReason = typeof profileWithdrawalReasons.$inferSelect;
export type NewProfileWithdrawalReason = typeof profileWithdrawalReasons.$inferInsert;
```

**Step 3: schema/index.ts에 export 추가**

```typescript
// packages/drizzle/src/schema/index.ts — Feature Schemas 섹션에 추가
export * from "./features/profile";
```

**Step 4: TypeScript 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 5: Commit**

```
feat(profile): 회원탈퇴 스키마 추가 (profiles.deletedAt + withdrawal_reasons 테이블)
```

---

## Task 2: 회원탈퇴 — DTO 추가

**Files:**
- Create: `packages/features/profile/dto/withdraw.dto.ts`
- Modify: `packages/features/profile/dto/index.ts`

**Step 1: withdraw DTO 생성**

```typescript
// packages/features/profile/dto/withdraw.dto.ts
import { z } from "zod";

export const withdrawInputSchema = z.object({
  reasonType: z.enum([
    "no_longer_use", "lack_features", "difficult_to_use",
    "too_expensive", "found_alternative", "other",
  ]).describe("탈퇴 사유 유형"),
  reasonDetail: z.string().max(500).optional().describe("기타 사유 상세"),
  password: z.string().min(1).describe("비밀번호 확인"),
});

export type WithdrawInput = z.infer<typeof withdrawInputSchema>;
```

**Step 2: dto/index.ts에 export 추가**

```typescript
// packages/features/profile/dto/index.ts 에 추가
export * from './withdraw.dto';
```

---

## Task 3: 회원탈퇴 — Service 메서드 추가

**Files:**
- Modify: `packages/features/profile/service/profile.service.ts`

**Step 1: import 추가 + 3개 메서드 구현**

Service 상단 import에 추가:
```typescript
import { profiles, profileWithdrawalReasons, subscriptions } from '@repo/drizzle';
import { BadRequestException } from '@nestjs/common';
```

Service 클래스 하단에 메서드 추가:

```typescript
// ========== Withdrawal ==========

async checkWithdrawable(userId: string) {
  const profile = await this.getProfile(userId);
  const blockers: string[] = [];

  // Owner 역할 확인 (role-permission의 user_roles 테이블 사용)
  // 여기서는 간소화하여 profile 자체 확인
  // TODO: role-permission feature와 연동하여 Owner 확인

  // 활성 구독 확인
  const [activeSub] = await this.db
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      or(
        eq(subscriptions.status, 'active'),
        eq(subscriptions.status, 'past_due'),
      ),
    ))
    .limit(1);

  if (activeSub) {
    blockers.push('활성 구독을 먼저 해지해 주세요');
  }

  return { withdrawable: blockers.length === 0, blockers };
}

async withdraw(userId: string, input: WithdrawInput) {
  // 탈퇴 가능 여부 재확인
  const { withdrawable, blockers } = await this.checkWithdrawable(userId);
  if (!withdrawable) {
    throw new BadRequestException(blockers.join(', '));
  }

  // 이미 탈퇴한 계정 확인
  const profile = await this.getProfile(userId);
  if (profile.deletedAt) {
    throw new NotFoundException('이미 탈퇴된 계정입니다');
  }

  // TODO: 비밀번호 검증 (Supabase Auth 연동)
  // const isValid = await this.verifyPassword(userId, input.password);
  // if (!isValid) throw new UnauthorizedException('비밀번호가 일치하지 않습니다');

  // 탈퇴 사유 저장
  await this.db.insert(profileWithdrawalReasons).values({
    userId,
    reasonType: input.reasonType,
    reasonDetail: input.reasonDetail,
  });

  // 계정 soft delete
  await this.db
    .update(profiles)
    .set({
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));

  logger.info('User withdrawn', {
    'profile.user_id': userId,
    'profile.withdrawal_reason': input.reasonType,
  });

  return { success: true };
}

async adminWithdrawalReasons(input: { page: number; limit: number; reasonType?: string }) {
  const { page, limit, reasonType } = input;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (reasonType) {
    conditions.push(eq(profileWithdrawalReasons.reasonType, reasonType as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    this.db
      .select()
      .from(profileWithdrawalReasons)
      .where(whereClause)
      .orderBy(desc(profileWithdrawalReasons.createdAt))
      .limit(limit)
      .offset(offset),
    this.db.select({ count: count() }).from(profileWithdrawalReasons).where(whereClause),
  ]);

  const total = totalResult[0]?.count ?? 0;
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

**Step 2: TypeScript 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`

---

## Task 4: 회원탈퇴 — tRPC Router 확장

**Files:**
- Modify: `packages/features/profile/profile.router.ts`

**Step 1: Router에 3개 프로시저 추가**

import에 `withdrawInputSchema` 추가.

Protected 섹션에 추가:
```typescript
checkWithdrawable: protectedProcedure.query(async ({ ctx }) => {
  return getProfileService().checkWithdrawable(ctx.user!.id);
}),

withdraw: protectedProcedure
  .input(withdrawInputSchema)
  .mutation(async ({ ctx, input }) => {
    return getProfileService().withdraw(ctx.user!.id, input);
  }),
```

Admin 섹션에 추가:
```typescript
withdrawalReasons: adminProcedure
  .input(z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
    reasonType: z.string().optional(),
  }))
  .query(({ input }) => {
    return getProfileService().adminWithdrawalReasons(input);
  }),
```

---

## Task 5: 회원탈퇴 — REST Controller 확장

**Files:**
- Modify: `packages/features/profile/controller/profile.controller.ts`

**Step 1: Auth 엔드포인트 추가**

```typescript
@Get('withdrawable')
@ApiOperation({ summary: '탈퇴 가능 여부 확인' })
@ApiResponse({ status: 200, description: '탈퇴 가능 여부 반환' })
async checkWithdrawable(@CurrentUser() user: User) {
  return this.profileService.checkWithdrawable(user.id);
}

@Post('withdraw')
@ApiOperation({ summary: '회원 탈퇴 요청' })
@ApiResponse({ status: 200, description: '탈퇴 성공' })
@ApiResponse({ status: 400, description: '활성 구독 존재' })
async withdraw(
  @CurrentUser() user: User,
  @Body() input: WithdrawInput,
) {
  return this.profileService.withdraw(user.id, input);
}
```

**Step 2: Admin 엔드포인트 추가**

```typescript
@Get('admin/withdrawal-reasons')
@UseGuards(NestAdminGuard)
@ApiOperation({ summary: '[Admin] 탈퇴 사유 목록 조회' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
@ApiQuery({ name: 'reasonType', required: false, type: String })
async adminWithdrawalReasons(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  @Query('reasonType') reasonType?: string,
) {
  return this.profileService.adminWithdrawalReasons({ page, limit, reasonType });
}
```

**Step 3: TypeScript 빌드 확인 + Commit**

```
feat(profile): 회원탈퇴 서비스, tRPC, REST 구현
```

---

## Task 6: 유저 환불 — Schema 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/payment/index.ts`

**Step 1: payment_refund_requests 테이블 추가**

기존 payment schema 파일 하단, Type Exports 섹션 위에 추가:

```typescript
// ============================================================================
// Refund Requests Table
// ============================================================================

export const paymentRefundRequestStatusEnum = pgEnum("payment_refund_request_status", [
  "pending", "processing", "approved", "rejected",
]);

export const paymentRefundReasonTypeEnum = pgEnum("payment_refund_reason_type", [
  "dissatisfied", "not_as_expected", "duplicate_payment",
  "changed_mind", "technical_issue", "other",
]);

export const refundRequests = pgTable('payment_refund_requests', {
  ...baseColumns(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => orders.id),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  reasonType: paymentRefundReasonTypeEnum('reason_type').notNull(),
  reasonDetail: text('reason_detail'),
  requestedAmount: integer('requested_amount'),
  status: paymentRefundRequestStatusEnum('status').notNull().default('pending'),
  adminNote: text('admin_note'),
  processedBy: uuid('processed_by').references(() => profiles.id),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

export type RefundRequest = typeof refundRequests.$inferSelect;
export type NewRefundRequest = typeof refundRequests.$inferInsert;
```

**Step 2: pgEnum import 추가 + 빌드 확인**

기존 import에 `pgEnum` 추가.

Run: `cd packages/drizzle && pnpm tsc --noEmit`

**Step 3: Commit**

```
feat(payment): 환불 요청 스키마 추가 (payment_refund_requests 테이블)
```

---

## Task 7: 유저 환불 — DTO + Service 추가

**Files:**
- Create: `packages/features/payment/dto/refund-request.dto.ts`
- Modify: `packages/features/payment/dto/index.ts`
- Modify: `packages/features/payment/service/payment.service.ts`

**Step 1: refund-request DTO 생성**

```typescript
// packages/features/payment/dto/refund-request.dto.ts
import { z } from "zod";

export const requestRefundSchema = z.object({
  orderId: z.string().uuid().describe("주문 ID"),
  reasonType: z.enum([
    "dissatisfied", "not_as_expected", "duplicate_payment",
    "changed_mind", "technical_issue", "other",
  ]).describe("환불 사유 유형"),
  reasonDetail: z.string().max(500).optional().describe("상세 사유"),
});

export const processRefundRequestSchema = z.object({
  requestId: z.string().uuid().describe("환불 요청 ID"),
  action: z.enum(["approve", "reject"]).describe("처리 액션"),
  adminNote: z.string().max(500).optional().describe("Admin 메모"),
});

export type RequestRefundInput = z.infer<typeof requestRefundSchema>;
export type ProcessRefundRequestInput = z.infer<typeof processRefundRequestSchema>;
```

**Step 2: Service에 5개 메서드 추가**

```typescript
// payment.service.ts 상단 import에 추가
import { refundRequests } from '@repo/drizzle';
import { ConflictException } from '@nestjs/common';

// Service 클래스 하단에 추가

// ========== User Refund Requests ==========

async getMyOrders(userId: string, input: { page: number; limit: number }) {
  const { page, limit } = input;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    this.db.query.orders.findMany({
      where: eq(orders.userId, userId),
      limit,
      offset,
      orderBy: [desc(orders.createdAt)],
    }),
    this.db.select({ count: count() }).from(orders).where(eq(orders.userId, userId)),
  ]);

  const total = totalResult[0]?.count ?? 0;
  return buildPaginatedResult(data, total, page, limit);
}

async checkRefundable(userId: string, orderId: string) {
  const order = await this.db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.userId, userId)),
  });

  if (!order) {
    throw new NotFoundException('주문을 찾을 수 없습니다');
  }

  if (order.refunded) {
    return { refundable: false, reason: '이미 환불된 주문입니다', estimatedAmount: 0 };
  }

  // 환불 기간 확인 (7일)
  const daysSinceOrder = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceOrder > 7) {
    return { refundable: false, reason: '환불 가능 기간(7일)이 초과되었습니다', estimatedAmount: 0 };
  }

  // 진행중인 환불 요청 확인
  const existingRequest = await this.db.query.refundRequests.findFirst({
    where: and(
      eq(refundRequests.orderId, orderId),
      or(
        eq(refundRequests.status, 'pending'),
        eq(refundRequests.status, 'processing'),
      ),
    ),
  });

  if (existingRequest) {
    return { refundable: false, reason: '이미 환불 요청이 진행 중입니다', estimatedAmount: 0 };
  }

  return { refundable: true, estimatedAmount: order.total };
}

async requestRefund(userId: string, input: RequestRefundInput) {
  // 환불 가능 여부 재확인
  const check = await this.checkRefundable(userId, input.orderId);
  if (!check.refundable) {
    throw new BadRequestException(check.reason);
  }

  const [request] = await this.db
    .insert(refundRequests)
    .values({
      userId,
      orderId: input.orderId,
      reasonType: input.reasonType,
      reasonDetail: input.reasonDetail,
      requestedAmount: check.estimatedAmount,
      status: 'pending',
    })
    .returning();

  logger.info('Refund requested by user', {
    'payment.refund_request_id': request.id,
    'payment.order_id': input.orderId,
    'user.id': userId,
  });

  return request;
}

async getMyRefundRequests(userId: string, input: { page: number; limit: number }) {
  const { page, limit } = input;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    this.db.query.refundRequests.findMany({
      where: eq(refundRequests.userId, userId),
      limit,
      offset,
      orderBy: [desc(refundRequests.createdAt)],
    }),
    this.db.select({ count: count() }).from(refundRequests).where(eq(refundRequests.userId, userId)),
  ]);

  const total = totalResult[0]?.count ?? 0;
  return buildPaginatedResult(data, total, page, limit);
}

async adminProcessRefundRequest(adminId: string, input: ProcessRefundRequestInput) {
  const request = await this.db.query.refundRequests.findFirst({
    where: eq(refundRequests.id, input.requestId),
  });

  if (!request) {
    throw new NotFoundException('환불 요청을 찾을 수 없습니다');
  }

  if (request.status !== 'pending' && request.status !== 'processing') {
    throw new BadRequestException('이미 처리된 환불 요청입니다');
  }

  if (input.action === 'approve' && request.orderId) {
    // 실제 환불 처리
    await this.refundOrder(request.orderId, request.requestedAmount ?? undefined, '유저 환불 요청 승인');
  }

  const [updated] = await this.db
    .update(refundRequests)
    .set({
      status: input.action === 'approve' ? 'approved' : 'rejected',
      adminNote: input.adminNote,
      processedBy: adminId,
      processedAt: new Date(),
    })
    .where(eq(refundRequests.id, input.requestId))
    .returning();

  logger.info('Refund request processed', {
    'payment.refund_request_id': input.requestId,
    'payment.action': input.action,
    'user.id': adminId,
  });

  return updated;
}
```

---

## Task 8: 유저 환불 — tRPC Router 확장

**Files:**
- Modify: `packages/features/payment/payment.router.ts`

**Step 1: import 추가**

```typescript
import { requestRefundSchema, processRefundRequestSchema } from './dto';
```

**Step 2: Protected 섹션에 프로시저 추가**

기존 `getMyOrders` 아래에 추가:

```typescript
checkRefundable: protectedProcedure
  .input(z.object({ orderId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    return services.get().paymentService.checkRefundable(ctx.user!.id, input.orderId);
  }),

requestRefund: protectedProcedure
  .input(requestRefundSchema)
  .mutation(async ({ ctx, input }) => {
    return services.get().paymentService.requestRefund(ctx.user!.id, input);
  }),

getMyRefundRequests: protectedProcedure
  .input(z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }))
  .query(async ({ ctx, input }) => {
    return services.get().paymentService.getMyRefundRequests(ctx.user!.id, input);
  }),
```

**Step 3: Admin 섹션에 프로시저 추가**

기존 `getRefundRequests` 아래에 추가:

```typescript
processRefundRequest: adminProcedure
  .input(processRefundRequestSchema)
  .mutation(async ({ ctx, input }) => {
    return services.get().paymentService.adminProcessRefundRequest(ctx.user!.id, input);
  }),
```

---

## Task 9: 유저 환불 — REST Controller 확장

**Files:**
- Modify: `packages/features/payment/controller/auth/subscription.controller.ts` (또는 적절한 위치)
- Modify: `packages/features/payment/controller/admin/payment-admin.controller.ts`

**Step 1: Auth 엔드포인트 추가** (subscription.controller.ts 또는 새 파일)

```typescript
@Get('orders/:orderId/refundable')
@ApiOperation({ summary: '환불 가능 여부 확인' })
@ApiParam({ name: 'orderId', description: '주문 ID' })
async checkRefundable(
  @CurrentUser() user: User,
  @Param('orderId', ParseUUIDPipe) orderId: string,
) {
  return this.paymentService.checkRefundable(user.id, orderId);
}

@Post('refund-requests')
@ApiOperation({ summary: '환불 요청' })
async requestRefund(
  @CurrentUser() user: User,
  @Body() input: RequestRefundInput,
) {
  return this.paymentService.requestRefund(user.id, input);
}

@Get('refund-requests')
@ApiOperation({ summary: '내 환불 요청 목록' })
async getMyRefundRequests(
  @CurrentUser() user: User,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
) {
  return this.paymentService.getMyRefundRequests(user.id, { page, limit });
}
```

**Step 2: Admin 엔드포인트 추가** (payment-admin.controller.ts)

```typescript
@Post('refund-requests/:requestId/process')
@ApiOperation({ summary: '[Admin] 환불 요청 처리' })
async processRefundRequest(
  @CurrentUser() user: User,
  @Param('requestId', ParseUUIDPipe) requestId: string,
  @Body() body: { action: 'approve' | 'reject'; adminNote?: string },
) {
  return this.paymentService.adminProcessRefundRequest(user.id, {
    requestId,
    action: body.action,
    adminNote: body.adminNote,
  });
}
```

**Step 3: TypeScript 빌드 확인 + Commit**

```
feat(payment): 유저 환불 요청 서비스, tRPC, REST 구현
```

---

## Task 10: 가족관리 — Schema 생성

**Files:**
- Create: `packages/drizzle/src/schema/features/family/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: Family schema 파일 생성**

```typescript
// packages/drizzle/src/schema/features/family/index.ts
import { pgEnum, pgTable, text, timestamp, uuid, boolean, date, varchar, unique } from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";

// ============================================================================
// Enums
// ============================================================================

export const familyMemberRoleEnum = pgEnum("family_member_role", [
  "owner", "guardian", "therapist", "viewer",
]);

export const familyInvitationStatusEnum = pgEnum("family_invitation_status", [
  "pending", "accepted", "rejected", "expired",
]);

// ============================================================================
// Tables
// ============================================================================

export const familyGroups = pgTable("family_groups", {
  ...baseColumns(),
  name: varchar("name", { length: 100 }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
});

export const familyMembers = pgTable("family_members", {
  ...baseColumns(),
  groupId: uuid("group_id").notNull().references(() => familyGroups.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  role: familyMemberRoleEnum("role").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_family_members_group_user").on(table.groupId, table.userId),
]);

export const familyInvitations = pgTable("family_invitations", {
  ...baseColumns(),
  groupId: uuid("group_id").notNull().references(() => familyGroups.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  role: familyMemberRoleEnum("role").notNull(),
  status: familyInvitationStatusEnum("status").notNull().default("pending"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const familyChildren = pgTable("family_children", {
  ...baseColumns(),
  groupId: uuid("group_id").notNull().references(() => familyGroups.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  birthDate: date("birth_date").notNull(),
  gender: varchar("gender", { length: 10 }),
  notes: text("notes"),
  avatar: text("avatar"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
});

export const familyChildAssignments = pgTable("family_child_assignments", {
  ...baseColumns(),
  childId: uuid("child_id").notNull().references(() => familyChildren.id, { onDelete: "cascade" }),
  therapistId: uuid("therapist_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  assignedBy: uuid("assigned_by").notNull().references(() => profiles.id, { onDelete: "cascade" }),
}, (table) => [
  unique("uq_family_child_assignments_child_therapist").on(table.childId, table.therapistId),
]);

// ============================================================================
// Type Exports
// ============================================================================

export type FamilyGroup = typeof familyGroups.$inferSelect;
export type NewFamilyGroup = typeof familyGroups.$inferInsert;

export type FamilyMember = typeof familyMembers.$inferSelect;
export type NewFamilyMember = typeof familyMembers.$inferInsert;

export type FamilyInvitation = typeof familyInvitations.$inferSelect;
export type NewFamilyInvitation = typeof familyInvitations.$inferInsert;

export type FamilyChild = typeof familyChildren.$inferSelect;
export type NewFamilyChild = typeof familyChildren.$inferInsert;

export type FamilyChildAssignment = typeof familyChildAssignments.$inferSelect;
export type NewFamilyChildAssignment = typeof familyChildAssignments.$inferInsert;
```

**Step 2: schema/index.ts에 export 추가**

```typescript
export * from "./features/family";
```

**Step 3: 빌드 확인 + Commit**

```
feat(family): 가족관리 스키마 생성 (5 테이블 + 2 enum)
```

---

## Task 11: 가족관리 — Feature 폴더 구조 생성

**Files:**
- Create: `packages/features/family/index.ts`
- Create: `packages/features/family/family.module.ts`
- Create: `packages/features/family/family.router.ts`
- Create: `packages/features/family/service/family.service.ts`
- Create: `packages/features/family/service/index.ts`
- Create: `packages/features/family/controller/family.controller.ts`
- Create: `packages/features/family/controller/index.ts`
- Create: `packages/features/family/dto/index.ts`
- Create: `packages/features/family/dto/create-group.dto.ts`
- Create: `packages/features/family/dto/invite-member.dto.ts`
- Create: `packages/features/family/dto/create-child.dto.ts`
- Create: `packages/features/family/types/index.ts`

DTO, Service, Router, Controller, Module의 전체 코드는 실행 시 FRD 기반으로 작성.

**핵심 요소:**

1. **DTOs**: createGroup, updateGroup, inviteMember, updateMemberRole, createChild, updateChild, assignTherapist
2. **Service**: 그룹 CRUD + 멤버 관리 + 아이 관리 + 치료사 배정 (단일 FamilyService)
3. **Router**: 22개 프로시저 (public 0, protected 18, admin 4)
4. **Controller**: family.controller.ts (Auth + Admin 통합)
5. **Module**: OnModuleInit으로 서비스 주입

---

## Task 12: 가족관리 — 4곳 등록

**Files:**
- Modify: `apps/server/src/app.module.ts`
- Modify: `packages/features/app-router.ts`
- Modify: `apps/server/src/trpc/router.ts`

**Step 1: AppModule 등록**

```typescript
// apps/server/src/app.module.ts
import { FamilyModule } from '@repo/features/family';
// [ATLAS:MODULES] 섹션에 FamilyModule 추가
```

**Step 2: app-router.ts 등록**

```typescript
import { familyRouter } from './family';
const _appRouter = router({ ..., family: familyRouter });
```

**Step 3: router.ts 등록**

```typescript
import { familyRouter } from '@repo/features/family';
export const trpcRouter: AppRouter = router({ ..., family: familyRouter }) as AppRouter;
```

**Step 4: 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`

**Step 5: Commit**

```
feat(family): 가족관리 Feature 서버 구현 완료
```

---

## Task 13: DB Migration 생성

**Step 1: Migration 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`

**Step 2: Migration 파일 확인**

생성된 SQL 파일 내용 확인:
- profiles에 deleted_at 컬럼 추가
- profile_withdrawal_reasons 테이블 생성
- payment_refund_requests 테이블 생성
- family_* 5개 테이블 생성
- enum 4개 생성

**Step 3: Commit**

```
chore: 회원탈퇴, 환불요청, 가족관리 DB migration 생성
```

---

## Task 14: 최종 빌드 검증 + Reference 문서 업데이트

**Step 1: 전체 TypeScript 빌드 확인**

Run:
```bash
cd apps/server && pnpm tsc --noEmit
cd packages/drizzle && pnpm tsc --noEmit
```

**Step 2: git status 확인 — 다른 Feature 미수정 확인**

**Step 3: Reference 문서 업데이트**

- `docs/reference/features-backend.md` — Profile 회원탈퇴 프로시저 추가, Payment 환불 프로시저 추가, Family Feature 추가
- `docs/reference/database-schema.md` — 신규 테이블/컬럼 추가
- `docs/reference/server-registry.md` — Family Module/Router 추가

**Step 4: Obsidian 인덱스 업데이트**

- `Product Builder/Features/인덱스.md` — Family Feature 섹션 추가, Profile/Payment 업데이트
