---
name: block-useeffect-data-fetch
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (apps|packages)/.+\.(tsx|ts)$
  - field: new_text
    operator: regex_match
    pattern: useEffect\s*\(\s*(\(\)|async\s*\(\))\s*=>\s*\{[^}]*(fetch\(|axios\.|\.get\(|\.post\(|api\.)
---

🚫 **상태 관리 위반 — useEffect 내 데이터 fetching 차단**

`useEffect` 안에서 API 호출을 하고 있습니다.

**원칙:** 서버 데이터는 TanStack Query + generated REST client. useEffect로 API 호출 금지.
**규칙:** `docs/rules/frontend/react-component.md` §5, `docs/rules/frontend/rest-client.md` §5

**올바른 방법:**
```typescript
// ❌ 금지
useEffect(() => {
  fetch('/api/posts').then(r => r.json()).then(setData)
}, [])

// ✅ TanStack Query + generated REST client
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/posts')
      if (error) throw error
      return data
    },
  })
}
```
