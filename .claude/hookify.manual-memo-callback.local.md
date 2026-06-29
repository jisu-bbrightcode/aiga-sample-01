---
name: block-manual-memo-callback
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (apps|packages)/.+\.tsx?$
  - field: new_text
    operator: regex_match
    pattern: (useMemo|useCallback|React\.memo)\s*\(
---

🚫 **React Compiler 규칙 위반 — 수동 메모이제이션 차단**

`useMemo`, `useCallback`, `React.memo`를 사용하고 있습니다.

**원칙:** 이 프로젝트는 React Compiler를 사용. Compiler가 메모이제이션을 자동 처리하므로 수동 최적화 API 사용 금지.
**규칙:** `docs/rules/frontend/react-component.md` §1

**그냥 삭제하세요:**
```typescript
// ❌ 금지
const value = useMemo(() => compute(a, b), [a, b])
const handler = useCallback(() => doSomething(), [])
const MemoComp = React.memo(Component)

// ✅ 그냥 작성
const value = compute(a, b)
const handler = () => doSomething()
function Component() { ... }
// React Compiler가 알아서 최적화합니다
```
