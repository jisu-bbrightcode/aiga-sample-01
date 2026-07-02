# 재사용 인증 통합 QA — 실행 결과 (BBR-517 / PB-AUTH-QA-001)

> Run: 2026-06-29 · Agent: Product Builder QA · Base: `product-builder-base@111d7721`
> Repo: `jisu-bbrightcode/aiga-sample-01` (delivery) · Worktree QA on `origin/main`

재사용한 better-auth 기반 인증/계정 surface가 고객 납품 repo에서 동작하는지
**실제 테스트를 실행**하여 검증했다. 아래 수치는 모두 이번 run의 실측 결과다.

## 1. 실행 결과 요약 — 98 pass / 0 fail

| Layer | Suite | 결과 | 명령 |
|---|---|---|---|
| Unit/contract | `packages/core/auth/*` (tsx --test) | **24/24** | `pnpm test:auth:core` |
| Integration | `@repo/features` email/resend (jest) | **16/16** | `pnpm test:auth:email` |
| Component | `apps/app` signup-flow + layout (vitest) | **26/26** | `pnpm test:auth:app` |
| API guard | `apps/server` better-auth.guard (jest) | **7/7** | `pnpm --filter server test -- better-auth.guard.spec.ts` |
| Client | `apps/app` auth-client + require-active-workspace | **6/6** | vitest run |
| **E2E** | `apps/app` auth-{signin,signup,forgot/reset-password,workspace-select} | **19/19** | `playwright test` (built app) |

## 2. Acceptance Criteria 매핑

### AC1 — email 인증 + OAuth provider별 성공/실패 흐름
- ✅ **email 로그인 성공/실패** — E2E: 성공→토큰저장+next이동, 자격증명오류→에러+페이지유지,
  EMAIL_NOT_VERIFIED→재발송 UI, Magic Link 성공/실패. (auth-signin 6 specs green)
- ✅ **가입 + 이메일 인증 안내/재발송** — auth-signup E2E green + signup-flow 26 vitest green.
- ✅ **비밀번호 재설정/찾기** — forgot/reset-password E2E green (성공/불일치/토큰없음/서버오류).
- ✅ **error contract / no-leak** — error-codes 매핑 + guard "no raw error leak" 401 green.
- ⚠️ **OAuth kakao/naver 실 흐름** — 미검증(아래 §3 R1). 빌드된 `/sign-in`은 Google 단일 버튼만
  노출, `oauth-buttons.tsx`는 Google/Apple/Naver/Kakao를 하드코딩 → AIGA 선택(kakao/naver)과 불일치.

### AC2 — 프로필 조회/수정, 세션 조회/해제, 계정 탈퇴 개별 증거
- ✅ **세션/인증 가드** — better-auth.guard 7 specs: JWT bearer / opaque session / cookie-only /
  stale-JWT→session fallback / 401(no creds) / 401(invalid) / 401(session API throw, no leak).
- ✅ **프로필 sync / active workspace** — auth-client + use-require-active-workspace + profile-sync green.
- ⚠️ **프로필 read/update · 세션 list/revoke · 계정 탈퇴의 live-API E2E** — 미실행(아래 §3 R2).
  실 DB(Neon) 필요 `@db` 경로라 dummy-state 환경에서 실행 불가.

## 3. 잔여 리스크 / 미검증 (residual)

| ID | 항목 | 성격 | Owner |
|---|---|---|---|
| R1 | sign-in OAuth 버튼이 AIGA 선택(kakao/naver)과 불일치 (Google 단일 노출, oauth-buttons는 4종 하드코딩) | UI/provider config 정합 | OAuth provider 구성 task (PB-AUTH-OAUTH-*) |
| R2 | 프로필 update·세션 revoke·계정 탈퇴 **live-API/DB** E2E 미실행 (`@db`) | 환경(실 Neon) 부재 | PB-INFRA real-provisioning (BBR-719) |
| R3 | **배포 URL** 공개탐색/로그인모달/보호접근 smoke 미실행 | 배포 부재 | PB-DEPLOY-VERIFY-001 / PB-LAUNCH-SMOKE-001 |
| R4 | 슈퍼 계정 `first@super.local` 기본 비밀번호 회전 미확인 | 핸드오프 | PB-ADMIN-SUPER-ACCOUNT-001 |

## 4. 재현 방법 (reproduce)

```bash
pnpm install --frozen-lockfile
pnpm run test:auth                 # core + email + app (66)
pnpm --filter server test -- better-auth.guard.spec.ts
pnpm --filter app exec vitest run src/lib/auth-client.test.ts \
  src/pages/auth/use-require-active-workspace.test.tsx
# E2E (built app, not dev — dev-server cold transforms are flaky):
pnpm --filter app exec vite build
pnpm --filter app exec vite preview --port 3000 &   # baseURL is :3000
pnpm --filter app exec playwright test tests/e2e/auth-*.spec.ts
```

> ⚠️ Note: `vite dev` 로 E2E 를 돌리면 cold on-demand transform 의 간헐 500 으로
> spec 이 위양성 실패한다. CI 와 동일하게 **빌드 후 preview** 로 실행해야 유효하다.
