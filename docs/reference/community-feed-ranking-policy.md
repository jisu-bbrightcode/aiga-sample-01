# 커뮤니티 피드 랭킹 정책 (PB-COMM-FEED-RANKING-API-001 / BBR-606)

커뮤니티 피드의 정렬 기준·시간 창과, 모든 피드/정렬에 동일하게 적용되는
차단/숨김/신고/필터 상태 정책을 한 곳에 고정한다. 구현은
`packages/features/community/service/community-feed.service.ts`,
노출은 `community.controller.ts`의 `feed/*` 엔드포인트다.

## 피드 종류 (scope)

| 엔드포인트 | 인증 | 범위 |
|-----------|------|------|
| `GET /community/feed/all` | 공개(Optional) | 모든 `type=public` 커뮤니티의 게시글 |
| `GET /community/feed/popular` | 공개(Optional) | 시간 창 내 `voteScore` 상위 게시글 |
| `GET /community/feed/home` | 인증 필수 | 로그인 사용자가 가입한 커뮤니티의 게시글 |
| `GET /community/posts` | 공개(Optional) | 단일 커뮤니티/검색 목록 (cursor) |

공개 피드는 비로그인 사용자도 탐색 가능하다. 로그인 사용자에게는 차단 필터가
추가로 적용된다(아래 AC#2).

## 정렬 방식 (sort) — 기준과 시간 창

기본 정렬은 피드 종류별로 다르다: `feed/all`·`feed/home`은 `hot`,
`POST /community/posts` 목록은 `new`. 사용 가능한 정렬은 다음 5종이다.

| sort | 기준(랭킹 키) | 시간 창 |
|------|--------------|---------|
| `new` | `createdAt DESC` (최신순) | `timeFilter` 따름 (기본 제한 없음, `all`) |
| `hot` | `hotScore DESC` — 점수와 경과 시간을 함께 반영한 사전 계산 컬럼 | `timeFilter` 따름 (기본 `day`) |
| `top` | `voteScore DESC` — 순추천수(up − down) | `timeFilter` 따름 (예: `day`/`week`/`month`/`year`/`all`) |
| `rising` | `voteScore / 경과초(EPOCH) DESC` — 단위 시간당 추천 속도 | **항상 최근 24시간** (timeFilter와 무관하게 강제) |
| `controversial` | `(up+down) × min(up/down, down/up) DESC` — 찬반이 팽팽할수록 상위 | `timeFilter` 따름 |

### 시간 창(timeFilter) 정의

`timeFilter` 값은 `createdAt >= now - 창` 조건으로 환산된다.

| timeFilter | 창 |
|-----------|----|
| `hour` | 1시간 |
| `day` | 24시간 |
| `week` | 7일 |
| `month` | 30일 |
| `year` | 365일 |
| `all` | 제한 없음 |

- `rising`은 시간 민감 정렬이므로 `timeFilter` 값과 무관하게 항상 최근 24시간으로
  좁혀진다(과거 게시글이 분모를 키워 순위를 왜곡하는 것을 방지).
- `feed/popular`은 `timeFilter` 창 내에서 `voteScore` 상위만 반환한다(기본 `day`).

## AC#2 — 차단/숨김/신고/필터 상태의 일관 적용

아래 상태 필터는 **모든 피드 종류와 모든 정렬에 동일하게** 적용된다. 정렬 키만
바뀔 뿐, 후보 집합을 만드는 WHERE 조건은 공통이다.

1. **숨김/제거/삭제 (status)** — 게시글 `status='published'`만 후보에 포함한다.
   모더레이터가 제거(`removed`)하거나 작성자가 삭제(`deleted`)했거나 숨김
   상태인 게시글은 정렬 종류와 무관하게 모든 피드에서 빠진다.
2. **신고 (report)** — 신고 자체는 노출을 바꾸지 않는다. 신고가 모더레이션으로
   이어져 게시글이 `removed`로 전이되면 (1)의 status 조건에 의해 자동 제외된다.
   즉 "신고 상태"는 status를 통해 단일 경로로 반영되며 피드 정렬에 중복 분기가
   생기지 않는다.
3. **차단 (block, 양방향)** — 로그인 사용자가 있는 모든 피드 요청에서
   `blockService.getBlockedUserIds(user.id)`로 차단 집합을 조회하고
   `authorId NOT IN (차단 집합)`을 적용한다. `feed/all`·`feed/popular`(공개,
   Optional 인증)·`feed/home`(인증)·`GET /community/posts` 모두 동일하다.
   비로그인 요청은 차단 집합이 없으므로 이 조건이 생략된다.
4. **콘텐츠 등급 필터 (content rating)** — `allowedRatings` 기본값은
   `["general", "sensitive"]`이며, `nsfw`/`violence`는 기본 제외된다. 모든 피드
   정렬에 동일하게 적용된다.

키워드/금지어 필터(`CommunityKeywordFilterService`)는 게시글 **작성 시점**의
검증이며, 차단 콘텐츠는 애초에 `published` 상태가 되지 않으므로 피드 읽기 경로의
status 조건으로 자연히 반영된다(읽기 시 별도 재검사 없음).

## 응답 계약

- `feed/all`·`feed/home`: `{ items, total, page, limit, hasMore }` 페이지네이션 봉투.
- `feed/popular`: 게시글 배열(상위 N). 페이지네이션 없음.
- 모더레이션 내부 필드는 공개 응답에 포함되지 않는다(기존 매퍼 계약 유지).
