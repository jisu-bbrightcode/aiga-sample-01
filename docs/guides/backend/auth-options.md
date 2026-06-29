---
description: "Auth options: Supabase vs Custom Auth comparison, setup SQL, migration guide"
globs: "packages/core/auth/**/*.ts, apps/server/**/*.ts"
alwaysApply: false
---

# Auth Options: Supabase vs Custom

## Auth 옵션 비교

| 항목              | Supabase Auth      | Custom Auth       |
| ----------------- | ------------------ | ----------------- |
| **설정 난이도**   | 쉬움               | 중간              |
| **인프라 의존성** | Supabase 필수      | PostgreSQL만 필요 |
| **OAuth 지원**    | 기본 제공          | 직접 구현         |
| **세션 관리**     | Supabase 처리      | 직접 구현         |
| **커스터마이징**  | 제한적             | 완전한 제어       |
| **서버 모듈**     | 불필요             | 필요              |
| **profiles 연결** | `id` 동일          | FK 참조           |
| **상태**          | 현재 기본값        | TODO              |

---

## 옵션 A: Supabase Auth (현재 기본값)

### auth.ts - Supabase Auth 스키마 참조

Supabase `auth` 스키마를 Drizzle에서 FK 참조할 때 사용합니다. **직접 수정 금지**.

```typescript
import { pgSchema, timestamp, uuid } from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
```

### 특징

- `profiles.id` = `auth.users.id` (동일한 UUID 사용)
- 인증 로직은 Supabase SDK로 처리
- 서버사이드 인증 모듈 불필요
- OAuth, Magic Link 등 기본 제공

### Profiles 자동 생성 트리거 (필수 설정)

Supabase Dashboard > SQL Editor에서 `packages/drizzle/supabase/auth-trigger.sql` 실행:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    'editor'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 트리거 동작

| 이벤트              | 동작                                |
| ------------------- | ----------------------------------- |
| 사용자 회원가입     | `profiles` 자동 생성 (role: editor) |
| OAuth 로그인 (최초) | `profiles` 자동 생성 + avatar 복사  |
| 사용자 삭제         | `profiles` 자동 삭제 (선택적)       |

### 이름 추출 우선순위

1. `raw_user_meta_data.full_name` (회원가입 시 입력)
2. `raw_user_meta_data.name` (OAuth 제공)
3. 이메일 @ 앞부분 (fallback)

---

## 옵션 B: Custom Auth (TODO)

### auth.ts - Custom Auth 스키마

```typescript
export const users = pgTable("auth_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const sessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const oauthAccounts = pgTable("auth_oauth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

### Custom Auth 테이블 구조

| 테이블                | 설명                                     |
| --------------------- | ---------------------------------------- |
| `auth_users`          | 사용자 인증 정보 (이메일, 비밀번호 해시) |
| `auth_sessions`       | 세션 토큰 관리                           |
| `auth_oauth_accounts` | OAuth 연동 정보                          |

### 특징

- `profiles.id`는 `auth_users.id`를 FK 참조
- 서버사이드 인증 모듈 필요 (`apps/server/src/features/auth/`)
- JWT/Session 토큰 직접 관리
- 비밀번호 해싱 (bcrypt/argon2) 직접 구현

