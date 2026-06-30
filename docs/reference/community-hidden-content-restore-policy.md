# 커뮤니티 콘텐츠 숨김 해제·복구 정책 (PB-COMM-HIDE-API-DELETE-001 / BBR-618)

숨김(BBR-617)의 역연산인 **숨김 해제·복구**의 권한·노출·감사 계약을 정의한다.
숨김에는 저장소·권한이 분리된 두 경로가 있으며, 해제 경로도 동일하게 분리된다.

## 두 경로 (숨김과 대칭)

| 경로 | 숨김 저장소 | 해제 엔드포인트 | 권한 | 감사 |
|------|------------|----------------|------|------|
| 사용자별 (per-viewer) | `community_hidden_content` (viewer 소유 행) | `DELETE /community/hidden-content/:id`, `DELETE /community/hidden-content` (본문) | 본인 인증 (owner-scope) | 비공개(개인 시야) → 공유 감사 로그 없음 |
| 전역 (관리자/모더레이터) | `community_posts.status='hidden'` / `community_comments.is_hidden=true` | `POST /community/hidden-content/restore` | 커뮤니티 `owner`/`admin`/`moderator` | `community_mod_logs` append (`전역 숨김 해제: …`) |

## 사용자별 숨김 해제 — `DELETE /community/hidden-content/:id`

- `:id` 는 `community_hidden_content` 레코드 id 다.
- **소유자 스코프**: 본인(`userId`) 소유 레코드만 해제할 수 있다. 타인의 레코드이거나
  존재하지 않는 id 는 정보 누출 없이 **404** 로 처리한다.
- 해제 후 동일 `(targetType, targetId)` 가 `getHiddenPostIds` / `getHiddenCommentIds`
  제외 집합에서 사라져, 목록·상세·댓글·리액션 노출이 일관되게 복구된다 (**AC#1**).
- 응답: `{ success: true, restored: { targetType, targetId } }`.

## 전역 숨김 복구 — `POST /community/hidden-content/restore`

- `hideGlobally` 의 역연산이다.
  - 게시글: `status='hidden'` → `'published'`, `removalReason`/`removedBy` 초기화.
  - 댓글: `is_hidden=true` → `false`, `removalReason`/`removedBy` 초기화.
- 커뮤니티 권한(`owner`/`admin`/`moderator`)을 요구한다. 멤버가 아니거나 일반
  멤버는 **403**.
- 이미 전역 숨김 상태가 아니면(복구 대상 아님) **409**. 삭제된 대상은 **404**.
- 모든 복구는 `community_mod_logs` 에 append 된다 (운영 감사, **감사 로그** 산출물).

## AC#2 — 관리자 전역 숨김은 일반 사용자 API 로 해제할 수 없다

구조적으로 보장된다.

- 전역 숨김은 `community_hidden_content` 가 **아니라** `posts`/`comments` 테이블에
  저장된다. 따라서 전역 숨김된 콘텐츠에는 사용자 숨김 레코드(`:id`)가 존재하지 않아,
  `DELETE /community/hidden-content/:id` 로는 도달조차 할 수 없다.
- 전역 복구는 `POST /community/hidden-content/restore` 하나뿐이며, 커뮤니티 권한
  게이트(`assertCommunityPermission`)를 통과해야 한다. 권한 없는 일반 사용자는 403.

## 검증

- `community-hidden-content.service.spec.ts` (DB-gated): 사용자별 해제(노출 복구·소유권
  404), 전역 복구(post/comment·mod log·권한 403·비숨김 409), 그리고 전역 숨김이
  사용자 레코드를 남기지 않아 사용자 API 로 해제 불가임을 검증한다.
