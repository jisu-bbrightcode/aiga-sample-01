# 커뮤니티 보관(Archive)·복구(Restore)·보존(Retention) 정책

> PB-COMM-SPACE-API-DELETE-001 (BBR-590). 커뮤니티 도메인 `community.space.api.delete` capability.
> EXTEND: 기존 커뮤니티 기능(`packages/features/community`)의 하드 삭제 경로를 보관/복구로 대체한다.

## 1. 원칙 — 실제 삭제 대신 보관

커뮤니티는 **하드 삭제하지 않는다.** 소유자/관리자의 "삭제" 요청은 커뮤니티 행을
`status='archived'` 로 전환하는 **보관(archive)** 으로 처리된다. 게시글·댓글·멤버십·
신고·감사 이력 등 모든 하위 콘텐츠는 그대로 **보존**되며, 보관은 언제든 **복구(restore)**
할 수 있다.

이렇게 함으로써 "커뮤니티 삭제"와 "콘텐츠/신고/감사 이력 보존"의 생명주기가 분리된다
(AC#2). 커뮤니티의 공개 여부(보관 상태)는 바뀌어도, 그 안의 데이터는 독립적으로 보존된다.

## 2. 데이터 모델

`community_communities` 테이블 (migration `0055_community_archive`):

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `status` | `community_status` (`active`\|`archived`) | 생명주기 상태. 기본 `active`. |
| `archived_at` | `timestamptz` nullable | 보관 시각. 복구 시 `NULL`. |
| `archived_by` | `text` → `users.id` | 보관을 수행한 사용자(소유자 또는 관리자). |
| `archive_reason` | `text` nullable | 보관 사유(선택). |

인덱스 `idx_communities_status` 로 공개 목록/피드의 `status='active'` 필터를 지원한다.

감사용 enum 값이 `community_mod_action` 에 추가된다: `archive_community`, `restore_community`.

## 3. 보존 정책 (Retention)

보관은 **비파괴적**이다. archive/restore 어느 동작도 다음을 삭제하거나 변경하지 않는다:

- 게시글(`community_posts`) — 상태/내용 그대로 보존
- 댓글(`community_comments`)
- 멤버십(`community_memberships`) — 가입자/역할 보존
- 신고(`community_reports`), 제재(`community_sanctions`), 이의제기(`community_appeals`)
- 감사 이력(`community_mod_logs`)

즉, 보관된 커뮤니티를 복구하면 보관 이전과 동일한 콘텐츠/멤버십/이력이 그대로 노출된다.

> 하드 삭제(물리적 purge)는 본 capability 에서 **제공하지 않는다.** 콘텐츠/신고/감사
> 이력 보존을 보장하기 위함이며, 필요 시 별도의 명시적·감사된 운영 절차로 분리한다.

## 4. 노출 정책 (Visibility) — AC#1

보관 상태에 따른 노출은 다음과 같이 **명확히** 정의된다.

| 표면 | `active` | `archived` |
|------|----------|------------|
| 공개 목록 `GET /community` (`findAll`) | 노출 | **제외** |
| 인기 목록 `GET /community/popular` (`findPopular`) | 노출 | **제외** |
| 내 구독 목록 (`findUserSubscriptions`) | 노출 | **제외** |
| 공개 상세 `GET /community/:slug` (`findBySlugForViewer`) | 노출 | 모더레이터(소유자/관리자/모더레이터)에게만 노출, 그 외 **404** |
| 홈/전체/인기 피드 (`getHomeFeed`/`getAllFeed`/`getPopularFeed`) | 노출 | 해당 커뮤니티 게시물 **제외** |
| 관리자 목록 `GET /admin/community` (`adminFindAll`) | 노출 | **노출**(관리/복구 대상) |

보관된 커뮤니티의 상세는 일반/비로그인 사용자에게 미존재(404)와 구분 불가하게 숨겨지며,
모더레이터에게만 복구를 위해 노출된다.

## 5. 엔드포인트

### 소유자 (BetterAuthGuard)

- `DELETE /community/:slug?reason=...` — 보관(archive). 소유자만. 게시글/댓글/멤버십 보존.
  - `403` 소유자 아님 · `404` 미존재 · `409` 이미 보관됨
- `POST /community/:slug/restore` — 복구. 소유자만.
  - `403` 소유자 아님 · `404` 미존재 · `409` 보관 상태 아님

### 관리자 강제 조치 (BetterAuthAdminGuard)

- `DELETE /admin/community/:id` (body `{ reason? }`) — 관리자 강제 보관(소유 무관).
  - `404` 미존재 · `409` 이미 보관됨
- `POST /admin/community/:id/restore` — 관리자 강제 복구.
  - `404` 미존재 · `409` 보관 상태 아님

## 6. 감사 로그 (Audit)

archive/restore 는 매번 `community_mod_logs` 에 1건을 기록한다.

| 필드 | 값 |
|------|----|
| `action` | `archive_community` / `restore_community` |
| `moderator_id` | 수행자(소유자 또는 관리자) |
| `target_type` / `target_id` | `community` / 커뮤니티 ID |
| `reason` | 보관 사유(있을 때) |

감사 이력은 커뮤니티 보관 여부와 독립적으로 보존된다. (복구해도 archive/restore 이력이 남는다.)

## 7. 테스트

DB 통합 스펙 `packages/features/community/service/community-archive.service.spec.ts`
(ephemeral PostgreSQL 16, migration `0000`–`0055` 적용 후 실행):

- archive/restore 가드(404/403/409)와 상태 전이
- 보관 메타(`archived_at/by`, `archive_reason`) 기록·초기화
- 감사 로그 기록(`archive_community`/`restore_community`)
- 콘텐츠/멤버십 보존(AC#2)
- 목록/상세/피드 노출 정책(AC#1)
- 관리자 강제 보관/복구
