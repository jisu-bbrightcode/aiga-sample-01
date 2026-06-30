# 커뮤니티 댓글 삭제/숨김/복구 정책 (BBR-602)

`community.comment.api.delete` capability. 게시글(`community-post-deletion-policy.md`)과
동일한 경계를 댓글에 적용한다. 댓글은 **물리 삭제하지 않고** 상태 플래그(soft
delete/archive)로만 처리하여 대댓글·신고·알림·감사 로그를 보존한다(AC#1).

## 상태값 구분 (AC#2: 관리자 숨김과 작성자 삭제가 상태값으로 구분된다)

댓글은 단일 enum 대신 boolean 플래그로 상태를 표현한다
(`community_comments`, `packages/drizzle/src/schema/features/community/index.ts`).
`service/comment-deletion-policy.ts` 의 `deriveCommentModerationStatus` 가 우선순위에
따라 하나의 파생 상태로 환원한다(우선순위: 작성자 삭제 > 운영자 제거 > 필터 숨김 > 공개).

| 파생 상태 | 플래그       | 의미                     | 설정 주체           | 진입 endpoint                          | 복구 가능 |
| --------- | ------------ | ------------------------ | ------------------- | -------------------------------------- | --------- |
| `visible` | (없음)       | 공개                     | -                   | -                                      | -         |
| `deleted` | `is_deleted` | **작성자 삭제**          | 작성자(또는 모더)   | `DELETE /community/comments/:id`       | ✗         |
| `removed` | `is_removed` | **관리자 제거**          | 모더레이터          | `POST /community/comments/:id/remove`  | ✓         |
| `hidden`  | `is_hidden`  | **숨김** (자동 키워드필터) | 자동필터            | 생성/수정 시 키워드 필터 트리거         | ✓         |

- **작성자 삭제(`is_deleted`)** 와 **관리자 제거(`is_removed`)** 는 서로 다른 플래그로
  명확히 구분된다. `is_removed` 는 `removed_by` / `removal_reason` 를 기록한다.
- 본문 마스킹은 **저장 시점이 아니라 read 시점**(`comment-visibility.ts`
  `resolveCommentContent`)에 적용한다 → 원본 본문을 보존하므로 복구가 가능하고,
  새로 추가되는 컬럼도 기본적으로 공개 projection 에서 제외된다(fail-closed).

## 카운트 일관성 (AC#1: 삭제 후 게시글 댓글 수가 일관된다)

- **작성자 삭제(`delete`)** 만 `community_posts.comment_count` 를 1 감소시킨다.
- `delete()` 는 **멱등** — 이미 `is_deleted` 인 댓글에 재호출해도 카운트를 다시 줄이지
  않는다(중복 호출로 카운트가 음수로 어긋나지 않음).
- 관리자 제거(`remove`)/복구(`restore`)는 게시글 댓글 수를 변경하지 않는다(게시글
  `remove`/`restore` 와 동일한 모델). 목록(`findByPost`)의 `totalCount` 는 tombstone 을
  포함한 독립 지표이며, denormalized `comment_count` 와는 별개로 일관성을 유지한다.

## 복구 정책 (deliverable: 복구 정책)

`POST /community/comments/:id/restore` (모더레이터 권한: owner/admin/moderator)

- **복구 대상**: 모더레이션 제거(`is_removed`) / 필터 숨김(`is_hidden`) 만 공개로 되돌린다.
- **복구 불가**: 작성자 삭제(`is_deleted`)는 작성자 본인 의사이므로 모더레이터가 복구하지
  않는다 → `409 Conflict`. 이미 공개 상태도 복구 대상이 아니다.
- 복구 시 `is_removed`/`is_hidden`/`removed_by`/`removal_reason` 를 비운다. 원본 본문은
  보존되어 그대로 다시 노출된다.
- 순수 판정 로직: `service/comment-deletion-policy.ts` (`canRestoreComment`).

## 보존 정책 (AC#1: 대댓글/신고/알림/감사 로그 보존)

댓글 행을 물리 삭제하지 않으므로 댓글에 연결된 데이터가 함께 삭제되지 않는다.

- **대댓글(`parent_id`)** / **신고(`community_reports`, `target_type="comment"`)**: 댓글 행이
  유지되므로 그대로 보존되고 복구 시 다시 노출된다.
- **감사 로그(`community_mod_logs`)**: append-only. 모더레이터의 제거(`remove_comment`)·
  복구(`other` + `details.kind="comment_restored"`) 액션을 `target_type="comment"` 로
  댓글과 독립적으로 기록한다(`target_id` 는 FK 가 아닌 text). `moderator_id` / `reason` /
  `created_at` 로 누가/왜/언제를 추적한다.

## 엔드포인트 요약

| Method/Path                            | 권한        | 동작                                         |
| -------------------------------------- | ----------- | -------------------------------------------- |
| `DELETE /community/comments/:id`       | 작성자/모더 | soft delete → `is_deleted`, 카운트 감소(멱등) |
| `POST /community/comments/:id/remove`  | 모더레이터  | → `is_removed` + 사유, 감사 로그              |
| `POST /community/comments/:id/restore` | 모더레이터  | `is_removed`/`is_hidden` → 공개, 감사 로그    |
