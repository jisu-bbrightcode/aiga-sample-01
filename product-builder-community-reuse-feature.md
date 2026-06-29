# Product Builder Community Reuse Feature

## 목적

Product Builder의 `커뮤니티` 선택 feature를 `product-builder-base`에서 재사용 가능한 full-stack capability로 고정한다.

이 문서는 새 기능을 추측해서 만드는 지시서가 아니다. 현재 `product-builder-base`에 이미 있는 커뮤니티 구현을 실제 경로, REST/OpenAPI 계약, 앱 UI, 관리자 UI, 테스트, QA 증거 기준으로 점검하고, Product Builder issue를 `REUSE` 또는 `EXTEND`로 닫을 수 있게 갭을 해소하는 구현 지시서다.

## 기준 repo/ref

- repo: `https://github.com/BBrightcode-atlas/product-builder-base`
- local path: `/Users/bright/Projects/product-builder-base`
- branch checked: `develop`
- current checked ref: `1f120f52`
- Product Builder reuse source format: `product-builder-base:<capability-path>@<tag-or-commit>`

최종 완료 시 `<tag-or-commit>`은 실제 배포/검증된 commit 또는 tag로 갱신한다.

## 현재 확인된 구현 경로

- backend feature module: `packages/features/community`
- REST controller: `packages/features/community/controller/community.controller.ts`
- admin REST controller: `packages/features/community/controller/community-admin.controller.ts`
- services/tests: `packages/features/community/service/*.ts`, `packages/features/community/service/*.spec.ts`
- schema: `packages/drizzle/src/schema/features/community/index.ts`
- app UI: `apps/app/src/features/community`
- admin UI: `apps/admin/src/features/community`
- feature inventory: `docs/features/index.md`
- policy docs: `docs/community/*`

주의: `docs/features/index.md`에는 community module registry가 `tRPC`로 표시된 줄도 있다. 실제 controller는 Nest REST + Swagger decorator가 존재한다. 문서와 실제 registry/API 노출이 맞는지 반드시 확인하고 불일치하면 문서 또는 등록 방식을 수정한다.

## Product Builder task 매핑

Product Builder plugin의 커뮤니티 feature 선택 시 아래 issue들이 실행 대상이어야 한다.

- `PB-COMM-001` 커뮤니티 feature 재사용 범위 확정
- `PB-COMM-DATA-001` 커뮤니티 데이터/정책 모델
- `PB-COMM-SPACE-API-LIST-001` 커뮤니티 목록/상세 API
- `PB-COMM-SPACE-API-CREATE-001` 커뮤니티 생성 API
- `PB-COMM-SPACE-API-UPDATE-001` 커뮤니티 수정/설정 API
- `PB-COMM-SPACE-API-DELETE-001` 커뮤니티 삭제/archive API
- `PB-COMM-MEMBERSHIP-API-001` 커뮤니티 가입/탈퇴/구독 API
- `PB-COMM-MEMBER-API-001` 커뮤니티 멤버/모더레이터 조회 API
- `PB-COMM-MODERATOR-API-001` 커뮤니티 모더레이터 초대/권한 API
- `PB-COMM-POST-API-LIST-001` 게시글 목록/검색 API
- `PB-COMM-POST-API-READ-001` 게시글 상세 API
- `PB-COMM-POST-API-CREATE-001` 게시글 생성 API
- `PB-COMM-POST-API-UPDATE-001` 게시글 수정 API
- `PB-COMM-POST-API-DELETE-001` 게시글 삭제/숨김 API
- `PB-COMM-POST-OPS-API-001` 게시글 pin/lock/remove/crosspost API
- `PB-COMM-COMMENT-API-LIST-001` 댓글 목록 API
- `PB-COMM-COMMENT-API-CREATE-001` 댓글 생성 API
- `PB-COMM-COMMENT-API-UPDATE-001` 댓글 수정 API
- `PB-COMM-COMMENT-API-DELETE-001` 댓글 삭제/숨김 API
- `PB-COMM-COMMENT-OPS-API-001` 댓글 remove/sticky/distinguish API
- `PB-COMM-REACTION-API-LIST-001` 리액션 조회 API
- `PB-COMM-REACTION-API-SET-001` 리액션 생성/변경 API
- `PB-COMM-REACTION-API-DELETE-001` 리액션 삭제 API
- `PB-COMM-POLL-API-001` 투표 API
- `PB-COMM-FEED-RANKING-API-001` 피드 랭킹 API
- `PB-COMM-KARMA-API-001` karma API
- `PB-COMM-REPORT-API-CREATE-001` 콘텐츠/작성자 신고 API
- `PB-COMM-BLOCK-API-CREATE-001` 작성자 차단 API
- `PB-COMM-BLOCK-API-DELETE-001` 작성자 차단 해제 API
- `PB-COMM-HIDE-API-CREATE-001` 콘텐츠 숨김 API
- `PB-COMM-HIDE-API-DELETE-001` 콘텐츠 숨김 해제 API
- `PB-COMM-FILTER-API-001` 정책 필터 API
- `PB-COMM-RULES-FLAIR-API-001` 규칙/flair/금칙어 API
- `PB-COMM-MODERATION-API-LIST-001` 모더레이션 큐 조회 API
- `PB-COMM-MODERATION-API-ACTION-001` 모더레이션 조치 API
- `PB-COMM-SANCTION-APPEAL-API-001` 제재/이의제기 API
- `PB-COMM-TIER-ONBOARDING-API-001` 티어/onboarding API
- `PB-COMM-API-001` REST API 통합 검수
- `PB-COMM-SAFETY-001` 신고/차단/숨김/필터 정책
- `PB-COMM-UI-001` 사용자 UI
- `PB-COMM-ADMIN-001` 신고/모더레이션 관리자
- `PB-COMM-ADMIN-STATS-001` 운영 통계 관리자
- `PB-COMM-QA-001` 가이드라인/모더레이션 QA

## 현재 구현에서 반드시 확인할 갭

### 1. REST route ordering

`community.controller.ts`에서 `@Get(":slug")`가 `@Get("posts")`, `@Get("feed/all")`, `@Get("feed/popular")`, `@Get("feed/home")`, `@Get("moderation/:communityId/...")`보다 먼저 선언되어 있다. Express/Nest 라우팅 순서에서 `/community/posts` 같은 GET 경로가 slug 조회로 먼저 매칭될 수 있다.

필수 조치:

- 정적 GET route를 `@Get(":slug")`보다 먼저 등록하거나 route prefix를 명확히 분리한다.
- `GET /community/posts`, `GET /community/feed/all`, `GET /community/moderation/:communityId/queue`가 slug handler로 가지 않는 regression test를 추가한다.
- Swagger/OpenAPI path 생성 결과와 실제 HTTP smoke 결과를 둘 다 확인한다.

### 2. REST/OpenAPI matrix

다음 항목별로 endpoint, method, auth guard, request DTO, response DTO, error code, 테스트 파일을 표로 남긴다.

- community list/read/create/update/delete
- membership join/leave/myMembership/mySubscriptions/rules accept
- members/moderators/invite/remove/role
- posts list/read/create/update/delete/pin/lock/remove/crosspost
- comments list/create/update/delete/remove/sticky/distinguish
- reactions/votes/polls
- feed home/all/popular/hot/new/top/rising/controversial
- karma get/getBatch
- reports/block/hide/filter
- rules/flair/banned words
- sanction/history/appeal/resolve
- admin list/delete/stats/reports/reportStats/resolveReport/ban/unban

### 3. Product Builder capability registry

Product Builder가 `REUSE`로 닫으려면 문서상 완료가 아니라 아래 식별자가 있어야 한다.

- `product-builder-base:packages/features/community@<ref>`
- `product-builder-base:packages/drizzle/src/schema/features/community@<ref>`
- `product-builder-base:apps/app/src/features/community@<ref>`
- `product-builder-base:apps/admin/src/features/community@<ref>`

필요하면 `docs/features/index.md` 또는 별도 capability registry 문서에 위 경로와 검증 ref를 추가한다.

### 4. 앱/관리자 UI 실제 연결

`apps/app/src/features/community`와 `apps/admin/src/features/community`는 파일이 존재한다. 다음을 실제 실행으로 확인한다.

- route registration이 앱 라우터에 연결되어 있는가
- API client가 현재 REST endpoint와 같은 path를 쓰는가
- 로그인 전 공개 탐색이 가능한가
- 작성/리액션/신고/차단/숨김/가입 같은 보호 액션은 auth modal 또는 로그인 gate로 연결되는가
- 관리자 화면은 admin guard와 실제 API 권한에 맞는가
- 운영 통계, 신고 통계, SLA 초과, 제재/appeal 현황이 화면에서 확인 가능한가

### 5. UGC 정책/스토어 심사 대응

Apple/Google UGC 요구 대응은 최소 아래 증거가 필요하다.

- 사용자가 콘텐츠/작성자를 신고할 수 있다.
- 사용자가 작성자를 차단할 수 있다.
- 사용자가 콘텐츠를 숨길 수 있다.
- 관리자/모더레이터가 신고 큐를 확인하고 조치할 수 있다.
- 금칙어/정책 필터가 게시글/댓글 작성 경로에 적용된다.
- 제재와 이의제기 흐름이 사용자/관리자 화면과 audit log에 남는다.
- 정책 문구와 실제 UI/endpoint가 같은 용어를 사용한다.

## 구현 지시

1. 위 경로를 직접 열어 현재 구현을 확인한다.
2. `docs/features/index.md`의 community 상태와 실제 module/controller 등록 상태가 불일치하면 수정한다.
3. REST route ordering을 먼저 검증하고, 문제가 있으면 controller 순서 또는 route prefix를 고친다.
4. Swagger/OpenAPI 문서에 모든 커뮤니티 endpoint가 누락 없이 들어가는지 확인한다.
5. 서비스 테스트가 있어도 HTTP/controller 테스트가 없으면 핵심 route smoke를 추가한다.
6. 앱/관리자 UI가 REST API와 실제로 연결되는지 확인하고 깨진 hook/API path를 수정한다.
7. Product Builder issue body에 넣을 reuse source map과 검증 evidence를 남긴다.

## 완료 기준

- `pnpm -r typecheck` 통과
- community 관련 unit/controller test 통과
- REST/OpenAPI path matrix 작성
- 앱 community 화면 smoke 통과
- 관리자 community 화면 smoke 통과
- route ordering regression test 통과
- `product-builder-base:<capability-path>@<ref>` reuse source 확정
- 남은 갭은 Product Builder issue에서 `EXTEND`로 추적 가능하게 분리

## 금지

- docs에 완료라고 되어 있다는 이유만으로 `REUSE` 완료 처리하지 말 것
- Flotter reference를 그대로 복붙했다고 가정하지 말 것
- tRPC endpoint를 Product Builder 표준 API로 인정하지 말 것
- Apple/Google UGC 요구를 단순 문구로만 처리하지 말 것
- route smoke 없이 OpenAPI decorator만 보고 완료 처리하지 말 것
