# 커뮤니티 데이터/정책 모델 (PB-COMM-DATA-001 / BBR-586)

> Decision: **EXTEND** — product-builder-base의 검증된 community capability를 재사용하고,
> 고객(AIGA)/AC 요구의 누락 델타만 구현한다.
>
> Source of truth: product-builder-base community schema (`packages/drizzle/src/schema/features/community/index.ts`,
> migration `0000`) + Flotter community 참조. 본 task는 데이터/정책 모델만 다룬다.
> CRUD/멤버십/모더레이션 **API**는 별도 EXTEND task(PB-COMM-API-*)로 분리된다.

## 1. 모델 개요

커뮤니티 도메인은 두 패키지 영역에 걸쳐 모델링되어 있다.

| 영역 | 위치 | 비고 |
|------|------|------|
| 커뮤니티 핵심 | `schema/features/community/index.ts` | base 재사용 (migration `0000`) |
| 모더레이션 정책 델타 | `schema/features/community/moderation-policy.ts` | **본 task 신규** (migration `0055`) |
| 폴리모픽 댓글 | `schema/features/comment/index.ts` | base 재사용 |
| 폴리모픽 리액션 | `schema/features/reaction/index.ts` | base 재사용 |

### 1.1 base에서 재사용하는 테이블 (REUSE)

| 테이블 | 역할 | Deliverable 충족 |
|--------|------|------------------|
| `community_communities` | 커뮤니티(타입/통계/automod 설정/배너워드) | community schema |
| `community_memberships` | 멤버십·역할·밴/뮤트·tier·온보딩 | membership schema |
| `community_moderators` | 모더레이터 권한 매트릭스 | moderator schema |
| `community_posts` | 게시글(text/link/image/video/poll, 상태/통계/`hot_score`) | post / feed ranking |
| `community_comments` | 댓글(트리/distinguished/`is_hidden`) | comment schema |
| `community_votes` | 업/다운보트(폴리모픽 target) | 투표 |
| `community_rules` / `community_flairs` | 규칙 / flair | rule·flair |
| `community_reports` | 신고(확장형 target_type, 심각도/해결) | report model |
| `community_bans` | 커뮤니티 단위 밴 | block(global) |
| `community_user_blocks` | 사용자→사용자 차단(per-user) | block(user) |
| `community_sanctions` / `community_appeals` | 단계적 제재 / 이의신청 | sanction·appeal model |
| `community_mod_logs` | 모더레이션 감사 로그 | moderation audit |
| `community_user_karma` | 게시글/댓글 karma 집계 | karma model |
| `community_saved_posts` | 게시글 저장 | — |

### 1.2 본 task가 추가하는 델타 (EXTEND, migration `0055`)

AC#3("작성자 차단, **콘텐츠 숨김, 필터 결과**가 사용자별/전역 정책으로 구분된다")가
base만으로는 충족되지 않아 다음 3개 테이블 + 5개 enum을 추가한다.

| 테이블 | 역할 | 정책 스코프 |
|--------|------|-------------|
| `community_hidden_contents` | 사용자가 자기 피드에서 게시글/댓글을 숨김 | **per-user** |
| `community_content_filters` | 키워드/정규식/도메인 필터 정책 | `scope = user \| global` |
| `community_filter_matches` | 필터 적용 결과(매치) 기록 | 결과마다 `scope` 보존 |

신규 enum: `community_policy_scope(user,global)`,
`community_hidden_content_target_type(post,comment)`,
`community_content_filter_match_type(keyword,regex,domain)`,
`community_content_filter_action(hide,flag,review)`,
`community_content_filter_target_type(post,comment)`.

## 2. 정책 스코프 모델 — per-user vs global

세 가지 모더레이션 표면 모두 **사용자별 / 전역** 두 축으로 구분된다.

| 표면 | per-user (사용자 정책) | global (운영자/커뮤니티 정책) |
|------|------------------------|-------------------------------|
| **작성자 차단** | `community_user_blocks` (blocker→blocked) | `community_bans` (커뮤니티 단위 밴) |
| **콘텐츠 숨김** | `community_hidden_contents` (본 task 신규) | `community_posts.status = hidden/removed`, `community_comments.is_removed` (모더레이터 조치) |
| **필터** | `community_content_filters` `scope='user'` (owner_id 지정) | `community_content_filters` `scope='global'` (community_id 지정) |
| **필터 결과** | `community_filter_matches` `scope='user'` + `affected_user_id` | `community_filter_matches` `scope='global'` |

`community_content_filters` 스코프 불변식(서비스/API 계층에서 강제, 스키마 주석에 명시):

- `scope='user'` → `owner_id` 지정, `community_id`는 선택(null = 사용자가 속한 모든 커뮤니티)
- `scope='global'` → `owner_id` null, `community_id` 지정(해당 커뮤니티 운영 정책)

## 3. Acceptance Criteria 매핑

### AC#1 — 사용자 생성 콘텐츠와 운영자 조치 이력이 분리되어 저장된다

- UGC: `community_posts`, `community_comments`, `community_votes`, `comment_comments`, `reaction_reactions`.
- 운영자/자동화 조치 이력: `community_mod_logs`(모더레이터 행위), `community_sanctions`/`community_appeals`(제재·이의), `community_reports`(신고 처리), `community_filter_matches`(필터 결과).
- 두 계층은 별도 테이블로 저장되며, UGC 행에는 운영 조치 결과를 직접 덮어쓰지 않는다(상태 플래그만 참조).

### AC#2 — 신고 대상은 게시글/댓글/작성자 등 확장 가능한 target model을 가진다

- `community_reports.target_type` = `community_report_target_type(post, comment, user)` + `target_id`.
- 폴리모픽 `(target_type, target_id)` 구조라 향후 대상 유형 추가는 enum 라벨 추가만으로 확장된다(테이블 구조 변경 불필요).

### AC#3 — 작성자 차단, 콘텐츠 숨김, 필터 결과가 사용자별/전역 정책으로 구분된다

- 위 **2장** 표 참조. base에 없던 per-user 콘텐츠 숨김(`community_hidden_contents`)과
  스코프 1급 필터(`community_content_filters.scope`) + 스코프 보존 필터 결과(`community_filter_matches.scope`)를 추가하여 충족.

### AC#4 — REUSE/N/A 결정이면 SKIP 사유와 참조 링크를 남긴다

본 task는 EXTEND. SKIP 처리한 항목과 사유:

| 항목 | 결정 | 사유 / 참조 |
|------|------|-------------|
| community/membership/moderator/post/comment/vote/rule/flair/report/ban/sanction/appeal/modlog/karma 스키마 | **REUSE** | product-builder-base `0000`에서 이미 모델링·마이그레이션됨. `schema/features/community/index.ts` |
| poll 스키마 | **REUSE** | `community_post_type`에 `poll` 포함 + `communityPosts.poll_data`(jsonb: options/multipleChoice/expiresAt)로 모델링됨. per-option 집계는 `poll_data.options[].voteCount` 사용. 전용 투표표는 현 범위 밖(필요 시 별도 task). |
| feed ranking | **REUSE** | `communityPosts.hot_score`(doublePrecision) + 정렬 인덱스(`idx_posts_community_status_hot_activity_id` 등)로 모델링됨. 랭킹 계산은 API/배치 task. |
| 커뮤니티 CRUD / 멤버십 / 게시글·댓글 CRUD / 리액션 / 모더레이션 **API** | **분리(별도 EXTEND task)** | 본 task는 데이터/정책 모델 한정. API는 PB-COMM-API-* 계열에서 EXTEND. |

## 4. UGC 안전 요구(App Store / Google Play) 매핑

사용자 생성 콘텐츠 커뮤니티는 Apple App Store(Guideline 1.2)·Google Play UGC 정책을 준수해야 한다.
요구 항목별 데이터 모델 근거:

| 요구 | 모델 근거 |
|------|-----------|
| 불쾌한 콘텐츠 신고 수단 | `community_reports` (+심각도/해결/`first_response_at`) |
| 악성 사용자 차단 수단 | `community_user_blocks`(per-user), `community_bans`(global) |
| 불쾌한 콘텐츠 필터링 수단 | `community_content_filters`(per-user 개인 필터 + global 운영 필터), `community_hidden_contents`(사용자 숨김) |
| 위반 콘텐츠/사용자 조치 및 추적 | `community_mod_logs`, `community_sanctions`/`community_appeals`, `community_filter_matches` |

## 5. 검증

- `pnpm --filter @repo/drizzle check-types` → 0 errors.
- Ephemeral PostgreSQL 16에서 전체 마이그레이션 체인(`0000`–`0055`) 적용 성공.
- `0055` 재실행 idempotent(모든 객체 `IF NOT EXISTS` / `duplicate_object` 가드) 확인.
- 기능 스모크: global/user 필터 + per-user 숨김 + 스코프 보존 필터 결과 INSERT 후 `scope`별 집계 분리 확인.
