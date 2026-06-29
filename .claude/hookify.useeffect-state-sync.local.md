---
name: warn-useeffect-state-sync
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: (apps|packages)/.+\.tsx?$
  - field: new_text
    operator: regex_match
    pattern: useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*(set[A-Z]\w+)\(
---

⚠️ **React 안티패턴 경고 — useEffect로 state 동기화 감지**

`useEffect` 안에서 `setState`를 호출하여 상태를 동기화하고 있습니다.

**원칙:** props → state 동기화에 useEffect 사용 금지. 렌더링 중 직접 계산.
**규칙:** `docs/rules/frontend/react-component.md` §3, §5

**파생 가능한 값이라면:**
```typescript
// ❌ useEffect 동기화
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${firstName} ${lastName}`)
}, [firstName, lastName])

// ✅ 렌더링 중 계산
const fullName = `${firstName} ${lastName}`
```

**외부 구독이라면:**
```typescript
// ✅ useSyncExternalStore 또는 이벤트 핸들러에서 직접 업데이트
```

**허용 예외:** cleanup 필수인 구독(타이머, 이벤트 리스너, WebSocket)
