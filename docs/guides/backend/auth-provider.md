---
description: "Auth provider interface, provider selection, transition patterns"
globs: "packages/core/auth/**/*.ts"
alwaysApply: false
---

# Auth Provider System

## IAuthProvider 인터페이스

```typescript
// packages/core/auth/provider.interface.ts
export interface IAuthProvider {
  signUp(email: string, password: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signOut(token: string): Promise<void>;
  getUser(token: string): Promise<AuthUser | null>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
}
```

## Provider 선택 로직

환경변수 `AUTH_PROVIDER`로 Provider를 선택합니다:

```typescript
// packages/core/auth/index.ts
import { supabaseProvider } from './providers/supabase';
import { customProvider } from './providers/custom';

const provider = process.env.AUTH_PROVIDER === 'custom'
  ? customProvider
  : supabaseProvider;

export const authProvider = provider;
```

```typescript
// Feature에서 사용
import { authProvider } from '@repo/core/auth';

const session = await authProvider.signIn(email, password);
```

## Feature 분리 전략

```
packages/core/auth/
├── index.ts              # Provider export (선택된 Provider만)
├── provider.interface.ts # IAuthProvider 인터페이스
├── providers/
│   ├── supabase.ts       # Supabase Adapter
│   └── custom.ts         # Custom Auth Adapter
├── store.ts              # Jotai atoms (Provider 무관)
├── guards/               # AuthGuard, AdminGuard
└── schema/
    └── profiles.ts       # 공통 profiles 테이블

# Server Feature (상호 배타적)
apps/server/src/features/auth-supabase/
├── service/
│   └── auth.service.ts   # Supabase 연동 서비스
└── auth-supabase.module.ts

apps/server/src/features/auth-custom/
├── schema/
│   ├── auth.ts           # auth_users, auth_sessions 테이블
│   └── index.ts
├── service/
│   └── auth.service.ts   # 비밀번호 해싱, JWT 발급
└── auth-custom.module.ts

# Client Feature
apps/app/src/features/auth-supabase/
└── ui/                   # Supabase 전용 UI (OAuth 버튼 등)

apps/app/src/features/auth-custom/
└── ui/                   # Custom 전용 UI (비밀번호 재설정 등)
```

## Registry 설정

```json
{
  "features": {
    "auth-supabase": {
      "name": "Supabase 인증",
      "group": "core",
      "conflicts": ["auth-custom"]
    },
    "auth-custom": {
      "name": "커스텀 인증",
      "group": "core",
      "conflicts": ["auth-supabase"]
    }
  }
}
```

## 네이밍 규칙

| 항목         | 이름                           | 이유                      |
| ------------ | ------------------------------ | ------------------------- |
| Feature 이름 | `auth-supabase`, `auth-custom` | Provider 명확히 구분      |
| Core 패키지  | `@repo/core/auth`              | Provider 무관한 공통 로직 |
| 환경변수     | `AUTH_PROVIDER`                | 명확하고 표준적           |
| Interface    | `IAuthProvider`                | 인터페이스 네이밍 컨벤션  |

## 설계 원칙

- Provider Adapter는 오버헤드 최소화 (단순 래핑)
- Custom Auth는 비밀번호 해싱(bcrypt), JWT 서명 검증 필수
- Session 토큰은 httpOnly 쿠키에 보안 저장
- 향후 OAuth Provider (Auth0, Clerk) 추가 가능하도록 인터페이스 설계
- `auth-supabase`와 `auth-custom`은 서로 의존하지 않음

## CLI 지원

```bash
product-builder init --auth=supabase  # Supabase Auth Feature 설치
product-builder init --auth=custom    # Custom Auth Feature 설치
```
