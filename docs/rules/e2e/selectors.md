# E2E selector 규칙 (i18n-agnostic)

> CI chromium 의 default locale 은 en-US. 한국어 / CJK 텍스트로 selector lock-in 하면 다른 로케일에서 깨진다.

## 1. 우선순위

| 좋음 | 나쁨 |
|---|---|
| `page.locator('[data-el="login.submit-btn"]')` | `page.getByRole('button', { name: '로그인' })` |
| `page.locator('[data-testid="project-card"]')` | `page.getByText('내 프로젝트')` |
| `page.getByRole('heading', { level: 1 })` | `page.getByRole('heading', { name: '다시 오신...' })` |
| `page.locator('[data-el="quest.create-btn"]')` | `page.locator('text=새 퀘스트')` |

## 2. `data-el` 컨벤션

```
data-el="<feature>.<element>"
```

예시:
- `data-el="login.email-input"`, `data-el="login.password-input"`, `data-el="login.submit-btn"`, `data-el="login.form-card"`
- `data-el="workspace.create"`
- `data-el="entity-table"`
- `data-el="shell.sidebar"`
- `data-el="draft-list.list"`

### 새 selector 가 없을 때

UI 컴포넌트에 `data-el` 이 부착되어 있지 않으면 **컴포넌트 PR 에서 먼저 부착**한 뒤 spec 작성.

```tsx
// 좋음
<Button data-el="quest.create-btn" onClick={handleCreate}>
  {t("quest.create")}
</Button>

// 안 좋음 — spec 이 i18n 텍스트로 잡아야 함
<Button onClick={handleCreate}>{t("quest.create")}</Button>
```

## 3. 영어 텍스트는?

영어로 고정된 화면 (예: 신규 organization 마법사 `Name your workspace`, `Continue`, `Skip for now`) 은 `getByRole({ name: "..." })` 로 잡아도 OK.
- CI 가 ko-KR 로 떠도 i18n 사전에 해당 키가 영어 fallback 만 있을 경우 안전.
- `apps/app/tests/e2e/_lib/workspace.ts` 의 `createWorkspaceAndProject` 가 이 패턴.

## 4. 자동 차단

`.pi/extensions/rules/e2e-spec-conventions.ts` 의 `cjk-selector` 룰:

| 패턴 | 차단 |
|---|---|
| `getByRole(...,  { name: '<CJK>' })` | ✅ |
| `getByText('<CJK>')` | ✅ |
| `.locator('text=<CJK>')` | ✅ |
| `{ hasText: '<CJK>' }` | ✅ |

CJK 정규식: `[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]` (히라가나/가타카나/한자/한글).

## 5. 회피하지 말 것

- `data-el` 이 귀찮다고 `xpath` 로 우회 → 디자인 변경에 깨짐. UI 컴포넌트에 selector 부착이 정답.
- 텍스트로 잡고 싶다면 영어 키 + `playwright.config.ts` 의 `locale: "ko-KR"` 가 영어 fallback 으로 떨어지는지 먼저 확인. 한 spec 만의 임시 우회는 안 된다.

## 6. config 의 locale

`apps/app/playwright.config.ts`:

```ts
use: {
  baseURL: "http://localhost:3000",
  locale: "ko-KR",  // 운영 언어 일관성 (한국어 텍스트 일부 spec 호환 임시 조치)
  // ...
}
```

→ **임시 조치**. 장기적으로 spec 을 모두 `data-el` 로 마이그하고 locale 제거 예정 (`docs/runbooks/e2e-management.md` §6 사전 부채).
