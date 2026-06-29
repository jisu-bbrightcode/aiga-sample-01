# Terms & Marketing Consent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin에서 약관(이름+URL)을 등록/관리하고, 사용자의 마케팅 동의 여부를 날짜로 추적하여 Admin 사용자 목록에서 필터링할 수 있도록 한다.

**Architecture:** 기존 Profile feature를 확장한다. profiles 테이블에 `marketingConsentAt` 컬럼을 추가하고, core schema에 `terms` 테이블을 신규 생성한다. ProfileService/Router/Controller에 약관 CRUD + 마케팅 필터를 추가하고, system-admin에 약관 관리 페이지 + 사용자 목록 필터를 구현한다.

**Tech Stack:** Drizzle ORM, NestJS, tRPC v11, TanStack Router/Query, Jotai, shadcn/ui, Tailwind CSS

**Design Doc:** `docs/plans/2026-02-24-terms-marketing-consent-design.md`

---

### Task 1: Core Schema — profiles 테이블에 marketingConsentAt 컬럼 추가

**Files:**
- Modify: `packages/drizzle/src/schema/core/profiles.ts`

**Step 1: profiles 테이블에 컬럼 추가**

`profiles.ts`의 pgTable 정의에 `marketingConsentAt` 컬럼을 추가한다:

```typescript
marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
```

기존 `updatedAt` 아래에 추가한다. nullable이므로 기본값은 `null`이다.

**Step 2: 타입 확인**

기존 `Profile`, `NewProfile` 타입은 `$inferSelect`/`$inferInsert`이므로 자동으로 새 컬럼이 포함된다. 별도 수정 불필요.

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/core/profiles.ts
git commit -m "feat(profile): add marketingConsentAt column to profiles table"
```

---

### Task 2: Core Schema — terms 테이블 생성

**Files:**
- Create: `packages/drizzle/src/schema/core/terms.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: terms 스키마 파일 생성**

`packages/drizzle/src/schema/core/terms.ts` 파일을 생성한다:

```typescript
import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Terms 테이블 (Core)
 * - 가입 시 동의해야 하는 약관 목록
 * - Admin에서 등록/관리
 * - 물리 삭제 대신 isActive: false로 비활성 처리
 */
export const terms = pgTable("terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  url: text("url").notNull(),
  isRequired: boolean("is_required").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Type exports
export type Term = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;
```

**Step 2: schema/index.ts에 export 추가**

`packages/drizzle/src/schema/index.ts`의 Core Schemas 섹션에 추가:

```typescript
export * from "./core/terms";
```

**Step 3: 커밋**

```bash
git add packages/drizzle/src/schema/core/terms.ts packages/drizzle/src/schema/index.ts
git commit -m "feat(profile): add terms table to core schema"
```

---

### Task 3: DB Migration 생성

**Step 1: Drizzle migration 생성**

```bash
cd packages/drizzle && pnpm drizzle-kit generate
```

생성된 migration SQL을 확인하여 `ALTER TABLE profiles ADD COLUMN marketing_consent_at`과 `CREATE TABLE terms`가 포함되어 있는지 확인한다.

**Step 2: 커밋**

```bash
git add packages/drizzle/drizzle/
git commit -m "chore(drizzle): add migration for terms table and marketingConsentAt"
```

---

### Task 4: Server — Terms DTO 생성

**Files:**
- Create: `packages/features/profile/dto/create-term.dto.ts`
- Create: `packages/features/profile/dto/update-term.dto.ts`
- Modify: `packages/features/profile/dto/index.ts`

**Step 1: CreateTermDto 생성**

`packages/features/profile/dto/create-term.dto.ts`:

```typescript
import { z } from 'zod';

export const createTermSchema = z.object({
  name: z.string().min(1, '약관 이름은 필수입니다').max(200).describe('약관 이름'),
  url: z.string().url('올바른 URL 형식이 아닙니다').describe('약관 URL'),
  isRequired: z.boolean().default(true).describe('필수 여부'),
  sortOrder: z.number().int().min(0).default(0).describe('정렬 순서'),
});

export type CreateTermInput = z.infer<typeof createTermSchema>;
```

**Step 2: UpdateTermDto 생성**

`packages/features/profile/dto/update-term.dto.ts`:

```typescript
import { z } from 'zod';

export const updateTermSchema = z.object({
  name: z.string().min(1).max(200).optional().describe('약관 이름'),
  url: z.string().url().optional().describe('약관 URL'),
  isRequired: z.boolean().optional().describe('필수 여부'),
  sortOrder: z.number().int().min(0).optional().describe('정렬 순서'),
  isActive: z.boolean().optional().describe('활성 여부'),
});

export type UpdateTermInput = z.infer<typeof updateTermSchema>;
```

**Step 3: dto/index.ts 업데이트**

`packages/features/profile/dto/index.ts`:

```typescript
export * from './update-profile.dto';
export * from './create-term.dto';
export * from './update-term.dto';
```

**Step 4: 커밋**

```bash
git add packages/features/profile/dto/
git commit -m "feat(profile): add terms DTOs"
```

---

### Task 5: Server — ProfileService에 Terms CRUD + 마케팅 필터 추가

**Files:**
- Modify: `packages/features/profile/service/profile.service.ts`

**Step 1: import 추가**

파일 상단 import에 추가:

```typescript
import { DRIZZLE, profiles, terms } from '@repo/drizzle';
import type { CreateTermInput, UpdateTermInput } from '../dto';
import { createLogger } from '@repo/core/logger';

const logger = createLogger('profile');
```

기존 `eq, count, ilike, or, desc, and` import에 `isNull, isNotNull, asc`를 추가한다.

**Step 2: listAll() 메서드에 marketingConsent 필터 추가**

기존 `listAll` 메서드의 input 타입을 확장한다:

```typescript
async listAll(input: { page: number; limit: number; search?: string; marketingConsent?: 'agreed' | 'not_agreed' }) {
```

conditions 배열에 마케팅 동의 필터를 추가한다:

```typescript
if (input.marketingConsent === 'agreed') {
  conditions.push(isNotNull(profiles.marketingConsentAt));
} else if (input.marketingConsent === 'not_agreed') {
  conditions.push(isNull(profiles.marketingConsentAt));
}
```

**Step 3: Terms CRUD 메서드 추가**

ProfileService 클래스에 다음 메서드를 추가한다:

```typescript
// ========== Terms ==========

async listTerms(onlyActive: boolean = true) {
  const conditions = onlyActive ? eq(terms.isActive, true) : undefined;

  return this.db
    .select()
    .from(terms)
    .where(conditions)
    .orderBy(asc(terms.sortOrder), asc(terms.createdAt));
}

async createTerm(input: CreateTermInput) {
  const [term] = await this.db
    .insert(terms)
    .values(input)
    .returning();

  logger.info('Term created', {
    'profile.term_id': term.id,
    'profile.term_name': term.name,
  });

  return term;
}

async updateTerm(id: string, input: UpdateTermInput) {
  const [existing] = await this.db
    .select()
    .from(terms)
    .where(eq(terms.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundException(`Term not found: ${id}`);
  }

  const [updated] = await this.db
    .update(terms)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(terms.id, id))
    .returning();

  logger.info('Term updated', {
    'profile.term_id': id,
    'profile.term_name': updated.name,
  });

  return updated;
}

async deleteTerm(id: string) {
  const [existing] = await this.db
    .select()
    .from(terms)
    .where(eq(terms.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundException(`Term not found: ${id}`);
  }

  const [updated] = await this.db
    .update(terms)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(terms.id, id))
    .returning();

  logger.info('Term deactivated', {
    'profile.term_id': id,
    'profile.term_name': updated.name,
  });

  return { success: true };
}
```

**Step 4: 커밋**

```bash
git add packages/features/profile/service/profile.service.ts
git commit -m "feat(profile): add terms CRUD and marketing consent filter to service"
```

---

### Task 6: Server — tRPC Router에 Terms 프로시저 추가

**Files:**
- Modify: `packages/features/profile/profile.router.ts`

**Step 1: import 추가**

```typescript
import { createTermSchema, updateTermSchema } from './dto';
import { publicProcedure } from '@repo/core/trpc';
```

기존 import에서 `publicProcedure`가 없다면 추가한다. 이미 `protectedProcedure`, `adminProcedure`는 import되어 있다.

**Step 2: admin.list input에 marketingConsent 필터 추가**

기존 `admin.list` 프로시저의 input에 추가:

```typescript
marketingConsent: z.enum(['agreed', 'not_agreed']).optional(),
```

**Step 3: Terms 프로시저 추가**

profileRouter에 terms 관련 프로시저를 추가한다. 최상위에 `termsList`(public), admin 내부에 `terms` 서브라우터:

```typescript
// 최상위 (profileRouter 내부, admin 밖)
termsList: publicProcedure.query(async () => {
  return getProfileService().listTerms(true);
}),
```

admin 서브라우터 내부:

```typescript
termsList: adminProcedure.query(async () => {
  return getProfileService().listTerms(false);
}),

termsCreate: adminProcedure
  .input(createTermSchema)
  .mutation(async ({ input }) => {
    return getProfileService().createTerm(input);
  }),

termsUpdate: adminProcedure
  .input(z.object({
    id: z.string().uuid(),
    data: updateTermSchema,
  }))
  .mutation(async ({ input }) => {
    return getProfileService().updateTerm(input.id, input.data);
  }),

termsDelete: adminProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    return getProfileService().deleteTerm(input.id);
  }),
```

**Step 4: 커밋**

```bash
git add packages/features/profile/profile.router.ts
git commit -m "feat(profile): add terms tRPC procedures"
```

---

### Task 7: Server — REST Controller에 Terms 엔드포인트 추가

**Files:**
- Modify: `packages/features/profile/controller/profile.controller.ts`

**Step 1: Public terms 엔드포인트 추가**

`ProfileController`의 Auth Endpoints 섹션 위에 Public 섹션을 추가한다. 이 엔드포인트는 `@UseGuards(JwtAuthGuard)` 밖에 있어야 하므로, 별도 Controller를 만들거나 기존 Controller 구조를 조정한다.

기존 Controller에 `@UseGuards(JwtAuthGuard)`가 클래스 레벨에 적용되어 있으므로, **Terms 전용 Public Controller를 별도 파일로 분리**한다.

`packages/features/profile/controller/terms.controller.ts` 파일을 새로 생성:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard, NestAdminGuard } from '@repo/core/nestjs/auth';
import { ProfileService } from '../service/profile.service';
import type { CreateTermInput, UpdateTermInput } from '../dto';

@ApiTags('Terms')
@Controller('terms')
export class TermsController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: '활성 약관 목록 조회 (Public)' })
  @ApiResponse({ status: 200, description: '활성 약관 목록 반환' })
  async listActiveTerms() {
    return this.profileService.listTerms(true);
  }
}

@ApiTags('Terms Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, NestAdminGuard)
@Controller('admin/terms')
export class TermsAdminController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] 전체 약관 목록 조회' })
  @ApiResponse({ status: 200, description: '전체 약관 목록 반환' })
  async listAllTerms() {
    return this.profileService.listTerms(false);
  }

  @Post()
  @ApiOperation({ summary: '[Admin] 약관 등록' })
  @ApiResponse({ status: 201, description: '약관 생성 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async createTerm(@Body() input: CreateTermInput) {
    return this.profileService.createTerm(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[Admin] 약관 수정' })
  @ApiParam({ name: 'id', description: '약관 ID (UUID)' })
  @ApiResponse({ status: 200, description: '약관 수정 성공' })
  @ApiResponse({ status: 404, description: '약관을 찾을 수 없음' })
  async updateTerm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTermInput,
  ) {
    return this.profileService.updateTerm(id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[Admin] 약관 비활성화' })
  @ApiParam({ name: 'id', description: '약관 ID (UUID)' })
  @ApiResponse({ status: 200, description: '약관 비활성화 성공' })
  @ApiResponse({ status: 404, description: '약관을 찾을 수 없음' })
  async deleteTerm(@Param('id', ParseUUIDPipe) id: string) {
    return this.profileService.deleteTerm(id);
  }
}
```

**Step 2: 기존 ProfileController의 adminList에 marketingConsent 파라미터 추가**

`profile.controller.ts`의 `adminList` 메서드에 쿼리 파라미터를 추가한다:

```typescript
@ApiQuery({ name: 'marketingConsent', required: false, enum: ['agreed', 'not_agreed'], description: '마케팅 동의 필터' })
```

메서드 시그니처에 추가:

```typescript
@Query('marketingConsent') marketingConsent?: 'agreed' | 'not_agreed',
```

서비스 호출에 전달:

```typescript
return this.profileService.listAll({ page, limit, search, marketingConsent });
```

**Step 3: controller/index.ts 업데이트**

`packages/features/profile/controller/index.ts`를 생성 또는 수정하여 새 Controller를 export:

```typescript
export { ProfileController } from './profile.controller';
export { TermsController, TermsAdminController } from './terms.controller';
```

**Step 4: 커밋**

```bash
git add packages/features/profile/controller/
git commit -m "feat(profile): add terms REST controllers with Swagger"
```

---

### Task 8: Server — Module에 새 Controller 등록

**Files:**
- Modify: `packages/features/profile/profile.module.ts`

**Step 1: 새 Controller import 및 등록**

```typescript
import { TermsController, TermsAdminController } from './controller/terms.controller';
```

`@Module`의 controllers 배열에 추가:

```typescript
controllers: [ProfileController, TermsController, TermsAdminController],
```

**Step 2: 커밋**

```bash
git add packages/features/profile/profile.module.ts
git commit -m "feat(profile): register terms controllers in module"
```

---

### Task 9: TypeScript 빌드 확인

**Step 1: 백엔드 타입 체크**

```bash
cd apps/server && pnpm tsc --noEmit
```

**Step 2: Schema 패키지 타입 체크**

```bash
cd packages/drizzle && pnpm tsc --noEmit
```

에러가 있으면 수정한다. 주요 확인 사항:
- `profiles` 테이블의 새 컬럼이 모든 곳에서 올바르게 타입 추론되는지
- `terms` 테이블 export가 정상인지
- ProfileService의 새 메서드 타입이 맞는지

---

### Task 10: Admin UI — Terms 관리 hooks 생성

**Files:**
- Create: `apps/system-admin/src/features/role-permission/hooks/use-terms.ts`
- Modify: `apps/system-admin/src/features/role-permission/hooks/index.ts`

> 참고: 사용자 관리는 `role-permission` feature 내에 있으므로, 약관 관련 hooks도 여기에 추가한다.

**Step 1: use-terms.ts 생성**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc';
import { toast } from 'sonner';

/**
 * 약관 목록 조회 (Admin — 전체)
 */
export function useAdminTerms() {
  const trpc = useTRPC();
  return useQuery(trpc.profile.admin.termsList.queryOptions());
}

/**
 * 약관 생성
 */
export function useCreateTerm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = trpc.profile.admin.termsCreate.mutationOptions();

  return useMutation({
    mutationFn: options.mutationFn,
    mutationKey: options.mutationKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.profile.admin.termsList.queryKey() });
      toast.success('약관이 등록되었습니다');
    },
    onError: (error) => {
      toast.error(error.message || '약관 등록에 실패했습니다');
    },
  });
}

/**
 * 약관 수정
 */
export function useUpdateTerm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = trpc.profile.admin.termsUpdate.mutationOptions();

  return useMutation({
    mutationFn: options.mutationFn,
    mutationKey: options.mutationKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.profile.admin.termsList.queryKey() });
      toast.success('약관이 수정되었습니다');
    },
    onError: (error) => {
      toast.error(error.message || '약관 수정에 실패했습니다');
    },
  });
}

/**
 * 약관 비활성화 (삭제)
 */
export function useDeleteTerm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = trpc.profile.admin.termsDelete.mutationOptions();

  return useMutation({
    mutationFn: options.mutationFn,
    mutationKey: options.mutationKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.profile.admin.termsList.queryKey() });
      toast.success('약관이 비활성화되었습니다');
    },
    onError: (error) => {
      toast.error(error.message || '약관 비활성화에 실패했습니다');
    },
  });
}
```

**Step 2: hooks/index.ts에 export 추가**

```typescript
// Terms hooks
export {
  useAdminTerms,
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
} from './use-terms';
```

**Step 3: 커밋**

```bash
git add apps/system-admin/src/features/role-permission/hooks/
git commit -m "feat(profile): add terms admin hooks"
```

---

### Task 11: Admin UI — 약관 관리 페이지 생성

**Files:**
- Create: `apps/system-admin/src/features/role-permission/pages/TermsManagementPage.tsx`
- Modify: `apps/system-admin/src/features/role-permission/pages/index.ts`

**Step 1: TermsManagementPage 생성**

약관 목록 테이블 + 추가/수정 Dialog + 비활성화 확인 AlertDialog를 포함하는 Admin 페이지를 생성한다. 기존 `UsersManagementPage.tsx` 패턴을 참고한다.

페이지 구성:
- `PageHeader` (제목: "약관 관리", 설명: "가입 시 표시되는 약관을 관리합니다")
- 상단 "약관 추가" 버튼
- 테이블 컬럼: 약관 이름, URL (링크), 필수여부 Badge, 정렬순서, 활성상태 Badge, 액션(수정/비활성화)
- Dialog: 약관 추가/수정 폼 (name, url, isRequired checkbox, sortOrder input)
- AlertDialog: 비활성화 확인

기존 프로젝트 컴포넌트 패턴을 준수한다:
- `interface Props` 상단 정의
- `@repo/ui/shadcn/*` 컴포넌트 사용
- `@repo/ui/components/page-header` 사용
- `sonner` toast 사용
- 하단에 `/* Components */`, `/* Types */` 섹션 분리

**Step 2: pages/index.ts에 export 추가**

```typescript
export { TermsManagementPage } from './TermsManagementPage';
```

**Step 3: 커밋**

```bash
git add apps/system-admin/src/features/role-permission/pages/
git commit -m "feat(profile): add terms management admin page"
```

---

### Task 12: Admin UI — 약관 관리 라우트 + 메뉴 등록

**Files:**
- Modify: `apps/system-admin/src/features/role-permission/routes.tsx`
- Modify: `apps/system-admin/src/features/role-permission/index.ts`
- Modify: `apps/system-admin/src/router.tsx`
- Modify: `apps/system-admin/src/feature-config.ts`

**Step 1: routes.tsx에 약관 관리 라우트 추가**

경로 상수 추가:
```typescript
export const TERMS_ADMIN_PATH = "/terms";
```

`createRolePermissionAdminRoutes` 함수에 약관 라우트 추가:
```typescript
import { TermsManagementPage } from './pages';

// /terms
const termsManagementRoute = createRoute({
  getParentRoute: () => parentRoute,
  path: '/terms',
  component: TermsManagementPage,
});

return [rolesManagementRoute, usersManagementRoute, termsManagementRoute];
```

**Step 2: index.ts에서 경로 상수 export**

```typescript
export { TERMS_ADMIN_PATH } from './routes';
```

**Step 3: feature-config.ts에 약관 관리 메뉴 추가**

import 추가:
```typescript
import { TERMS_ADMIN_PATH } from "./features/role-permission";
import { FileCheck } from "lucide-react";
```

`featureAdminMenus`에서 기존 "사용자 관리" 메뉴에 서브메뉴로 추가:

```typescript
{
  id: "user-management",
  label: "사용자 관리",
  path: USERS_ADMIN_PATH,
  icon: UserCog,
  order: 2,
  submenus: [
    { id: "user-list", label: "사용자 목록", path: USERS_ADMIN_PATH },
    { id: "role-management", label: "역할 관리", path: ROLES_ADMIN_PATH },
    { id: "terms-management", label: "약관 관리", path: TERMS_ADMIN_PATH },
  ],
},
```

**Step 4: 커밋**

```bash
git add apps/system-admin/src/features/role-permission/ apps/system-admin/src/feature-config.ts
git commit -m "feat(profile): add terms management route and admin menu"
```

---

### Task 13: Admin UI — 사용자 목록에 마케팅 동의 필터 + 컬럼 추가

**Files:**
- Modify: `apps/system-admin/src/features/role-permission/hooks/use-admin-users.ts`
- Modify: `apps/system-admin/src/features/role-permission/pages/UsersManagementPage.tsx`

**Step 1: useAdminUsers hook에 marketingConsent 파라미터 추가**

`use-admin-users.ts`의 `AdminUsersInput` 인터페이스 확장:

```typescript
interface AdminUsersInput {
  page: number;
  limit: number;
  search?: string;
  marketingConsent?: 'agreed' | 'not_agreed';
}
```

**Step 2: UsersManagementPage에 마케팅 동의 필터 추가**

`UsersManagementPage.tsx`에 변경 사항:

1. 상태 추가: `const [marketingConsent, setMarketingConsent] = useState<'agreed' | 'not_agreed' | undefined>(undefined);`
2. `useAdminUsers` 호출에 `marketingConsent` 전달
3. 검색 영역 옆에 `Select` 드롭다운 추가 (전체/동의/미동의)
4. 테이블 `<TableHead>` + `<TableCell>`에 "마케팅 동의" 컬럼 추가
5. 셀 내용: `user.marketingConsentAt`이 있으면 날짜 표시, 없으면 "미동의" Badge

필요한 import:
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/shadcn/select';
```

날짜 포맷: `new Date(user.marketingConsentAt).toLocaleDateString('ko-KR')` 또는 적절한 포맷 사용.

**Step 3: 커밋**

```bash
git add apps/system-admin/src/features/role-permission/
git commit -m "feat(profile): add marketing consent filter and column to user list"
```

---

### Task 14: 프론트엔드 TypeScript 빌드 확인

**Step 1: system-admin 타입 체크**

```bash
cd apps/system-admin && pnpm tsc --noEmit
```

**Step 2: apps/app 타입 체크 (profiles 타입 변경 영향 확인)**

```bash
cd apps/app && pnpm tsc --noEmit
```

에러가 있으면 수정한다. 주요 확인 사항:
- tRPC Router 타입이 클라이언트에서 올바르게 추론되는지
- profiles 타입에 `marketingConsentAt`이 추가되어 기존 코드에 영향 없는지

---

### Task 15: Reference 문서 업데이트

**Files:**
- Modify: `docs/reference/database-schema.md`
- Modify: `docs/reference/features-backend.md`

**Step 1: database-schema.md 업데이트**

Core Schemas 섹션에:
- profiles 테이블에 `marketingConsentAt` 컬럼 추가 기록
- terms 테이블 전체 스키마 문서화

**Step 2: features-backend.md 업데이트**

Profile feature 섹션에:
- Terms CRUD 메서드 추가 기록
- 마케팅 동의 필터 추가 기록
- Terms REST 엔드포인트 추가 기록

**Step 3: 커밋**

```bash
git add docs/reference/
git commit -m "docs: update reference docs for terms and marketing consent"
```
