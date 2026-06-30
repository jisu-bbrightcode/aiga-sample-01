# 커뮤니티 댓글 운영(ops) 액션 정책 — Contract

> PB-COMM-COMMENT-OPS-API-001 / BBR-604
> 단일 출처(SoT): `packages/features/community/service/comment-ops-policy.ts`

커뮤니티 댓글의 모더레이션 운영 액션(remove / sticky / distinguish), 대댓글 depth
제한, 목록 정렬 정책의 계약을 고정한다. 본 문서는 OpenAPI 설명과 서비스 구현이
참조하는 contract 다.

## 1. 운영 엔드포인트

모두 `BetterAuthGuard` 인증 필요. 권한은 대상 커뮤니티의 `owner / admin / moderator`.

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/community/comments/:id/remove` | 댓글 제거(tombstone). body `{ reason }` 필수 | 모더레이터 |
| POST | `/community/comments/:id/sticky` | 댓글 고정 설정/토글. body `{ sticky? }` (생략 시 토글) | 모더레이터 |
| POST | `/community/comments/:id/distinguish` | 모더레이터 표시 설정/토글. body `{ distinguished? }` (`null`=해제, 생략 시 토글) | 모더레이터 + **자신의 댓글** |

### 상태 반영 (AC#1)

- `remove` → `isRemoved=true`, `removalReason`, `removedBy` 기록. 목록에서는 본문이
  `[운영자에 의해 삭제된 댓글입니다]` 로 마스킹되지만 행은 tombstone 으로 유지된다
  (스레드 구조·댓글 수 일관성). `removalReason`/`removedBy` 는 공개 projection 에서
  제외된다.
- `sticky` → `isStickied` 토글. 고정 댓글은 목록 정렬상 항상 상단에 노출된다(§3).
- `distinguish` → `distinguished` (`moderator`|`admin`|`null`) 토글.

`isStickied` / `distinguished` / `isRemoved` 는 공개 댓글 목록 projection
(`comment-visibility.ts`)에 노출되어 클라이언트와 관리자 화면이 동일한 상태를 본다.

## 2. 감사 로그 (AC#1 — 관리자 큐 반영)

모든 운영 액션은 `community_mod_logs` 에 append-only 로 기록되어 관리자 모드로그
큐에 일관되게 반영된다.

| 액션 | `action` | `targetType` | `details.kind` |
|------|----------|--------------|----------------|
| remove | `remove_comment` | `comment` | `remove_comment` |
| sticky on/off | `other` | `comment` | `sticky_comment` / `unsticky_comment` |
| distinguish on/off | `other` | `comment` | `distinguish_comment` / `undistinguish_comment` |

`targetId` = 댓글 ID, `reason` = remove 사유. 로그는 수정/삭제하지 않는다(audit trail).

## 3. 대댓글 depth 제한 (AC#2)

- `MAX_COMMENT_DEPTH = 5` (0-indexed). 최상위 댓글 depth 0, 답글마다 +1.
- 스레드는 총 `MAX_COMMENT_DEPTH + 1 = 6` 단계까지 중첩 가능하다.
- depth 가 한도를 초과하는 답글 작성은 `400 Bad Request` 로 거부된다.
- 자식 depth = `부모 depth + 1` (순수 함수 `resolveReplyDepth`).

## 4. 정렬 계약 (AC#2)

목록(`GET /community/posts/:id/comments`)의 정렬 키:

```
isStickied DESC, createdAt (sort=new ? DESC : ASC), id (tie-breaker)
```

- 고정 댓글(`isStickied=true`)을 항상 상단에 배치한다.
- 그 안에서 `sort=new` 면 최신순(DESC), 기본 `old` 면 오래된 순(ASC).
- Cursor 페이지네이션은 동일한 `(isStickied, createdAt, id)` 3-튜플을 비교하므로
  고정-우선 정렬이 페이지 경계를 넘어도 일관된다. (cursor value 는
  `encodeCommentSortKey` 로 `"<1|0>:<ISO8601>"` 형식으로 packing 된다. 플래그
  접두사가 없는 과거 cursor 는 `stickied=false` 로 안전하게 해석한다.)
