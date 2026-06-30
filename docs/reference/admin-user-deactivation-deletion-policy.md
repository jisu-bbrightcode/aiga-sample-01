# 관리자 사용자 비활성/삭제 정책 (PB-ADMIN-USERS-DELETE-001 / BBR-690)

관리자(apps/admin)에서 사용자 계정을 처리할 때의 **되돌릴 수 있는/없는 작업 구분**,
**데이터 보존**, **세션·권한 정리**, **감사 로그** 규칙을 정의한다.

## 1. 작업 종류와 가역성 (AC: 되돌릴 수 있는/없는 작업 구분)

| 작업 | 가역성 | 효과 | 데이터 | 세션 | API |
|------|--------|------|--------|------|-----|
| **정지 (deactivate)** | ✅ 되돌릴 수 있음 | `profiles.isActive=false`. 활성화로 즉시 복원 | 보존 | **해제** | `PATCH /api/admin/users/:id/status {isActive:false}` |
| **활성화 (reactivate)** | ✅ | `isActive=true` | 보존 | 복원하지 않음(재로그인) | `PATCH .../status {isActive:true}` |
| **보관 (archive / soft-delete)** | ✅ 되돌릴 수 있음 | `deletedAt` 기록 + `isActive=false`. 공개/앱 노출 차단 | 보존(물리 삭제 X) | **해제** | `DELETE /api/admin/users/:id` |
| **복구 (restore)** | ✅ | `deletedAt=null` + `isActive=true` | — | 복원하지 않음(재로그인) | `POST /api/admin/users/:id/restore` |
| **영구 삭제 (hard delete)** | ❌ 되돌릴 수 없음 | — | — | — | **제공하지 않음** |

### 영구 삭제를 제공하지 않는 이유 (데이터 보존 정책)

물리 삭제는 결제·이력·감사 등 연결 데이터와의 정합성을 깨고, 잘못 실행 시 복구할 수
없다. 따라서 이 시스템의 "삭제"는 **항상 soft-delete(보관)** 이며, 행은 지우지 않고
플래그(`deletedAt`)로 노출만 차단한다. 법적 파기/익명화가 필요하면 별도의 일괄
파기 절차(배치)로 분리하며, 관리자 화면의 즉시 액션으로는 노출하지 않는다.

관리자 UI는 정지·보관을 **"되돌릴 수 있는 작업"** 으로 명시하고, 영구 삭제는
제공하지 않음을 안내해 가역/비가역 작업을 명확히 구분한다.

## 2. 세션·권한 정리 (AC: 계정 처리 후 세션·권한 상태 일관 정리)

- **정지/보관 시**: `SessionRevocationService.revokeAllForUser(userId)` 가 해당
  사용자의 모든 `sessions` 행을 삭제한다. 열려 있던 세션으로 비활성/보관된 계정이
  계속 활동하는 것을 막는다. 해제된 세션 수는 감사 로그 `payloadAfter.revokedSessions`
  에 기록한다.
- **활성화/복구 시**: 세션을 **복원하지 않는다.** 사용자는 다시 로그인해야 하며,
  로그인 시점에 (재활성화된) 계정 상태를 다시 검증받는다. 이 단방향 규칙이 세션
  정리를 일관되게 만든다.
- **권한(역할)**: 정지/보관은 역할(`members`, `user_roles`)을 삭제하지 않는다 —
  복구 가능성을 위해 보존한다. 권한의 실효성은 세션 해제 + `isActive=false` 로
  보장된다(비활성 계정은 재로그인하지 못함).

## 3. 감사 로그

모든 처리는 `admin_audit_log` 에 행위자(actor)·사유·전후 스냅샷과 함께 한 행씩 남는다.

| 작업 | action | payloadAfter 주요 필드 |
|------|--------|------------------------|
| 정지/활성화 | `user.status_changed` | `isActive`, `revokedSessions` |
| 보관 | `user.archived` | `isActive:false`, `deletedAt`, `revokedSessions` |
| 복구 | `user.restored` | `isActive:true`, `deletedAt:null` |

## 4. 보호 규칙

- 자기 자신의 계정 상태는 변경할 수 없다(정지).
- 소유자(owner) 계정은 정지·보관할 수 없다(관리자 UI에서도 차단).
- 보관은 위험도가 있어 관리자 UI에서 2단계 확인을 거친다.
