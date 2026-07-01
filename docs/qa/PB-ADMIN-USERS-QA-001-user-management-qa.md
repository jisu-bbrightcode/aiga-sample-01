# 사용자 관리 QA 리포트 — PB-ADMIN-USERS-QA-001 / BBR-691

Product Builder build: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b` · Blueprint: 온라인 서비스
Decision: **EXTEND** · Capability: `admin.users.qa` · 검증 기준: `origin/main` `5f4f8cb`

## 요약

관리자 사용자 관리(`/admin/users`) 표면의 목록/역할/상태 변경, 권한 게이팅, 감사 로그를
단위·가드 스펙으로 검증했다. 서비스·가드 base 스펙은 이미 main에 존재하여 **REUSE**,
누락되어 있던 **컨트롤러 배선 회귀 스펙**과 **재사용 체크리스트**를 이 작업에서 추가했다.

- 추가: `packages/features/_common/controller/admin-users.controller.spec.ts` (6 tests)
- 추가: `tests/admin/user-management-checklist.md` (재사용 체크리스트, EXTEND 대상 경로)
- 마이그레이션: 없음 (프로덕션 코드 무변경, QA 회귀 스펙 + 문서만)

## 검증 결과 (그린 증거)

| 스위트 | 스펙 | tests |
|--------|------|-------|
| 목록 매핑/필터/정렬 + 상태 변경 | `_common/service/admin-users.service.spec.ts` | ✓ |
| 역할 변경 + 보호 규칙 | `_common/service/admin-role.service.spec.ts` | ✓ |
| 감사 기록 | `_common/service/admin-audit.service.spec.ts` | ✓ |
| 목록 쿼리 정규화 | `_common/service/user-list-query.spec.ts` | ✓ |
| **컨트롤러 배선(신규)** | `_common/controller/admin-users.controller.spec.ts` | ✓ 6 |
| 인증 가드 | `apps/server/src/auth/better-auth.guard.spec.ts` | ✓ |
| 정지 사용자 가드 | `apps/server/src/auth/suspended-user.guard.spec.ts` | ✓ |

실행 집계: `packages/features` `jest _common` → **5 suites / 31 tests green**,
`apps/server` guard 스펙 → **2 suites / 12 tests green**. 합계 **7 suites / 43 tests green**.

## AC 커버리지

### AC#1 — 사용자 관리 CRUD/상태 변경이 각각 검증되어 있다

- **목록(read)**: 사용자 매핑(RBAC role + org access role + total), 필터(status/accessRole),
  정렬(sort/order), 빈 결과 단락 — `admin-users.service.spec` + `user-list-query.spec`.
- **역할 변경(update-role)**: 승격/강등 + 멤버십 갱신 + 감사, no-op 감사, self/owner 거부,
  잘못된 role 400 — `admin-role.service.spec` + 컨트롤러 스펙.
- **상태 변경(activate/suspend)**: `is_active` 영속 + 감사, no-op 감사, self/owner 거부,
  비-boolean 400 — `admin-users.service.spec` + 컨트롤러 스펙.
- **컨트롤러 배선**: list/changeRole/changeStatus가 검증된 입력을 정확한 서비스로 전달하고,
  잘못된 body는 서비스 호출 전 400 — 신규 컨트롤러 스펙.

### AC#2 — 비관리자 접근과 권한 없는 관리자 작업이 차단된다

- **컨트롤러 가드 배선(신규 검증)**: `AdminUsersController`가 `BetterAuthGuard` →
  `BetterAuthAdminGuard`로 게이트됨을 `GUARDS_METADATA` 리플렉션으로 단언 → 익명·비관리자
  진입 불가. (기존에는 가드가 격리 단위로만 테스트됐고, 컨트롤러가 실제로 가드를 적용하는지
  단언하는 스펙이 없었음 — 이 작업의 핵심 델타.)
- **권한 없는 관리자 작업 차단**: self 변경 거부, owner 대상 변경 거부, 조직 멤버십 없는 actor
  forbid, 타 조직 target 404 — role/status 서비스 스펙.
- **정지 사용자 강제**: `SuspendedUserGuard`가 `is_active=false` 계정을 보호 액션·결제·커뮤니티
  경로에서 403 — `suspended-user.guard.spec`.

## 감사 로그 증거

`AdminAuditService`가 role 변경(`user.role_changed`)·status 변경(`user.status_changed`)을
`admin_audit_log`에 before/after + reason + actor + ip/UA와 함께 기록하며, no-op 변경도
감사 로우를 남긴다(변경 없음도 추적). role/status 서비스 스펙에서 감사 로우 기록을 단언.

## 잔여 리스크

1. **미머지 의존성 (주요 리스크)**: 이슈 의존성 중 `READ(상세)`·`CREATE(초대)`·
   `UPDATE(프로필 수정)`·`DELETE(보관)`은 QA 시점에 main에 미머지(각 in_review PR).
   main 컨트롤러는 `list/role/status`만 노출한다. 초대/수정/상세/보관 경로의 전체 CRUD
   E2E는 해당 PR 머지 후 재검증 필요. 머지되면 `tests/admin/user-management-checklist.md`의
   관련 항목을 재실행할 것.
2. **라이브 E2E 미수행**: 단위 + 가드 스펙(모킹 Drizzle, Postgres 불필요) 범위. 실제 Neon +
   Vercel 배포에서의 브라우저 E2E(관리자 로그인 → 목록 → role/status 변경 → 감사 확인)는
   배포 환경 접근이 필요하여 DEFER. PB-FILE-QA / PB-NOTI-EMAIL-QA와 동일한 인프라 위임 패턴.
3. **감사 로그 UI 노출**: 감사 로우는 기록되나, 관리자 콘솔에서 사용자별 감사 이력을 열람하는
   UI는 이 표면에 없음(admin 감사 뷰는 별도 표면). AC 외.

## 재실행

```bash
# packages/features
./node_modules/.bin/jest _common
# apps/server
./node_modules/.bin/jest src/auth/suspended-user.guard.spec.ts src/auth/better-auth.guard.spec.ts
```
