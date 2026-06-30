# 커뮤니티 게시글 삭제/숨김/복구 정책 (BBR-598)

`community.post.api.delete` capability. 게시글은 **물리 삭제하지 않고** 상태값(soft
delete/archive)으로만 처리하여 댓글·신고·감사 로그를 보존한다.

## 상태값 구분 (AC: 관리자 숨김과 작성자 삭제가 상태값으로 구분된다)

`community_post_status` enum (`packages/drizzle/src/schema/features/community/index.ts`):

| status      | 의미                       | 설정 주체            | 진입 endpoint                       | 복구 가능 |
| ----------- | -------------------------- | -------------------- | ----------------------------------- | --------- |
| `published` | 공개                       | -                    | -                                   | -         |
| `draft`     | 임시저장                   | 작성자               | 생성                                | N/A       |
| `deleted`   | **작성자 삭제**            | 작성자(또는 모더)    | `DELETE /community/posts/:id`       | ✗         |
| `hidden`    | **숨김** (자동필터/모더)   | 모더레이터/자동필터  | 자동필터 / `Put` 필터 트리거        | ✓         |
| `removed`   | **관리자 제거**            | 모더레이터           | `POST /community/posts/:id/remove`  | ✓         |

- **작성자 삭제(`deleted`)** 와 **관리자 숨김/제거(`hidden`/`removed`)** 는 서로 다른
  status 값으로 명확히 구분된다. `removed` 는 `removed_by` / `removal_reason` 를 기록한다.
- 공개 목록(`findAll`)은 `published` 만 노출하므로 위 비공개 상태는 자동으로 가려진다.
  관리자 목록(`adminFindAll`)은 전 상태를 조회할 수 있다.

## 복구 정책 (AC: 복구 가능 상태)

`POST /community/posts/:id/restore` (모더레이터 권한: owner/admin/moderator)

- **복구 대상**: 모더레이션 숨김 상태(`hidden`, `removed`)만 `published` 로 되돌린다.
- **복구 불가**: 작성자 삭제(`deleted`)는 작성자 본인 의사이므로 모더레이터가 복구하지
  않는다 → `409 Conflict`. `draft`/`published` 도 복구 대상이 아니다.
- 복구 시 `removed_by` / `removal_reason` 를 비우고 게시글을 다시 공개한다.
- 순수 판정 로직: `service/post-deletion-policy.ts` (`canRestore`).

## 보존 정책 (AC: 댓글/신고/감사 로그 보존)

게시글 행을 물리 삭제하지 않으므로 게시글에 `onDelete: cascade` 로 연결된 데이터가
함께 삭제되지 않는다.

- **댓글(`community_comments`)** / **신고(`community_reports`)**: 게시글 행이 유지되므로
  cascade 가 발동하지 않아 그대로 보존된다. 복구 시 다시 노출된다.
- **감사 로그(`community_mod_logs`)**: append-only. 모더레이터의 제거(`remove_post`)·
  복구(`other` + `details.kind="post_restored"`) 액션을 게시글과 독립적으로 기록하므로
  게시글 상태가 바뀌어도(또는 추후 물리 삭제되어도 — `target_id` 는 FK 가 아닌 text)
  남는다. `moderator_id` / `reason` / `created_at` 로 누가/왜/언제를 추적한다.

## 엔드포인트 요약

| Method/Path                          | 권한        | 동작                                      |
| ------------------------------------ | ----------- | ----------------------------------------- |
| `DELETE /community/posts/:id`        | 작성자/모더 | soft delete → `deleted`, 내용 마스킹      |
| `POST /community/posts/:id/remove`   | 모더레이터  | → `removed` + 사유, 감사 로그             |
| `POST /community/posts/:id/restore`  | 모더레이터  | `hidden`/`removed` → `published`, 감사 로그 |
