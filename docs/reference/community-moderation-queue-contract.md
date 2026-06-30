# Community Moderation Queue Contract (BBR-620)

`GET /admin/community/moderation` — 관리자 통합 모더레이션 큐.

PB-COMM-MODERATION-API-LIST-001. 관리자가 **신고 / 필터 후보 / 숨김 후보 / 차단** 이력과
처리 상태를 한 화면에서 검색·필터·페이지네이션으로 추적할 수 있게 한다.

## 권한 (AC#1)

- `CommunityAdminController` (`@Controller("admin/community")`) 전체가
  `@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)` 로 보호된다 → **관리자만** 조회 가능.
- 이 엔드포인트는 cross-community(전역) 조회다. 커뮤니티별 모더레이터 전용 조회는
  기존 `GET /community/moderation/...` 경로가 담당한다(별도 권한 게이트).

## 통합 소스 (AC#2)

큐는 세 개의 일급 모더레이션 테이블을 하나의 정규화 항목으로 모은다:

| `kind`   | 소스 테이블              | 의미                                            |
| -------- | ------------------------ | ----------------------------------------------- |
| `report` | `community_reports`      | 신고                                            |
| `filter` | `community_filter_logs`  | 자동 필터 — `blocked`(차단) + `hidden_for_review`(숨김 후보) |
| `ban`    | `community_bans`         | 사용자 차단                                     |

> 숨김(`숨김`)은 자동 필터의 `hidden_for_review` 액션으로 표현된다. 사용자별 뮤트
> (`community_hidden_content`)는 모더레이션 액션이 아니므로 큐에서 제외한다.

## 쿼리 파라미터

| 파라미터      | 타입                          | 기본 | 설명                                         |
| ------------- | ----------------------------- | ---- | -------------------------------------------- |
| `page`        | number                        | 1    | 페이지(1-base)                               |
| `limit`       | number                        | 20   | 페이지 크기(최대 100)                        |
| `kind`        | `report\|filter\|ban`         | –    | 출처 종류 필터(생략 시 전체)                 |
| `state`       | `open\|resolved`              | –    | 정규화된 처리 상태 필터                      |
| `communityId` | string(uuid)                  | –    | 특정 커뮤니티로 스코프                       |
| `search`      | string                        | –    | 사유/설명 부분일치(ILIKE)                    |

## 정규화 항목

```jsonc
{
  "kind": "report",          // report | filter | ban
  "id": "…",                 // 소스 레코드 ID
  "communityId": "…",
  "targetType": "post",      // post | comment | user | null
  "targetId": "…",
  "subjectId": "…",          // 신고자 | 작성자 | 차단 실행자
  "state": "open",           // 정규화 상태: open | resolved
  "status": "pending",       // 원본 소스 상태값(아래 매핑)
  "severity": "high",        // 신고 전용, 그 외 null
  "reason": "…",
  "ruleType": "keyword",     // 필터 전용, 그 외 null
  "action": "hidden_for_review", // 필터 전용(blocked|hidden_for_review), 그 외 null
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

각 항목은 **정규화된 `state`** (cross-source open/resolved)와 **원본 `status`** 를
함께 담아, 단일 처리-상태 축으로 필터하면서도 정확한 소스 상태를 잃지 않는다.

### state ← status 매핑

| kind     | open                  | resolved                       |
| -------- | --------------------- | ------------------------------ |
| `report` | `pending`, `reviewing` | `resolved`, `dismissed`        |
| `filter` | `pending`             | `approved`, `rejected`         |
| `ban`    | `active`              | `expired`                      |

차단의 `active`/`expired` 는 `is_permanent` / `expires_at` 으로 파생한다(영구 또는
만료 없음/미래 만료 → active). 필터링은 DB `NOW()` 로 평가한다.

응답 봉투: `{ items, total, page, limit, totalPages }`.

## 페이지네이션 모델

세 소스를 독립 쿼리한 뒤 앱 레벨에서 병합·정렬한다:

1. 각 소스에서 `page * limit`(= offset+limit)개를 `created_at` 내림차순으로 가져온다.
   이는 전역 상위 `page*limit`에 들어갈 수 있는 모든 행의 상위집합이다.
2. 병합 후 `created_at` 내림차순(+id tiebreak) 정렬.
3. `[offset, offset+limit)` 윈도우를 잘라 요청 페이지를 정확히 만든다.
4. `total` = 동일 필터를 적용한 소스별 count 합.

운영용 어드민 도구 기준의 합리적 트레이드오프 — 매우 깊은 페이지에서는 소스별 과다
조회가 발생할 수 있으나, 일반적으로 `kind` 필터로 단일 소스에 한정해 사용한다.

## 검증

- 순수 단위: `service/moderation-queue.spec.ts` (정규화/상태파생/병합/슬라이스, DB 불필요).
- DB 통합: `service/community-moderation-queue.service.spec.ts` (집계/kind·state 필터/검색/페이지/스코프).
