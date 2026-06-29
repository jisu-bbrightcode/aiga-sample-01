---
name: block-console-log-production
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: packages/(features|core|drizzle|widgets)/.*\.ts$
  - field: new_text
    operator: regex_match
    pattern: console\.(log|error|warn|debug)\(
---

🚫 **로깅 규칙 위반 — console.log/error/warn 차단**

서버/공유 패키지에서 `console.log`를 사용하고 있습니다.

**원칙:** `console.*` 금지. `createLogger()` 사용.
**규칙:** `docs/rules/backend/logging.md`

**올바른 방법:**
```typescript
// ❌ 금지
console.log('Post published', postId)
console.error('Payment failed', error)

// ✅ 구조화 로깅
import { createLogger } from '@repo/core/logger'
const logger = createLogger('blog')

logger.info('Post published', {
  'blog.post_id': postId,
  'blog.slug': post.slug,
})

logger.error('Payment charge failed', {
  'payment.order_id': orderId,
  'error.message': error.message,
})
```

**예외:** `apps/` 내 클라이언트 코드와 부트스트랩(`main.ts`)에서는 허용.
