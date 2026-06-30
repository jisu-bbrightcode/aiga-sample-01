# 사용자 role/status 변경 관리자 (PB-ADMIN-USERS-STATUS-001 / BBR-689)

관리자 계정 상태 변경(역할/정지) 기능과, 정지된 사용자에 대한 보호 기능·결제·커뮤니티
액션 제한 정책을 정리한다. Decision은 `EXTEND` 이며, 이미 머지된 base capability를 재사용하고
누락된 델타(정지 강제)만 신규 구현했다.

## EXTEND / REUSE / 신규 구현 분리

| 항목 | 판정 | 근거 |
|------|------|------|
| 관리자 role 변경 (admin/member) API + UI | **REUSE** | `PATCH /api/admin/users/:id/role` (admin guard, owner/self 보호, 감사 로그) + `apps/admin` `features/users/user-detail-dialog.tsx` 역할 변경 섹션이 이미 main에 존재 (BBR-684/686). |
| 계정 정지/해제 (활성/정지) API + UI | **REUSE** | `PATCH /api/admin/users/:id/status` + 동일 detail dialog의 계정 상태 변경 섹션이 이미 존재. |
| 감사 로그 | **REUSE** | `AdminAuditService` 가 `user.role_changed` / `user.status_changed` 를 `admin_audit_log` 에 기록 (before/after + reason). |
| **정지 사용자 액션 제한 (AC#2)** | **신규 (이 변경)** | 기존에는 `profiles.is_active = false` 로 정지해도 이를 강제하는 가드가 전무했다 → 정지가 기능적으로 무의미했다. `SuspendedUserGuard` 신규 추가. |
| 이메일 인증 상태 보정 | **DEFER** | AC 미포함 soft deliverable. 별도 백엔드 엔드포인트 필요 → 후속 작업으로 분리 권장. |
| 임퍼소네이트 정책 | **DEFER** | 코드베이스에 임퍼소네이션 서브시스템이 전무. 신규 구축은 투기적(speculative)이라 범위 외. 도입 시 별도 feature task로 분리 권장. |

## Acceptance Criteria

### AC#1 — 권한 상승/강등은 허용된 관리자만 수행할 수 있다 (REUSE로 충족)

- `AdminUsersController` 의 role/status 엔드포인트는 `@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)` 로
  조직 owner/admin 만 통과한다.
- `AdminRoleService.changeRole` 은 owner 역할 변경 금지 + 본인 역할 변경 금지 + assignable role(admin/member) 화이트리스트.
- `apps/admin` 전체가 `AdminGuard` 로 게이트되어, 권한 없는 사용자는 콘솔 자체에 진입할 수 없다.

### AC#2 — 정지된 사용자는 보호 기능과 결제/커뮤니티 액션이 제한된다 (이 변경에서 구현)

`SuspendedUserGuard` (`packages/core/nestjs/auth/suspended-user.guard.ts`):

- `BetterAuthGuard` 뒤에서 실행되어 `request.user.id` 로 `profiles.is_active` 를 조회한다.
- 명시적으로 `is_active = false` 인 경우에만 `403 ForbiddenException` 으로 차단한다.
- 프로필 행이 없거나 조회가 실패하면 **fail-open**(정상 사용자 보호) — 일시적 DB 장애로 정상 사용자를
  대량 잠그지 않기 위함.
- 공개(비인증) 라우트는 `BetterAuthGuard` 를 거치지 않으므로 이 가드도 적용되지 않는다 →
  비로그인 탐색은 그대로 유지된다 (워크플로우 규칙 "공개 페이지 비로그인 탐색" 준수).

적용 범위 (인증된 사용자 액션 표면에 `BetterAuthGuard` 와 함께 배선):

- **결제**: `PaymentController`, `InicisOrderPublicController`, `InicisPublicController`(주문/결제 액션).
- **커뮤니티**: `community.controller.ts` 의 모든 인증 사용자 액션(게시글/댓글/투표/리액션/가입·탈퇴/
  차단/신고/모더레이션 등).

> 관리자(admin) 표면(`@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)`)과 공개 읽기 표면은 의도적으로
> 제외했다. owner 계정은 정지 자체가 불가하며(`AdminUsersService.setActive`), 관리자 모더레이션은
> 정지 강제 대상이 아니다.

## 테스트

- `apps/server/src/auth/suspended-user.guard.spec.ts` — 활성 통과 / 정지 403 / 프로필 부재 통과 /
  조회 실패 fail-open / user 부재 거부 (5 cases).
- 기존 `better-auth.guard.spec.ts` 회귀 통과(배럴 export 변경 영향 없음).
