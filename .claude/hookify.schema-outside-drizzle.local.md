---
name: block-schema-outside-drizzle
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: packages/features/.+\.ts$
  - field: new_text
    operator: regex_match
    pattern: pgTable\(|pgEnum\(|\.references\(\s*\(\)\s*=>
---

🚫 **스키마 중앙 관리 위반 — Feature 내부 스키마 정의 차단**

`packages/features/` 안에서 Drizzle 스키마(`pgTable`, `pgEnum`)를 정의하고 있습니다.

**원칙:** 모든 DB 스키마는 `packages/drizzle/src/schema/`에서 중앙 관리. Feature에 schema 없음.
**규칙:** `docs/rules/feature/schema.md`

**올바른 위치:**
```
packages/drizzle/src/schema/features/{name}/index.ts  ← 여기에 정의
packages/features/{name}/                              ← 여기에 정의 금지
```

**Import 패턴:**
```typescript
// ✅ 중앙 스키마에서 import
import { blogPosts, communities } from '@repo/drizzle'
import type { BlogPost } from '@repo/drizzle'

// ❌ Feature 내부 스키마
import { blogPosts } from './schema/posts.schema'
```
