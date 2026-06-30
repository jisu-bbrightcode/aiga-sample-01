# FR-001 사용자 수정/상태 변경 API (BBR-529)

Capability: `domain.feature.fr-001.api.update` · Decision: **NEW** (admin 필드 수정 + 이력), 다수 **REUSE**
Module: `@repo/features/user-directory` (EXTEND — read/list/archive 와 동일 서비스)
Depends on: FEAT-FR-001-API-READ (#44), FEAT-FR-001-API-CREATE

## 범위 결정 (NEW vs REUSE)

FR-001 "사용자" 리소스의 수정/상태 변경/이력은 여러 경로로 나뉘며, base 에 이미 존재하는
기능은 재구현하지 않고 재사용한다(중복 라우트/로직 방지).

| 요구 | 결정 | 구현/참조 |
|------|------|-----------|
| 본인(self) 프로필 수정 (이름/핸들/소개/아바타) | **REUSE** | `@repo/features/_common` `UserProfileController` — `PATCH /user-profile/name\|handle\|bio`, 아바타 업로드. 핸들 규칙 `handleSchema` 공유. |
| **활성/비활성 상태 변경** | **REUSE** | `_common` `AdminUsersController.changeStatus` — `PATCH /admin/users/:id/status`(BBR-684). `profiles.isActive` 토글 + `admin_audit_log`(`user.status_changed`). 자기 자신 변경 금지 가드 포함. |
| 삭제(보관, soft delete) / 복구 | **REUSE** | FR-001 DELETE (BBR-530): `DELETE /admin/users/:id`(archive) + `POST /admin/users/:id/restore`. |
| 변경 이력 조회(전역) | **REUSE** | `GET /admin/audit-logs?targetType=user&targetId=:id` (`admin_audit_log`). |
| **관리자 부분 수정** (이름/핸들/소개/아바타) | **NEW** | `PATCH /admin/users/:id` |
| **사용자별 변경 이력** (편의 엔드포인트) | **NEW (thin)** | `GET /admin/users/:id/history` |

즉, self 수정·상태 변경(active/inactive)·삭제/복구는 이미 충족되어 있으므로, 이 작업의
신규 산출물은 base 에 빈 곳인 **관리자 티어의 (다른 사용자) 부분 수정 + 사용자 단위 변경
이력 조회**다. 상태 모델 전체는 active↔inactive(`_common` status, BBR-684) ·
→deleted(archive) · deleted→active(restore)로 이미 완성되어 있다.

> ⚠️ 충돌 회피: `_common` 과 `user-directory` 두 컨트롤러가 모두 `@Controller("admin/users")`
> 를 쓴다. 본 작업은 `_common` 이 이미 가진 `PATCH :id/status` 를 **재구현하지 않고**
> 비어 있는 `PATCH :id`(필드 수정)·`GET :id/history` 만 추가해 정확히 중복되는 라우트를
> 만들지 않는다.

## 엔드포인트 (NEW)

모두 `BetterAuthGuard` + `BetterAuthAdminGuard` (인증된 관리자 전용).

### `PATCH /admin/users/:id` — 부분 수정

- Body(전부 optional, 부분 업데이트): `name`, `handle`(nullable), `bio`(nullable),
  `avatar`(nullable, URL), `reason`(감사용).
- 허용 필드만 수정한다. `email`/인증수단/등급/활성여부/삭제부기는 이 경로로 바꿀 수 없다.
- nullable 필드는 `null` 로 비울 수 있다. `handle` 은 self 설정과 동일 규칙(소문자/숫자/
  하이픈 + 예약어 차단)을 검증하며, 다른 사용자가 사용 중이면 **409**.
- 응답 200: 갱신된 관리자 뷰(`AdminUserDto`). before/after 스냅샷을 `admin_audit_log`
  (`action=user.updated`)에 기록.
- 오류: 400(변경할 내용 없음/검증 실패) · 401 · 403 · 404 · 409(핸들 중복).

### `GET /admin/users/:id/history` — 변경 이력

- Query: `cursor?`, `limit?`(≤200).
- `admin_audit_log` 에서 `targetType=user, targetId=:id` 인 행을 최신순으로 반환
  (`AdminAuditListResponseDto`). 수정/상태변경/보관/복구가 모두 한 트레일에 모인다.
- 별도 이력 테이블을 만들지 않고 공용 감사 로그를 단일 출처로 재사용한다 → **마이그레이션 없음**.

## 권한 검증 · 일관성

- 모든 쓰기는 관리자 가드 뒤에서만 동작하며 actor 가 감사 로그에 남는다(권한 검증 + 귀속).
- 수정은 `profiles` 행을 직접 갱신하므로, 공개 목록/상세(BBR-526/527)·관리자 목록/상세
  (BBR-526)가 동일 컬럼을 읽어 **즉시 일관**된다.

## 변경 이력(감사) 액션 vocabulary

`user.updated`(신규) · `user.status_changed`(BBR-684) · `user.archived`/`user.restored`(BBR-530).
DB enum 이 아니라 서비스 레이어 문자열 — 새 액션 추가에 마이그레이션 불필요.

## 테스트

`service/user-directory.service.spec.ts` — updateAdminUser(필드 갱신/널 클리어/빈 패치 400/
404/핸들 409), getUserHistory(감사 로그 위임). 기존 read/list/archive/restore 테스트와 함께
user-directory 39개 통과. 마이그레이션 없음.
