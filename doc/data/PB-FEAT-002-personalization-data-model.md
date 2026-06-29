# PB-FEAT-002 (BBR-732) — 개인화 데이터 모델

FR-002 개인화(저장/관심/검색 히스토리) data model. Decision: **NEW** · MVP.

세 개의 **소유자 스코프(owner-scoped)** 테이블을 정의한다: `saved_item`(저장),
`interest`(관심), `search_history`(검색 히스토리). 세 테이블 모두 better-auth
`users`를 참조하며, 저장/관심은 서비스 도메인 카탈로그(PB-DATA-001: 의사/병원)를
다형(polymorphic)으로 가리킨다.

## Schema location

- `packages/drizzle/src/schema/features/personalization/`
  - `enums.ts` — `personalization_target_type` (`doctor` | `hospital`)
  - `saved-item.ts` — `saved_item`
  - `interest.ts` — `interest`
  - `search-history.ts` — `search_history`
  - `index.ts` — barrel (registered in `schema/index.ts`)
- Migration: `packages/drizzle/migrations/0053_personalization.sql` (journal idx 53,
  appended after the latest base migration). Idempotent, hand-authored to match the
  repo migration pattern.

## ERD

```
                 ┌──────────────┐
                 │    users     │  (core/better-auth, id: text)
                 └──────┬───────┘
        ┌───────────────┼───────────────┐
        │ user_id       │ user_id       │ user_id
        │ (cascade)     │ (cascade)     │ (cascade)
   ┌────▼─────┐   ┌─────▼────┐   ┌──────▼────────┐
   │saved_item│   │ interest │   │search_history │
   └────┬─────┘   └────┬─────┘   └───────────────┘
        │ (target_type, target_id)  ── polymorphic, no hard FK ──┐
        └───────────────┬──────────────────────────────────────┘
                        ▼
            service_doctors / service_hospitals   (PB-DATA-001 catalog)
```

`target_type` + `target_id` is a polymorphic pointer (a save/interest can target
either a 의사 or a 병원). It is intentionally **not** a DB foreign key — a single
column cannot reference two tables. Cleanup of dangling targets is the
service/catalog layer's responsibility.

## Resource / field map

### `saved_item` — 저장
| field         | type                          | notes |
|---------------|-------------------------------|-------|
| id            | uuid PK                       | |
| created_at    | timestamptz NOT NULL          | |
| updated_at    | timestamptz NOT NULL          | memo/tags 편집 가능 → updated_at 유지 |
| user_id       | text NOT NULL → users.id      | ON DELETE cascade |
| target_type   | personalization_target_type   | doctor \| hospital |
| target_id     | uuid NOT NULL                 | polymorphic target |
| memo          | text (nullable)               | 사용자 메모(옵션) |
| tags          | text[] (nullable)             | 사용자 태그(옵션) |

### `interest` — 관심
| field         | type                          | notes |
|---------------|-------------------------------|-------|
| id            | uuid PK                       | |
| user_id       | text NOT NULL → users.id      | ON DELETE cascade |
| target_type   | personalization_target_type   | doctor \| hospital |
| target_id     | uuid NOT NULL                 | polymorphic target |
| created_at    | timestamptz NOT NULL          | append-only (no updated_at) |

### `search_history` — 검색 히스토리
| field         | type                          | notes |
|---------------|-------------------------------|-------|
| id            | uuid PK                       | |
| user_id       | text NOT NULL → users.id      | ON DELETE cascade |
| query         | varchar(500) NOT NULL         | 검색어(필터 전용 검색 시 빈 문자열 허용) |
| filters       | jsonb (nullable)              | 적용 필터 스냅샷(지역/진료과/정렬 등) |
| created_at    | timestamptz NOT NULL          | append-only, 반복 허용 |

## Indexes

| index                            | table          | columns                              | purpose |
|----------------------------------|----------------|--------------------------------------|---------|
| uq_saved_item_owner_target       | saved_item     | (user_id, target_type, target_id)    | 중복 저장 방지 |
| idx_saved_item_user_created      | saved_item     | (user_id, created_at)                | 사용자별 저장 목록 최근순 + user_id 조회 |
| uq_interest_owner_target         | interest       | (user_id, target_type, target_id)    | 중복 관심 방지 |
| idx_interest_user_created        | interest       | (user_id, created_at)                | 사용자별 관심 목록 최근순 + user_id 조회 |
| idx_search_history_user_created  | search_history | (user_id, created_at)                | 사용자별 검색 히스토리 최근순 + user_id 조회 |

모든 테이블의 인덱스는 `user_id`를 선두로 하여 "모든 테이블 user_id 인덱스"
요구를 만족한다. `search_history`는 같은 검색의 반복을 허용하므로 unique 제약이
없다.

## 로그인 게이트 (비로그인 레코드 없음)

`user_id`가 모든 테이블에서 `NOT NULL`이므로 비로그인 레코드는 **데이터 계층에서**
생성될 수 없다. 화면/API의 로그인 게이트가 1차 방어선이고, 이 NOT NULL 제약이
백스톱이다.

## 다운스트림 (이 PR 범위 밖)

- API(apps/server): saved/interest 토글·목록, search_history 기록·조회 엔드포인트.
- 화면(apps/app): 저장/관심 버튼, 마이페이지 목록, 검색 히스토리 노출.
- Admin: —, AI: ⏸DEFER (이슈 스펙 기준).
