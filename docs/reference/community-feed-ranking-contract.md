# 커뮤니티 피드 랭킹 계약 (Feed Ranking Contract)

> 목적: 저장소에 **이미 존재하는** 커뮤니티 피드/게시물 랭킹 capability를 재사용 기준으로 고정하고,
> 부모 이슈(BBR-606) 범위에서 실제로 남은 delta만 분리한다.
> 정적 코드 리뷰(`rg`/직접 Read) 결과이며 프로덕션 코드를 변경하지 않는다.

조사 기준: `origin/main` = `cb5f95e`. 모든 `파일:line` 인용은 이 커밋 기준.
관련 in-review 작업: 부모 BBR-606 / PR #110 (feed/all·feed/popular 차단 필터 배선).

---

## 1. 엔드포인트 ↔ 코드 경로

| 엔드포인트 | 컨트롤러 | 서비스 메서드 | 인증 | 페이지네이션 | 기본 sort |
|---|---|---|---|---|---|
| `GET /api/community/feed/all` | `community.controller.ts:922` `feedAll` | `CommunityFeedService.getAllFeed` (`community-feed.service.ts:50`) → `getFeed` (`:106`) | 공개 | **offset** (`page`/`limit`) | `hot` (컨트롤러 기본값 `:938`) |
| `GET /api/community/feed/popular` | `community.controller.ts:946` `feedPopular` | `CommunityFeedService.getPopularFeed` (`:61`) | 공개 | 없음 (단일 `limit`) | 고정 `voteScore desc` (sort 파라미터 없음, `:100`) |
| `GET /api/community/feed/home` | `community.controller.ts:962` `feedHome` (`BetterAuthGuard`) | `getHomeFeed(userId)` (`:29`) → `getFeed` (`:106`) | 인증 | **offset** (`page`/`limit`) | `hot` (`:980`) |
| `GET /api/community/posts` | `community.controller.ts:480` `postList` (`@OptionalUser`) | `CommunityPostService.findAll` (`community-post.service.ts:158`) | 공개(+선택 인증) | **cursor (keyset)** | `new` (`DEFAULT_POST_SORT`, `post-list-options.ts`) |

핵심: **`feed/*` 3종은 `CommunityFeedService` 한 줄기**(offset 페이지네이션), **`posts`는 별개의 `CommunityPostService`**(keyset 커서)이다.
같은 sort 이름을 쓰지만 **두 줄기의 정렬식·동반 조건·페이지네이션이 다르다** (§3).
`postList`는 응답을 `toPublicPostListItem`으로 매핑해 `{items,nextCursor,viewer}` 형태로 반환(`controller:529`)하며, `getFeed`/`getPopularFeed`의 원시 봉투와 다르다.

---

## 2. 공통 필터 (status / 등급 / 차단)

| 필터 | feed (`getFeed`) | popular (`getPopularFeed`) | posts (`findAll`) |
|---|---|---|---|
| `status = published` | ✅ (`:115`) | ✅ (`:90`) | ✅ (`:162`) |
| 콘텐츠 등급(`allowedRatings`, 기본 `["general","sensitive"]`) | ✅ (`:110`,`:117`) | ✅ (`:86`,`:92`) | ❌ **없음** |
| 차단 유저 제외(`blockedUserIds`, 양방향) | 서비스 지원(`:118`). **`feed/home`만 배선**(`controller:986`); `feed/all`(`:943`)·`feed/popular`(`:959`) **미배선** | 서비스 지원(`:93`), **컨트롤러 미배선**(`:959`) | ✅ 배선됨 — `@OptionalUser` 로그인 시 `getBlockedUserIds`→`findAll`(`controller:517,526`; service `:166`) |

> 차단 필터 gap은 이제 **`feed/all`·`feed/popular`만** 남았고, 둘 다 부모 BBR-606 / PR #110에서 처리 중. `posts` 목록은 이미 main에 배선 완료.

---

## 3. sort 별 정렬식 · 시간 창 · tiebreaker (feed vs posts)

`hot/new/top/rising/controversial` 이름은 동일하나 동작이 다르다.

| sort | feed `getFeed` (`community-feed.service.ts`) | posts `findAll`→`applySort` (`community-post.service.ts:304`) | 동일? |
|---|---|---|---|
| `hot` | `desc(hotScore)` 단일 컬럼 (`:154`) | `desc(hotScore), desc(lastActivityAt), desc(id)` (`:306`) | 1차 동일, **tiebreaker 다름** |
| `new` | `desc(createdAt)` (`:174` default) | `desc(createdAt), desc(id)` (`:330`) | 사실상 동일(+id 안정화) |
| `top` | `desc(voteScore)` (`:157`) | `desc(voteScore), desc(createdAt), desc(id)` (`:312`) | 1차 동일, tiebreaker 다름 |
| `rising` | **velocity** `voteScore / EXTRACT(EPOCH FROM (NOW()-createdAt))` (`:160`) **+ 강제 24h 창**(`:137`) | `desc(lastActivityAt), desc(commentCount), desc(id)` (`:318`) — **창 없음, velocity 없음** | ❌ **의미 자체가 다름** |
| `controversial` | `(up+down) * LEAST(up/down, down/up)` 균형 가중(`:167`) | `desc(LEAST(up,down)), desc(commentCount), desc(id)` (`:324`) | ❌ **공식 다름** |

### 시간 창(timeFilter)
- feed `getFeed`: `timeFilter`(`hour/day/week/month/year/all`) → `gte(createdAt, now-Δ)` 조건 합성(`:122-134`). `rising`은 `timeFilter`와 **무관하게 항상 24h 강제**(`:136-141`).
- popular: `timeFilter` 창(기본 `day`)으로 `gte(createdAt, startDate)`(`:62-84`).
- posts `findAll`: **timeFilter 미지원** (시간 창 조건이 없음).

### 페이지네이션 계약
- feed `getFeed`: offset = `(page-1)*limit`(`:109`). 반환 `total = items.length`(**현재 페이지 크기일 뿐 전체 카운트 아님**, `:186`), `hasMore = items.length === limit`(`:189`).
- posts `findAll`: keyset. `limit+1` 조회 후 lookahead(`:200`). 커서는 sort별 tuple(`hotScore,lastActivityAt,id` 등)을 인코딩(`buildCursorCondition :284`). `payload.sort !== sort`이면 커서 무시.

### hotScore 산식
- `calculateHotScore`(`community-post.service.ts:761`): Reddit식 `sign*log10(max(|score|,1)) + seconds/45000`. 생성 시 `voteScore=0`으로 저장(`:144`), `updateHotScores()` 배치 재계산 존재(`:772`).

---

## 4. already covered / needs delta

### ✅ already covered (REUSE — 재구현 금지)
- 4개 엔드포인트 모두 등록·동작하며 5종 sort 키 모두 양 줄기에 존재.
- feed = offset 봉투(`{items,total,page,limit,hasMore}`), posts = keyset 커서(안정 정렬+id tiebreaker)로 각자 완결.
- `published` status 게이트, feed/popular의 콘텐츠 등급 게이트, hotScore 산식+배치 재계산.
- 차단 필터: `feed/home` + `posts` 목록은 배선 완료(양방향 차단 제외).

### ⚠️ needs delta (후속 구현 이슈 후보)
1. **동명 sort, 상이 의미** — 특히 `rising`/`controversial`는 feed↔posts 공식이 완전히 다르고, `hot`/`top`은 tiebreaker가 다르다. 제품 결정 필요: (a) 단일 랭킹 모듈로 통일 vs (b) "탐색 피드"와 "커뮤니티 내 목록"을 의도적으로 다른 surface로 고정·문서화.
2. **posts `rising`이 사실상 "최근 활동순"** — 시간 창·velocity 없음(`applySort :318`). Reddit식 rising을 원하면 실제 delta.
3. **feed `total`이 전체 카운트가 아님** (`:186`) — 페이지 크기와 동일. 총개수/마지막 페이지 UI는 `hasMore` 추정에만 의존. 진짜 카운트가 필요하면 `count()` 쿼리 delta.
4. **차단 필터 미배선: `feed/all`·`feed/popular`** (`controller:943,959`) — 부모 BBR-606 / PR #110에서 처리 중. (posts 목록은 이미 covered.)
5. **posts `findAll`에 콘텐츠 등급 필터 부재** — feed에는 있고 posts에는 없음(`findAll` 조건 `:162,166`만). 노출 정책 일관화가 필요하면 delta.
6. **`popular` 응답이 bare array** (`:103`) — 다른 피드의 봉투(`{items,...}`)와 형태 불일치. 클라이언트 계약 일관화 시 delta.
7. **feed offset 페이지네이션의 deep-page drift** — 쓰기 중 중복/누락 가능. posts의 keyset 대비 약함. feed에 안정 페이지네이션이 필요하면 delta.

> 우선순위 제안: (4)는 이미 부모에서 진행 중. (2)(3)(5)는 사용자 체감 버그/노출정책에 가깝고, (1)은 범위 결정이 선행되어야 (6)(7)이 정렬된다.
