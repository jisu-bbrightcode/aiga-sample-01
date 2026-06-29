---
name: block-feature-isolation
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: packages/features/[^/]+/
  - field: new_text
    operator: regex_match
    pattern: from\s+['"]\.\./((?!types|index)\w+)/
---

🚫 **Feature 격리 위반 — 다른 Feature 내부 파일 직접 import 차단**

`packages/features/{A}/`에서 `packages/features/{B}/`의 내부 파일을 직접 참조하고 있습니다.

**원칙:** 각 Feature는 독립적. 다른 Feature 수정 금지, 내부 직접 참조 금지.
**규칙:** `docs/rules/feature/isolation.md`

**허용되는 방법:**
```typescript
// ✅ Core 참조
import { profiles } from '@repo/drizzle'
import { getAppErrorMessage } from '@repo/core/i18n'

// ✅ 다른 Feature의 public API (index.ts export)
import { BlogService } from '@repo/features/blog'

// ❌ 다른 Feature 내부 파일 직접 참조
import { BlogService } from '../../blog/service/blog.service'
```
