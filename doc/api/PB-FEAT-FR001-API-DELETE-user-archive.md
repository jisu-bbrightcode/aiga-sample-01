# PB-FEAT-FR001-API-DELETE — 사용자 삭제/archive API (BBR-530)

- Capability: `domain.feature.fr-001.api.delete`
- Decision: **NEW / EXTEND** (Backend Engineer)
- Depends on: PB-FEAT-FR001-API-READ (BBR-527, `@repo/features/user-directory`, main)
- Target: `packages/features/user-directory` (wired into `apps/server`)

## 결정값과 근거

FR-001 "사용자" 삭제/archive는 BBR-526/527이 만든 `@repo/features/user-directory`를 **EXTEND**한다.
물리 삭제 대신 **soft delete(archive)** 로 구현한다: `profiles.deleted_at`을 찍고 `is_active=false`로
내려 공개/앱 노출에서 차단하되, 레코드 자체와 연결 데이터(결제/이력/감사 등)는 그대로 보존해
**복구 가능**하게 둔다. 신원(소셜 로그인)·프로필(`profiles`)·등급(`user_grades`)은 REUSE한다.

마이그레이션은 없다 — `profiles.deleted_at`/`is_active` 컬럼과 `admin_audit_log` 테이블은 모두 main에
존재한다 → 번호 경합 없음.

## 실행 산출물

`@repo/features/user-directory`에 추가/변경:

```
service/user-directory.service.ts        # + archiveUser / restoreUser (soft delete + 감사 로그)
controller/user-directory-admin.controller.ts  # + DELETE /admin/users/:id, POST /admin/users/:id/restore
dto/requests.dto.ts                      # + ArchiveUserBodyDto (감사 reason)
user-directory.module.ts                 # + AdminAuditService provider (self-contained append-only writer)
service/user-directory.service.spec.ts   # +6 tests (archive/restore: 성공/멱등/404)
```

## 엔드포인트

| 메서드 | 경로 | 가드 | 동작 |
|--------|------|------|------|
| `DELETE` | `/admin/users/:id` | BetterAuthGuard + AdminGuard | soft delete(archive): `deleted_at=now`, `is_active=false` |
| `POST` | `/admin/users/:id/restore` | BetterAuthGuard + AdminGuard | 복구: `deleted_at=null`, `is_active=true` |

- 본문(선택): `{ "reason"?: string(≤500) }` — 감사 로그에 기록되는 운영자 메모. (DELETE/restore 공용)
- 응답: `200` + `AdminUserDto` (갱신된 관리자 뷰, `deletedAt`/`isActive` 포함).
- 두 엔드포인트 모두 **멱등**: 이미 archive된 사용자를 다시 DELETE 하거나 archive되지 않은 사용자를
  restore 하면 추가 쓰기·감사 없이 현재 상태를 그대로 반환한다.

## 노출 정책 (AC#1 — 삭제/archive 후 공개/앱/관리자 노출)

archive는 새로운 노출 규칙을 만들지 않고, BBR-526/527이 이미 세운 `deleted_at`/`is_active` 가시성
계약을 그대로 트리거한다:

| 표면 | archive된 사용자 노출 |
|------|----------------------|
| 공개 목록 `GET /users` | 제외 (`is_active ∧ deleted_at IS NULL ∧ handle IS NOT NULL`) |
| 공개 상세 `GET /users/:handle` | **404** (`deleted_at` → 존재 자체를 숨김; 본인만 200) |
| 본인 `GET /users/me` | 본인은 자기 레코드 조회 가능 |
| 관리자 목록 `GET /admin/users` | 기본 제외, `includeDeleted=true`로만 조회 |
| 관리자 상세 `GET /admin/users/:id` | 조회 가능 (운영자는 보관 상태 확인/복구) |

복구(restore) 후에는 `deleted_at=null ∧ is_active=true`가 되어 공개/앱 노출이 즉시 재개된다.

## 연결 데이터 보존 (AC#2 — 결제/이력/감사 보존)

- **파괴적 삭제 없음**: `profiles` 행을 DELETE 하지 않고 플래그만 갱신한다. 결제(`payment_*`)·
  이력·감사(`admin_audit_log` 등) 연결 데이터는 FK cascade 없이 그대로 남아 복구·정산·감사 추적이
  유지된다.
- **감사 추적 추가**: archive/restore 자체를 privileged 운영 작업으로 보고 `admin_audit_log`에
  append-only 한 줄을 남긴다 (`action=user.archived`/`user.restored`, `targetType=user`,
  `targetId`, `payloadBefore/After`={isActive, deletedAt}, actor/ip/user-agent/reason).
  `AdminAuditService`는 `_common`의 append-only writer를 그대로 사용하되, 모듈 결합 없이
  `UserDirectoryModule` provider 로 직접 주입한다.

## OpenAPI 동기화 (AC#3)

NestJS Swagger 데코레이터가 단일 소스다. `DELETE /admin/users/:id` · `POST /admin/users/:id/restore`에
`200`(`AdminUserDto`)/`401`/`403`/`404`를 명시했다. 본문은 `ArchiveUserBodyDto`(zod `createZodDto`)로
전역 `ZodValidationPipe`가 검증한다(과도한 reason → 400).

## REUSE/SKIP 메모 (AC#4)

- 신원(인증 사용자) 자체의 삭제/탈퇴 흐름은 better-auth 책임 영역으로 본 task 범위 밖이다. FR-001의
  삭제 단위는 **서비스 프로필(`profiles`)의 보관/복구**이며, 그것을 NEW로 구현했다.
- 결제/이력 데이터의 별도 보존 로직은 **이미 보존이 기본값**(soft delete가 연결 데이터를 건드리지 않음)
  이므로 추가 구현 없이 보장된다.

## 검증

- jest 29 tests (archive/restore 성공·멱등·404 6개 신규 포함) — green
- `tsc --noEmit`(user-directory scope) — 0 errors
- biome check — clean
- 마이그레이션 없음 → 스키마 변경/경합 없음
