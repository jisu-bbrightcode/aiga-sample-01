---
description: Feature Isolation rules - never modify other Features
globs: "packages/features/**/*.ts, apps/app/src/features/**/*.ts"
alwaysApply: false
---

# Feature Isolation (기능 격리)

신규 Feature를 구현할 때는 **다른 Feature를 절대 수정하지 않습니다**.

## 핵심 원칙

| 원칙                  | 설명                                                     |
| --------------------- | -------------------------------------------------------- |
| **독립성 유지**        | 각 Feature는 독립적으로 동작하며 다른 Feature 수정 금지   |
| **Core만 참조**        | 다른 Feature 대신 Core 스키마/서비스만 참조              |
| **읽기 전용**          | 기존 Feature 코드는 참고만 하고 수정하지 않음             |
| **새 파일만 생성**      | 기존 Feature 폴더 내부에 파일 추가/수정 금지              |

## 허용/금지 범위

```
❌ 다른 Feature 수정:
packages/features/blog/                       # Blog Feature 수정 금지
packages/features/community/                  # Community Feature 수정 금지
apps/app/src/features/payment/                # Payment Feature 수정 금지

❌ 다른 Feature Schema 수정:
packages/drizzle/src/schema/features/blog/    # 다른 Feature 스키마 수정 금지
packages/drizzle/src/schema/features/community/

✅ 자신의 Feature만 작업:
packages/features/my-new-feature/                 # 새 Feature만 생성
packages/drizzle/src/schema/features/my-new-feature/

✅ Core는 참조 가능:
packages/drizzle/src/schema/core/profiles.ts      # Core 스키마 참조 OK
packages/drizzle/src/schema/core/auth.ts
```

> 의존성 해결 방법은 `dependencies.md`를 참조하십시오.
