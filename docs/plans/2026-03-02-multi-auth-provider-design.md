# Multi Auth Provider 설계

## 개요

관리자가 `.env`에서 활성 OAuth Provider를 설정하면, 로그인/회원가입 화면에 해당 Provider 버튼이 자동으로 나타나는 기능.

**1차 범위**: 이메일 + Google + 카카오 + 네이버

## 현재 상태

- Supabase Auth 기반, Google OAuth만 구현됨
- `useSignInWithOAuth` 훅 존재 (provider 파라미터 받음)
- 로그인 UI: variant 패턴 (sign-in-04.tsx 사용 중)
- Admin에 Auth Provider 관리 기능 없음

## Provider별 연동 전략

| Provider | Supabase 지원 | 연동 방식 | 클라이언트 코드 |
|----------|:---:|-----------|----------------|
| **이메일** | O (기본) | 기존 유지 | `signInWithPassword()` |
| **Google** | O (네이티브) | 기존 유지 | `signInWithOAuth({ provider: "google" })` |
| **카카오** | O (네이티브) | Supabase Dashboard 설정 | `signInWithOAuth({ provider: "kakao" })` |
| **네이버** | X | 서버사이드 OAuth + Admin API | 서버 리다이렉트 방식 |

### 카카오 (Supabase 네이티브)

Supabase가 카카오를 공식 지원하므로 Google과 동일한 패턴으로 구현 가능.

**설정**:
1. Kakao Developers에서 앱 생성, REST API key + Client Secret 획득
2. Supabase Dashboard > Authentication > Providers > Kakao 활성화
3. Client ID, Client Secret 입력
4. 리다이렉트 URI: `https://<project-ref>.supabase.co/auth/v1/callback`

**코드**: `signInWithOAuth({ provider: "kakao" })` — Google과 동일 패턴

### 네이버 (서버사이드 OAuth)

Supabase가 네이버를 지원하지 않으므로, 서버에서 OAuth를 직접 처리하고 Supabase Admin API로 사용자/세션을 생성한다.

**흐름**:
```
1. 프론트엔드: "네이버로 로그인" 클릭
   → window.location.href = `${API_URL}/api/auth/naver/authorize`

2. server: /api/auth/naver/authorize
   → 네이버 OAuth 인증 URL로 리다이렉트
   → https://nid.naver.com/oauth2.0/authorize?client_id=...&redirect_uri=...&response_type=code&state=...

3. 사용자: 네이버에서 로그인 후 동의

4. 네이버 → server: /api/auth/naver/callback?code=...&state=...
   a. code로 access_token 교환 (POST https://nid.naver.com/oauth2.0/token)
   b. access_token으로 사용자 정보 조회 (GET https://openapi.naver.com/v1/nid/me)
   c. Supabase Admin API로 사용자 찾기/생성:
      - listUsers로 이메일 검색
      - 없으면 createUser({ email, email_confirm: true, user_metadata, app_metadata })
   d. generateLink({ type: 'magiclink', email }) → token_hash 획득
   e. 리다이렉트: ${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=magiclink&redirect_to=${FRONTEND_URL}

5. Supabase: magic link 토큰 검증 → 세션 생성 → 프론트엔드로 리다이렉트

6. 프론트엔드: onAuthStateChange가 세션 감지 → 정상 로그인 완료
```

**장점**:
- Supabase 세션 관리 완전 통합 (기존 sessionAtom/profileAtom 그대로 동작)
- 커스텀 JWT 발급 불필요
- auth.users 테이블에 통합 관리
- 기존 Auth Guard, Profile Sync 변경 없음

## 환경변수 구조

```ini
# ===== Auth Provider 활성화 (프론트엔드) =====
VITE_AUTH_PROVIDERS=email,google,naver,kakao

# ===== Google =====
# Supabase Dashboard에서 설정 — .env 불필요

# ===== Kakao =====
# Supabase Dashboard에서 설정 — .env에는 참조용만
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret

# ===== Naver (서버에서만 사용) =====
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

**규칙**:
- `VITE_AUTH_PROVIDERS`: 쉼표 구분, 프론트엔드가 빌드타임에 읽어서 버튼 렌더링 결정
- `NAVER_*`: 서버 전용 (`VITE_` 접두사 없음 — 클라이언트 노출 금지)
- Google/Kakao 키: Supabase Dashboard에서 관리 (`.env`에는 참조/백업용)

## 서버 구현: Naver OAuth Feature

### NestJS Module 구조

```
packages/features/naver-auth/
├── index.ts
├── naver-auth.module.ts
├── controller/
│   └── naver-auth.controller.ts    # /api/auth/naver/authorize, /callback
├── service/
│   └── naver-auth.service.ts       # 네이버 API 호출, Supabase Admin API
├── dto/
│   └── naver-callback.dto.ts
└── types/
    └── index.ts
```

### 주요 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/auth/naver/authorize` | 네이버 로그인 페이지로 리다이렉트 |
| GET | `/api/auth/naver/callback` | 네이버 콜백 처리 → Supabase 세션 생성 → 프론트 리다이렉트 |

### NaverAuthService 핵심 메서드

```typescript
class NaverAuthService {
  // 네이버 인증 URL 생성 (state 포함)
  getAuthorizationUrl(redirectUri: string): string

  // 인증 코드 → 액세스 토큰 교환
  exchangeCodeForToken(code: string, state: string): Promise<NaverTokenResponse>

  // 액세스 토큰 → 사용자 프로필 조회
  getUserProfile(accessToken: string): Promise<NaverUserProfile>

  // Supabase 사용자 찾기/생성 + magic link 생성
  findOrCreateSupabaseUser(profile: NaverUserProfile): Promise<{ tokenHash: string }>
}
```

### 네이버 API 참조

```
인증 URL:     https://nid.naver.com/oauth2.0/authorize
토큰 교환:    https://nid.naver.com/oauth2.0/token
사용자 정보:  https://openapi.naver.com/v1/nid/me
```

**네이버 사용자 정보 응답**:
```json
{
  "resultcode": "00",
  "message": "success",
  "response": {
    "id": "unique_naver_id",
    "email": "user@naver.com",
    "name": "홍길동",
    "profile_image": "https://...",
    "nickname": "닉네임"
  }
}
```

## 프론트엔드 변경

### Provider 설정 파싱

```typescript
// apps/app/src/features/auth/config.ts 확장
type OAuthProvider = "google" | "naver" | "kakao";
type AuthProvider = "email" | OAuthProvider;

const ENABLED_PROVIDERS: AuthProvider[] =
  (import.meta.env.VITE_AUTH_PROVIDERS ?? "email")
    .split(",")
    .map(p => p.trim()) as AuthProvider[];

const PROVIDER_CONFIG: Record<OAuthProvider, {
  label: string;
  icon: string;         // SVG 컴포넌트 또는 아이콘 이름
  color: string;        // 버튼 배경색
  supabaseNative: boolean;
}> = {
  google:  { label: "Google로 계속",  icon: "google",  color: "white",   supabaseNative: true },
  kakao:   { label: "카카오로 계속",   icon: "kakao",   color: "#FEE500", supabaseNative: true },
  naver:   { label: "네이버로 계속",   icon: "naver",   color: "#03C75A", supabaseNative: false },
};
```

### 로그인 UI 변경 (sign-in-04.tsx)

**현재**: Google 버튼 하드코딩
**변경**: `ENABLED_PROVIDERS`에서 OAuth Provider만 필터링하여 동적 렌더링

```tsx
// 변경 전
<Button onClick={signInWithGoogle}>
  <GoogleIcon /> Google로 계속
</Button>

// 변경 후
{getEnabledOAuthProviders().map(provider => (
  <OAuthButton
    key={provider}
    provider={provider}
    config={PROVIDER_CONFIG[provider]}
    onClick={() => handleOAuthSignIn(provider)}
  />
))}
```

### OAuth 로그인 핸들러

```typescript
function handleOAuthSignIn(provider: OAuthProvider) {
  const config = PROVIDER_CONFIG[provider];

  if (config.supabaseNative) {
    // Google, Kakao: Supabase 네이티브
    signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
  } else {
    // Naver: 서버사이드 리다이렉트
    window.location.href = `${API_URL}/api/auth/${provider}/authorize?redirect_to=${encodeURIComponent(window.location.origin)}`;
  }
}
```

### Provider 아이콘 SVG

각 Provider의 공식 로고 SVG를 `components/` 또는 `blocks/shared/`에 추가:
- `GoogleIcon`: 기존 사용 중
- `KakaoIcon`: 카카오 말풍선 로고
- `NaverIcon`: 네이버 N 로고

### 회원가입 UI 변경 (sign-up 블록)

로그인과 동일하게 OAuth Provider 버튼 동적 렌더링. OAuth 회원가입과 로그인은 동일 흐름 (Supabase가 자동으로 신규/기존 사용자 처리).

## DB 스키마 변경

### profiles 테이블에 auth_provider 컬럼 추가

```typescript
// packages/drizzle/src/schema/core/profiles.ts
export const authProviderEnum = pgEnum("auth_provider", [
  "email", "google", "naver", "kakao"
]);

// profiles 테이블에 추가
authProvider: authProviderEnum("auth_provider").default("email"),
```

**용도**: Admin 사용자 관리에서 가입 방식 표시, 분석

### Profile Sync 수정

`useProfileSync` 또는 서버사이드 프로필 생성 로직에서 `auth_provider` 필드 설정:
- Supabase 네이티브 (Google, Kakao): `auth.users.app_metadata.provider` 값 사용
- 서버사이드 (Naver): 사용자 생성 시 직접 설정

## Admin 변경 (최소)

Admin에 별도 Provider 관리 UI 없음. 변경 사항:

1. **사용자 목록**: `auth_provider` 컬럼 표시 (아이콘 + 텍스트)
2. **사용자 상세**: 가입 Provider 정보 표시

## 보안 고려사항

| 항목 | 대응 |
|------|------|
| CSRF | 네이버 OAuth `state` 파라미터에 랜덤 값 + 서버 세션 검증 |
| 토큰 노출 | NAVER_CLIENT_SECRET은 서버 전용, VITE_ 접두사 절대 금지 |
| 오픈 리다이렉트 | `redirect_to` 파라미터를 허용 도메인 화이트리스트로 검증 |
| 이메일 충돌 | 동일 이메일로 다른 Provider 가입 시 기존 계정에 연결 (Supabase 기본 동작) |

## 구현 순서

1. **Phase 1**: 환경변수 + 카카오 (Supabase 네이티브, 가장 간단)
2. **Phase 2**: 네이버 서버사이드 OAuth Feature
3. **Phase 3**: 프론트엔드 UI 변경 (동적 Provider 버튼)
4. **Phase 4**: DB 스키마 + Profile Sync + Admin 표시
5. **Phase 5**: 테스트 + 문서

## 참고 자료

- [Supabase Kakao Login Docs](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
- [Supabase signInWithOAuth API](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)
- [Supabase Third-party Auth Overview](https://supabase.com/docs/guides/auth/third-party/overview)
- [Supabase Naver Support Discussion](https://github.com/orgs/supabase/discussions/35631)
- [Custom OAuth Providers Discussion](https://github.com/orgs/supabase/discussions/417)
- [Generic OIDC Provider Discussion](https://github.com/orgs/supabase/discussions/6547)
- [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md)
- [카카오 로그인 API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
