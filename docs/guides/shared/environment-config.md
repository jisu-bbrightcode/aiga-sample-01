---
description: "Environment variable configuration rules - Server/Client env structure, Zod schema validation, NestJS ConfigModule, Vite integration, Feature config pattern"
globs: "apps/*/src/config/*.ts, apps/*/src/lib/env.ts, .env*"
alwaysApply: false
---

# Environment Configuration Rules

> Feature 환경변수 설정 패턴

---

## 환경변수 분류

| 구분               | 접두사            | 사용처                  | 예시                              |
| ------------------ | ----------------- | ----------------------- | --------------------------------- |
| **Server**         | 없음              | NestJS 서버             | `DATABASE_URL`, `PORT`            |
| **Client Core**    | `VITE_`           | Vite 클라이언트 공통    | `VITE_API_URL`, `VITE_APP_NAME` |
| **Feature Server** | `{FEATURE}_`      | Feature 전용 서버       | `PAYMENT_STRIPE_KEY`              |
| **Feature Client** | `VITE_{FEATURE}_` | Feature 전용 클라이언트 | `VITE_PAYMENT_PUBLIC_KEY`         |

## 네이밍 규칙

`VITE_APP_NAME`은 런타임 UI 라벨을 override할 때만 사용한다. 앱/관리자 HTML의 문서 title은
환경변수 미설정 상태에서도 브랜드명이 깨지지 않도록 각각 `Product Builder`, `Product Builder Admin`을 기본값으로 둔다.

| 규칙                 | 예시                    | 설명                      |
| -------------------- | ----------------------- | ------------------------- |
| **Server Feature**   | `{FEATURE}_{NAME}`      | `PAYMENT_STRIPE_KEY`      |
| **Client Feature**   | `VITE_{FEATURE}_{NAME}` | `VITE_PAYMENT_PUBLIC_KEY` |
| **UPPER_SNAKE_CASE** | `STRIPE_SECRET_KEY`     | 환경변수 표준             |
| **Feature 접두사**   | `PAYMENT_`, `AUTH_`     | Feature 구분              |

---

## 폴더 구조

```
# Server Feature
apps/server/src/features/{name}/
├── config/
│   ├── {name}.config.ts      # 환경변수 설정 정의
│   └── index.ts

# Client Feature
apps/app/src/features/{name}/
├── config/
│   ├── env.ts                 # 클라이언트 환경변수
│   └── index.ts
```

---

## Server 환경변수 (NestJS)

### 1. Config 정의 (Zod + registerAs)

```typescript
// apps/server/src/features/payment/config/payment.config.ts
import { registerAs } from "@nestjs/config";
import { z } from "zod";

const paymentEnvSchema = z.object({
  stripeSecretKey: z.string().min(1, "PAYMENT_STRIPE_SECRET_KEY is required"),
  stripeWebhookSecret: z.string().min(1, "PAYMENT_STRIPE_WEBHOOK_SECRET is required"),
  currency: z.string().default("KRW"),
});

export type PaymentConfig = z.infer<typeof paymentEnvSchema>;

export const paymentConfig = registerAs("payment", (): PaymentConfig => {
  const config = {
    stripeSecretKey: process.env.PAYMENT_STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: process.env.PAYMENT_STRIPE_WEBHOOK_SECRET ?? "",
    currency: process.env.PAYMENT_CURRENCY ?? "KRW",
  };

  const result = paymentEnvSchema.safeParse(config);
  if (!result.success) {
    console.error("Payment config validation failed:", result.error.format());
    throw new Error("Invalid payment configuration");
  }

  return result.data;
});
```

### 2. Module에서 Config 로드

```typescript
@Module({
  imports: [
    ConfigModule.forFeature(paymentConfig),  // Feature 전용 config 등록
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
```

### 3. Service에서 @Inject 사용

```typescript
@Injectable()
export class PaymentService {
  constructor(
    @Inject(paymentConfig.KEY)
    private config: ConfigType<typeof paymentConfig>,
  ) {
    this.stripe = new Stripe(this.config.stripeSecretKey, { ... });
  }
}
```

---

## Client 환경변수 (Vite)

### 1. Zod 검증 + 싱글톤 export

```typescript
// apps/app/src/features/payment/config/env.ts
import { z } from "zod";

const paymentClientEnvSchema = z.object({
  VITE_PAYMENT_STRIPE_PUBLIC_KEY: z.string().min(1),
  VITE_PAYMENT_SUCCESS_URL: z.string().url().optional(),
  VITE_PAYMENT_CANCEL_URL: z.string().url().optional(),
});

export type PaymentClientEnv = z.infer<typeof paymentClientEnvSchema>;

function getPaymentEnv(): PaymentClientEnv {
  const env = {
    VITE_PAYMENT_STRIPE_PUBLIC_KEY: import.meta.env.VITE_PAYMENT_STRIPE_PUBLIC_KEY,
    VITE_PAYMENT_SUCCESS_URL: import.meta.env.VITE_PAYMENT_SUCCESS_URL,
    VITE_PAYMENT_CANCEL_URL: import.meta.env.VITE_PAYMENT_CANCEL_URL,
  };

  const result = paymentClientEnvSchema.safeParse(env);
  if (!result.success) {
    console.error("Payment client env validation failed:", result.error.format());
    throw new Error("Invalid payment client environment");
  }

  return result.data;
}

export const paymentEnv = getPaymentEnv();
```

### 2. Vite 타입 확장 (선택)

```typescript
// apps/app/src/features/payment/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAYMENT_STRIPE_PUBLIC_KEY: string;
  readonly VITE_PAYMENT_SUCCESS_URL?: string;
  readonly VITE_PAYMENT_CANCEL_URL?: string;
}
```

---

## .env 파일 구조

```bash
# .env.example

# ===== Core =====
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=xxx
BETTER_AUTH_URL=http://localhost:3002
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Feature-specific server integrations. Missing values should disable or fail
# the relevant feature path, not prevent core auth/API boot. Provider-backed
# template features should also have an explicit {FEATURE}_ENABLED=false gate.
GEMINI_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
BLOB_READ_WRITE_TOKEN=

# ===== Feature: Email (Server) =====
# 서버 부팅 필수값은 아니다. 없으면 EmailModule은 뜨지만 실제 발송 요청만 실패한다.
RESEND_API_KEY=
EMAIL_FROM=Product Builder <noreply@example.com>

VITE_API_URL=http://localhost:3002

# ===== Feature: Payment (Server) =====
# 없거나 불완전하면 PaymentModule/Polar webhook route가 등록되지 않는다.
PAYMENT_STRIPE_SECRET_KEY=sk_test_...
PAYMENT_STRIPE_WEBHOOK_SECRET=whsec_...
POLAR_ACCESS_TOKEN=polar_oat_...
POLAR_ENV=sandbox
POLAR_ORGANIZATION_ID=...
POLAR_WEBHOOK_SECRET=

# ===== Feature: Message Sending / SOLAPI (Server, optional admin) =====
# 새 Product Builder 프로젝트 복제 직후에는 route가 등록되지 않아야 한다.
SOLAPI_ENABLED=false
SOLAPI_API_KEY=your_solapi_api_key
SOLAPI_API_SECRET=your_solapi_api_secret
SOLAPI_DEFAULT_SENDER=0212345678
SOLAPI_WEBHOOK_SECRET=your_solapi_webhook_secret

# ===== Feature: Payment (Client) =====
VITE_PAYMENT_STRIPE_PUBLIC_KEY=pk_test_...
```

서버 런타임은 로컬 개발에서만 루트 `.env.local` / `.env`를 읽는다. Vercel처럼
`VERCEL` 환경변수가 있는 배포 환경에서는 배포 플랫폼의 Environment Variables만
사용하고, 로컬 env 파일 로딩은 건너뛴다.

EmailModule은 auth email sender 주입을 위해 항상 등록된다. `RESEND_API_KEY`는
서버 부팅 필수값이 아니며, 실제 이메일 발송 시점에 없으면 해당 발송만 실패해야
한다.

## 빌드 시점 환경변수 검증

```typescript
// scripts/validate-env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PAYMENT_STRIPE_SECRET_KEY: z.string().optional(),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Environment validation failed:");
  console.error(result.error.format());
  process.exit(1);
}
```

```json
// package.json
{ "scripts": { "prebuild": "tsx scripts/validate-env.ts" } }
```

---

## 체크리스트

Feature에 환경변수 추가 시:

- [ ] **Server**: `config/{feature}.config.ts` 생성, Zod 스키마 검증, `registerAs()` 등록
- [ ] **Server**: Module에서 `ConfigModule.forFeature()` 추가
- [ ] **Server**: Service에서 `@Inject()` 주입
- [ ] **Client**: `config/env.ts` 생성, `VITE_` 접두사 확인, Zod 검증
- [ ] **CI/CD**: `scripts/validate-env.ts`에 추가, `.env.example` 업데이트
- [ ] **보안**: `BETTER_AUTH_SECRET` 등 서버 전용 키는 `VITE_` 접두사 사용 금지

---

## 관련 문서

- `.claude/rules/backend/core-schema.md` - Core Schema + Auth 설정
- `.claude/rules/feature/steps.md` - Feature 구현 단계 + 체크리스트
