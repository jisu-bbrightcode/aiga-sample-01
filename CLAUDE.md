# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. User-Facing Error Messages

**Never show raw technical errors to users.**

For any UI, feature, auth, payment, upload, AI/provider, sync, or form-validation work:

- Do not render raw `Error.message`, server `message`, provider `reason`, `failureReason`, status codes, tokens, request ids, or stack traces in toast/alert/dialog/inline/banner/tooltip/error-state UI.
- Internal logs, analytics payloads, and debug metadata may keep technical detail when they are not user-visible.
- User-visible errors must go through stable code/errorCode mapping plus i18n fallback:
  - app: `apps/app/src/lib/user-facing-error.ts` / `getAppErrorMessage(...)`
  - widgets: `packages/widgets/src/common/user-facing-error.ts` / `getWidgetErrorMessage(...)`
  - shared/core: `packages/core/i18n/user-facing-error.ts`
- Copy must be non-technical, friendly, and action-oriented: explain the situation briefly and tell the user what to do next.
- Any new user-facing error copy must update all locale sets (`ko`, `en`, `ja`, `zh`) and pass `pnpm i18n:verify`.
- Before claiming completion, search the touched UI surface for raw error leaks such as `error.message`, `result.error.message`, `failureReason`, `.reason`, and `String(error)`.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 프로젝트 컨텍스트 (on-demand)

이 파일은 **항상 로드**되지만 아래 상세 문서는 **작업이 해당될 때만** Read. 기본 로드 X.

### Product Builder 데이터 정책

이 워크스페이스에서는 Product Builder의 서버 권위 데이터 정책을 사용한다.

- 캐시는 서버 권위 데이터의 보조 캐시로만 설계한다.
- 데이터 변경은 서버 API + 서버 DB 검증 경로를 기준으로 설계한다.

### 도메인별 코딩 룰 (on-demand)

Repo-local skill bundle은 Product Builder 정리 범위에서 제거했다. 작업 영역별 규칙은 필요한 시점에 `docs/rules/`와 `docs/reference/`의 직접 문서를 읽는다.

| 영역 | 직접 참조 |
|------|----------|
| 프론트엔드 (React, shadcn, 라우팅, i18n) | `docs/rules/frontend/*.md` |
| 백엔드 (NestJS, tRPC, Drizzle, 로깅) | `docs/rules/backend/*.md` |
| Feature 추가/수정 (Page/Widget/Agent) | `docs/rules/feature/*.md`, `docs/reference/` |
| QA 검증 | `docs/rules/qa/*.md`, runtime verification docs |
| 범용 품질 · 아키텍처 · 커밋 | `docs/rules/`, `docs/reference/` |

원칙:
- 작업 시작 전에 해당 영역의 직접 문서를 필요한 만큼만 읽는다.
- 머지 전 최종 품질 체크는 테스트, 타입체크, 빌드, 정책 검색 결과로 판단한다.

Agent spawning 워크플로우:
- `/build` — 일반 구현 (Hana → Kai + Remy/Vera fan-out)
- `/qa` — 수동 QA (Hana → Vera/Remy/Zion 병렬)

### 자동 로드되는 규칙

아래는 세션 시작 시 **Claude Code가 자동으로 읽음** — 재참조 불필요:

- `AGENTS.md` — CLI 역할 라우팅, Slack 응답 규칙
- 이 `CLAUDE.md` — 본 문서
