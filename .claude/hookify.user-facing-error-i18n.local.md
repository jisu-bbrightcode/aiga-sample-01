---
name: block-user-facing-raw-error-message
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: (apps/app/src|packages/widgets/src)/.+\.(ts|tsx)$
  - field: new_text
    operator: regex_match
    pattern: (toast\.(error|warning|info|success)\(|alert\(|description=\{|set[A-Za-z]*(Error|Message)\()[\s\S]{0,180}((error|err|e|result\.error)\.message|failureReason|providerReason|serverReason|\.reason)
---

🚫 **사용자 노출 에러 규칙 위반 — raw error message/reason 차단**

사용자에게 보이는 toast, alert, dialog description, inline error state 에 raw `Error.message`, 서버 `message`, provider/server `reason`, `failureReason` 를 직접 연결하려고 합니다.

**원칙:** 사용자에게 전달되는 에러는 비기술적이고 친절한 i18n 문구여야 합니다. 내부 로그/analytics/debug metadata 가 아닌 UI 경로에서는 raw message/reason 표시 금지.

**올바른 방법:**
```tsx
// ❌ 금지
toast.error(error.message)
setError(result.error.message)
<p>{log.failureReason}</p>

// ✅ app
import { getAppErrorMessage } from "@/lib/user-facing-error"
toast.error(getAppErrorMessage(t, error, "errors.saveFailed"))

// ✅ widgets
import { getWidgetErrorMessage } from "../common/user-facing-error"
setError(getWidgetErrorMessage(t, error, "errors.loadFailed"))
```

**필수 확인:**
- ko/en/ja/zh locale key 를 모두 추가/갱신한다.
- `pnpm i18n:verify` 를 통과시킨다.
- 내부 로그 전용이면 UI 렌더링 경로가 아님을 코드 구조로 분리한다.
