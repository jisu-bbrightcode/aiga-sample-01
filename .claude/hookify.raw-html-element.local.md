---
name: block-raw-html-element
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (apps|packages/widgets)/.+\.tsx$
  - field: new_text
    operator: regex_match
    pattern: <(button|input|textarea|select|table|dialog)[\s>]
---

🚫 **UI 컴포넌트 규칙 위반 — 원시 HTML element 차단**

`<button>`, `<input>`, `<textarea>`, `<select>`, `<table>`, `<dialog>`를 직접 사용하고 있습니다.

**원칙:** shadcn(Base-UI) 컴포넌트를 기본으로 사용. 동일/유사 컴포넌트가 있으면 HTML element 직접 사용 금지.
**규칙:** `CLAUDE.md` FE UI 컴포넌트 강제 규칙

**올바른 방법:**
```tsx
// ❌ 금지
<button onClick={handler}>저장</button>
<input type="text" value={v} />

// ✅ shadcn 컴포넌트
import { Button } from '@repo/ui/shadcn/button'
import { Input } from '@repo/ui/shadcn/input'

<Button onClick={handler}>저장</Button>
<Input type="text" value={v} />
```

**예외:** `packages/ui/` 내부에서 wrapper를 만들 때만 원시 element 허용.
