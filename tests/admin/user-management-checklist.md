# 사용자 관리 QA 재사용 체크리스트 (admin.users.qa)

PB-ADMIN-USERS-QA-001 / BBR-691. 관리자 사용자 관리(`/admin/users`) 기능의 CRUD·상태
변경·권한·감사 로그를 검증하기 위한 재사용 가능한 QA 체크리스트.

Decision: **EXTEND** — base capability(서비스/가드/감사 스펙)는 이미 main에 존재하며, 이
체크리스트와 컨트롤러 배선 회귀 스펙(`packages/features/_common/controller/admin-users.controller.spec.ts`)
이 누락 델타를 채운다.

## 대상 표면 (main 기준)

| 엔드포인트 | 동작 | 가드 |
|-----------|------|------|
| `GET /admin/users` | 목록/검색/필터(status·accessRole)/정렬 | `BetterAuthGuard` + `BetterAuthAdminGuard` |
| `PATCH /admin/users/:id/role` | 접근 역할 변경 (admin/member), 감사 기록 | 동일 |
| `PATCH /admin/users/:id/status` | 계정 활성/정지, 감사 기록 | 동일 |

정지 강제는 `SuspendedUserGuard`(`profiles.is_active=false` → 403)가 보호 액션·결제·커뮤니티
경로에서 담당한다.

## AC#1 — CRUD/상태 변경 각각 검증

- [ ] **목록(read)**: 사용자 매핑(RBAC role + org access role + total)이 정확하다.
- [ ] **목록 필터/정렬**: `status`/`accessRole` 필터와 `sort`/`order`가 매핑을 깨지 않는다.
- [ ] **빈 결과**: 매칭 사용자가 없으면 role 조회 없이 빈 목록을 반환한다.
- [ ] **역할 변경**: member→admin 승격 시 멤버십 갱신 + 감사 로우 기록.
- [ ] **역할 no-op**: 동일 역할 재지정은 DB 업데이트 없이 감사만 남긴다.
- [ ] **상태 변경**: 계정 정지 시 `is_active=false` 영속 + 감사 로우 기록.
- [ ] **상태 no-op**: 이미 활성 계정 재활성화는 DB 업데이트 없이 감사만 남긴다.
- [ ] **입력 검증**: 잘못된 role / 비-boolean isActive는 서비스 호출 전 400.

## AC#2 — 비관리자/권한 없는 관리자 작업 차단

- [ ] 컨트롤러가 `BetterAuthGuard` → `BetterAuthAdminGuard` 순으로 게이트된다(익명·비관리자 진입 불가).
- [ ] 본인 역할/상태 변경 거부(self-change reject).
- [ ] owner 계정 역할/상태 변경 거부.
- [ ] actor가 조직 멤버십이 없으면 forbid.
- [ ] target이 actor 조직 멤버가 아니면 404.
- [ ] 정지된 사용자(`is_active=false`)는 보호 액션에서 `SuspendedUserGuard`로 403.

## 감사 로그 증거

- [ ] role 변경 → `admin_audit_log` `user.role_changed` (before/after + reason + actor + ip/UA).
- [ ] status 변경 → `admin_audit_log` `user.status_changed` (before/after + reason).
- [ ] no-op 액션도 감사 로우가 남는다(변경 없음도 추적).

## 자동화 스펙 매핑

| 항목 | 스펙 |
|------|------|
| 목록 매핑/필터/정렬 | `packages/features/_common/service/admin-users.service.spec.ts`, `user-list-query.spec.ts` |
| 상태 변경/보호 규칙 | `admin-users.service.spec.ts` (setActive) |
| 역할 변경/보호 규칙 | `admin-role.service.spec.ts` |
| 감사 기록 | `admin-audit.service.spec.ts` |
| 가드 로직 | `apps/server/src/auth/better-auth.guard.spec.ts`, `suspended-user.guard.spec.ts` |
| 컨트롤러 배선(가드+forwarding+검증) | `packages/features/_common/controller/admin-users.controller.spec.ts` |

## 실행

```bash
# 서비스/컨트롤러 (packages/features)
./node_modules/.bin/jest _common

# 가드 (apps/server)
./node_modules/.bin/jest src/auth/suspended-user.guard.spec.ts src/auth/better-auth.guard.spec.ts
```

## 잔여 리스크 (미머지 의존성)

이슈 의존성 중 **READ(상세)·CREATE(초대)·UPDATE(프로필 수정)·DELETE(보관)** 는 이 QA 시점에
main에 미머지(각각 in_review PR). 따라서 전체 CRUD의 초대/수정/상세/보관 경로는 main에서 E2E
검증 불가하며, 해당 PR 머지 후 이 체크리스트의 관련 항목을 재실행해야 한다. 상세는
`docs/qa/PB-ADMIN-USERS-QA-001-user-management-qa.md` 참조.
