# Multi Auth Provider 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** .env에서 활성 OAuth Provider를 설정하면 로그인/회원가입에 해당 Provider 버튼이 동적으로 나타나는 기능 구현 (이메일 + Google + 카카오 + 네이버)

**Architecture:** 카카오는 Supabase 네이티브 지원 활용 (`signInWithOAuth({ provider: "kakao" })`). 네이버는 Supabase 미지원이므로 server에서 OAuth를 직접 처리하고 Supabase Admin API로 사용자/세션 생성. 프론트엔드는 `VITE_AUTH_PROVIDERS` 환경변수를 읽어 활성 Provider 버튼만 렌더링.

**Tech Stack:** Supabase Auth, NestJS (Fastify), React, TanStack Router, Jotai, Drizzle ORM

**설계 문서:** `docs/plans/2026-03-02-multi-auth-provider-design.md`

---

## Task 1: 환경변수 추가

**Files:**
- Modify: `.env.example`
- Modify: `.env` (로컬)

**Step 1: .env.example에 Auth Provider 환경변수 추가**

`.env.example` 파일의 `# Supabase` 섹션 아래에 추가:

```ini
# Auth Providers
VITE_AUTH_PROVIDERS=email,google
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret
```

**Step 2: 로컬 .env에 실제 값 추가**

실제 Naver/Kakao 키를 `.env.local`에 입력. (개발 시에는 `VITE_AUTH_PROVIDERS=email,google`로 시작, 키 획득 후 `naver,kakao` 추가)

**Step 3: 커밋**

```bash
git add .env.example
git commit -m "chore: add multi auth provider environment variables"
```

---

## Task 2: DB 스키마 — profiles에 auth_provider 컬럼 추가

**Files:**
- Modify: `packages/drizzle/src/schema/core/profiles.ts`

**Step 1: auth_provider enum과 컬럼 추가**

`packages/drizzle/src/schema/core/profiles.ts` 수정:

```typescript
import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", [
  "email", "google", "naver", "kakao"
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  avatar: text("avatar"),
  authProvider: authProviderEnum("auth_provider").default("email"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
```

**Step 2: 마이그레이션 생성**

```bash
cd packages/drizzle && pnpm drizzle-kit generate
```

Expected: `auth_provider` enum + `profiles.auth_provider` 컬럼 추가 마이그레이션 생성

**Step 3: 마이그레이션 적용**

```bash
cd packages/drizzle && pnpm drizzle-kit migrate
```

**Step 4: 타입 체크**

```bash
cd packages/drizzle && pnpm tsc --noEmit
```

Expected: PASS

**Step 5: 커밋**

```bash
git add packages/drizzle/
git commit -m "feat(auth): add auth_provider column to profiles table"
```

---

## Task 3: 프론트엔드 — Provider 설정 및 아이콘 컴포넌트

**Files:**
- Modify: `apps/app/src/features/auth/config.ts`
- Create: `apps/app/src/features/auth/components/oauth-icons.tsx`

**Step 1: config.ts에 Provider 설정 추가**

`apps/app/src/features/auth/config.ts` 전체 교체:

```typescript
export type AuthUiVariant = 1 | 2 | 3 | 4 | 5;

export type OAuthProvider = "google" | "naver" | "kakao";
export type AuthProvider = "email" | OAuthProvider;

export interface OAuthProviderConfig {
  label: string;
  labelEn: string;
  bgColor: string;
  textColor: string;
  supabaseNative: boolean;
}

export const OAUTH_PROVIDER_CONFIG: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    label: "Google로 계속",
    labelEn: "Continue with Google",
    bgColor: "bg-white border border-input",
    textColor: "text-foreground",
    supabaseNative: true,
  },
  kakao: {
    label: "카카오로 계속",
    labelEn: "Continue with Kakao",
    bgColor: "bg-[#FEE500]",
    textColor: "text-[#191919]",
    supabaseNative: true,
  },
  naver: {
    label: "네이버로 계속",
    labelEn: "Continue with Naver",
    bgColor: "bg-[#03C75A]",
    textColor: "text-white",
    supabaseNative: false,
  },
};

const ENABLED_PROVIDERS: AuthProvider[] =
  (import.meta.env.VITE_AUTH_PROVIDERS ?? "email")
    .split(",")
    .map((p: string) => p.trim())
    .filter(Boolean) as AuthProvider[];

export function getEnabledOAuthProviders(): OAuthProvider[] {
  return ENABLED_PROVIDERS.filter((p): p is OAuthProvider => p !== "email");
}

export function isProviderEnabled(provider: AuthProvider): boolean {
  return ENABLED_PROVIDERS.includes(provider);
}

export const authConfig = {
  uiVariant: 4 as AuthUiVariant,
} as const;
```

**Step 2: OAuth 아이콘 컴포넌트 생성**

`apps/app/src/features/auth/components/oauth-icons.tsx` 생성:

```tsx
interface IconProps {
  className?: string;
}

export function GoogleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function KakaoIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.725 1.8 5.117 4.508 6.476-.162.578-.588 2.098-.674 2.423-.106.4.147.394.309.287.127-.084 2.016-1.371 2.834-1.928A13.3 13.3 0 0 0 12 18.382c5.523 0 10-3.463 10-7.691S17.523 3 12 3z" fill="#191919" />
    </svg>
  );
}

export function NaverIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" fill="currentColor" />
    </svg>
  );
}
```

**Step 3: 타입 체크**

```bash
cd apps/app && pnpm tsc --noEmit
```

Expected: PASS

**Step 4: 커밋**

```bash
git add apps/app/src/features/auth/config.ts apps/app/src/features/auth/components/
git commit -m "feat(auth): add oauth provider config and icon components"
```

---

## Task 4: 프론트엔드 — OAuthButtons 공유 컴포넌트

**Files:**
- Create: `apps/app/src/features/auth/components/oauth-buttons.tsx`

**Step 1: OAuthButtons 컴포넌트 생성**

`apps/app/src/features/auth/components/oauth-buttons.tsx`:

```tsx
import { Button } from "@repo/ui/shadcn/button";
import { cn } from "@repo/ui/lib/utils";
import {
  type OAuthProvider,
  OAUTH_PROVIDER_CONFIG,
  getEnabledOAuthProviders,
} from "../config";
import { GoogleIcon, KakaoIcon, NaverIcon } from "./oauth-icons";
import { useSignInWithOAuth } from "../hooks/use-sign-in-with-oauth";

const ICON_MAP: Record<OAuthProvider, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  kakao: KakaoIcon,
  naver: NaverIcon,
};

interface OAuthButtonsProps {
  disabled?: boolean;
}

export function OAuthButtons({ disabled }: OAuthButtonsProps) {
  const providers = getEnabledOAuthProviders();

  const { execute: signInWithGoogle } = useSignInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  const { execute: signInWithKakao } = useSignInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });

  if (providers.length === 0) return null;

  function handleOAuthClick(provider: OAuthProvider) {
    const config = OAUTH_PROVIDER_CONFIG[provider];

    if (config.supabaseNative) {
      if (provider === "google") signInWithGoogle();
      if (provider === "kakao") signInWithKakao();
    } else {
      // Naver: 서버사이드 리다이렉트
      const apiUrl = import.meta.env.VITE_API_URL;
      const redirectTo = encodeURIComponent(window.location.origin);
      window.location.href = `${apiUrl}/api/auth/${provider}/authorize?redirect_to=${redirectTo}`;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => {
        const config = OAUTH_PROVIDER_CONFIG[provider];
        const Icon = ICON_MAP[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className={cn("w-full", config.bgColor, config.textColor)}
            onClick={() => handleOAuthClick(provider)}
            disabled={disabled}
          >
            <Icon className="mr-2 h-4 w-4" />
            {config.label}
          </Button>
        );
      })}
    </div>
  );
}
```

**Step 2: 타입 체크**

```bash
cd apps/app && pnpm tsc --noEmit
```

**Step 3: 커밋**

```bash
git add apps/app/src/features/auth/components/
git commit -m "feat(auth): add OAuthButtons shared component"
```

---

## Task 5: 프론트엔드 — sign-in-04, sign-up-04 수정

**Files:**
- Modify: `apps/app/src/features/auth/blocks/sign-in-04.tsx`
- Modify: `apps/app/src/features/auth/blocks/sign-up-04.tsx`

**Step 1: sign-in-04.tsx 수정**

하드코딩된 Google/Facebook 버튼을 `OAuthButtons`로 교체.

**제거할 코드**:
- `GoogleIcon` 함수 (라인 17~38)
- `FacebookIcon` 함수 (라인 40~46)
- `useSignInWithOAuth` import 및 `signInWithGoogle` 선언 (라인 14, 82~91)
- Google/Facebook 버튼 JSX (라인 101~108)

**추가/변경**:
```tsx
// import 추가
import { OAuthButtons } from "../components/oauth-buttons";

// 라인 100~108의 OAuth 버튼 영역을 교체
<OAuthButtons disabled={loading} />
```

**최종 OAuth 영역 (라인 100~108 대체)**:
```tsx
<div className="space-y-4">
  <OAuthButtons disabled={loading} />

  <div className="flex items-center gap-4">
    <Separator className="flex-1" />
    <p>Or</p>
    <Separator className="flex-1" />
  </div>
  {/* ... 이메일 폼 그대로 ... */}
```

**Step 2: sign-up-04.tsx 수정**

동일하게 하드코딩된 Google 버튼을 `OAuthButtons`로 교체.

**제거할 코드**:
- `useSignInWithOAuth` import 및 `signInWithGoogle` 선언 (라인 13, 82~90)
- Google 버튼 JSX + 인라인 SVG (라인 100~126)

**추가/변경**:
```tsx
// import 추가
import { OAuthButtons } from "../components/oauth-buttons";

// 라인 99~126의 Google 버튼을 교체
<OAuthButtons disabled={signUpWithEmailAndPassword.loading} />
```

**Step 3: 미사용 import 제거**

sign-in-04.tsx에서 제거:
- `import { useSignInWithOAuth } from "../hooks/use-sign-in-with-oauth";` (OAuthButtons 내부로 이동)

sign-up-04.tsx에서 제거:
- `import { useSignInWithOAuth } from "../hooks/use-sign-in-with-oauth";`

**Step 4: 타입 체크**

```bash
cd apps/app && pnpm tsc --noEmit
```

Expected: PASS

**Step 5: 커밋**

```bash
git add apps/app/src/features/auth/blocks/
git commit -m "feat(auth): replace hardcoded oauth buttons with dynamic OAuthButtons"
```

---

## Task 6: 서버 — Naver OAuth Feature (NestJS Module)

**Files:**
- Create: `packages/features/naver-auth/index.ts`
- Create: `packages/features/naver-auth/naver-auth.module.ts`
- Create: `packages/features/naver-auth/controller/naver-auth.controller.ts`
- Create: `packages/features/naver-auth/service/naver-auth.service.ts`
- Create: `packages/features/naver-auth/types/index.ts`

**참조 문서:**
- `.claude/rules/feature/definition.md` — Feature 디렉토리 구조
- `.claude/rules/backend/swagger.md` — Controller + Swagger 데코레이터
- `.claude/rules/backend/logging.md` — createLogger 필수

**Step 1: types/index.ts**

```typescript
export interface NaverTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface NaverUserProfile {
  id: string;
  email: string;
  name: string;
  nickname?: string;
  profileImage?: string;
}

export interface NaverApiResponse {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email: string;
    name: string;
    nickname?: string;
    profile_image?: string;
  };
}
```

**Step 2: service/naver-auth.service.ts**

핵심 로직:
- `getAuthorizationUrl(redirectTo: string)`: 네이버 인증 URL 생성 (state에 redirectTo 인코딩)
- `handleCallback(code: string, state: string)`: 인증 코드 → 토큰 교환 → 유저 프로필 → Supabase 사용자 생성/찾기 → magic link 토큰 반환
- `exchangeCodeForToken(code: string)`: POST `https://nid.naver.com/oauth2.0/token`
- `getUserProfile(accessToken: string)`: GET `https://openapi.naver.com/v1/nid/me`
- `findOrCreateSupabaseUser(profile: NaverUserProfile)`: Supabase Admin API로 사용자 생성 + profiles 테이블 업데이트 + generateLink

**Supabase Admin API 사용 패턴:**
```typescript
import { createClient } from "@supabase/supabase-js";

// Service Role Key 사용 (Admin 권한)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 사용자 찾기
const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
const existing = users.find(u => u.email === profile.email);

// 없으면 생성
if (!existing) {
  await supabaseAdmin.auth.admin.createUser({
    email: profile.email,
    email_confirm: true,
    user_metadata: {
      name: profile.name,
      avatar_url: profile.profileImage,
      provider: "naver",
    },
    app_metadata: {
      provider: "naver",
      providers: ["naver"],
    },
  });
}

// Magic link 생성 (세션용)
const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: "magiclink",
  email: profile.email,
});
// linkData.properties.hashed_token 사용
```

**Step 3: controller/naver-auth.controller.ts**

```typescript
@ApiTags("Naver Auth")
@Controller("auth/naver")
export class NaverAuthController {
  @Get("authorize")
  @ApiOperation({ summary: "네이버 OAuth 인증 시작" })
  @ApiQuery({ name: "redirect_to", required: true, description: "로그인 완료 후 리다이렉트 URL" })
  @ApiResponse({ status: 302, description: "네이버 로그인 페이지로 리다이렉트" })
  authorize(@Query("redirect_to") redirectTo: string, @Res() reply: FastifyReply) {
    const url = this.naverAuthService.getAuthorizationUrl(redirectTo);
    reply.redirect(302, url);
  }

  @Get("callback")
  @ApiOperation({ summary: "네이버 OAuth 콜백 처리" })
  @ApiQuery({ name: "code", required: true })
  @ApiQuery({ name: "state", required: true })
  @ApiResponse({ status: 302, description: "프론트엔드로 리다이렉트 (세션 포함)" })
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() reply: FastifyReply,
  ) {
    const { redirectUrl } = await this.naverAuthService.handleCallback(code, state);
    reply.redirect(302, redirectUrl);
  }
}
```

**Step 4: naver-auth.module.ts**

```typescript
@Module({
  controllers: [NaverAuthController],
  providers: [NaverAuthService],
  exports: [NaverAuthService],
})
export class NaverAuthModule {}
```

**Step 5: index.ts**

```typescript
export { NaverAuthModule } from "./naver-auth.module";
export { NaverAuthService } from "./service/naver-auth.service";
```

**Step 6: 타입 체크**

```bash
cd packages/features && pnpm tsc --noEmit
```

**Step 7: 커밋**

```bash
git add packages/features/naver-auth/
git commit -m "feat(auth): add naver oauth server-side feature module"
```

---

## Task 7: 서버 등록 — NestJS Module + CORS

**Files:**
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/src/main.ts` (CORS에 콜백 URL 허용 확인)

**Step 1: app.module.ts에 NaverAuthModule 추가**

```typescript
import { NaverAuthModule } from "@repo/features/naver-auth";

@Module({
  imports: [
    // ... 기존 modules ...
    NaverAuthModule,
  ],
})
```

**Step 2: CORS 확인**

`apps/server/src/main.ts`의 CORS 설정 확인. 네이버 콜백은 서버-서버 통신이므로 추가 CORS 설정 불필요. 프론트엔드 리다이렉트만 확인.

**Step 3: 타입 체크**

```bash
cd apps/server && pnpm tsc --noEmit
```

**Step 4: 커밋**

```bash
git add apps/server/src/app.module.ts
git commit -m "feat(auth): register NaverAuthModule in server"
```

---

## Task 8: 프론트엔드 — Auth Callback 처리

**Files:**
- Modify 또는 확인: `apps/app/src/App.tsx` (또는 auth callback 처리 위치)

**Step 1: Supabase auth callback 처리 확인**

네이버 OAuth 최종 리다이렉트는 Supabase의 `/auth/v1/verify` 엔드포인트를 거쳐 프론트엔드로 돌아온다. Supabase가 URL fragment에 `access_token`, `refresh_token`을 포함하여 전달. 기존 `useAuthStateSync`의 `onAuthStateChange`가 이를 자동으로 감지하므로 추가 코드 불필요.

**Step 2: 동작 확인**

네이버 로그인 후 프론트엔드로 돌아오면:
1. Supabase JS client가 URL fragment에서 토큰 추출
2. `onAuthStateChange`에서 `SIGNED_IN` 이벤트 발생
3. `sessionAtom` 설정 → `useProfileSync` 트리거
4. `profileAtom` 설정 → 홈 페이지 표시

별도 callback 라우트가 필요하지 않다면 이 단계는 검증만 수행.

**Step 3: 커밋 (변경 있는 경우만)**

---

## Task 9: Profile Sync — auth_provider 필드 동기화

**Files:**
- Modify: `packages/core/auth/hooks/use-profile-sync.ts`

**Step 1: useProfileSync에서 auth_provider 포함 확인**

현재 `select("*")`로 profiles를 조회하므로, DB에 `auth_provider` 컬럼이 추가되면 자동으로 포함된다. `profileAtom`의 타입만 확인.

**Step 2: 신규 사용자 프로필 생성 시 auth_provider 설정**

회원가입/OAuth 로그인 시 profiles 레코드를 생성하는 로직이 어디인지 확인 필요. (Supabase trigger 또는 서버 코드)

- Google/Kakao: Supabase `auth.users.app_metadata.provider` 값을 읽어 profiles.auth_provider에 설정
- Naver: `NaverAuthService.findOrCreateSupabaseUser()`에서 직접 설정
- Email: 기본값 "email" (DB default)

**Step 3: 타입 체크 및 커밋**

```bash
cd packages/core && pnpm tsc --noEmit
git add packages/core/auth/
git commit -m "feat(auth): sync auth_provider field in profile"
```

---

## Task 10: Admin — 사용자 목록에 Provider 표시

**Files:**
- Modify: `apps/system-admin/src/features/` — 사용자 관리 관련 페이지

**Step 1: 사용자 목록 테이블에 auth_provider 컬럼 추가**

Admin 사용자 관리 페이지를 찾아 테이블에 `auth_provider` 컬럼 추가. Provider별 아이콘 또는 배지로 표시.

**Step 2: 사용자 상세에 Provider 정보 표시**

사용자 상세 페이지에 가입 방식 정보 표시.

**Step 3: 커밋**

```bash
git add apps/system-admin/
git commit -m "feat(auth): display auth provider in admin user management"
```

---

## Task 11: Supabase Dashboard 설정 (수동 작업)

이 단계는 코드가 아닌 수동 설정.

**Step 1: Kakao Developers 앱 설정**

1. https://developers.kakao.com 에서 앱 생성
2. REST API 키 + Client Secret 획득
3. 리다이렉트 URI 등록: `https://<project-ref>.supabase.co/auth/v1/callback`
4. 동의 항목 설정: `account_email`, `profile_nickname`, `profile_image`

**Step 2: Supabase Dashboard Kakao Provider 설정**

1. Authentication > Providers > Kakao
2. Kakao Enabled 활성화
3. Client ID + Client Secret 입력

**Step 3: Naver Developers 앱 설정**

1. https://developers.naver.com 에서 앱 등록
2. Client ID + Client Secret 획득
3. 콜백 URL 등록: `https://your-domain.com/api/auth/naver/callback`

**Step 4: .env.local에 키 입력 및 VITE_AUTH_PROVIDERS 업데이트**

```ini
VITE_AUTH_PROVIDERS=email,google,kakao,naver
NAVER_CLIENT_ID=실제값
NAVER_CLIENT_SECRET=실제값
KAKAO_CLIENT_ID=실제값
KAKAO_CLIENT_SECRET=실제값
```

---

## Task 12: 통합 테스트

**Step 1: 서버 시작 후 API 테스트**

```bash
# Naver authorize 엔드포인트
curl -v http://localhost:3002/api/auth/naver/authorize?redirect_to=http://localhost:3000

# Expected: 302 redirect to https://nid.naver.com/oauth2.0/authorize?...
```

**Step 2: 프론트엔드 브라우저 테스트**

Playwright MCP로 검증:
1. `/sign-in` 페이지 접속
2. 활성화된 Provider 버튼이 표시되는지 확인
3. Google 버튼 클릭 → Supabase OAuth 리다이렉트 확인
4. `/sign-up` 페이지에서도 동일 확인

**Step 3: E2E 흐름 테스트 (수동)**

각 Provider로 실제 로그인:
1. Google: 기존과 동일하게 동작 확인
2. Kakao: `signInWithOAuth({ provider: "kakao" })` → 카카오 로그인 → 콜백 → 세션 생성
3. Naver: 서버 리다이렉트 → 네이버 로그인 → 콜백 → magic link → 세션 생성

---

## Task 13: 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md` — naver-auth Feature 추가
- Modify: `docs/reference/database-schema.md` — auth_provider 컬럼 추가
- Modify: `docs/reference/features-frontend.md` — auth Feature 변경사항 반영

**Step 1: 레퍼런스 문서 업데이트**

각 문서에 해당 변경사항 추가.

**Step 2: 커밋**

```bash
git add docs/reference/
git commit -m "docs: update reference docs for multi auth provider"
```

---

## 요약

| Task | 내용 | 예상 영역 |
|------|------|----------|
| 1 | 환경변수 추가 | .env |
| 2 | DB 스키마 (auth_provider) | packages/drizzle |
| 3 | Provider 설정 + 아이콘 | apps/app (auth) |
| 4 | OAuthButtons 컴포넌트 | apps/app (auth) |
| 5 | sign-in/sign-up UI 수정 | apps/app (auth) |
| 6 | Naver OAuth Feature | packages/features |
| 7 | 서버 등록 | apps/server |
| 8 | Auth Callback 확인 | apps/app |
| 9 | Profile Sync 수정 | packages/core |
| 10 | Admin 사용자 표시 | apps/system-admin |
| 11 | Supabase/Naver/Kakao 수동 설정 | 외부 |
| 12 | 통합 테스트 | 전체 |
| 13 | 문서 업데이트 | docs/reference |
